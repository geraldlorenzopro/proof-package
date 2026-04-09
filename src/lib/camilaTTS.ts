// Camila TTS — Browser SpeechSynthesis wrapper

let currentUtterance: SpeechSynthesisUtterance | null = null;

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
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/- /g, ". ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[|─═┌┐└┘┬┴├┤]/g, "")
    .replace(/[•·]\s/g, "");

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

/** Select the best available Spanish voice with priority-based search */
function seleccionarVoz(): SpeechSynthesisVoice | null {
  const voces = speechSynthesis.getVoices();
  if (voces.length === 0) return null;

  // Priority order: es-419 → es-MX → es-US → es-DO → es-PR → es-CO → any es-XX → any es
  const prioridades: ((v: SpeechSynthesisVoice) => boolean)[] = [
    (v) => v.lang === 'es-419',
    (v) => v.lang === 'es-MX',
    (v) => v.lang === 'es-US',
    (v) => v.lang === 'es-DO',
    (v) => v.lang === 'es-PR',
    (v) => v.lang === 'es-CO',
    (v) => v.lang === 'es-VE',
    (v) => v.lang === 'es-AR',
    (v) => v.lang.startsWith('es-') && v.lang !== 'es-ES',
    (v) => v.lang.startsWith('es'),
  ];

  for (const prioridad of prioridades) {
    const voz = voces.find(prioridad);
    if (voz) {
      console.log('Camila TTS usando voz:', voz.name, voz.lang);
      return voz;
    }
  }

  // Last resort: search by name
  const porNombre = voces.find(v => {
    const name = v.name.toLowerCase();
    return name.includes('spanish') ||
      name.includes('español') ||
      name.includes('paulina') ||
      name.includes('monica') ||
      name.includes('mónica') ||
      name.includes('jorge') ||
      name.includes('diego') ||
      name.includes('juan') ||
      name.includes('lucia') ||
      name.includes('lucía') ||
      name.includes('rosa') ||
      name.includes('carlos') ||
      name.includes('jimena') ||
      name.includes('angelica') ||
      name.includes('sabina') ||
      name.includes('dalia');
  });

  if (porNombre) {
    console.log('Camila TTS por nombre:', porNombre.name, porNombre.lang);
    return porNombre;
  }

  console.warn(
    'No se encontró voz en español. Voces disponibles:',
    voces.map(v => `${v.name} (${v.lang})`)
  );
  return null;
}

/** Speak text aloud as Camila */
export function speakAsCamila(text: string): void {
  if (!("speechSynthesis" in window)) return;

  stopSpeaking();

  const clean = cleanForSpeech(text);
  if (!clean) return;

  const chunks = splitIntoChunks(clean, 250);

  function speakChunks(voice: SpeechSynthesisVoice | null) {
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = 'es-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      if (voice) utterance.voice = voice;

      if (i === 0) currentUtterance = utterance;

      speechSynthesis.speak(utterance);
    });
  }

  // Try to get voice immediately
  const vozInmediata = seleccionarVoz();
  if (vozInmediata) {
    speakChunks(vozInmediata);
  } else {
    // Voices may load async — wait for them
    const onVoicesChanged = () => {
      const voz = seleccionarVoz();
      speakChunks(voz);
      speechSynthesis.onvoiceschanged = cachedOnVoicesChanged;
    };
    const cachedOnVoicesChanged = speechSynthesis.onvoiceschanged;
    speechSynthesis.onvoiceschanged = onVoicesChanged;

    // Safety timeout — speak even without Spanish voice after 1s
    setTimeout(() => {
      if (!speechSynthesis.speaking) {
        const voz = seleccionarVoz();
        speakChunks(voz);
        speechSynthesis.onvoiceschanged = cachedOnVoicesChanged;
      }
    }, 1000);
  }
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

/** Log available Spanish voices for diagnostics */
export function logVocesDiagnostico(): void {
  if (!("speechSynthesis" in window)) {
    console.warn('SpeechSynthesis no disponible en este navegador');
    return;
  }

  function logVoces() {
    const voces = speechSynthesis.getVoices();
    const espanol = voces.filter(v => v.lang.startsWith('es'));
    console.log(
      'Camila TTS — Voces en español disponibles:',
      espanol.map(v => `${v.name} (${v.lang})`)
    );
    console.log('Total de voces en el sistema:', voces.length);
  }

  if (speechSynthesis.getVoices().length > 0) {
    logVoces();
  } else {
    speechSynthesis.onvoiceschanged = () => {
      logVoces();
    };
  }
}

// Preload voices
if (typeof window !== 'undefined' && "speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
