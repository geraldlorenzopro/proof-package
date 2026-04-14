import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: office } = await supabase
      .from("office_config")
      .select("firm_address, firm_name, attorney_name")
      .eq("account_id", account_id)
      .single();

    const todayStr = new Date().toISOString().split("T")[0];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [activeCasesRes, todayApptsRes, overdueRes] = await Promise.all([
      supabase.from("client_cases").select("id", { count: "exact", head: true })
        .eq("account_id", account_id).neq("status", "completed"),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("account_id", account_id).eq("appointment_date", todayStr).neq("status", "cancelled"),
      supabase.from("case_deadlines").select("id", { count: "exact", head: true })
        .eq("account_id", account_id).eq("status", "active").lt("deadline_date", todayStr),
    ]);

    const kpis = {
      activeCases: activeCasesRes.count || 0,
      todayAppointments: todayApptsRes.count || 0,
      overdueDeadlines: overdueRes.count || 0,
    };

    // ─── Weather ───
    let weatherText = "";
    try {
      const address = office?.firm_address || "";
      const parts = address.split(",").map((s: string) => s.trim());
      const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "Miami";
      const weatherResp = await fetch(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (weatherResp.ok) {
        const w = await weatherResp.json();
        const current = w?.current_condition?.[0];
        if (current) {
          const tempF = current.temp_F;
          const desc = current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || "";
          weatherText = `En ${city} hay ${tempF} grados Fahrenheit, ${desc.toLowerCase()}.`;
        }
      }
    } catch (e) {
      console.warn("Weather fetch failed:", e);
    }

    // ─── Immigration news via Perplexity — official sources ───
    let newsText = "";
    let newsCitations: string[] = [];
    let newsCards: any[] = [];
    try {
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      if (PERPLEXITY_API_KEY) {
        const pxResp = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content: `Eres un asistente especializado en inmigración en Estados Unidos.

Busca noticias Y alertas oficiales de estas fuentes en orden de prioridad:

FUENTES OFICIALES (prioridad máxima):
- uscis.gov — alertas, policy updates, fee changes, form updates
- travel.state.gov — Visa Bulletin mensual, fechas de prioridad, alertas consulares
- ice.gov — operaciones, políticas, prioridades de enforcement
- cbp.gov — puertos de entrada, políticas fronterizas
- justice.gov/eoir — cortes de inmigración, decisiones del BIA
- federalregister.gov — nuevas reglas y propuestas de USCIS/DHS

TIPOS DE CONTENIDO A INCLUIR:
- Nuevo Visa Bulletin (sale el 2do miércoles de cada mes)
- Cambios en fechas de prioridad
- Cambios en fees de USCIS
- Nuevas versiones de formularios
- Alertas de procesamiento
- Cambios en políticas de entrevistas
- Operaciones de ICE relevantes
- Cambios en puertos de entrada CBP
- Decisiones del BIA que crean precedente
- Nuevas reglas en Federal Register

NO incluyas:
- Política general o legislación amplia sin impacto directo
- Economía o empleo general
- Noticias internacionales sin relación directa con inmigración en USA
- Opiniones o editoriales

Responde SOLO con un JSON array de exactamente 9 objetos.
Distribución: 3 de USCIS/DOS, 2 de Visa Bulletin/fechas, 2 de ICE/CBP/Cortes, 2 de noticias generales de inmigración.

Cada objeto:
{
  "title": "máx 70 chars, en español",
  "summary": "máx 130 chars, en español",
  "source": "USCIS" | "DOS" | "ICE" | "CBP" | "EOIR" | "Federal Register" | "Noticias",
  "category": "USCIS" | "Visa Bulletin" | "ICE/CBP" | "Cortes" | "DACA/TPS" | "Legislación",
  "urgency": "alta" | "media" | "baja",
  "url": "string (si disponible, sino vacío)",
  "time": "hace Xh"
}

No incluyas ningún texto fuera del JSON.`,
              },
              {
                role: "user",
                content: `Dame las 9 noticias y alertas oficiales más recientes sobre inmigración en Estados Unidos hoy ${todayStr}. Prioriza fuentes gubernamentales (uscis.gov, travel.state.gov, ice.gov).`,
              },
            ],
            max_tokens: 1800,
            temperature: 0.2,
            search_recency_filter: "day",
            search_domain_filter: [
              "uscis.gov",
              "travel.state.gov",
              "ice.gov",
              "cbp.gov",
              "justice.gov",
              "federalregister.gov",
              "boundless.com",
              "aila.org",
              "reuters.com",
              "apnews.com",
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (pxResp.ok) {
          const pxData = await pxResp.json();
          const raw = pxData.choices?.[0]?.message?.content?.trim() || "";
          newsCitations = pxData.citations || [];
          newsText = raw;

          try {
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length >= 1) {
                newsCards = parsed.slice(0, 9).map((item: any) => ({
                  title: String(item.title || "").slice(0, 100),
                  summary: String(item.summary || "").slice(0, 200),
                  source: String(item.source || "Noticias"),
                  category: String(item.category || "USCIS"),
                  urgency: String(item.urgency || "media"),
                  url: String(item.url || ""),
                  time: String(item.time || "hoy"),
                }));
              }
            }
          } catch (parseErr) {
            console.warn("Failed to parse structured news:", parseErr);
          }
        }
      }

      // Fallback
      if (!newsText && !newsCards.length) {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Responde SOLO con un JSON array de exactamente 9 objetos. Cada objeto tiene: title (titular en español, máx 70 chars sobre inmigración en EE.UU.), summary (resumen en español, máx 130 chars), source (USCIS, DOS, ICE, CBP, EOIR, Federal Register, o Noticias), category (USCIS, Visa Bulletin, ICE/CBP, Cortes, DACA/TPS, o Legislación), urgency (alta, media, baja), url (vacío), time (ej: 'hoy'). Sin texto extra.`,
                },
                {
                  role: "user",
                  content: `Dame 9 noticias recientes importantes sobre inmigración en Estados Unidos.`,
                },
              ],
              max_tokens: 1800,
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const raw2 = aiData.choices?.[0]?.message?.content?.trim() || "";
            try {
              const jsonMatch2 = raw2.match(/\[[\s\S]*\]/);
              if (jsonMatch2) {
                const parsed2 = JSON.parse(jsonMatch2[0]);
                if (Array.isArray(parsed2)) {
                  newsCards = parsed2.slice(0, 9).map((item: any) => ({
                    title: String(item.title || "").slice(0, 100),
                    summary: String(item.summary || "").slice(0, 200),
                    source: String(item.source || "Noticias"),
                    category: String(item.category || "USCIS"),
                    urgency: String(item.urgency || "media"),
                    url: String(item.url || ""),
                    time: String(item.time || "hoy"),
                  }));
                }
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn("News fetch failed:", e);
    }

    return new Response(
      JSON.stringify({ weather: weatherText, news: newsText, citations: newsCitations, newsCards, kpis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Briefing error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
