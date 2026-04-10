import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanTextForTTS(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/- /g, ". ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[|─═┌┐└┘┬┴├┤]/g, "")
    .replace(/[•·]\s/g, "")
    // Strip emojis
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{20E3}]/gu, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleTtsKey = Deno.env.get("GOOGLE_TTS_KEY");
    if (!googleTtsKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_TTS_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      return new Response(
        JSON.stringify({ audio: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const truncated = cleanText.length > 4500 ? cleanText.slice(0, 4500) + "..." : cleanText;

    const VOICES = [
      { languageCode: "es-US", name: "es-US-Neural2-F", ssmlGender: "FEMALE" },
      { languageCode: "es-US", name: "es-US-Neural2-A", ssmlGender: "FEMALE" },
      { languageCode: "es-MX", name: "es-MX-Neural2-A", ssmlGender: "FEMALE" },
      { languageCode: "es-US", name: "es-US-Wavenet-F", ssmlGender: "FEMALE" },
    ];

    const ssmlText = `<speak><prosody rate="medium" pitch="0st">${truncated.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</prosody></speak>`;

    let audioBase64: string | null = null;
    let usedVoice = "";

    for (const voice of VOICES) {
      try {
        const ttsResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleTtsKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { ssml: ssmlText },
              voice,
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: 1.0,
                pitch: 0.0,
                effectsProfileId: ["headphone-class-device"],
              },
            }),
          }
        );

        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          if (ttsData.audioContent) {
            audioBase64 = ttsData.audioContent;
            usedVoice = voice.name;
            console.log("Voz usada:", voice.name);
            break;
          }
        } else {
          console.log("Voz no disponible:", voice.name);
        }
      } catch (e) {
        console.log("Error con voz:", voice.name, e);
      }
    }

    return new Response(
      JSON.stringify({ audio: audioBase64, audioType: "audio/mpeg", voice: usedVoice }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("camila-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
