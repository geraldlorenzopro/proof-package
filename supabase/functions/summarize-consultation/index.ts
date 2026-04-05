import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto asistente legal de inmigración con 20 años de experiencia. Analiza las notas de una consulta y genera un resumen estructurado en español. Sé específico, práctico y honesto sobre los riesgos del caso.

Responde SOLO con JSON válido sin markdown:
{
  "summary": "Resumen ejecutivo de 2-3 oraciones",
  "eligibility": "Evaluación de elegibilidad detallada",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "risks": ["riesgo 1", "riesgo 2"],
  "flags": ["flag1", "flag2"],
  "action_items": ["acción 1", "acción 2"],
  "recommended_case_type": "tipo-de-caso"
}

Los flags posibles son:
- prior_deportation: deportación previa detectada
- criminal_record: antecedentes penales
- urgent_deadline: tiene deadline urgente
- complex_case: caso complejo requiere revisión especial
- humanitarian: caso humanitario
- court_case: caso en corte
- missing_docs: falta documentación crítica
- payment_issue: problema de pago mencionado

REGLAS:
- Cada fortaleza y riesgo debe ser específico al caso, no genérico.
- Los action_items deben ser pasos concretos y accionables.
- La evaluación de elegibilidad debe ser honesta y directa.
- Si las notas mencionan derivados (familia), inclúyelos en el análisis.
- Siempre responde en español.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY no está configurada. Contacta al administrador." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { consultation_id, raw_notes, case_type, client_name, current_status, derivatives } = body;

    if (!consultation_id || !raw_notes) {
      return new Response(
        JSON.stringify({ error: "consultation_id y raw_notes son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const derivativesText = derivatives && Array.isArray(derivatives) && derivatives.length > 0
      ? `\n\nDerivados/Familia:\n${derivatives.map((d: any) =>
          `- ${d.name} (${d.relationship}), nacido en ${d.country_of_birth || 'N/A'}, estatus: ${d.immigration_status || 'N/A'}`
        ).join("\n")}`
      : "";

    const userPrompt = `Notas de consulta para ${client_name || "cliente"}:

Tipo de caso actual: ${case_type || "No definido"}
Estatus migratorio: ${current_status || "No especificado"}
${derivativesText}

--- NOTAS DE LA CONSULTA ---
${raw_notes}
--- FIN DE NOTAS ---

Analiza estas notas y genera el resumen estructurado.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Anthropic API error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Error al procesar con AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.content?.[0]?.text || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "No se pudo procesar la respuesta del AI", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update consultation with AI results using service role
    const adminClient = createClient(supabaseUrl, serviceKey);
    await adminClient.from("consultations").update({
      ai_summary: parsed.summary || null,
      ai_eligibility_assessment: parsed.eligibility || null,
      ai_recommended_case_type: parsed.recommended_case_type || null,
      ai_flags: parsed.flags || [],
      ai_action_items: parsed.action_items || [],
      ai_strengths: parsed.strengths || [],
      ai_risks: parsed.risks || [],
    }).eq("id", consultation_id);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-consultation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
