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

    // ─── Noticias oficiales traducidas al español ───
    let newsCards: any[] = [];
    try {
      // PASO 1: Obtener noticias del Federal Register
      const agencyIds = [499, 501, 503, 149, 227];
      const params = agencyIds
        .map(id => `conditions[agency_ids][]=${id}`)
        .join("&");
      const frUrl = `https://www.federalregister.gov/api/v1/articles?${params}&per_page=9&order=newest&fields[]=title&fields[]=abstract&fields[]=html_url&fields[]=publication_date&fields[]=agency_names`;

      const frResp = await fetch(frUrl, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (frResp.ok) {
        const frData = await frResp.json();
        const articles = (frData.results || []).slice(0, 9);

        if (articles.length > 0) {
          // PASO 2: Traducir todos al español con Claude
          const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

          const toTranslate = articles.map((a: any) => ({
            title: a.title || "",
            abstract: (a.abstract || "").replace(/<[^>]*>/g, "").slice(0, 200),
            agencies: (a.agency_names || []).join(", "),
          }));

          const claudeResp = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_KEY!,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5",
                max_tokens: 2000,
                messages: [{
                  role: "user",
                  content: `Traduce estos artículos del Federal Register al español para profesionales de inmigración hispanos.

Para cada artículo genera:
- title: título en español (máx 80 chars, claro y directo)
- summary: resumen en español (máx 130 chars, qué significa para una firma de inmigración)
- category: exactamente uno de: USCIS | ICE/CBP | Cortes | DACA/TPS | Visa Bulletin | Legislación
- urgency: alta | media | baja

Responde SOLO con un JSON array. Sin texto adicional.

Artículos:
${JSON.stringify(toTranslate, null, 2)}`,
                }],
              }),
              signal: AbortSignal.timeout(15000),
            }
          );

          if (claudeResp.ok) {
            const claudeData = await claudeResp.json();
            const raw = claudeData.content?.[0]?.text?.trim() || "";
            const jsonMatch = raw.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
              const translated = JSON.parse(jsonMatch[0]);

              newsCards = articles.map((article: any, i: number) => {
                const t = translated[i] || {};
                const agNames: string[] = article.agency_names || [];
                let source = "DHS";
                if (agNames.some((n: string) => n.includes("Citizenship"))) source = "USCIS";
                else if (agNames.some((n: string) => n.includes("Customs and Border"))) source = "CBP";
                else if (agNames.some((n: string) => n.includes("Immigration and Customs"))) source = "ICE";
                else if (agNames.some((n: string) => n.includes("Immigration Review"))) source = "EOIR";

                const pub = article.publication_date || "";
                const diffD = pub ? Math.floor((Date.now() - new Date(pub).getTime()) / 86400000) : 0;
                const time = diffD === 0 ? "Hoy" : diffD === 1 ? "Ayer" : `Hace ${diffD} días`;

                return {
                  title: String(t.title || article.title).slice(0, 100),
                  summary: String(t.summary || "").slice(0, 150),
                  source,
                  category: String(t.category || "USCIS"),
                  urgency: String(t.urgency || "media"),
                  url: article.html_url || "https://www.federalregister.gov",
                  time,
                  pubDate: pub,
                };
              });
            }
          } else {
            console.warn("Claude translation failed:", claudeResp.status);
          }
        }
      }
    } catch (e) {
      console.warn("News error:", e);
    }

    if (newsCards.length === 0) {
      newsCards = [{
        title: "Ver noticias oficiales de inmigración",
        summary: "Visita el Federal Register para las últimas actualizaciones oficiales.",
        source: "USCIS",
        category: "USCIS",
        urgency: "baja",
        url: "https://www.federalregister.gov",
        time: "Ahora",
      }];
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