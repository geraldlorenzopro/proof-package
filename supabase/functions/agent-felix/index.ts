import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAccountMembership } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_COST = 5;
const MODEL = "claude-haiku-4-5-20251001";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { case_id, account_id, form_type, language } = await req.json();
    if (!case_id || !account_id || !form_type) {
      return new Response(JSON.stringify({ error: "missing_params" }), { status: 400, headers: corsHeaders });
    }

    // SECURITY FIX 2026-05-10: verificar que el user pertenece al account_id.
    // Sin esto, paralegal de firma A puede pasar account_id de firma B y
    // drenar créditos AI + leer datos de firma B. Audit hallazgo crítico #1.
    const isMember = await verifyAccountMembership(supabaseAdmin, user.id, account_id);
    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: "not_member_of_account" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check credits
    const creditResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/check-credits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      body: JSON.stringify({ account_id, agent_slug: "felix", cost: CREDIT_COST }),
    });
    const creditResult = await creditResp.json();
    if (!creditResult.allowed) {
      return new Response(JSON.stringify({ error: "insufficient_credits", balance: creditResult.balance, needed: CREDIT_COST }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create session
    const { data: session } = await supabaseAdmin.from("ai_agent_sessions").insert({
      account_id, case_id, agent_slug: "felix", triggered_by: user.id,
      status: "running", input_data: { form_type, language },
      model_used: MODEL, credits_used: CREDIT_COST,
    }).select("id").single();

    // Load case data
    const [caseRes, officeRes] = await Promise.all([
      supabaseAdmin.from("client_cases").select("*").eq("id", case_id).single(),
      supabaseAdmin.from("office_config").select("*").eq("account_id", account_id).single(),
    ]);

    const caseData = caseRes.data;
    const officeConfig = officeRes.data;
    if (!caseData) throw new Error("Case not found");

    // Load client profile if exists
    let profileData: any = null;
    if (caseData.client_profile_id) {
      const { data: p } = await supabaseAdmin.from("client_profiles").select("*").eq("id", caseData.client_profile_id).single();
      profileData = p;
    }

    // Load intake if exists
    const { data: intakeData } = await supabaseAdmin.from("intake_sessions").select("*").eq("case_id", case_id).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const lang = language || officeConfig?.preferred_language || "es";
    const firmName = officeConfig?.firm_name || "La firma";

    // Schema esperado por form_type. El frontend mapea estos keys → estructura UI.
    // Si el form_type no está aquí, Felix usa keys descriptivos genéricos.
    const FORM_SCHEMAS: Record<string, { keys: string[]; notes: string }> = {
      "i-765": {
        keys: [
          // Personal
          "lastName", "firstName", "middleName",
          "aNumber", "uscisAccountNumber", "ssn",
          "sex", "maritalStatus", "previouslyFiled",
          "dateOfBirth", "cityOfBirth", "stateOfBirth", "countryOfBirth",
          "countryOfCitizenship1", "countryOfCitizenship2",
          // Mailing address
          "mailingCareOf", "mailingStreet", "mailingApt", "mailingAptType",
          "mailingCity", "mailingState", "mailingZip",
          // Physical
          "sameAddress", "physicalStreet", "physicalApt", "physicalAptType",
          "physicalCity", "physicalState", "physicalZip",
          // Arrival
          "i94Number", "passportNumber", "travelDocNumber",
          "passportCountry", "passportExpiration",
          "lastArrivalDate", "lastArrivalPlace", "statusAtArrival", "currentStatus", "sevisNumber",
          // Eligibility
          "eligibilityCategory", "eligibilityCategorySpecific",
          "h1bReceiptNumber", "c8EverArrested", "i140ReceiptNumber", "c35EverArrested",
          // Reason
          "reasonForApplying",
          // Contact
          "applicantPhone", "applicantMobile", "applicantEmail",
          // Statements
          "applicantCanReadEnglish", "interpreterUsed", "preparerUsed",
        ],
        notes: `eligibilityCategory: usar codes oficiales como "(c)(9)" para pending adjustment, "(a)(5)" para asylee, etc.
reasonForApplying: solo "initial", "replacement" o "renewal".
sex: solo "male" o "female".
maritalStatus: "single", "married", "divorced" o "widowed".
dateOfBirth y passportExpiration: formato YYYY-MM-DD.
sameAddress: boolean true si physical = mailing.`,
      },
    };

    const formSchema = FORM_SCHEMAS[form_type.toLowerCase()] || { keys: [], notes: "" };

    const systemPrompt = `Eres Felix, especialista en formularios de inmigración de Estados Unidos que trabaja para ${firmName}.
Tu trabajo es extraer datos del expediente y mapearlos a los campos del formulario ${form_type}.

ESQUEMA EXACTO DEL FORMULARIO ${form_type.toUpperCase()}:
Usa EXACTAMENTE estos keys en camelCase cuando llenes "field" en el JSON:
${formSchema.keys.length > 0 ? formSchema.keys.join(", ") : "(usar keys descriptivos)"}

REGLAS DE VALORES:
${formSchema.notes || "(sin reglas específicas)"}

REGLAS CRÍTICAS:
- Solo llena campos con datos que EXISTEN en el expediente
- Marca como "[FALTA]" los campos sin datos con status "missing"
- NUNCA inventes ni asumas datos
- Si un campo requiere verificación legal, márcalo como "[VERIFICAR]" con status "verify"
- Eres preciso, rápido, y confiable
- Responde en ${lang === "en" ? "inglés" : "español"}
- Responde SOLO con JSON válido, sin markdown ni backticks`;

    const userPrompt = `Llena el formulario ${form_type} para ${caseData.client_name}.

Datos disponibles del expediente:
${JSON.stringify({
  case: { ...caseData, access_token: undefined },
  profile: profileData,
  intake: intakeData,
  office: { firm_name: firmName, attorney_name: officeConfig?.attorney_name, bar_number: officeConfig?.bar_number, bar_state: officeConfig?.bar_state },
}, null, 2)}

Genera un JSON con esta estructura exacta:
{
  "form": "${form_type}",
  "client_name": "nombre del cliente",
  "completion_percentage": número 0-100,
  "parts": {
    "part_1": {
      "title": "nombre de la parte",
      "completion": número 0-100,
      "fields": [
        { "field": "nombre del campo", "value": "valor o [FALTA]", "status": "completed|missing|verify" }
      ]
    }
  },
  "missing_fields": ["lista de campos faltantes"],
  "warnings": ["lista de advertencias"],
  "felix_note": "nota breve de Felix sobre el estado del formulario"
}`;

    // Call Anthropic
    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("Anthropic error:", errText);
      await supabaseAdmin.from("ai_agent_sessions").update({ status: "failed", error_message: errText, completed_at: new Date().toISOString() }).eq("id", session!.id);
      return new Response(JSON.stringify({ error: "ai_error" }), { status: 500, headers: corsHeaders });
    }

    const aiResult = await anthropicResp.json();
    const outputText = aiResult.content?.[0]?.text || "";
    const tokensUsed = (aiResult.usage?.input_tokens || 0) + (aiResult.usage?.output_tokens || 0);

    // Parse output
    let outputData: any;
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      outputData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: outputText };
    } catch {
      outputData = { raw: outputText };
    }

    // Update session
    await supabaseAdmin.from("ai_agent_sessions").update({
      status: "completed",
      output_data: outputData,
      output_text: outputText,
      tokens_used: tokensUsed,
      completed_at: new Date().toISOString(),
    }).eq("id", session!.id);

    // Update credit transaction with session_id and case_id
    await supabaseAdmin.from("ai_credit_transactions").update({ session_id: session!.id, case_id }).eq("account_id", account_id).eq("agent_slug", "felix").is("session_id", null).order("created_at", { ascending: false }).limit(1);

    return new Response(JSON.stringify({ success: true, session_id: session!.id, output: outputData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("agent-felix error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
