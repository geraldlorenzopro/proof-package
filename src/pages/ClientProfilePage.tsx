import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Phone, Mail, Calendar, Tag, FileText, Loader2 } from "lucide-react";
import ChannelLogo from "@/components/intake/ChannelLogo";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
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
  created_at: string;
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("client_profiles")
        .select("id, first_name, last_name, phone, email, source_channel, source_detail, notes, created_at")
        .eq("id", id)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(data);

      const { data: intake } = await supabase
        .from("intake_sessions")
        .select("id, consultation_topic_tag, urgency_level, status, created_at")
        .eq("client_profile_id", id)
        .order("created_at", { ascending: false });
      setSessions(intake || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-foreground">Cliente no encontrado</p>
        <p className="text-sm text-muted-foreground">El perfil solicitado no existe o fue eliminado.</p>
        <button onClick={() => navigate("/hub")} className="text-sm text-accent hover:underline">← Volver al Hub</button>
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Sin nombre";

  const URGENCY: Record<string, { label: string; color: string }> = {
    urgente: { label: "Urgente", color: "text-red-400 bg-red-500/10" },
    prioritario: { label: "Prioritario", color: "text-amber-400 bg-amber-500/10" },
    informativo: { label: "Informativo", color: "text-emerald-400 bg-emerald-500/10" },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <button onClick={() => navigate("/hub")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver al Hub
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xl font-bold">
            {(profile.first_name?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{fullName}</h1>
            <p className="text-sm text-muted-foreground">
              Registrado el {new Date(profile.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Contact info */}
        <div className="border border-border rounded-xl p-5 space-y-3 mb-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Contacto</h2>
          {profile.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{profile.phone}</span>
            </div>
          )}
          {profile.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{profile.email}</span>
            </div>
          )}
          {profile.source_channel && (
            <div className="flex items-center gap-3 text-sm">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <ChannelLogo channel={profile.source_channel} size={16} />
              {profile.source_detail && <span className="text-muted-foreground text-xs">({profile.source_detail})</span>}
            </div>
          )}
          {profile.notes && (
            <div className="flex items-start gap-3 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground">{profile.notes}</span>
            </div>
          )}
        </div>

        {/* Intake sessions */}
        <div className="border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Consultas registradas</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consultas registradas aún.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const u = URGENCY[s.urgency_level || ""] || { label: s.urgency_level, color: "text-muted-foreground bg-muted" };
                return (
                  <div key={s.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.consultation_topic_tag || "Sin tema"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(s.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.color}`}>{u.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
