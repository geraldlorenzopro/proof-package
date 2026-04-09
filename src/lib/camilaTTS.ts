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
    .replace(/\bboss\b/gi, "jefa")
    .replace(/\bcrack\b/gi, "campeona")
    .replace(/\bok\b/gi, "está bien")
    .replace(/\bhey\b/gi, "ey")
    .replace(/\bhi\b/gi, "hola")
    .replace(/\bhello\b/gi, "hola")
    .replace(/\bemail\b/gi, "correo")
    .replace(/\blink\b/gi, "enlace")
    .replace(/\bmeeting\b/gi, "reunión")
    .replace(/\bdeadline\b/gi, "fecha límite")
    .replace(/\bintake\b/gi, "formulario inicial")
    .replace(/\bsummary\b/gi, "resumen")
    .replace(/\bstatus\b/gi, "estado")
    .replace(/\btask\b/gi, "tarea")
    .replace(/\bpending\b/gi, "pendiente")
    .replace(/\bcompleted\b/gi, "completado")
    .replace(/\bin progress\b/gi, "en proceso")
    .replace(/\bscheduled\b/gi, "programada")
    .replace(/\bconfirmed\b/gi, "confirmada")
    .replace(/\bcancelled\b/gi, "cancelada")
    .replace(/\bno show\b/gi, "no asistió")
    .replace(/\brescheduled\b/gi, "reprogramada")
    .replace(/\bconsultation\b/gi, "consulta")
    .replace(/\bvirtual office\b/gi, "oficina virtual")
    .replace(/\bAI\b/g, "inteligencia artificial")
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

/** Get best Latin American Spanish voice available */
function getSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();

  const latamPriority = [
    "Paulina",
    "Jimena",
    "Angelica",
    "Microsoft Sabina",
    "Microsoft Dalia",
    "Google español de Estados Unidos",
  ];

  for (const name of latamPriority) {
    const v = voices.find(v => v.name.includes(name));
    if (v) return v;
  }

  const latamVoice = voices.find(v =>
    ["es-MX", "es-419", "es-DO", "es-PR", "es-CO", "es-VE", "es-AR"].includes(v.lang)
  );
  if (latamVoice) return latamVoice;

  const nonSpainVoice = voices.find(v => v.lang.startsWith("es") && v.lang !== "es-ES");
  if (nonSpainVoice) return nonSpainVoice;

  const anyEs = voices.find(v => v.lang.startsWith("es"));
  return anyEs || null;
}

/** Speak text aloud as Camila */
export function speakAsCamila(text: string): void {
  if (!("speechSynthesis" in window)) return;

  stopSpeaking();

  const clean = cleanForSpeech(text);
  if (!clean) return;

  const chunks = splitIntoChunks(clean, 250);

  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = "es-DO";
    utterance.rate = 0.96;
    utterance.pitch = 0.98;
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
