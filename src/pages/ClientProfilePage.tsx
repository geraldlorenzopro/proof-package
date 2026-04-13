import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Calendar, Tag, FileText, Loader2, MessageSquare, Pencil, Plus, Briefcase, Activity, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { logAccess } from "@/lib/auditLog";
import ChannelLogo from "@/components/intake/ChannelLogo";
import HubLayout from "@/components/hub/HubLayout";
import IntakeWizard from "@/components/intake/IntakeWizard";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  country_of_birth: string | null;
  city_of_birth: string | null;
  country_of_citizenship: string | null;
  immigration_status: string | null;
  a_number: string | null;
  i94_number: string | null;
  class_of_admission: string | null;
  date_of_last_entry: string | null;
  place_of_last_entry: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiration: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  source_channel: string | null;
  source_detail: string | null;
  notes: string | null;
  created_at: string;
}

interface IntakeSession {
  id: string;
  consultation_topic_tag: string | null;
  urgency_level: string | null;
  status: string | null;
  entry_channel: string | null;
  created_at: string;
}

interface ClientCase {
  id: string;
  case_type: string;
  file_number: string | null;
  status: string;
  pipeline_stage: string | null;
  created_at: string;
}

interface CaseDoc {
  id: string;
  file_name: string;
  category: string | null;
  created_at: string;
}

const URGENCY: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "text-red-400 bg-red-500/10" },
  prioritario: { label: "Prioritario", color: "text-amber-400 bg-amber-500/10" },
  informativo: { label: "Informativo", color: "text-emerald-400 bg-emerald-500/10" },
};

function getCompleteness(p: Profile): number {
  const fields = [p.first_name, p.last_name, p.email, p.phone, p.dob, p.country_of_birth, p.address_city, p.address_state, p.immigration_status];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function getStatusLabel(pct: number) {
  if (pct >= 80) return { label: "Completo", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  if (pct >= 50) return { label: "En progreso", cls: "bg-accent/10 text-accent border-accent/20" };
  return { label: "Nuevo", cls: "bg-jarvis/10 text-jarvis border-jarvis/20" };
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const auditLoggedRef = useRef(false);
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("client_profiles")
        .select("id, first_name, last_name, middle_name, phone, email, dob, gender, country_of_birth, city_of_birth, country_of_citizenship, immigration_status, a_number, i94_number, class_of_admission, date_of_last_entry, place_of_last_entry, passport_number, passport_country, passport_expiration, address_street, address_city, address_state, address_zip, source_channel, source_detail, notes, created_at")
        .eq("id", id)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setProfile(data);

      const [intakeRes, casesRes] = await Promise.all([
        supabase.from("intake_sessions").select("id, consultation_topic_tag, urgency_level, status, entry_channel, created_at").eq("client_profile_id", id).order("created_at", { ascending: false }),
        supabase.from("client_cases").select("id, case_type, file_number, status, pipeline_stage, created_at").eq("client_profile_id", id).order("created_at", { ascending: false }),
      ]);
      setSessions(intakeRes.data || []);
      setCases(casesRes.data || []);

      // Fetch docs for all client cases
      if (casesRes.data && casesRes.data.length > 0) {
        const caseIds = casesRes.data.map((c: any) => c.id);
        const { data: docsData } = await supabase.from("case_documents").select("id, file_name, category, created_at").in("case_id", caseIds).order("created_at", { ascending: false });
        setDocs(docsData || []);
      }

      // Audit log
      if (!auditLoggedRef.current && data) {
        auditLoggedRef.current = true;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const acctId = await supabase.rpc("user_account_id", { _user_id: user.id });
          if (acctId.data) {
            logAccess({
              accountId: acctId.data,
              userId: user.id,
              action: "viewed",
              entityType: "client_profile",
              entityId: id,
              metadata: { client_name: [data.first_name, data.last_name].filter(Boolean).join(" ") },
            });
          }
        }
      }

      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <HubLayout><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></HubLayout>;
  }

  if (notFound || !profile) {
    return (
      <HubLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-foreground">Cliente no encontrado</p>
          <Button variant="outline" onClick={() => navigate("/hub/clients")}>← Volver a Clientes</Button>
        </div>
      </HubLayout>
    );
  }

  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "Sin nombre";
  const pct = getCompleteness(profile);
  const statusBadge = getStatusLabel(pct);
  const initials = ((profile.first_name?.[0] || "") + (profile.last_name?.[0] || "")).toUpperCase() || "?";

  const waLink = profile.phone ? `https://wa.me/${profile.phone.replace(/[^0-9]/g, "")}` : null;
  const mailLink = profile.email ? `mailto:${profile.email}` : null;

  const InfoRow = ({ label, value }: { label: string; value: string | null }) =>
    value ? <div className="flex justify-between py-2 border-b border-border/40"><span className="text-xs text-muted-foreground">{label}</span><span className="text-sm text-foreground font-medium">{value}</span></div> : null;

  return (
    <HubLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jarvis/20 to-accent/10 flex items-center justify-center text-2xl font-bold text-jarvis shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`text-xs border ${statusBadge.cls}`}>{statusBadge.label} · {pct}%</Badge>
              {profile.source_channel && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ChannelLogo channel={profile.source_channel} size={14} />
                  {profile.source_detail && <span>({profile.source_detail})</span>}
                </span>
              )}
              <span className="text-xs text-muted-foreground">Registrado {format(new Date(profile.created_at), "d MMM yyyy", { locale: es })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waLink && <Button variant="outline" size="sm" asChild><a href={waLink} target="_blank" rel="noopener noreferrer"><Phone className="w-4 h-4" /></a></Button>}
            {mailLink && <Button variant="outline" size="sm" asChild><a href={mailLink}><Mail className="w-4 h-4" /></a></Button>}
            <Button onClick={() => setIntakeOpen(true)} size="sm" className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> Nueva consulta
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full justify-start bg-muted/30 border border-border rounded-xl p-1">
            <TabsTrigger value="info" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" />Información</TabsTrigger>
            <TabsTrigger value="consultas" className="gap-1.5 text-xs"><MessageSquare className="w-3.5 h-3.5" />Consultas <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{sessions.length}</Badge></TabsTrigger>
            <TabsTrigger value="casos" className="gap-1.5 text-xs"><Briefcase className="w-3.5 h-3.5" />Casos <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{cases.length}</Badge></TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FolderOpen className="w-3.5 h-3.5" />Docs <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{docs.length}</Badge></TabsTrigger>
          </TabsList>

          {/* INFO TAB */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <Section title="Datos personales">
              <InfoRow label="Nombre completo" value={fullName} />
              <InfoRow label="Fecha de nacimiento" value={profile.dob} />
              <InfoRow label="Género" value={profile.gender} />
              <InfoRow label="País de nacimiento" value={profile.country_of_birth} />
              <InfoRow label="Ciudad de nacimiento" value={profile.city_of_birth} />
              <InfoRow label="Ciudadanía" value={profile.country_of_citizenship} />
            </Section>
            <Section title="Contacto">
              <InfoRow label="Teléfono" value={profile.phone} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Dirección" value={[profile.address_street, profile.address_city, profile.address_state, profile.address_zip].filter(Boolean).join(", ") || null} />
            </Section>
            <Section title="Inmigración">
              <InfoRow label="Status migratorio" value={profile.immigration_status} />
              <InfoRow label="A-Number" value={profile.a_number} />
              <InfoRow label="I-94 Number" value={profile.i94_number} />
              <InfoRow label="Clase de admisión" value={profile.class_of_admission} />
              <InfoRow label="Última entrada" value={profile.date_of_last_entry} />
              <InfoRow label="Lugar de entrada" value={profile.place_of_last_entry} />
            </Section>
            <Section title="Pasaporte">
              <InfoRow label="Número" value={profile.passport_number} />
              <InfoRow label="País" value={profile.passport_country} />
              <InfoRow label="Expiración" value={profile.passport_expiration} />
            </Section>
            {profile.notes && (
              <Section title="Notas">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.notes}</p>
              </Section>
            )}
          </TabsContent>

          {/* CONSULTAS TAB */}
          <TabsContent value="consultas" className="mt-4 space-y-2">
            {sessions.length === 0 ? (
              <Empty label="Sin consultas registradas" />
            ) : (
              sessions.map((s) => {
                const u = URGENCY[s.urgency_level || ""] || { label: s.urgency_level || "—", color: "text-muted-foreground bg-muted" };
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/hub/consultations/${s.id}`)}
                    className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 text-left hover:border-jarvis/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {s.entry_channel && <ChannelLogo channel={s.entry_channel} size={16} />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.consultation_topic_tag || "Sin tema"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />{format(new Date(s.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.color}`}>{u.label}</span>
                  </button>
                );
              })
            )}
          </TabsContent>

          {/* CASOS TAB */}
          <TabsContent value="casos" className="mt-4 space-y-2">
            {cases.length === 0 ? (
              <Empty label="Sin casos vinculados" />
            ) : (
              cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/case-engine/${c.id}`)}
                  className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 text-left hover:border-jarvis/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.file_number || c.case_type}</p>
                    <p className="text-xs text-muted-foreground">{c.case_type} · {c.pipeline_stage || c.status}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </button>
              ))
            )}
          </TabsContent>

          {/* DOCUMENTOS TAB */}
          <TabsContent value="documentos" className="mt-4 space-y-2">
            {docs.length === 0 ? (
              <Empty label="Sin documentos" />
            ) : (
              docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.file_name}</p>
                      <p className="text-xs text-muted-foreground">{d.category || "General"} · {format(new Date(d.created_at), "d MMM yyyy", { locale: es })}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {intakeOpen && profile && (
        <IntakeWizard
          open={intakeOpen}
          onOpenChange={(o) => { if (!o) setIntakeOpen(false); }}
          prefill={{
            name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
            phone: profile.phone || undefined,
            email: profile.email || undefined,
            client_profile_id: profile.id,
          }}
          onCreated={() => {
            setIntakeOpen(false);
            toast.success('Consulta registrada');
          }}
        />
      )}
    </HubLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-4">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{label}</p>;
}
