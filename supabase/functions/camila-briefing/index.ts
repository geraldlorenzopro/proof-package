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

    // Fetch office config for city/address
    const { data: office } = await supabase
      .from("office_config")
      .select("firm_address, firm_name, attorney_name")
      .eq("account_id", account_id)
      .single();

    // Fetch KPIs in parallel
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

    // ─── Weather via wttr.in (free, no API key) ───
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

    // ─── Immigration news via Perplexity (real-time web search) ───
    let newsText = "";
    let newsCitations: string[] = [];
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
                content: `Eres un asistente de noticias de inmigración de EE.UU. para abogados. Genera un resumen de 2-3 oraciones sobre lo más relevante que está pasando HOY en inmigración de EE.UU. (USCIS, boletín de visas, cambios de política, tiempos de procesamiento, deportaciones, ICE, etc). Sé conciso, profesional y en español. No uses emojis ni markdown.`,
              },
              {
                role: "user",
                content: `¿Cuáles son las noticias de inmigración más importantes de hoy ${todayStr} en Estados Unidos?`,
              },
            ],
            max_tokens: 300,
            temperature: 0.2,
            search_recency_filter: "day",
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (pxResp.ok) {
          const pxData = await pxResp.json();
          newsText = pxData.choices?.[0]?.message?.content?.trim() || "";
          newsCitations = pxData.citations || [];
        } else {
          console.warn("Perplexity API error:", pxResp.status, await pxResp.text());
        }
      }

      // Fallback to Lovable AI if Perplexity is not available
      if (!newsText) {
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
                  content: `Eres un asistente de noticias de inmigración de EE.UU. Genera un resumen de 1-2 oraciones sobre el panorama migratorio actual. Sé conciso, profesional y en español. No uses emojis ni markdown.`,
                },
                {
                  role: "user",
                  content: `Dame un resumen general del panorama migratorio actual en EE.UU.`,
                },
              ],
              max_tokens: 200,
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            newsText = aiData.choices?.[0]?.message?.content?.trim() || "";
          }
        }
      }
    } catch (e) {
      console.warn("News fetch failed:", e);
    }

    return new Response(
      JSON.stringify({ weather: weatherText, news: newsText, citations: newsCitations, kpis }),
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
