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

// Map old-style category names to standard format
const CATEGORY_ALIASES: Record<string, string> = {
  '1ST': 'F1',
  '1st': 'F1',
  '2A': 'F2A',
  '2A*': 'F2A',
  '2B': 'F2B',
  '3RD': 'F3',
  '3rd': 'F3',
  '4TH': 'F4',
  '4th': 'F4',
  'F1': 'F1',
  'F2A': 'F2A',
  'F2B': 'F2B',
  'F3': 'F3',
  'F4': 'F4',
  // Additional variations found on older bulletins
  'FIRST': 'F1',
  'SECOND A': 'F2A',
  'SECOND B': 'F2B',
  'THIRD': 'F3',
  'FOURTH': 'F4',
  'F-1': 'F1',
  'F-2A': 'F2A',
  'F-2B': 'F2B',
  'F-3': 'F3',
  'F-4': 'F4',
};

const CHARGEABILITY_MAP: Record<string, string> = {
  'all chargeability': 'ALL',
  'all chargeability areas': 'ALL',
  'all charge- ability areas': 'ALL',
  'all charge-ability areas': 'ALL',
  'all chargeability areas except': 'ALL',
  'all chargeability areas except those listed below': 'ALL',
  'china': 'CHINA',
  'china-mainland born': 'CHINA',
  'china - mainland born': 'CHINA',
  'china- mainland born': 'CHINA',
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
  if (cleaned === 'U' || cleaned === 'UNAVAILABLE' || cleaned === '-' || cleaned === '') {
    return { date: null, isCurrent: false };
  }

  const monthMap: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };

  // Format: 01JAN06 or 01JAN2006
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

  // Format: JAN 01, 2006 or January 1, 2006
  const longMatch = cleaned.match(/([A-Z]+)\s*(\d{1,2}),?\s*(\d{4})/);
  if (longMatch) {
    const monthAbbr = longMatch[1].substring(0, 3);
    const mon = monthMap[monthAbbr];
    const day = longMatch[2].padStart(2, '0');
    const year = longMatch[3];
    if (mon) {
      return { date: `${year}-${mon}-${day}`, isCurrent: false };
    }
  }

  return { date: null, isCurrent: false };
}

async function fetchBulletin(year: number, month: number): Promise<string | null> {
  const monthName = MONTH_NAMES[month - 1];
  // State Department uses fiscal years (Oct = start of new FY)
  const fiscalYear = month >= 10 ? year + 1 : year;
  
  // Comprehensive URL patterns — State Dept has changed formats multiple times
  const urlPatterns = [
    // Current format (2015+)
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fiscalYear}/visa-bulletin-for-${monthName}-${year}.html`,
    // Alternative without "for"
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fiscalYear}/visa-bulletin-${monthName}-${year}.html`,
    // Using calendar year instead of fiscal year
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${year}/visa-bulletin-for-${monthName}-${year}.html`,
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${year}/visa-bulletin-${monthName}-${year}.html`,
    // Fiscal year -1 variant (some edge cases)
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fiscalYear - 1}/visa-bulletin-for-${monthName}-${year}.html`,
    // Older format with visa-bulletin repeated
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fiscalYear}/visa-bulletin-for-${monthName}-${year}0.html`,
    // Some older bulletins have hyphens or different endings
    `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fiscalYear}/visa-bulletin-for-${monthName}${year}.html`,
  ];
  
  for (const url of urlPatterns) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (res.ok) {
        const html = await res.text();
        // Verify it actually contains visa bulletin data
        if (html.toLowerCase().includes('chargeability') || html.toLowerCase().includes('preference')) {
          console.log(`✅ Found bulletin for ${month}/${year} at: ${url}`);
          return html;
        }
      }
      await res.text().catch(() => {});
    } catch (e) {
      // Continue to next pattern
    }
  }
  
  console.log(`❌ Bulletin not found for ${month}/${year} (tried ${urlPatterns.length} patterns)`);
  return null;
}

function extractFamilyPreferenceDates(html: string, year: number, month: number): BulletinRow[] {
  const rows: BulletinRow[] = [];
  const normalizedHtml = html.replace(/\s+/g, ' ');
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  
  while ((tableMatch = tablePattern.exec(normalizedHtml)) !== null) {
    const tableHtml = tableMatch[1];
    const tableStart = tableMatch.index;
    const contextBefore = normalizedHtml.slice(Math.max(0, tableStart - 3000), tableStart).toLowerCase();
    
    // For newer bulletins, check for "final action" section
    const finalActionIdx = contextBefore.lastIndexOf('final action');
    const datesForFilingIdx = contextBefore.lastIndexOf('dates for filing');
    
    // Skip "dates for filing" tables (we only want final action dates)
    if (datesForFilingIdx > -1 && (finalActionIdx === -1 || datesForFilingIdx > finalActionIdx)) continue;
    
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rowMatches.length < 3) continue;
    
    const headerRow = rowMatches[0][1].toLowerCase();
    const hasChargeability = headerRow.includes('chargeability') || headerRow.includes('china') || 
                              headerRow.includes('india') || headerRow.includes('all charge');
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
        .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim().toUpperCase());
      
      if (cells.length < 2) continue;
      
      const rawCat = cells[0].replace(/\s+/g, '').replace(/\*/g, '').replace(/-/g, '');
      // Robust matching: try alias map first, then regex for ordinal formats
      let cat = CATEGORY_ALIASES[rawCat] || CATEGORY_ALIASES[cells[0].trim()];
      if (!cat) {
        // Handle "1ST", "2A", "2B", "3RD", "4TH" and variations
        if (/^1(ST)?$/.test(rawCat) || /^F?1$/.test(rawCat) || /^FIRST$/.test(rawCat)) cat = 'F1';
        else if (/^2A$/.test(rawCat) || /^F?2A$/.test(rawCat)) cat = 'F2A';
        else if (/^2B$/.test(rawCat) || /^F?2B$/.test(rawCat)) cat = 'F2B';
        else if (/^3(RD)?$/.test(rawCat) || /^F?3$/.test(rawCat) || /^THIRD$/.test(rawCat)) cat = 'F3';
        else if (/^4(TH)?$/.test(rawCat) || /^F?4$/.test(rawCat) || /^FOURTH$/.test(rawCat)) cat = 'F4';
      }
      if (!cat) {
        console.log(`⚠️ Unmatched category: "${rawCat}" (original: "${cells[0]}")`);
        continue;
      }
      
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

async function getExistingMonths(): Promise<Set<string>> {
  const params = new URLSearchParams({
    select: 'bulletin_year,bulletin_month',
    category: 'eq.F1',
    chargeability: 'eq.ALL',
    order: 'bulletin_year.asc,bulletin_month.asc',
    limit: '500',
  });
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/visa_bulletin?${params}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  
  if (!res.ok) return new Set();
  const rows: Array<{ bulletin_year: number; bulletin_month: number }> = await res.json();
  return new Set(rows.map(r => `${r.bulletin_year}-${r.bulletin_month}`));
}

function getMissingMonths(existing: Set<string>, startYear: number, startMonth: number): Array<{ year: number; month: number }> {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const missing: Array<{ year: number; month: number }> = [];
  
  let y = startYear;
  let m = startMonth;
  
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const key = `${y}-${m}`;
    if (!existing.has(key)) {
      missing.push({ year: y, month: m });
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  
  return missing;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Parse body early to check mode
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const fillGaps = body.fill_gaps ?? false;

  // Require webhook secret or authenticated admin (except for fill_gaps which is safe)
  const secret = req.headers.get('x-webhook-secret');
  const expectedSecret = Deno.env.get('GHL_WEBHOOK_SECRET');
  const authHeader = req.headers.get('Authorization');

  let authorized = fillGaps; // fill_gaps is always allowed (public data backfill)

  // Option 1: webhook secret
  if (!authorized && secret && expectedSecret && secret === expectedSecret) {
    authorized = true;
  }

  // Option 2: authenticated admin user
  if (!authorized && authHeader?.startsWith('Bearer ')) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      // Check admin role
      const sbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: member } = await sbAdmin.from('account_members').select('role').eq('user_id', user.id).maybeSingle();
      if (member && (member.role === 'owner' || member.role === 'admin')) {
        authorized = true;
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // body already parsed above
    
    const now = new Date();
    const targetYear = body.year ?? now.getFullYear();
    const targetMonth = body.month ?? (now.getMonth() + 1);
    const backfill = body.backfill ?? false;
    const backfillMonths = body.backfill_months ?? 60;
    const gapStartYear = body.gap_start_year ?? 1991;
    const gapStartMonth = body.gap_start_month ?? 10;
    const batchSize = body.batch_size ?? 24; // Process up to 24 months per invocation to avoid timeouts
    // When called without specific month (cron), also try next month for "upcoming" bulletin
    const autoMode = !body.year && !body.month && !fillGaps;
    
    const monthsToSync: Array<{ year: number; month: number }> = [];
    
    if (fillGaps) {
      // Smart gap-filling: check what's missing and fill only those
      const existing = await getExistingMonths();
      const missing = getMissingMonths(existing, gapStartYear, gapStartMonth);
      console.log(`Found ${missing.length} missing months total. Processing batch of ${batchSize}.`);
      monthsToSync.push(...missing.slice(0, batchSize));
    } else if (backfill) {
      let y = targetYear;
      let m = targetMonth;
      for (let i = 0; i < backfillMonths; i++) {
        monthsToSync.push({ year: y, month: m });
        m--;
        if (m === 0) { m = 12; y--; }
      }
    } else {
      monthsToSync.push({ year: targetYear, month: targetMonth });
      // In auto mode, also try the next month (upcoming bulletin)
      if (autoMode) {
        let nextMonth = targetMonth + 1;
        let nextYear = targetYear;
        if (nextMonth > 12) { nextMonth = 1; nextYear++; }
        monthsToSync.push({ year: nextYear, month: nextMonth });
      }
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
          await logSync(year, month, 0, 'error', 'Page found but no family preference data extracted');
          results.push({ month: `${month}/${year}`, records: 0, status: 'no_data_extracted' });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logSync(year, month, 0, 'error', msg);
        results.push({ month: `${month}/${year}`, records: 0, status: `error: ${msg}` });
      }
      
      // Rate limit to be polite to State Dept servers
      if (monthsToSync.length > 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
    
    // If filling gaps, report remaining
    let remainingGaps = 0;
    if (fillGaps) {
      const existing = await getExistingMonths();
      const missing = getMissingMonths(existing, gapStartYear, gapStartMonth);
      remainingGaps = missing.length;
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        total_inserted: totalInserted, 
        results,
        ...(fillGaps ? { remaining_gaps: remainingGaps } : {}),
      }),
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
