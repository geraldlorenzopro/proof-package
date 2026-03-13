import { useState, useEffect } from "react";
import { IMMIGRATION_STATUSES } from "@/lib/immigrationStatuses";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, MapPin, Globe, Calendar, Shield, FileText,
  Save, Loader2, CheckCircle2, ChevronDown, ChevronUp
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface Props {
  clientId: string;
  onUpdated?: () => void;
}

interface ProfileData {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  dob: string | null;
  gender: string | null;
  country_of_birth: string | null;
  city_of_birth: string | null;
  province_of_birth: string | null;
  country_of_citizenship: string | null;
  immigration_status: string | null;
  a_number: string | null;
  ssn_last4: string | null;
  i94_number: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiration: string | null;
  class_of_admission: string | null;
  date_of_last_entry: string | null;
  place_of_last_entry: string | null;
  marital_status: string | null;
  address_street: string | null;
  address_apt: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  mailing_same_as_physical: boolean | null;
  mailing_street: string | null;
  mailing_apt: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  mailing_country: string | null;
  notes: string | null;
}

const emptyProfile: ProfileData = {
  first_name: null, middle_name: null, last_name: null,
  email: null, phone: null, mobile_phone: null,
  dob: null, gender: null, country_of_birth: null, city_of_birth: null, province_of_birth: null,
  country_of_citizenship: null, immigration_status: null,
  a_number: null, ssn_last4: null, i94_number: null,
  passport_number: null, passport_country: null, passport_expiration: null,
  class_of_admission: null, date_of_last_entry: null, place_of_last_entry: null,
  marital_status: null,
  address_street: null, address_apt: null, address_city: null, address_state: null, address_zip: null, address_country: null,
  mailing_same_as_physical: true,
  mailing_street: null, mailing_apt: null, mailing_city: null, mailing_state: null, mailing_zip: null, mailing_country: null,
  notes: null,
};

const sections = [
  { id: "personal", label: "Datos Personales", icon: User },
  { id: "immigration", label: "Inmigración", icon: Shield },
  { id: "address", label: "Dirección", icon: MapPin },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "notes", label: "Notas", icon: FileText },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function ClientProfileEditor({ clientId, onUpdated }: Props) {
  const [data, setData] = useState<ProfileData>(emptyProfile);
  const [original, setOriginal] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["personal"]));

  useEffect(() => {
    fetchProfile();
  }, [clientId]);

  async function fetchProfile() {
    setLoading(true);
    const { data: p, error } = await supabase
      .from("client_profiles")
      .select("first_name, middle_name, last_name, email, phone, mobile_phone, dob, gender, country_of_birth, city_of_birth, province_of_birth, country_of_citizenship, immigration_status, a_number, ssn_last4, i94_number, passport_number, passport_country, passport_expiration, class_of_admission, date_of_last_entry, place_of_last_entry, marital_status, address_street, address_apt, address_city, address_state, address_zip, address_country, mailing_same_as_physical, mailing_street, mailing_apt, mailing_city, mailing_state, mailing_zip, mailing_country, notes")
      .eq("id", clientId)
      .single();

    if (p && !error) {
      setData(p as ProfileData);
      setOriginal(p as ProfileData);
    }
    setLoading(false);
  }

  const hasChanges = JSON.stringify(data) !== JSON.stringify(original);

  const set = (field: keyof ProfileData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value || null }));
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("client_profiles")
      .update(data)
      .eq("id", clientId);

    if (error) {
      toast.error("Error al guardar");
      console.error(error);
    } else {
      toast.success("Perfil actualizado");
      setOriginal(data);
      onUpdated?.();
      logAudit({
        action: "client.updated",
        entity_type: "client",
        entity_id: clientId,
        entity_label: [data.first_name, data.last_name].filter(Boolean).join(" ") || undefined,
      });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-jarvis animate-spin" />
      </div>
    );
  }

  const inputClass = "bg-muted/50 border-border focus:border-jarvis/50 text-sm h-9";

  return (
    <div className="space-y-3">
      {/* Save bar */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-10 flex items-center gap-3 rounded-xl border border-jarvis/20 bg-jarvis/5 backdrop-blur-md px-4 py-3"
        >
          <div className="w-2 h-2 rounded-full bg-jarvis animate-pulse" />
          <span className="text-sm text-jarvis font-medium flex-1">Cambios sin guardar</span>
          <Button size="sm" variant="outline" onClick={() => { setData(original); }}>
            Descartar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-jarvis hover:bg-jarvis/90 gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </Button>
        </motion.div>
      )}

      {/* Sections */}
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        const Icon = section.icon;

        return (
          <div key={section.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
            >
              <Icon className="w-4 h-4 text-jarvis" />
              <span className="text-sm font-semibold text-foreground flex-1">{section.label}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 border-t border-border/50"
              >
                <div className="pt-3">
                  {section.id === "personal" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Field label="Nombre">
                        <Input className={inputClass} value={data.first_name || ""} onChange={(e) => set("first_name", e.target.value)} />
                      </Field>
                      <Field label="Segundo nombre">
                        <Input className={inputClass} value={data.middle_name || ""} onChange={(e) => set("middle_name", e.target.value)} />
                      </Field>
                      <Field label="Apellido">
                        <Input className={inputClass} value={data.last_name || ""} onChange={(e) => set("last_name", e.target.value)} />
                      </Field>
                      <Field label="Email">
                        <Input className={inputClass} type="email" value={data.email || ""} onChange={(e) => set("email", e.target.value)} />
                      </Field>
                      <Field label="Teléfono">
                        <Input className={inputClass} value={data.phone || ""} onChange={(e) => set("phone", e.target.value)} />
                      </Field>
                      <Field label="Celular">
                        <Input className={inputClass} value={data.mobile_phone || ""} onChange={(e) => set("mobile_phone", e.target.value)} />
                      </Field>
                      <Field label="Fecha de nacimiento">
                        <Input className={inputClass} type="date" value={data.dob || ""} onChange={(e) => set("dob", e.target.value)} />
                      </Field>
                      <Field label="Género">
                        <Select value={data.gender || ""} onValueChange={(v) => set("gender", v)}>
                          <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Masculino</SelectItem>
                            <SelectItem value="female">Femenino</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Estado civil">
                        <Select value={data.marital_status || ""} onValueChange={(v) => set("marital_status", v)}>
                          <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Soltero/a</SelectItem>
                            <SelectItem value="married">Casado/a</SelectItem>
                            <SelectItem value="divorced">Divorciado/a</SelectItem>
                            <SelectItem value="widowed">Viudo/a</SelectItem>
                            <SelectItem value="separated">Separado/a</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="País de nacimiento">
                        <Input className={inputClass} value={data.country_of_birth || ""} onChange={(e) => set("country_of_birth", e.target.value)} />
                      </Field>
                      <Field label="Ciudad de nacimiento">
                        <Input className={inputClass} value={data.city_of_birth || ""} onChange={(e) => set("city_of_birth", e.target.value)} />
                      </Field>
                      <Field label="Provincia de nacimiento">
                        <Input className={inputClass} value={data.province_of_birth || ""} onChange={(e) => set("province_of_birth", e.target.value)} />
                      </Field>
                      <Field label="Ciudadanía">
                        <Input className={inputClass} value={data.country_of_citizenship || ""} onChange={(e) => set("country_of_citizenship", e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {section.id === "immigration" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Field label="Estatus migratorio">
                        <Select value={data.immigration_status || ""} onValueChange={(v) => set("immigration_status", v)}>
                          <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lpr">Residente Permanente</SelectItem>
                            <SelectItem value="ead">Permiso de Trabajo</SelectItem>
                            <SelectItem value="visa">Visa No-Inmigrante</SelectItem>
                            <SelectItem value="asylee">Asilado</SelectItem>
                            <SelectItem value="refugee">Refugiado</SelectItem>
                            <SelectItem value="tps">TPS</SelectItem>
                            <SelectItem value="daca">DACA</SelectItem>
                            <SelectItem value="undocumented">Sin estatus</SelectItem>
                            <SelectItem value="other">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Clase de admisión">
                        <Input className={inputClass} value={data.class_of_admission || ""} onChange={(e) => set("class_of_admission", e.target.value)} />
                      </Field>
                      <Field label="Fecha de última entrada">
                        <Input className={inputClass} type="date" value={data.date_of_last_entry || ""} onChange={(e) => set("date_of_last_entry", e.target.value)} />
                      </Field>
                      <Field label="Lugar de última entrada">
                        <Input className={inputClass} value={data.place_of_last_entry || ""} onChange={(e) => set("place_of_last_entry", e.target.value)} />
                      </Field>
                      <Field label="Número I-94">
                        <Input className={inputClass} value={data.i94_number || ""} onChange={(e) => set("i94_number", e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {section.id === "address" && (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dirección Física</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <Field label="Calle">
                            <Input className={inputClass} value={data.address_street || ""} onChange={(e) => set("address_street", e.target.value)} />
                          </Field>
                        </div>
                        <Field label="Apt/Suite">
                          <Input className={inputClass} value={data.address_apt || ""} onChange={(e) => set("address_apt", e.target.value)} />
                        </Field>
                        <Field label="Ciudad">
                          <Input className={inputClass} value={data.address_city || ""} onChange={(e) => set("address_city", e.target.value)} />
                        </Field>
                        <Field label="Estado">
                          <Input className={inputClass} value={data.address_state || ""} onChange={(e) => set("address_state", e.target.value)} />
                        </Field>
                        <Field label="Código postal">
                          <Input className={inputClass} value={data.address_zip || ""} onChange={(e) => set("address_zip", e.target.value)} />
                        </Field>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <Switch
                          checked={data.mailing_same_as_physical ?? true}
                          onCheckedChange={(v) => set("mailing_same_as_physical", v)}
                        />
                        <span className="text-xs text-muted-foreground">Dirección de correo igual a la física</span>
                      </div>

                      {!data.mailing_same_as_physical && (
                        <>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dirección de Correo</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <Field label="Calle">
                                <Input className={inputClass} value={data.mailing_street || ""} onChange={(e) => set("mailing_street", e.target.value)} />
                              </Field>
                            </div>
                            <Field label="Apt/Suite">
                              <Input className={inputClass} value={data.mailing_apt || ""} onChange={(e) => set("mailing_apt", e.target.value)} />
                            </Field>
                            <Field label="Ciudad">
                              <Input className={inputClass} value={data.mailing_city || ""} onChange={(e) => set("mailing_city", e.target.value)} />
                            </Field>
                            <Field label="Estado">
                              <Input className={inputClass} value={data.mailing_state || ""} onChange={(e) => set("mailing_state", e.target.value)} />
                            </Field>
                            <Field label="Código postal">
                              <Input className={inputClass} value={data.mailing_zip || ""} onChange={(e) => set("mailing_zip", e.target.value)} />
                            </Field>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {section.id === "documents" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Field label="A-Number">
                        <Input className={inputClass} placeholder="A-XXX-XXX-XXX" value={data.a_number || ""} onChange={(e) => set("a_number", e.target.value)} />
                      </Field>
                      <Field label="SSN (últimos 4)">
                        <Input className={inputClass} placeholder="XXXX" maxLength={4} value={data.ssn_last4 || ""} onChange={(e) => set("ssn_last4", e.target.value)} />
                      </Field>
                      <Field label="Número de pasaporte">
                        <Input className={inputClass} value={data.passport_number || ""} onChange={(e) => set("passport_number", e.target.value)} />
                      </Field>
                      <Field label="País del pasaporte">
                        <Input className={inputClass} value={data.passport_country || ""} onChange={(e) => set("passport_country", e.target.value)} />
                      </Field>
                      <Field label="Vencimiento del pasaporte">
                        <Input className={inputClass} type="date" value={data.passport_expiration || ""} onChange={(e) => set("passport_expiration", e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {section.id === "notes" && (
                    <Field label="Notas del caso">
                      <Textarea
                        className="bg-muted/50 border-border focus:border-jarvis/50 min-h-[100px]"
                        placeholder="Notas internas sobre el cliente..."
                        value={data.notes || ""}
                        onChange={(e) => set("notes", e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
