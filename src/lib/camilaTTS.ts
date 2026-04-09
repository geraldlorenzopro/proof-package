// Camila TTS — Browser SpeechSynthesis wrapper

let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Strip markdown formatting for cleaner speech */
const anglicisms: Record<string, string> = {
  'deadline': 'fecha límite',
  'deadlines': 'fechas límite',
  'meeting': 'reunión',
  'meetings': 'reuniones',
  'follow-up': 'seguimiento',
  'follow up': 'seguimiento',
  'update': 'actualización',
  'updates': 'actualizaciones',
  'email': 'correo',
  'emails': 'correos',
  'schedule': 'agenda',
  'task': 'tarea',
  'tasks': 'tareas',
  'client': 'cliente',
  'clients': 'clientes',
  'status': 'estado',
  'pending': 'pendiente',
  'billing': 'facturación',
  'overdue': 'vencido',
  'dashboard': 'panel',
  'link': 'enlace',
  'links': 'enlaces',
  'ticket': 'expediente',
  'tickets': 'expedientes',
  'issue': 'problema',
  'issues': 'problemas',
  'ok': 'bien',
  'okay': 'entendido',
  'check': 'verificar',
  'chat': 'conversación',
  'login': 'acceso',
  'case': 'caso',
  'cases': 'casos',
};

function cleanForSpeech(text: string): string {
  let result = text
    // Strip markdown
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/- /g, ". ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[|─═┌┐└┘┬┴├┤]/g, "");

  // Apply anglicism replacements case-insensitively
  for (const [eng, esp] of Object.entries(anglicisms)) {
    const escaped = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), esp);
  }

  // Strip emojis
  result = result
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

  return result;
}

const LATAM_SPANISH_LANGS = ["es-DO", "es-PR", "es-419", "es-MX", "es-CO", "es-VE", "es-AR", "es-CL", "es-PE", "es-EC"];

/** Get best Latin American Spanish voice available */
function getSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const preferredNames = [
    "Paulina",
    "Jimena",
    "Angelica",
    "Microsoft Dalia",
    "Microsoft Sabina",
    "Google español",
  ];

  for (const lang of LATAM_SPANISH_LANGS) {
    const exactLangVoice = voices.find((v) => v.lang === lang && preferredNames.some((name) => v.name.includes(name)));
    if (exactLangVoice) return exactLangVoice;
  }

  for (const lang of LATAM_SPANISH_LANGS) {
    const exactLangVoice = voices.find((v) => v.lang === lang);
    if (exactLangVoice) return exactLangVoice;
  }

  const genericLatam = voices.find((v) =>
    v.lang.startsWith("es") && v.lang !== "es-ES" && !v.name.toLowerCase().includes("spain")
  );
  if (genericLatam) return genericLatam;

  return voices.find((v) => v.lang.startsWith("es")) || null;
}

/** Speak text aloud as Camila */
export function speakAsCamila(text: string): void {
  if (!("speechSynthesis" in window)) return;

  stopSpeaking();

  const clean = cleanForSpeech(text);
  if (!clean) return;

  const chunks = splitIntoChunks(clean, 250);
  const voice = getSpanishVoice();

  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = voice?.lang || "es-419";
    utterance.rate = 0.92;
    utterance.pitch = 0.95;
    utterance.volume = 1.0;

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
