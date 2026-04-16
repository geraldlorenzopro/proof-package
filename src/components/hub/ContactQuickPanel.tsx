import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Phone, Mail, MessageSquare, ExternalLink, Send,
  FileText, Briefcase, Clock, ChevronRight, Check
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ContactQuickPanelProps {
  contactId: string | null;
  open: boolean;
  onClose: () => void;
  onStartIntake?: (profileId: string, data: { name?: string; phone?: string; email?: string; source_channel?: string }) => void;
}

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source_channel: string | null;
  source_detail: string | null;
  contact_stage: string;
  created_at: string;
}

interface IntakeRecord {
  id: string;
  consultation_topic_tag: string | null;
  status: string | null;
  created_at: string;
}

interface CaseRecord {
  id: string;
  case_type: string;
  file_number: string | null;
  status: string;
  pipeline_stage: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", referido: "Referido", anuncio: "Anuncio",
  website: "Website", llamada: "Llamada", "walk-in": "Walk-in",
  youtube: "YouTube",
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-500/10 text-green-400 border-green-500/20",
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  website: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  llamada: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", prospect: "Prospecto", client: "Cliente",
  inactive: "Inactivo", former: "Anterior",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  prospect: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  client: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  inactive: "bg-muted/50 text-muted-foreground border-border",
};

const TOPIC_LABELS: Record<string, string> = {
  family: "Familia", employment: "Empleo", humanitarian: "Humanitario",
  removal: "Remoción", naturalization: "Naturalización", other: "Otro",
  adjustment: "Ajuste de Estatus", consular: "Consular",
};

export default function ContactQuickPanel({ contactId, open, onClose, onStartIntake }: ContactQuickPanelProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!contactId || !open) {
      setProfile(null);
      setIntakes([]);
      setCases([]);
      setLoading(true);
      return;
    }
    loadData(contactId);
  }, [contactId, open]);

  async function loadData(id: string) {
    setLoading(true);
    const [profileRes, intakesRes, casesRes] = await Promise.all([
      supabase.from("client_profiles")
        .select("id, first_name, last_name, middle_name, email, phone, notes, source_channel, source_detail, contact_stage, created_at")
        .eq("id", id)
        .single(),
      supabase.from("intake_sessions")
        .select("id, consultation_topic_tag, status, created_at")
        .eq("client_profile_id", id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("client_cases")
        .select("id, case_type, file_number, status, pipeline_stage")
        .eq("client_profile_id", id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    setProfile(profileRes.data as any);
    setIntakes((intakesRes.data as any) || []);
    setCases((casesRes.data as any) || []);
    setLoading(false);
  }

  const getName = (p: ProfileData) => {
    const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
    return name ? normalizeClientName(name) : p.phone || p.email || "Sin identificar";
  };

  const getInitials = (p: ProfileData) => {
    if (p.first_name || p.last_name) {
      return ((p.first_name?.[0] || "") + (p.last_name?.[0] || "")).toUpperCase() || "?";
    }
    return "?";
  };

  const isNew = (created: string) => Date.now() - new Date(created).getTime() < 24 * 60 * 60 * 1000;

  const cleanPhone = (phone: string) => phone.replace(/[^+\d]/g, "");

  async function handleSaveNote() {
    if (!quickNote.trim() || !profile) return;
    setSavingNote(true);
    const now = format(new Date(), "d MMM h:mma", { locale: es });
    const entry = `[${now}]: ${quickNote.trim()}`;
    const newNotes = profile.notes ? `${entry}\n${profile.notes}` : entry;
    const { error } = await supabase
      .from("client_profiles")
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (!error) {
      setProfile({ ...profile, notes: newNotes });
      setQuickNote("");
      toast.success("Nota guardada ✅");
    } else {
      toast.error("Error al guardar nota");
    }
    setSavingNote(false);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col overflow-hidden">
        {loading || !profile ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 pb-4 border-b border-border">
              <SheetHeader className="mb-0">
                <SheetTitle className="sr-only">Contacto</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {getInitials(profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-foreground text-lg truncate">{getName(profile)}</h2>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {profile.source_channel && (
                      <Badge className={`text-[10px] border ${CHANNEL_COLORS[profile.source_channel] || "bg-muted/50 text-muted-foreground border-border"}`}>
                        {CHANNEL_LABELS[profile.source_channel] || profile.source_channel}
                      </Badge>
                    )}
                    <Badge className={`text-[10px] border ${STAGE_COLORS[profile.contact_stage] || "bg-muted/50 text-muted-foreground border-border"}`}>
                      {STAGE_LABELS[profile.contact_stage] || profile.contact_stage}
                    </Badge>
                    {isNew(profile.created_at) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                        NUEVO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Contact info */}
              <div className="space-y-2">
                {profile.phone && (
                  <a href={`tel:${cleanPhone(profile.phone)}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                    <Phone className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span>{profile.phone}</span>
                  </a>
                )}
                {profile.phone && (
                  <a href={`https://wa.me/${cleanPhone(profile.phone)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                    <MessageSquare className="w-4 h-4 shrink-0 text-green-500 group-hover:text-green-400" />
                    <span>WhatsApp</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                  </a>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group truncate">
                    <Mail className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="truncate">{profile.email}</span>
                  </a>
                )}
              </div>

              {/* Website message */}
              {profile.source_channel === "website" && profile.notes && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Su mensaje:</p>
                  <div className="bg-muted/30 border border-border/40 rounded-lg p-3 text-sm text-foreground/80 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {profile.notes}
                  </div>
                </div>
              )}

              {/* History */}
              <div className="space-y-3">
                {/* Intakes */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Consultas anteriores: {intakes.length}
                  </p>
                  {intakes.length > 0 ? (
                    <div className="space-y-1">
                      {intakes.map((i) => (
                        <div key={i.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                          <span className="text-foreground/70">→</span>
                          <span>{TOPIC_LABELS[i.consultation_topic_tag || ""] || i.consultation_topic_tag || "General"}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="text-muted-foreground/70">
                            {formatDistanceToNow(new Date(i.created_at), { locale: es, addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Cases */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    Casos activos: {cases.filter(c => c.status !== "completed").length}
                  </p>
                  {cases.length > 0 ? (
                    <div className="space-y-1">
                      {cases.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                          <span className="text-foreground/70">→</span>
                          <span className="font-medium text-foreground/80">{c.file_number || c.case_type}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>{c.status === "completed" ? "Completado" : "En proceso"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {intakes.length === 0 && cases.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic pl-1">Cliente nuevo — sin historial previo</p>
                )}
              </div>

              {/* Quick note */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Nota rápida</p>
                <div className="flex items-center gap-2">
                  <input
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(); }}
                    placeholder="Agregar nota rápida..."
                    className="flex-1 h-9 px-3 rounded-lg bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!quickNote.trim() || savingNote}
                    className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 disabled:opacity-40 transition-all"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5">
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    if (onStartIntake && profile) {
                      onStartIntake(profile.id, {
                        name: getName(profile),
                        phone: profile.phone || undefined,
                        email: profile.email || undefined,
                        source_channel: profile.source_channel || undefined,
                      });
                      onClose();
                    }
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Nueva consulta
                </Button>

                <div className="flex items-center gap-2">
                  {profile.phone && (
                    <a href={`tel:${cleanPhone(profile.phone)}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Phone className="w-3.5 h-3.5" />Llamar
                      </Button>
                    </a>
                  )}
                  {profile.phone && (
                    <a href={`https://wa.me/${cleanPhone(profile.phone)}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <MessageSquare className="w-3.5 h-3.5" />WhatsApp
                      </Button>
                    </a>
                  )}
                  {profile.email && (
                    <a href={`mailto:${profile.email}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Mail className="w-3.5 h-3.5" />Email
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => { onClose(); navigate(`/hub/clients/${profile.id}`); }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors w-full justify-center"
              >
                Ver perfil completo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
