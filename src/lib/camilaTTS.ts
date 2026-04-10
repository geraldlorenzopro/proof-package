// Camila TTS — ElevenLabs via Edge Function, fallback to Browser SpeechSynthesis

let currentAudio: HTMLAudioElement | null = null;
let ttsEnabled = true;
let currentAbort: AbortController | null = null;
let isFetching = false;

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-tts`;

function cleanForSpeech(text: string): string {
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
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{20E3}]/gu, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Speak text aloud as Camila using ElevenLabs (via edge function) */
export async function speakAsCamila(text: string): Promise<void> {
  if (!ttsEnabled) return;
  stopSpeaking();

  const clean = cleanForSpeech(text);
  if (!clean) return;

  try {
    const resp = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text: clean }),
    });

    if (!resp.ok) throw new Error(`TTS ${resp.status}`);

    const data = await resp.json();

    if (data.audio) {
      const audioType = data.audioType || "audio/mpeg";
      const audioUrl = `data:${audioType};base64,${data.audio}`;
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      await audio.play();
      console.log("Camila TTS ✓ source:", data.source || "elevenlabs");
      return;
    }
  } catch (err) {
    console.warn("Camila TTS edge function failed, falling back to browser:", err);
  }

  // Fallback: browser SpeechSynthesis
  fallbackBrowserTTS(clean);
}

function fallbackBrowserTTS(text: string) {
  if (!("speechSynthesis" in window)) return;

  const chunks = splitIntoChunks(text, 250);
  const voces = speechSynthesis.getVoices();
  const esVoz = voces.find(v => v.lang.startsWith("es") && v.lang !== "es-ES")
    || voces.find(v => v.lang.startsWith("es"))
    || null;

  chunks.forEach((chunk) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = "es-419";
    u.rate = 0.97;
    u.pitch = 1.1;
    if (esVoz) u.voice = esVoz;
    speechSynthesis.speak(u);
  });
}

/** Stop current speech */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

/** Check if currently speaking */
export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if ("speechSynthesis" in window) return speechSynthesis.speaking;
  return false;
}

/** Enable/disable TTS globally */
export function setTtsEnabled(enabled: boolean): void {
  ttsEnabled = enabled;
  if (!enabled) stopSpeaking();
}

export function isTtsEnabled(): boolean {
  return ttsEnabled;
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf(". ", maxLen);
    if (splitAt === -1 || splitAt < maxLen / 2) splitAt = remaining.lastIndexOf(", ", maxLen);
    if (splitAt === -1 || splitAt < maxLen / 2) splitAt = remaining.lastIndexOf(" ", maxLen);
    if (splitAt === -1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/** Log available Spanish voices for diagnostics */
export function logVocesDiagnostico(): void {
  if (!("speechSynthesis" in window)) return;
  const voces = speechSynthesis.getVoices();
  const espanol = voces.filter(v => v.lang.startsWith("es"));
  console.log("Camila TTS — Voces español:", espanol.map(v => `${v.name} (${v.lang})`));
}

// Preload browser voices as fallback
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
