const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_CATEGORIES = ['F1', 'F2A', 'F2B', 'F3', 'F4'];
const VALID_CHARGEABILITIES = ['ALL', 'CHINA', 'INDIA', 'MEXICO', 'PHILIPPINES'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { priority_date, category, chargeability } = body;

    if (!priority_date || !category || !chargeability) {
      return new Response(
        JSON.stringify({ success: false, error: 'priority_date, category, and chargeability are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate types
    if (typeof priority_date !== 'string' || typeof category !== 'string' || typeof chargeability !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'All parameters must be strings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format
    if (!DATE_REGEX.test(priority_date)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid priority_date format. Use YYYY-MM-DD.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pd = new Date(priority_date);
    if (isNaN(pd.getTime())) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid priority_date value' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const catUpper = category.toUpperCase().trim();
    const charUpper = chargeability.toUpperCase().trim();

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

    const pdYear = pd.getFullYear();
    const pdMonth = pd.getMonth() + 1;

    const params = new URLSearchParams({
      select: 'bulletin_year,bulletin_month,final_action_date,is_current,raw_value',
      category: `eq.${catUpper}`,
      chargeability: `eq.${charUpper}`,
      order: 'bulletin_year.asc,bulletin_month.asc',
      limit: '600',
    });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visa_bulletin?${params}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!res.ok) {
      throw new Error(`DB query failed: ${await res.text()}`);
    }

    const rows: Array<{
      bulletin_year: number;
      bulletin_month: number;
      final_action_date: string | null;
      is_current: boolean;
      raw_value: string | null;
    }> = await res.json();

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'NO_DATA', message: 'No visa bulletin data found for the given category and chargeability.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priorityDateStr = priority_date;

    const match = rows.find((row) => {
      const bulletinIsAfterOrSamePdMonth =
        row.bulletin_year > pdYear ||
        (row.bulletin_year === pdYear && row.bulletin_month >= pdMonth);

      if (!bulletinIsAfterOrSamePdMonth) return false;
      if (row.is_current) return true;
      if (row.final_action_date) {
        return row.final_action_date >= priorityDateStr;
      }
      return false;
    });

    if (!match) {
      const sortedDesc = [...rows].sort((a, b) =>
        b.bulletin_year !== a.bulletin_year
          ? b.bulletin_year - a.bulletin_year
          : b.bulletin_month - a.bulletin_month
      );
      const latestBulletin = sortedDesc[0];

      return new Response(
        JSON.stringify({
          success: false,
          error: 'NOT_YET_CURRENT',
          message: 'The priority date is not yet current according to the Visa Bulletin.',
          latest_bulletin_year: latestBulletin?.bulletin_year,
          latest_bulletin_month: latestBulletin?.bulletin_month,
          latest_final_action_date: latestBulletin?.final_action_date,
          latest_raw_value: latestBulletin?.raw_value,
          latest_is_current: latestBulletin?.is_current,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const visaAvailableDate = `${match.bulletin_year}-${String(match.bulletin_month).padStart(2, '0')}-01`;

    return new Response(
      JSON.stringify({
        success: true,
        visa_available_date: visaAvailableDate,
        bulletin_year: match.bulletin_year,
        bulletin_month: match.bulletin_month,
        final_action_date: match.final_action_date,
        is_current: match.is_current,
        raw_value: match.raw_value,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-visa-date error:', message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
