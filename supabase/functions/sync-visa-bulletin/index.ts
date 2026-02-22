const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const CATEGORIES = ['F1', 'F2A', 'F2B', 'F3', 'F4'];

const CHARGEABILITY_MAP: Record<string, string> = {
  'all chargeability': 'ALL',
  'china': 'CHINA',
  'india': 'INDIA',
  'mexico': 'MEXICO',
  'philippines': 'PHILIPPINES',
};

interface BulletinRow {
  bulletin_year: number;
  bulletin_month: number;
  category: string;
  chargeability: string;
  final_action_date: string | null;
  is_current: boolean;
  raw_value: string;
}

function parseVisaDate(raw: string): { date: string | null; isCurrent: boolean } {
  const cleaned = raw.trim().toUpperCase();
  if (cleaned === 'C' || cleaned === 'CURRENT') {
    return { date: null, isCurrent: true };
  }
  if (cleaned === 'U' || cleaned === 'UNAVAILABLE' || cleaned === '-') {
    return { date: null, isCurrent: false };
  }

  const monthMap: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };

  const match = cleaned.match(/^(\d{2})([A-Z]{3})(\d{2,4})$/);
  if (match) {
    const day = match[1];
    const mon = monthMap[match[2]];
    let year = match[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? '19' + year : '20' + year;
    }
    if (mon) {
      return { date: `${year}-${mon}-${day}`, isCurrent: false };
    }
  }

  return { date: null, isCurrent: false };
}

async function fetchBulletin(year: number, month: number): Promise<string | null> {
  const monthName = MONTH_NAMES[month - 1];
  const url = `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${year}/visa-bulletin-for-${monthName}-${year}.html`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NERImmigration/1.0)',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) {
      console.log(`Bulletin not found for ${month}/${year}: ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.error(`Error fetching bulletin ${month}/${year}:`, e);
    return null;
  }
}

function extractFamilyPreferenceDates(html: string, year: number, month: number): BulletinRow[] {
  const rows: BulletinRow[] = [];
  const normalizedHtml = html.replace(/\s+/g, ' ');
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  
  while ((tableMatch = tablePattern.exec(normalizedHtml)) !== null) {
    const tableHtml = tableMatch[1];
    const tableStart = tableMatch.index;
    const contextBefore = normalizedHtml.slice(Math.max(0, tableStart - 2000), tableStart).toLowerCase();
    
    const finalActionIdx = contextBefore.lastIndexOf('final action');
    const datesForFilingIdx = contextBefore.lastIndexOf('dates for filing');
    
    if (finalActionIdx === -1) continue;
    if (datesForFilingIdx > finalActionIdx) continue;
    
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rowMatches.length < 3) continue;
    
    const headerRow = rowMatches[0][1].toLowerCase();
    const hasChargeability = headerRow.includes('chargeability') || headerRow.includes('china') || headerRow.includes('india');
    if (!hasChargeability) continue;
    
    const headerCells = [...rowMatches[0][1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
    
    const colMapping: Array<string | null> = headerCells.map(cell => {
      for (const [key, val] of Object.entries(CHARGEABILITY_MAP)) {
        if (cell.includes(key)) return val;
      }
      return null;
    });
    
    if (!colMapping.some(c => c !== null)) continue;
    
    for (let i = 1; i < rowMatches.length; i++) {
      const cells = [...rowMatches[i][1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim().toUpperCase());
      
      if (cells.length < 2) continue;
      
      const cat = cells[0].replace(/\s+/g, '');
      if (!CATEGORIES.includes(cat)) continue;
      
      for (let col = 1; col < cells.length && col < colMapping.length; col++) {
        const chargeability = colMapping[col];
        if (!chargeability) continue;
        
        const rawValue = cells[col];
        const { date, isCurrent } = parseVisaDate(rawValue);
        
        rows.push({
          bulletin_year: year,
          bulletin_month: month,
          category: cat,
          chargeability,
          final_action_date: date,
          is_current: isCurrent,
          raw_value: rawValue,
        });
      }
    }
    
    if (rows.length > 0) break;
  }
  
  return rows;
}

async function upsertRows(rows: BulletinRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/visa_bulletin?on_conflict=bulletin_year,bulletin_month,category,chargeability`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    }
  );
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB upsert failed: ${err}`);
  }
  
  return rows.length;
}

async function logSync(year: number, month: number, records: number, status: 'success' | 'error', errorMessage?: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/bulletin_sync_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ bulletin_year: year, bulletin_month: month, records_inserted: records, status, error_message: errorMessage }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    
    const now = new Date();
    const targetYear = body.year ?? now.getFullYear();
    const targetMonth = body.month ?? (now.getMonth() + 1);
    const backfill = body.backfill ?? false;
    const backfillMonths = body.backfill_months ?? 60;
    
    const monthsToSync: Array<{ year: number; month: number }> = [];
    
    if (backfill) {
      let y = targetYear;
      let m = targetMonth;
      for (let i = 0; i < backfillMonths; i++) {
        monthsToSync.push({ year: y, month: m });
        m--;
        if (m === 0) { m = 12; y--; }
      }
    } else {
      monthsToSync.push({ year: targetYear, month: targetMonth });
    }
    
    let totalInserted = 0;
    const results: Array<{ month: string; records: number; status: string }> = [];
    
    for (const { year, month } of monthsToSync) {
      console.log(`Syncing ${month}/${year}...`);
      
      try {
        const html = await fetchBulletin(year, month);
        if (!html) {
          results.push({ month: `${month}/${year}`, records: 0, status: 'not_found' });
          continue;
        }
        
        const extractedRows = extractFamilyPreferenceDates(html, year, month);
        console.log(`Found ${extractedRows.length} rows for ${month}/${year}`);
        
        if (extractedRows.length > 0) {
          await upsertRows(extractedRows);
          await logSync(year, month, extractedRows.length, 'success');
          totalInserted += extractedRows.length;
          results.push({ month: `${month}/${year}`, records: extractedRows.length, status: 'success' });
        } else {
          results.push({ month: `${month}/${year}`, records: 0, status: 'no_data' });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logSync(year, month, 0, 'error', msg);
        results.push({ month: `${month}/${year}`, records: 0, status: `error: ${msg}` });
      }
      
      if (monthsToSync.length > 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, total_inserted: totalInserted, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync failed:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
