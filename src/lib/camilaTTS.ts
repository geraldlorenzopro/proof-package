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

// Known female voice names across platforms
const FEMALE_NAMES = [
  'paulina', 'mónica', 'monica', 'jimena', 'angelica', 'angélica',
  'sabina', 'dalia', 'lucia', 'lucía', 'rosa', 'elena', 'francisca',
  'marisol', 'lourdes', 'grandma', 'flo', 'sandy', 'shelley', 'reed',
  'majesty', 'rocko', // some Apple names
];

const MALE_NAMES = [
  'eddy', 'jorge', 'diego', 'juan', 'carlos', 'ralph', 'aaron',
  'albert', 'fred', 'junior', 'grandpa',
];

function esFemenina(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  if (FEMALE_NAMES.some(f => n.includes(f))) return true;
  if (MALE_NAMES.some(m => n.includes(m))) return false;
  // If name contains "female" or similar hints
  if (n.includes('female') || n.includes('mujer')) return true;
  // Unknown gender — treat as neutral (acceptable fallback)
  return true;
}

/** Select the best available Spanish FEMALE voice */
function seleccionarVoz(): SpeechSynthesisVoice | null {
  const voces = speechSynthesis.getVoices();
  if (voces.length === 0) return null;

  const esVoces = voces.filter(v => v.lang.startsWith('es'));

  // Log all Spanish voices for debugging
  console.log('Camila TTS — voces español:', esVoces.map(v => `${v.name} (${v.lang})`));

  // Priority locales
  const locales = ['es-419', 'es-MX', 'es-US', 'es-DO', 'es-PR', 'es-CO', 'es-VE', 'es-AR'];

  // Pass 1: Female voice in priority locale
  for (const loc of locales) {
    const voz = esVoces.find(v => v.lang === loc && esFemenina(v));
    if (voz) {
      console.log('Camila TTS ✓ voz femenina:', voz.name, voz.lang);
      return voz;
    }
  }

  // Pass 2: Any female Spanish voice (non es-ES first)
  const femNoEspana = esVoces.find(v => v.lang !== 'es-ES' && esFemenina(v));
  if (femNoEspana) {
    console.log('Camila TTS ✓ voz femenina:', femNoEspana.name, femNoEspana.lang);
    return femNoEspana;
  }
  const femAny = esVoces.find(v => esFemenina(v));
  if (femAny) {
    console.log('Camila TTS ✓ voz femenina:', femAny.name, femAny.lang);
    return femAny;
  }

  // Pass 3: Known female by name across all voices
  const porNombre = voces.find(v => {
    const n = v.name.toLowerCase();
    return FEMALE_NAMES.some(f => n.includes(f)) && n.includes('spanish');
  });
  if (porNombre) {
    console.log('Camila TTS ✓ por nombre:', porNombre.name, porNombre.lang);
    return porNombre;
  }

  // Pass 4: Any Spanish voice (last resort, even male)
  const cualquiera = esVoces.find(v => v.lang !== 'es-ES') || esVoces[0];
  if (cualquiera) {
    console.warn('Camila TTS ⚠ sin voz femenina, usando:', cualquiera.name, cualquiera.lang);
    return cualquiera;
  }

  console.warn('Camila TTS ✗ sin voces en español');
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
      utterance.lang = 'es-419';
      utterance.rate = 0.97;
      utterance.pitch = 1.1;
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
