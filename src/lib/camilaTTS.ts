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
    // Remove ALL emojis universally
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")  // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")  // misc symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")  // transport
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")  // flags
    .replace(/[\u{2600}-\u{26FF}]/gu, "")    // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")    // dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")    // variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")  // supplemental
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")  // chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")  // symbols extended
    .replace(/[\u{200D}]/gu, "")             // zero-width joiner
    .replace(/[\u{20E3}]/gu, "")             // combining enclosing keycap
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s{2,}/g, " ")
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
