import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json() as { texts: Record<string, string> };

    if (!texts || Object.keys(texts).length === 0) {
      return new Response(JSON.stringify({ translated: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the list of texts to translate
    const entries = Object.entries(texts).filter(([, v]) => v && v.trim().length > 0);
    if (entries.length === 0) {
      return new Response(JSON.stringify({ translated: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const numbered = entries.map(([k, v], i) => `${i + 1}. [${k}]: ${v}`).join('\n');

    const prompt = `You are a professional immigration document translator. Translate the following Spanish phrases to natural, formal English suitable for a USCIS immigration case document. 

Rules:
- Translate ONLY if the text appears to be in Spanish. If already in English, keep it exactly as-is.
- Keep names of people and places (cities, countries) unchanged.
- Use formal but clear language appropriate for immigration officials.
- Return ONLY a numbered list matching the input format, one line per item.
- Do not add explanations or extra text.

Text to translate:
${numbered}

Output format (exactly):
1. [key]: translated text
2. [key]: translated text
...`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

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
        const key = match[1].trim();
        const value = match[2].trim();
        translated[key] = value;
      }
    }

    // Fill any missing keys with original values
    for (const [k, v] of entries) {
      if (!(k in translated)) translated[k] = v;
    }

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Translation error:', err);
    // On error, return empty so caller falls back to originals
    return new Response(JSON.stringify({ translated: {}, error: String(err) }), {
      status: 200, // Return 200 so caller can handle gracefully
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
