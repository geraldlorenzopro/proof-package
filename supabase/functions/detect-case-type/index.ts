import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      current_status, entry_method, has_prior_deportation, has_criminal_record,
      current_documents, client_goal, urgency_level, has_pending_deadline, account_id,
    } = body;

    // Get active case types for the account
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: caseTypes } = await adminClient
      .from("active_case_types")
      .select("case_type, display_name, description")
      .eq("account_id", account_id)
      .eq("is_active", true);

    const availableTypes = (caseTypes || []).map(
      (ct: any) => `${ct.case_type}: ${ct.display_name} - ${ct.description || ""}`
    ).join("\n");

    // Try AI detection via Anthropic Claude
    if (anthropicKey) {
      try {
        const systemPrompt = `Eres un experto en derecho de inmigración de Estados Unidos. Basándote en la información del cliente, determina el tipo de caso más probable de la lista disponible.

Responde SOLO con JSON válido en este formato:
{
  "suggested_type": "case_type_slug",
  "confidence": 85,
  "reasoning": "Explicación breve en español",
  "flags": ["flag1", "flag2"],
  "secondary_type": "otro_posible_tipo"
}

Los flags pueden ser:
- "prior_deportation": tiene deportación previa
- "criminal_record": tiene antecedentes
- "urgent_deadline": tiene deadline urgente
- "complex_case": caso complejo
- "multiple_options": múltiples opciones posibles

Tipos de caso disponibles:
${availableTypes}`;

        const userPrompt = `Información del cliente:
- Estatus actual: ${current_status || "No especificado"}
- Método de entrada: ${entry_method || "No especificado"}
- Deportación previa: ${has_prior_deportation ? "SÍ" : "No"}
- Antecedentes penales: ${has_criminal_record ? "SÍ" : "No"}
- Documentos actuales: ${(current_documents || []).join(", ") || "Ninguno"}
- Objetivo del cliente: ${client_goal || "No especificado"}
- Urgencia: ${urgency_level || "normal"}
- Deadline pendiente: ${has_pending_deadline ? "SÍ" : "No"}`;

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.content?.[0]?.text || "";
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return new Response(JSON.stringify(parsed), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (aiErr) {
        console.error("AI detection failed, falling back to rules:", aiErr);
      }
    }

    // Fallback: rule-based detection
    const result = ruleBasedDetection({
      current_status, entry_method, has_prior_deportation,
      has_criminal_record, client_goal, has_pending_deadline,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("detect-case-type error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ruleBasedDetection(data: any) {
  const goal = (data.client_goal || "").toLowerCase();
  const status = (data.current_status || "").toLowerCase();
  const flags: string[] = [];

  if (data.has_prior_deportation) flags.push("prior_deportation");
  if (data.has_criminal_record) flags.push("criminal_record");
  if (data.has_pending_deadline) flags.push("urgent_deadline");

  if (data.has_prior_deportation) {
    return {
      suggested_type: "removal-defense",
      confidence: 75,
      reasoning: "El cliente tiene deportación o remoción previa, lo que sugiere un caso de defensa contra deportación.",
      flags,
      secondary_type: "waiver",
    };
  }

  if (goal.includes("ciudadan") || goal.includes("naturaliz")) {
    if (status.includes("residente") || status.includes("green")) {
      return {
        suggested_type: "naturalization",
        confidence: 90,
        reasoning: "El cliente es residente permanente y busca la ciudadanía americana.",
        flags,
        secondary_type: null,
      };
    }
  }

  if (goal.includes("trabajo") || goal.includes("permiso") || goal.includes("ead")) {
    return {
      suggested_type: "ead-renewal",
      confidence: 70,
      reasoning: "El cliente busca un permiso de trabajo o renovación de EAD.",
      flags: [...flags, "multiple_options"],
      secondary_type: "work-visa",
    };
  }

  if (goal.includes("asilo") || goal.includes("asylum")) {
    return {
      suggested_type: "asylum",
      confidence: 80,
      reasoning: "El cliente busca protección de asilo en Estados Unidos.",
      flags,
      secondary_type: null,
    };
  }

  if (goal.includes("familia") || goal.includes("esposo") || goal.includes("esposa") || goal.includes("hijo")) {
    return {
      suggested_type: "family-petition",
      confidence: 75,
      reasoning: "El cliente busca un proceso de petición familiar.",
      flags: [...flags, "multiple_options"],
      secondary_type: "adjustment-of-status",
    };
  }

  if (status.includes("daca")) {
    return {
      suggested_type: "daca-tps",
      confidence: 85,
      reasoning: "El cliente tiene DACA y probablemente necesita renovación.",
      flags,
      secondary_type: null,
    };
  }

  if (status.includes("tps")) {
    return {
      suggested_type: "daca-tps",
      confidence: 85,
      reasoning: "El cliente tiene TPS y probablemente necesita renovación o extensión.",
      flags,
      secondary_type: "extension-of-status",
    };
  }

  return {
    suggested_type: "adjustment-of-status",
    confidence: 50,
    reasoning: "Basado en la información proporcionada, el ajuste de estatus es el proceso más probable. Se recomienda revisar con el abogado.",
    flags: [...flags, "complex_case", "multiple_options"],
    secondary_type: "family-petition",
  };
}
