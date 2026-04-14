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

    // ─── Noticias de inmigración en español via Perplexity ───
    let newsCards: any[] = [];
    try {
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

      if (PERPLEXITY_API_KEY) {
        const pxResp = await fetch(
          "https://api.perplexity.ai/chat/completions",
          {
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

Busca ÚNICAMENTE noticias recientes sobre inmigración en USA que estén escritas en español.
TIPOS DE NOTICIAS A INCLUIR:
- Cambios en políticas de USCIS
- Actualizaciones de DACA, TPS, Parole
- Operaciones de ICE y deportaciones
- Cambios en el Visa Bulletin
- Decisiones de cortes de inmigración
- Cambios en fees o formularios
- Noticias que afecten directamente a inmigrantes hispanohablantes en USA

NO incluyas:
- Noticias en inglés
- Política general sin relación directa con inmigración
- Noticias de otros países que no afecten a inmigrantes en USA

Responde SOLO con un JSON array de exactamente 9 objetos.
Cada objeto:
{
  "title": "título en español máx 80 chars",
  "summary": "resumen en español máx 150 chars",
  "source": "nombre del medio (ej: Univision, Telemundo, CNN Español)",
  "category": "USCIS" | "ICE/CBP" | "DACA/TPS" | "Cortes" | "Visa Bulletin" | "Legislación",
  "urgency": "alta" | "media" | "baja",
  "url": "URL exacta del artículo",
  "time": "hace Xh o hace X días"
}
Sin texto fuera del JSON.`,
                },
                {
                  role: "user",
                  content: `Dame las 9 noticias más recientes sobre inmigración en Estados Unidos publicadas en medios en español. Hoy es ${todayStr}. Busca en Univision, Telemundo, CNN en Español, El Nuevo Herald, BBC Mundo, y otros medios confiables en español.`,
                },
              ],
              max_tokens: 2000,
              temperature: 0.1,
              search_recency_filter: "week",
              search_domain_filter: [
                "univision.com",
                "telemundo.com",
                "cnnespanol.cnn.com",
                "elnuevoherald.com",
                "bbc.com/mundo",
                "mundohispanico.com",
                "laopinion.com",
                "noticiasunivision.com",
                "aila.org",
                "immi-usa.com",
              ],
            }),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (pxResp.ok) {
          const pxData = await pxResp.json();
          const raw = pxData.choices?.[0]?.message?.content?.trim() || "";

          try {
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed)) {
                newsCards = parsed
                  .slice(0, 9)
                  .map((item: any) => ({
                    title: String(item.title || "").slice(0, 100),
                    summary: String(item.summary || "").slice(0, 200),
                    source: String(item.source || "Noticias"),
                    category: String(item.category || "USCIS"),
                    urgency: String(item.urgency || "media"),
                    url: String(item.url || ""),
                    time: String(item.time || "hoy"),
                  }))
                  .filter((n: any) =>
                    n.url &&
                    n.url.startsWith("http") &&
                    n.title.length > 5
                  );
              }
            }
          } catch (parseErr) {
            console.warn("Failed to parse news:", parseErr);
          }
        } else {
          console.warn(`Perplexity news: HTTP ${pxResp.status}`);
        }
      }
    } catch (e) {
      console.warn("News fetch failed:", e);
    }

    // Fallback si Perplexity no retorna noticias
    if (newsCards.length === 0) {
      newsCards = [
        {
          title: "Ver últimas noticias de inmigración",
          summary: "Visita Univision Noticias para las últimas actualizaciones sobre inmigración en Estados Unidos.",
          source: "Univision",
          category: "USCIS",
          urgency: "baja",
          url: "https://www.univision.com/noticias/inmigracion",
          time: "Ahora",
        },
        {
          title: "Noticias de inmigración en Telemundo",
          summary: "Mantente informado con las últimas noticias de inmigración en Telemundo.",
          source: "Telemundo",
          category: "USCIS",
          urgency: "baja",
          url: "https://www.telemundo.com/noticias/inmigracion",
          time: "Ahora",
        },
        {
          title: "CNN en Español — Inmigración",
          summary: "Cobertura completa de inmigración en CNN en Español.",
          source: "CNN Español",
          category: "USCIS",
          urgency: "baja",
          url: "https://cnnespanol.cnn.com/category/inmigracion/",
          time: "Ahora",
        },
      ];
    }

    return new Response(
      JSON.stringify({ weather: weatherText, newsCards, kpis }),
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