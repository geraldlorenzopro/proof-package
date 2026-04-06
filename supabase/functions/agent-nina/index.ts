import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_COST = 10;
const MODEL = "claude-sonnet-4-6";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { case_id, account_id, language } = await req.json();
    if (!case_id || !account_id) return new Response(JSON.stringify({ error: "missing_params" }), { status: 400, headers: corsHeaders });

    // Check credits
    const creditResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/check-credits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      body: JSON.stringify({ account_id, agent_slug: "nina", cost: CREDIT_COST }),
    });
    const creditResult = await creditResp.json();
    if (!creditResult.allowed) {
      return new Response(JSON.stringify({ error: "insufficient_credits", balance: creditResult.balance, needed: CREDIT_COST }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: session } = await supabaseAdmin.from("ai_agent_sessions").insert({
      account_id, case_id, agent_slug: "nina", triggered_by: user.id,
      status: "running", input_data: { language },
      model_used: MODEL, credits_used: CREDIT_COST,
    }).select("id").single();

    // Load data
    const [caseRes, officeRes] = await Promise.all([
      supabaseAdmin.from("client_cases").select("*").eq("id", case_id).single(),
      supabaseAdmin.from("office_config").select("*").eq("account_id", account_id).single(),
    ]);
    const caseData = caseRes.data;
    const officeConfig = officeRes.data;
    if (!caseData) throw new Error("Case not found");

    let profileData: any = null;
    if (caseData.client_profile_id) {
      const { data: p } = await supabaseAdmin.from("client_profiles").select("*").eq("id", caseData.client_profile_id).single();
      profileData = p;
    }

    // Load Felix output if exists
    const { data: felixSession } = await supabaseAdmin.from("ai_agent_sessions")
      .select("output_data")
      .eq("case_id", case_id).eq("agent_slug", "felix").eq("status", "completed")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const lang = language || officeConfig?.preferred_language || "es";
    const firmName = officeConfig?.firm_name || "La firma";

    const systemPrompt = `Eres Nina, especialista en paquetes de inmigración que trabaja para ${firmName}.
Tu trabajo es ensamblar el paquete completo listo para enviar a USCIS.

REGLAS:
- No das asesoría legal
- Tu trabajo es organizar y redactar
- La cover letter debe ser profesional y específica para este caso
- El índice debe estar en el orden exacto que USCIS espera
- Responde en ${lang === "en" ? "inglés" : "español"}
- Responde SOLO con JSON válido, sin markdown ni backticks`;

    const userPrompt = `Ensambla el paquete para el caso de ${caseData.client_name}.
Tipo de caso: ${caseData.case_type}

Datos del expediente:
${JSON.stringify({ case: { ...caseData, access_token: undefined }, profile: profileData, felix_output: felixSession?.output_data || null, office: { firm_name: firmName, attorney_name: officeConfig?.attorney_name, firm_phone: officeConfig?.firm_phone, firm_address: officeConfig?.firm_address, bar_number: officeConfig?.bar_number } }, null, 2)}

Genera un JSON con esta estructura exacta:
{
  "package_title": "Paquete [tipo] — [nombre]",
  "cover_letter": {
    "date": "fecha actual",
    "service_center": "centro de servicio correcto",
    "re": "línea de referencia",
    "salutation": "saludo",
    "body": "cuerpo completo de la carta",
    "closing": "cierre con firma del abogado"
  },
  "document_index": [
    { "tab": "1", "document": "nombre del documento", "status": "received|pending|pending_signature" }
  ],
  "assembly_order": ["lista ordenada de documentos para ensamblar"],
  "missing_for_assembly": ["items faltantes para completar el paquete"],
  "nina_note": "nota breve de Nina"
}`;

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
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

    let outputData: any;
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      outputData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: outputText };
    } catch { outputData = { raw: outputText }; }

    await supabaseAdmin.from("ai_agent_sessions").update({
      status: "completed", output_data: outputData, output_text: outputText,
      tokens_used: tokensUsed, completed_at: new Date().toISOString(),
    }).eq("id", session!.id);

    return new Response(JSON.stringify({ success: true, session_id: session!.id, output: outputData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("agent-nina error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
