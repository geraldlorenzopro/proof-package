import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un asistente especializado en inmigración de EE.UU. Tu tarea es analizar un reporte de análisis de documentos USCIS y extraer TODAS las evidencias sugeridas, recomendaciones y acciones pendientes para crear un checklist organizado.

INSTRUCCIONES:
1. Lee el reporte completo cuidadosamente.
2. Extrae CADA pieza de evidencia sugerida, documento recomendado, o acción requerida.
3. Organízalos por categoría.
4. Devuelve ÚNICAMENTE un JSON válido con la siguiente estructura (sin markdown, sin backticks, solo JSON puro):

{
  "categories": [
    {
      "title": "Nombre de la categoría (ej: Documentos de Identidad, Evidencia Financiera, etc.)",
      "items": [
        "Descripción clara y concisa del item del checklist"
      ]
    }
  ],
  "deadlines": [
    {
      "date": "Fecha límite si se menciona",
      "description": "Qué debe hacerse antes de esa fecha"
    }
  ],
  "case_info": {
    "receipt_number": "Número de recibo si aparece",
    "document_type": "Tipo de documento analizado",
    "petitioner": "Nombre del peticionario si aparece",
    "beneficiary": "Nombre del beneficiario si aparece"
  }
}

REGLAS:
- Cada item debe ser específico y accionable.
- No repitas items.
- Si el reporte está en español, genera el checklist en español. Si está en inglés, en inglés.
- Incluye TODAS las evidencias mencionadas en el reporte, no omitas ninguna.
- Si no encuentras información para un campo, usa null.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { files } = body;

    const hasFiles = Array.isArray(files) && files.length > 0;

    if (!hasFiles) {
      return new Response(
        JSON.stringify({ error: "Debes enviar el archivo del reporte." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: "Analiza el siguiente reporte de USCIS y extrae un checklist completo de todas las evidencias sugeridas, documentos recomendados y acciones pendientes. Devuelve SOLO JSON válido.",
      },
    ];

    for (const file of files) {
      if (file.base64.startsWith("data:application/pdf") || file.base64.startsWith("data:image/")) {
        userContent.push({
          type: "image_url",
          image_url: { url: file.base64 },
        });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Error al procesar el checklist" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response (might have markdown wrapping)
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: "No se pudo parsear la respuesta del AI", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-checklist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
