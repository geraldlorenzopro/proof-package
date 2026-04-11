import { supabase } from "@/integrations/supabase/client";

let currentAudio: HTMLAudioElement | null = null;
let isSpeakingFlag = false;

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

export function cleanForSpeech(text: string): string {
  let result = text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/- /g, ". ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[|─═┌┐└┘┬┴├┤]/g, "");

  for (const [eng, esp] of Object.entries(anglicisms)) {
    const escaped = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), esp);
  }

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

export async function speakAsCamila(text: string): Promise<void> {
  if (!text?.trim()) return;
  stopSpeaking();

  const cleaned = cleanForSpeech(text);
  if (!cleaned.trim()) return;

  try {
    isSpeakingFlag = true;
    const { data, error } = await supabase.functions.invoke("camila-tts-openai", {
      body: { text: cleaned },
    });

    if (error) throw error;

    const blob = new Blob([data], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.playbackRate = 1.0;

    await new Promise<void>((resolve) => {
      if (!currentAudio) return resolve();
      currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        isSpeakingFlag = false;
        resolve();
      };
      currentAudio.onerror = () => {
        URL.revokeObjectURL(url);
        isSpeakingFlag = false;
        fallbackBrowserTTS(cleaned);
        resolve();
      };
      currentAudio.play().catch(() => {
        isSpeakingFlag = false;
        fallbackBrowserTTS(cleaned);
        resolve();
      });
    });
  } catch (err) {
    console.error("OpenAI TTS error, falling back to browser TTS:", err);
    isSpeakingFlag = false;
    fallbackBrowserTTS(cleaned);
  }
}

function fallbackBrowserTTS(text: string): void {
  if (!window.speechSynthesis) return;
  stopSpeaking();
  isSpeakingFlag = true;

  const chunks = text.match(/.{1,250}(?:\s|$)/g) || [text];
  let index = 0;

  function speakNext() {
    if (index >= chunks.length) { isSpeakingFlag = false; return; }
    const utterance = new SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang = "es-419";
    utterance.rate = 0.92;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const latinVoice = voices.find(v =>
      ['es-DO','es-PR','es-419','es-MX','es-CO','es-US'].some(l => v.lang.startsWith(l))
    );
    if (latinVoice) utterance.voice = latinVoice;

    utterance.onend = speakNext;
    utterance.onerror = () => { isSpeakingFlag = false; };
    window.speechSynthesis.speak(utterance);
  }
  speakNext();
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  isSpeakingFlag = false;
}

export function isSpeaking(): boolean {
  return isSpeakingFlag;
}
