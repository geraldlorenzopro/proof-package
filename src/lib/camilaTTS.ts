// Camila TTS — Browser SpeechSynthesis wrapper

let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Strip markdown formatting for cleaner speech */
function cleanForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")        // headers
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")      // italic
    .replace(/`(.+?)`/g, "$1")        // inline code
    .replace(/```[\s\S]*?```/g, "")   // code blocks
    .replace(/- /g, ". ")             // list items → pause
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/[|─═┌┐└┘┬┴├┤]/g, "")   // table chars
    .replace(/\n{2,}/g, ". ")         // double newlines
    .replace(/\n/g, ". ")             // single newlines
    .replace(/\s{2,}/g, " ")          // extra spaces
    .replace(/⚠️/g, "Atención: ")
    .replace(/✅/g, "")
    .replace(/📋|📊|📅|👋|🔴|🟢|🟡/g, "")
    .trim();
}

/** Get best Spanish voice available */
function getSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  // Prefer female Spanish voices
  const preferred = [
    "Paulina",    // macOS/iOS Spanish
    "Monica",     // Windows Spanish
    "Google español", // Chrome
    "Microsoft Sabina", // Edge
  ];

  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name));
    if (v) return v;
  }

  // Fallback: any es-* voice, prefer female
  const esVoices = voices.filter(v => v.lang.startsWith("es"));
  return esVoices[0] || null;
}

/** Speak text aloud as Camila */
export function speakAsCamila(text: string): void {
  if (!("speechSynthesis" in window)) return;

  // Cancel any ongoing speech
  stopSpeaking();

  const clean = cleanForSpeech(text);
  if (!clean) return;

  // Split into chunks if too long (browsers have limits ~200-300 chars)
  const chunks = splitIntoChunks(clean, 250);

  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = "es-MX";
    utterance.rate = 1.05;   // Slightly faster for natural feel
    utterance.pitch = 1.1;   // Slightly higher for feminine voice
    utterance.volume = 1.0;

    const voice = getSpanishVoice();
    if (voice) utterance.voice = voice;

    if (i === 0) currentUtterance = utterance;

    speechSynthesis.speak(utterance);
  });
}

/** Stop current speech */
export function stopSpeaking(): void {
  speechSynthesis.cancel();
  currentUtterance = null;
}

/** Check if currently speaking */
export function isSpeaking(): boolean {
  return speechSynthesis.speaking;
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Find last sentence break before maxLen
    let splitAt = remaining.lastIndexOf(". ", maxLen);
    if (splitAt === -1 || splitAt < maxLen / 2) {
      splitAt = remaining.lastIndexOf(", ", maxLen);
    }
    if (splitAt === -1 || splitAt < maxLen / 2) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt === -1) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

// Preload voices (some browsers load async)
if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
