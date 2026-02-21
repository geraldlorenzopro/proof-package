import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Copy, Check, ArrowRight, User, Mail, Briefcase, Webhook } from 'lucide-react';

const CASE_TYPES = ['I-130', 'I-485', 'I-751', 'I-129F', 'N-400', 'DACA', 'TPS', 'Otro'];

type Props = {
  onClose: () => void;
  onCreated: (newCase: any) => void;
};

export default function NewCaseModal({ onClose, onCreated }: Props) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [caseType, setCaseType] = useState('I-130');
  const [petitionerName, setPetitionerName] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('client_cases').insert({
      professional_id: user.id,
      client_name: clientName,
      client_email: clientEmail,
      case_type: caseType,
      petitioner_name: petitionerName || null,
      beneficiary_name: beneficiaryName || null,
      webhook_url: webhookUrl || null,
    }).select().single();

    setLoading(false);
    if (!error && data) {
      setCreated(data);
    }
  }

  function getLink() {
    return `${window.location.origin}/upload/${created.access_token}`;
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDone() {
    onCreated(created);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {created ? '¡Caso creado!' : 'Nuevo caso de cliente'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {created ? 'Copia el link y envíalo a tu cliente' : 'Completa los datos básicos del caso'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!created ? (
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />
                  Email del cliente *
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                  Tipo de caso *
                </label>
                <select
                  value={caseType}
                  onChange={e => setCaseType(e.target.value)}
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Peticionario</label>
                  <input
                    type="text"
                    value={petitionerName}
                    onChange={e => setPetitionerName(e.target.value)}
                    placeholder="María García"
                    className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Beneficiario</label>
                  <input
                    type="text"
                    value={beneficiaryName}
                    onChange={e => setBeneficiaryName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* GHL Webhook */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  <Webhook className="w-3.5 h-3.5 inline mr-1" />
                  Webhook de GHL (opcional)
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground/70 mt-1">Se notificará automáticamente cuando el cliente termine de subir evidencias</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? 'Creando…' : 'Crear caso y generar link'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="p-6 space-y-5">
            {/* Success */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Check className="w-5 h-5 text-white" />
              </div>
              <p className="font-semibold text-emerald-700">Caso de <strong>{created.client_name}</strong> creado</p>
              <p className="text-sm text-emerald-600/80 mt-0.5">El link está listo para enviar</p>
            </div>

            {/* Link box */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Link del cliente</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-secondary/60 border rounded-xl px-4 py-3 font-mono text-xs text-muted-foreground break-all">
                  {getLink()}
                </div>
              </div>
              <button
                onClick={copyLink}
                className={`w-full mt-2 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl border transition-all ${
                  copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '¡Link copiado! Pégalo en tu template de GHL' : 'Copiar link para GHL / email'}
              </button>
            </div>

            {/* GHL tip */}
            <div className="bg-secondary/50 border rounded-xl p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground text-xs mb-1">💡 Tip para GoHighLevel</p>
              <p className="text-xs">Pega este link en tu workflow de GHL como variable en el template de email. El cliente hace clic y empieza a subir de inmediato.</p>
            </div>

            <button
              onClick={handleDone}
              className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity"
            >
              Ir al dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
