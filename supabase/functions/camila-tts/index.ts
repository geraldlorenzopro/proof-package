import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function limpiarTexto(texto: string): string {
  return texto
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/- /g, ". ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[|─═┌┐└┘┬┴├┤]/g, "")
    .replace(/[•·]\s/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{20E3}]/gu, "")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
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

    const textoLimpio = limpiarTexto(text);
    if (!textoLimpio) {
      return new Response(
        JSON.stringify({ audio: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textFinal = textoLimpio.length > 4500
      ? textoLimpio.slice(0, 4500) + "."
      : textoLimpio;

    // ═══ INTENTAR ELEVENLABS PRIMERO ═══
    const elevenKey = Deno.env.get("ELEVENLABS_API_KEY");

    if (elevenKey) {
      try {
        const configuredVoice = Deno.env.get("ELEVENLABS_VOICE_ID");
        const voiceId = configuredVoice || "pFZP5JQG7iQjIQuC4Bku";
        console.log("ELEVENLABS_VOICE_ID env:", configuredVoice ?? "(not set)");
        console.log("Voice ID final:", voiceId);

        const elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "Accept": "audio/mpeg",
              "Content-Type": "application/json",
              "xi-api-key": elevenKey,
            },
            body: JSON.stringify({
              text: textFinal,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.80,
                style: 0.3,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (elevenRes.ok) {
          const audioBuffer = await elevenRes.arrayBuffer();
          // Use Deno's base64 encoder - safe for large buffers
          const base64 = base64Encode(audioBuffer);
          console.log("ElevenLabs TTS exitoso, bytes:", audioBuffer.byteLength);
          return new Response(
            JSON.stringify({
              audio: base64,
              audioType: "audio/mpeg",
              source: "elevenlabs",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const err = await elevenRes.text();
          console.error("ElevenLabs error:", elevenRes.status, err);
        }
      } catch (e) {
        console.error("ElevenLabs exception:", e);
      }
    }

    // ═══ FALLBACK: GOOGLE TTS ═══
    const googleKey = Deno.env.get("GOOGLE_TTS_KEY");

    if (googleKey) {
      try {
        const VOICES = [
          { languageCode: "es-US", name: "es-US-Neural2-F", ssmlGender: "FEMALE" },
          { languageCode: "es-US", name: "es-US-Neural2-A", ssmlGender: "FEMALE" },
          { languageCode: "es-MX", name: "es-MX-Neural2-A", ssmlGender: "FEMALE" },
          { languageCode: "es-US", name: "es-US-Wavenet-F", ssmlGender: "FEMALE" },
        ];

        for (const voice of VOICES) {
          const gRes = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                input: { text: textFinal },
                voice,
                audioConfig: {
                  audioEncoding: "MP3",
                  speakingRate: 1.0,
                  pitch: 0.0,
                },
              }),
            }
          );

          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData.audioContent) {
              console.log("Google TTS voz:", voice.name);
              return new Response(
                JSON.stringify({
                  audio: gData.audioContent,
                  audioType: "audio/mpeg",
                  source: "google",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      } catch (e) {
        console.error("Google TTS exception:", e);
      }
    }

    // Sin TTS disponible
    return new Response(
      JSON.stringify({ audio: null, source: "none" }),
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
