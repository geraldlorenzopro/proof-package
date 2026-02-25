const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_CATEGORIES = ['F1', 'F2A', 'F2B', 'F3', 'F4'];
const VALID_CHARGEABILITIES = ['ALL', 'CHINA', 'INDIA', 'MEXICO', 'PHILIPPINES'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface BulletinRow {
  bulletin_year: number;
  bulletin_month: number;
  final_action_date: string | null;
  is_current: boolean;
  raw_value: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { dob, priority_date, category, chargeability, approval_date } = body;

    // Input validation
    if (!dob || !priority_date || !category || !chargeability) {
      return new Response(
        JSON.stringify({ success: false, error: 'dob, priority_date, category, and chargeability are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date formats
    for (const [name, val] of [['dob', dob], ['priority_date', priority_date], ['approval_date', approval_date]] as const) {
      if (val && (typeof val !== 'string' || !DATE_REGEX.test(val) || isNaN(new Date(val).getTime()))) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid ${name} format. Use YYYY-MM-DD.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const catUpper = String(category).toUpperCase().trim();
    const charUpper = String(chargeability).toUpperCase().trim();

    if (!VALID_CATEGORIES.includes(catUpper)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_CHARGEABILITIES.includes(charUpper)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid chargeability. Must be one of: ${VALID_CHARGEABILITIES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all bulletin data for this category/chargeability
    const params = new URLSearchParams({
      select: 'bulletin_year,bulletin_month,final_action_date,is_current,raw_value',
      category: `eq.${catUpper}`,
      chargeability: `eq.${charUpper}`,
      order: 'bulletin_year.asc,bulletin_month.asc',
      limit: '1000',
    });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visa_bulletin?${params}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!res.ok) throw new Error(`DB query failed: ${await res.text()}`);

    const rows: BulletinRow[] = await res.json();
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'NO_DATA', message: 'No visa bulletin data found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse dates
    const dobDate = new Date(dob);
    const pdDate = new Date(priority_date);
    const adDate = approval_date ? new Date(approval_date) : null;

    // Date when child turns 21
    const turns21 = new Date(dobDate);
    turns21.setFullYear(turns21.getFullYear() + 21);

    // Calculate pending time (approval - priority) in days for CSPA deduction
    let pendingTimeDays = 0;
    if (adDate) {
      pendingTimeDays = Math.floor((adDate.getTime() - pdDate.getTime()) / (1000 * 60 * 60 * 24));
      if (pendingTimeDays < 0) pendingTimeDays = 0;
    }

    // Effective age-out date: when CSPA age = 21
    const effectiveAgeOutDate = new Date(turns21);
    effectiveAgeOutDate.setDate(effectiveAgeOutDate.getDate() + pendingTimeDays);

    // Check if PD is already current using only the LATEST bulletin entry
    const pdStr = priority_date;
    const sortedDesc = [...rows].sort((a, b) =>
      b.bulletin_year !== a.bulletin_year
        ? b.bulletin_year - a.bulletin_year
        : b.bulletin_month - a.bulletin_month
    );
    const latestEntry = sortedDesc[0];
    const alreadyCurrent = latestEntry
      ? (latestEntry.is_current || (latestEntry.final_action_date !== null && latestEntry.final_action_date >= pdStr))
      : false;

    if (alreadyCurrent) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ALREADY_CURRENT',
          message: 'Priority date is already current. Use the standard calculator.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate advancement rate from historical data
    const validRows = rows
      .filter(r => r.final_action_date && !r.is_current)
      .sort((a, b) => a.bulletin_year !== b.bulletin_year
        ? a.bulletin_year - b.bulletin_year
        : a.bulletin_month - b.bulletin_month
      );

    if (validRows.length < 6) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INSUFFICIENT_DATA',
          message: 'Not enough historical data to project trends.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calcRate = (windowRows: BulletinRow[]): number | null => {
      if (windowRows.length < 2) return null;
      const first = windowRows[0];
      const last = windowRows[windowRows.length - 1];
      const firstFAD = new Date(first.final_action_date!).getTime();
      const lastFAD = new Date(last.final_action_date!).getTime();
      const fadAdvanceDays = (lastFAD - firstFAD) / (1000 * 60 * 60 * 24);
      const bulletinMonths =
        (last.bulletin_year - first.bulletin_year) * 12 +
        (last.bulletin_month - first.bulletin_month);
      if (bulletinMonths <= 0) return null;
      return fadAdvanceDays / bulletinMonths;
    };

    const latest = validRows.slice(-12);
    const mid = validRows.slice(-24);
    const long = validRows.slice(-36);

    const rate12 = calcRate(latest);
    const rate24 = calcRate(mid);
    const rate36 = calcRate(long);

    const rates = [rate12, rate24, rate36].filter(r => r !== null) as number[];
    if (rates.length === 0 || rates.every(r => r <= 0)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NO_ADVANCEMENT',
          message: 'The bulletin shows no forward movement for this category/chargeability. Projection is not possible.',
          turns_21: turns21.toISOString().split('T')[0],
          effective_age_out: effectiveAgeOutDate.toISOString().split('T')[0],
          pending_time_days: pendingTimeDays,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const weights = [0.5, 0.3, 0.2];
    let weightedRate = 0;
    let totalWeight = 0;
    rates.forEach((r, i) => {
      weightedRate += r * weights[i];
      totalWeight += weights[i];
    });
    weightedRate = weightedRate / totalWeight;

    const latestRow = validRows[validRows.length - 1];
    const latestFAD = new Date(latestRow.final_action_date!);
    const latestBulletinDate = new Date(latestRow.bulletin_year, latestRow.bulletin_month - 1, 1);

    const fadGapDays = (pdDate.getTime() - latestFAD.getTime()) / (1000 * 60 * 60 * 24);

    if (fadGapDays <= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ALREADY_CURRENT',
          message: 'Priority date appears to be current based on latest data.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const monthsNeeded = weightedRate > 0 ? fadGapDays / weightedRate : Infinity;

    if (!isFinite(monthsNeeded) || monthsNeeded > 600) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'TOO_FAR',
          message: 'At the current rate, the projection exceeds 50 years.',
          turns_21: turns21.toISOString().split('T')[0],
          effective_age_out: effectiveAgeOutDate.toISOString().split('T')[0],
          pending_time_days: pendingTimeDays,
          rate_days_per_month: Math.round(weightedRate * 10) / 10,
          latest_fad: latestRow.final_action_date,
          latest_bulletin: `${latestRow.bulletin_year}-${String(latestRow.bulletin_month).padStart(2, '0')}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectedCurrentDate = new Date(latestBulletinDate);
    projectedCurrentDate.setMonth(projectedCurrentDate.getMonth() + Math.ceil(monthsNeeded));

    const agedOut = projectedCurrentDate > effectiveAgeOutDate;

    const marginDays = (effectiveAgeOutDate.getTime() - projectedCurrentDate.getTime()) / (1000 * 60 * 60 * 24);
    const marginMonths = Math.round(marginDays / 30.44);

    const optimisticRate = Math.max(...rates);
    const pessimisticRate = Math.min(...rates.filter(r => r > 0));

    const optimisticMonths = optimisticRate > 0 ? fadGapDays / optimisticRate : Infinity;
    const pessimisticMonths = pessimisticRate > 0 ? fadGapDays / pessimisticRate : Infinity;

    const optimisticDate = new Date(latestBulletinDate);
    if (isFinite(optimisticMonths)) optimisticDate.setMonth(optimisticDate.getMonth() + Math.ceil(optimisticMonths));

    const pessimisticDate = new Date(latestBulletinDate);
    if (isFinite(pessimisticMonths)) pessimisticDate.setMonth(pessimisticDate.getMonth() + Math.ceil(pessimisticMonths));

    const projectedBioAgeDays = (projectedCurrentDate.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24);
    const projectedCspaAgeDays = projectedBioAgeDays - pendingTimeDays;
    const projectedCspaAgeYears = projectedCspaAgeDays / 365.25;

    return new Response(
      JSON.stringify({
        success: true,
        status: agedOut ? 'WILL_AGE_OUT' : 'MAY_QUALIFY',
        projected_current_date: projectedCurrentDate.toISOString().split('T')[0],
        projected_cspa_age: Math.round(projectedCspaAgeYears * 100) / 100,
        turns_21: turns21.toISOString().split('T')[0],
        effective_age_out: effectiveAgeOutDate.toISOString().split('T')[0],
        margin_months: marginMonths,
        pending_time_days: pendingTimeDays,
        months_to_current: Math.ceil(monthsNeeded),
        rate_days_per_month: Math.round(weightedRate * 10) / 10,
        rates: {
          rate_12m: rate12 !== null ? Math.round(rate12 * 10) / 10 : null,
          rate_24m: rate24 !== null ? Math.round(rate24 * 10) / 10 : null,
          rate_36m: rate36 !== null ? Math.round(rate36 * 10) / 10 : null,
        },
        latest_fad: latestRow.final_action_date,
        latest_bulletin: `${latestRow.bulletin_year}-${String(latestRow.bulletin_month).padStart(2, '0')}`,
        optimistic: isFinite(optimisticMonths) ? {
          date: optimisticDate.toISOString().split('T')[0],
          months: Math.ceil(optimisticMonths),
          aged_out: optimisticDate > effectiveAgeOutDate,
        } : null,
        pessimistic: isFinite(pessimisticMonths) ? {
          date: pessimisticDate.toISOString().split('T')[0],
          months: Math.ceil(pessimisticMonths),
          aged_out: pessimisticDate > effectiveAgeOutDate,
        } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('cspa-projection error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
