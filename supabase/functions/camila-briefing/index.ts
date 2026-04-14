import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── RSS FEEDS OFICIALES ───
const RSS_SOURCES = [
  {
    name: "USCIS",
    url: "https://www.uscis.gov/feeds/news.rss",
    category: "USCIS",
  },
  {
    name: "ICE",
    url: "https://www.ice.gov/feeds/news",
    category: "ICE/CBP",
  },
  {
    name: "CBP",
    url: "https://www.cbp.gov/feeds/news",
    category: "ICE/CBP",
  },
  {
    name: "Federal Register",
    url: "https://www.federalregister.gov/api/v1/articles.rss?conditions%5Bagency_ids%5D%5B%5D=573",
    category: "USCIS",
  },
  {
    name: "DOS",
    url: "https://travel.state.gov/content/travel/en/News/visas-news.rss.xml",
    category: "Visa Bulletin",
  },
  {
    name: "EOIR",
    url: "https://www.justice.gov/eoir/rss.xml",
    category: "Cortes",
  },
];

// Función para parsear XML RSS/Atom básico
function parseRSS(xmlText: string): Array<{
  title: string;
  link: string;
  pubDate: string;
  description: string;
}> {
  const items: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
  }> = [];

  // Try RSS <item> format
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const item = match[1];
    const title = item.match(
      /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/
    );
    const link = item.match(
      /<link>(.*?)<\/link>|<guid[^>]*>(.*?)<\/guid>/
    );
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>|<dc:date>(.*?)<\/dc:date>/);
    const desc = item.match(
      /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/
    );
    items.push({
      title: (title?.[1] || title?.[2] || "").trim(),
      link: (link?.[1] || link?.[2] || "").trim(),
      pubDate: (pubDate?.[1] || pubDate?.[2] || "").trim(),
      description: (desc?.[1] || desc?.[2] || "")
        .replace(/<[^>]*>/g, "")
        .trim()
        .slice(0, 200),
    });
  }

  // If no RSS items, try Atom <entry> format
  if (items.length === 0) {
    const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entry = match[1];
      const title = entry.match(/<title[^>]*>(.*?)<\/title>|<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/);
      const link = entry.match(/<link[^>]*href="([^"]*)"/) || entry.match(/<link>(.*?)<\/link>/);
      const updated = entry.match(/<updated>(.*?)<\/updated>|<published>(.*?)<\/published>/);
      const summary = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>|<content[^>]*>([\s\S]*?)<\/content>/);
      items.push({
        title: (title?.[1] || title?.[2] || "").trim(),
        link: (link?.[1] || "").trim(),
        pubDate: (updated?.[1] || updated?.[2] || "").trim(),
        description: (summary?.[1] || summary?.[2] || "")
          .replace(/<[^>]*>/g, "")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
          .trim()
          .slice(0, 200),
      });
    }
  }

  return items;
}

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
    return date.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Reciente";
  }
}

// Función para determinar urgencia
function getUrgency(title: string, desc: string): string {
  const text = (title + " " + desc).toLowerCase();
  const highKeywords = [
    "urgent", "alert", "alerta", "deadline",
    "effective immediately", "immediately",
    "court order", "injunction", "fee increase",
    "policy change", "deportation", "deportación",
    "rfe", "noid", "denial",
  ];
  const medKeywords = [
    "update", "change", "new", "announce",
    "processing", "bulletin", "visa",
  ];
  if (highKeywords.some((k) => text.includes(k))) return "alta";
  if (medKeywords.some((k) => text.includes(k))) return "media";
  return "baja";
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

    // ─── Immigration news via RSS feeds oficiales ───
    let newsCards: any[] = [];
    try {
      const rssResults = await Promise.allSettled(
        RSS_SOURCES.map(async (source) => {
          try {
            const resp = await fetch(source.url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; NER-Immigration-Monitor/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
              },
              signal: AbortSignal.timeout(12000),
            });
            if (!resp.ok) {
              console.warn(`RSS ${source.name}: HTTP ${resp.status}`);
              throw new Error(`HTTP ${resp.status}`);
            }
            const xml = await resp.text();
            console.log(`RSS ${source.name}: got ${xml.length} chars`);
            const items = parseRSS(xml);
            console.log(`RSS ${source.name}: parsed ${items.length} items`);

          // Filtrar últimos 7 días
          const sevenDaysAgo = Date.now() - 7 * 86_400_000;
          return items
            .filter((item) => {
              if (!item.pubDate) return true;
              const d = new Date(item.pubDate).getTime();
              return d > sevenDaysAgo;
            })
            .slice(0, 3) // max 3 por fuente
            .map((item) => ({
              title: item.title.slice(0, 100),
              summary: item.description.slice(0, 200),
              source: source.name,
              category: source.category,
              urgency: getUrgency(item.title, item.description),
              url: item.link,
              time: relativeTime(item.pubDate),
              pubDate: item.pubDate,
            }));
        })
      );

      // Consolidar y ordenar por fecha
      for (const result of rssResults) {
        if (result.status === "fulfilled") {
          newsCards.push(...result.value);
        }
      }

      // Ordenar por más reciente primero
      newsCards.sort((a, b) => {
        const da = new Date(a.pubDate || 0).getTime();
        const db = new Date(b.pubDate || 0).getTime();
        return db - da;
      });

      // Tomar las 9 más recientes
      newsCards = newsCards.slice(0, 9);
    } catch (e) {
      console.warn("RSS fetch failed:", e);
    }

    // Si no hay noticias de RSS (todos fallaron), mostrar fallback
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
