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
      body: JSON.stringify({ account_id, agent_slug: "max", cost: CREDIT_COST }),
    });
    const creditResult = await creditResp.json();
    if (!creditResult.allowed) {
      return new Response(JSON.stringify({ error: "insufficient_credits", balance: creditResult.balance, needed: CREDIT_COST }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: session } = await supabaseAdmin.from("ai_agent_sessions").insert({
      account_id, case_id, agent_slug: "max", triggered_by: user.id,
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

    // Load Felix and Nina outputs
    const { data: prevSessions } = await supabaseAdmin.from("ai_agent_sessions")
      .select("agent_slug, output_data")
      .eq("case_id", case_id).eq("status", "completed")
      .in("agent_slug", ["felix", "nina"])
      .order("created_at", { ascending: false });

    const felixOutput = prevSessions?.find(s => s.agent_slug === "felix")?.output_data;
    const ninaOutput = prevSessions?.find(s => s.agent_slug === "nina")?.output_data;

    const lang = language || officeConfig?.preferred_language || "es";
    const firmName = officeConfig?.firm_name || "La firma";

    const systemPrompt = `Eres Max, el evaluador de calidad de paquetes de inmigración que trabaja para ${firmName}.
Tu trabajo es revisar el paquete ANTES de enviarlo y detectar cualquier problema.

REGLAS IMPORTANTES:
- NO das probabilidades de aprobación (no tienes la base legal completa)
- SÍ detectas documentos faltantes
- SÍ detectas inconsistencias
- SÍ detectas campos sin llenar
- Eres directo — un paquete incompleto puede costarle el caso al cliente
- El score es de PREPARACIÓN del paquete, no de probabilidad de aprobación
- Responde en ${lang === "en" ? "inglés" : "español"}
- Responde SOLO con JSON válido, sin markdown ni backticks`;

    const userPrompt = `Evalúa el paquete para ${caseData.client_name}.
Tipo de caso: ${caseData.case_type}

Datos del expediente:
${JSON.stringify({ case: { ...caseData, access_token: undefined }, profile: profileData, felix_output: felixOutput || null, nina_output: ninaOutput || null }, null, 2)}

Genera un JSON con esta estructura exacta:
{
  "readiness_score": número 0-100,
  "readiness_label": "No listo|Casi listo|Listo para enviar",
  "readiness_color": "red|yellow|green",
  "summary": "resumen breve de la evaluación",
  "critical_issues": [
    { "issue": "descripción", "impact": "impacto", "action": "acción requerida" }
  ],
  "warnings": [
    { "issue": "descripción", "impact": "impacto", "action": "acción sugerida" }
  ],
  "strengths": ["fortalezas del paquete"],
  "next_steps": ["próximos pasos numerados"],
  "max_note": "nota directa de Max"
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
    console.error("agent-max error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }), { status: 500, headers: corsHeaders });
  }
});
