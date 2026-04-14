import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── FEDERAL REGISTER API — fuentes oficiales verificadas ───
const FR_AGENCY_SOURCES = [
  { agency_id: 499, name: "USCIS", category: "USCIS" },
  { agency_id: 501, name: "CBP", category: "ICE/CBP" },
  { agency_id: 503, name: "ICE", category: "ICE/CBP" },
  { agency_id: 149, name: "EOIR", category: "Cortes" },
  { agency_id: 227, name: "DHS", category: "Legislación" },
];

// Función para calcular tiempo relativo
function relativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffD = Math.floor(diffMs / 86_400_000);
    if (diffH < 1) return "Hace menos de 1h";
    if (diffH < 24) return `Hace ${diffH}h`;
    if (diffD === 1) return "Ayer";
    if (diffD < 7) return `Hace ${diffD} días`;
    return date.toLocaleDateString("es", { day: "numeric", month: "short" });
  } catch {
    return "Reciente";
  }
}

// Función para determinar urgencia
function getUrgency(title: string, desc: string): string {
  const text = (title + " " + desc).toLowerCase();
  const highKeywords = [
    "urgent", "alert", "deadline", "effective immediately",
    "immediately", "court order", "injunction", "fee increase",
    "policy change", "deportation", "rfe", "noid", "denial",
    "final rule", "emergency", "interim final",
  ];
  const medKeywords = [
    "update", "change", "new", "announce", "processing",
    "bulletin", "visa", "proposed rule", "notice",
  ];
  if (highKeywords.some((k) => text.includes(k))) return "alta";
  if (medKeywords.some((k) => text.includes(k))) return "media";
  return "baja";
}

// Determinar categoría más específica basándose en el título
function refineCategory(title: string, baseCategory: string): string {
  const t = title.toLowerCase();
  if (t.includes("visa bulletin") || t.includes("priority date")) return "Visa Bulletin";
  if (t.includes("daca") || t.includes("tps") || t.includes("temporary protected")) return "DACA/TPS";
  if (t.includes("court") || t.includes("eoir") || t.includes("bia") || t.includes("immigration judge")) return "Cortes";
  if (t.includes("ice") || t.includes("enforcement") || t.includes("removal") || t.includes("detention")) return "ICE/CBP";
  if (t.includes("cbp") || t.includes("border") || t.includes("port of entry")) return "ICE/CBP";
  return baseCategory;
}

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

    // ─── Immigration news via Federal Register JSON API ───
    let newsCards: any[] = [];
    try {
      // Build agency IDs query param
      const agencyParams = FR_AGENCY_SOURCES.map(s => `conditions[agency_ids][]=${s.agency_id}`).join("&");
      const frUrl = `https://www.federalregister.gov/api/v1/articles?${agencyParams}&per_page=20&order=newest&fields[]=title&fields[]=abstract&fields[]=html_url&fields[]=publication_date&fields[]=agency_names&fields[]=type`;

      const frResp = await fetch(frUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NER-Immigration-Monitor/1.0)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (frResp.ok) {
        const frData = await frResp.json();
        const results = frData.results || [];
        console.log(`Federal Register API: ${results.length} articles`);

        // Map agency names to our source names
        const agencyMap: Record<string, { name: string; category: string }> = {};
        for (const s of FR_AGENCY_SOURCES) {
          agencyMap[s.agency_id.toString()] = { name: s.name, category: s.category };
        }

        const agencyNameMap: Record<string, { name: string; category: string }> = {
          "U.S. Citizenship and Immigration Services": { name: "USCIS", category: "USCIS" },
          "U.S. Customs and Border Protection": { name: "CBP", category: "ICE/CBP" },
          "U.S. Immigration and Customs Enforcement": { name: "ICE", category: "ICE/CBP" },
          "Executive Office for Immigration Review": { name: "EOIR", category: "Cortes" },
          "Homeland Security Department": { name: "DHS", category: "Legislación" },
          "State Department": { name: "DOS", category: "Visa Bulletin" },
        };

        for (const article of results) {
          const title = (article.title || "").slice(0, 100);
          const summary = (article.abstract || "").replace(/<[^>]*>/g, "").slice(0, 200);
          const url = article.html_url || "";
          const pubDate = article.publication_date || "";
          const agencyNames: string[] = article.agency_names || [];

          // Find best matching source
          let source = "DHS";
          let category = "Legislación";
          for (const agName of agencyNames) {
            const match = agencyNameMap[agName];
            if (match) {
              source = match.name;
              category = match.category;
              break;
            }
          }

          category = refineCategory(title, category);

          newsCards.push({
            title,
            summary,
            source,
            category,
            urgency: getUrgency(title, summary),
            url,
            time: relativeTime(pubDate),
            pubDate,
          });
        }
      } else {
        console.warn(`Federal Register API: HTTP ${frResp.status}`);
      }
    } catch (e) {
      console.warn("Federal Register fetch failed:", e);
    }

    // Also try USCIS newsroom RSS as supplemental source
    try {
      // USCIS news alerts feed
      const uscisResp = await fetch("https://www.uscis.gov/news/alerts/feed", {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NER-Immigration-Monitor/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (uscisResp.ok) {
        const xml = await uscisResp.text();
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        let count = 0;
        for (const match of itemMatches) {
          if (count >= 3) break;
          const item = match[1];
          const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
          const link = item.match(/<link>(.*?)<\/link>|<guid[^>]*>(.*?)<\/guid>/);
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>|<dc:date>(.*?)<\/dc:date>/);
          const desc = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);

          const t = (title?.[1] || title?.[2] || "").trim();
          if (!t) continue;
          const d = (pubDate?.[1] || pubDate?.[2] || "").trim();

          newsCards.push({
            title: t.slice(0, 100),
            summary: (desc?.[1] || desc?.[2] || "").replace(/<[^>]*>/g, "").trim().slice(0, 200),
            source: "USCIS",
            category: refineCategory(t, "USCIS"),
            urgency: getUrgency(t, ""),
            url: (link?.[1] || link?.[2] || "").trim(),
            time: relativeTime(d),
            pubDate: d,
          });
          count++;
        }
        console.log(`USCIS alerts feed: ${count} items`);
      }
    } catch (e) {
      console.warn("USCIS alerts feed failed:", e);
    }

    // Deduplicate by title similarity and sort by date
    const seen = new Set<string>();
    newsCards = newsCards.filter(card => {
      const key = card.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by most recent
    newsCards.sort((a, b) => {
      const da = new Date(a.pubDate || 0).getTime();
      const db = new Date(b.pubDate || 0).getTime();
      return db - da;
    });

    // Take top 9
    newsCards = newsCards.slice(0, 9);

    // Fallback if nothing found
    if (newsCards.length === 0) {
      newsCards = [
        {
          title: "No se pudieron cargar las noticias",
          summary: "Verifica tu conexión o visita uscis.gov directamente para noticias oficiales.",
          source: "USCIS",
          category: "USCIS",
          urgency: "baja",
          url: "https://www.uscis.gov/newsroom",
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
