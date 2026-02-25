import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_TEXTS = 50;
const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 2000;
const MAX_TOTAL_LENGTH = 10000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { texts } = body as { texts: Record<string, string> };

    if (!texts || typeof texts !== 'object' || Array.isArray(texts)) {
      return new Response(JSON.stringify({ translated: {}, error: 'Invalid input: texts must be an object' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keys = Object.keys(texts);
    if (keys.length === 0) {
      return new Response(JSON.stringify({ translated: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (keys.length > MAX_TEXTS) {
      return new Response(JSON.stringify({ translated: {}, error: `Too many texts. Maximum is ${MAX_TEXTS}.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate and sanitize entries
    const entries: [string, string][] = [];
    let totalLength = 0;

    for (const [k, v] of Object.entries(texts)) {
      if (typeof k !== 'string' || typeof v !== 'string') continue;
      if (k.length > MAX_KEY_LENGTH || v.length > MAX_VALUE_LENGTH) continue;
      const trimmed = v.trim();
      if (trimmed.length === 0) continue;
      totalLength += trimmed.length;
      if (totalLength > MAX_TOTAL_LENGTH) break;
      entries.push([k, trimmed]);
    }

    if (entries.length === 0) {
      return new Response(JSON.stringify({ translated: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const numbered = entries.map(([k, v], i) => `${i + 1}. [${k}]: ${v}`).join('\n');

    const prompt = `You are a professional immigration document translator. Translate the following text to natural, formal English suitable for a USCIS immigration case document.

Rules:
- Translate from ANY language (Spanish, Portuguese, French, etc.) to English.
- If already in English, keep it exactly as-is.
- Keep names of people and places (cities, countries) unchanged.
- Fix obvious typos and spelling errors in the source language before translating.
- Use formal but clear language appropriate for immigration officials.
- Return ONLY a numbered list matching the input format, one line per item.
- Do not add explanations or extra text.

Text to translate:
${numbered}

Output format (exactly):
1. [key]: translated text
2. [key]: translated text
...`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ translated: {}, error: 'Rate limit exceeded. Please try again in a moment.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (response.status === 402) {
      return new Response(JSON.stringify({ translated: {}, error: 'AI credits exhausted. Please add credits in Settings → Workspace → Usage.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawOutput: string = data.choices?.[0]?.message?.content || '';

    // Parse numbered output back to key→translation map
    const translated: Record<string, string> = {};
    const lines = rawOutput.split('\n');
    for (const line of lines) {
      const match = line.match(/^\d+\.\s+\[([^\]]+)\]:\s+(.+)$/);
      if (match) {
        translated[match[1].trim()] = match[2].trim();
      }
    }

    // Fill missing keys with originals
    for (const [k, v] of entries) {
      if (!(k in translated)) translated[k] = v;
    }

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Translation error:', err);
    return new Response(JSON.stringify({ translated: {}, error: 'Translation service error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
