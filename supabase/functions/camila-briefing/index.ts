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

    // ─── Immigration news via Perplexity — structured 3 cards ───
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
                content: `Eres un asistente que busca noticias recientes de inmigración en Estados Unidos. Responde SOLO con un JSON array de exactamente 3 objetos. Cada objeto tiene: title (máx 80 caracteres en español), summary (2 oraciones en español, máx 150 caracteres), category (una de: USCIS, DACA, Visas, Deportación, Naturalización, Legislación), time (ej: 'hace 2h', 'hace 5h', 'ayer'). No incluyas ningún texto fuera del JSON.`,
              },
              {
                role: "user",
                content: `Dame las 3 noticias más recientes e importantes sobre inmigración en Estados Unidos hoy ${todayStr}.`,
              },
            ],
            max_tokens: 500,
            temperature: 0.2,
            search_recency_filter: "day",
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (pxResp.ok) {
          const pxData = await pxResp.json();
          const raw = pxData.choices?.[0]?.message?.content?.trim() || "";
          newsCitations = pxData.citations || [];
          newsText = raw;

          // Try to parse structured JSON
          try {
            // Extract JSON array from response (may have markdown fences)
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length >= 1) {
                newsCards = parsed.slice(0, 3).map((item: any) => ({
                  title: String(item.title || "").slice(0, 100),
                  summary: String(item.summary || "").slice(0, 200),
                  category: String(item.category || "USCIS"),
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
                  content: `Responde SOLO con un JSON array de exactamente 3 objetos. Cada objeto tiene: title (máx 80 caracteres en español sobre inmigración en EE.UU.), summary (2 oraciones, máx 150 chars), category (USCIS, DACA, Visas, Deportación, Naturalización, o Legislación), time (ej: 'hoy'). Sin texto extra.`,
                },
                {
                  role: "user",
                  content: `Dame 3 noticias recientes importantes sobre inmigración en Estados Unidos.`,
                },
              ],
              max_tokens: 400,
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
                  newsCards = parsed2.slice(0, 3).map((item: any) => ({
                    title: String(item.title || "").slice(0, 100),
                    summary: String(item.summary || "").slice(0, 200),
                    category: String(item.category || "USCIS"),
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
