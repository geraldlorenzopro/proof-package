import { useState, useCallback, useEffect } from "react";
import { ChevronRight, ChevronLeft, Save, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useSmartFormsContext } from "./SmartFormsContext";
import {
  I765Data, defaultI765Data, I765Step, I765_STEPS, I765_STEP_LABELS,
  US_STATES, ELIGIBILITY_CATEGORIES,
} from "./i765Schema";

interface Props {
  lang: "en" | "es";
  initialData?: Partial<I765Data>;
  onSave: (data: I765Data, status: "draft" | "completed") => void;
  onFillUSCIS?: (data: I765Data) => void;
  saving?: boolean;
}

// ─── Field helpers ───
const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
    {children}
  </div>
);

const StateSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="bg-secondary/60 border-border/50"><SelectValue placeholder="State" /></SelectTrigger>
    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
  </Select>
);

const inputCls = "bg-secondary/60 border-border/50 focus:border-accent/60";

export default function I765Wizard({ lang, initialData, onSave, onFillUSCIS, saving }: Props) {
  const [data, setData] = useState<I765Data>({ ...defaultI765Data, ...initialData });
  const [stepIdx, setStepIdx] = useState(0);
  const step = I765_STEPS[stepIdx];
  const { setWizardNav } = useSmartFormsContext();

  const t = useCallback((en: string, es: string) => lang === "es" ? es : en, [lang]);

  // Register wizard nav in layout context
  useEffect(() => {
    setWizardNav({ steps: I765_STEPS, currentStep: stepIdx, setStep: setStepIdx });
    return () => setWizardNav(null);
  }, [stepIdx, setWizardNav]);

  const set = <K extends keyof I765Data>(key: K, value: I765Data[K]) =>
    setData(prev => ({ ...prev, [key]: value }));

  const next = () => stepIdx < I765_STEPS.length - 1 && setStepIdx(stepIdx + 1);
  const prev = () => stepIdx > 0 && setStepIdx(stepIdx - 1);

  // ─── Step renderers ───
  const renderReason = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-accent">{t("What do you need?", "¿Qué necesitas?")}</h3>
      <p className="text-sm text-muted-foreground">{t("Select the option that best describes your situation", "Selecciona la opción que mejor describe tu situación")}</p>
      <RadioGroup value={data.reasonForApplying} onValueChange={v => set("reasonForApplying", v as I765Data["reasonForApplying"])}>
        {[
          { v: "initial", en: "I need a work permit for the first time", es: "Necesito un permiso de trabajo por primera vez" },
          { v: "replacement", en: "I lost or need to replace my work permit", es: "Perdí o necesito reemplazar mi permiso de trabajo" },
          { v: "renewal", en: "I need to renew my work permit", es: "Necesito renovar mi permiso de trabajo" },
        ].map(o => (
          <label key={o.v} className={cn(
            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
            data.reasonForApplying === o.v ? "border-accent/60 bg-accent/5" : "border-border/30 hover:border-border/60"
          )}>
            <RadioGroupItem value={o.v} className="mt-0.5" />
            <span className="text-sm">{t(o.en, o.es)}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );

  const renderPersonal = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("Tell us about yourself", "Cuéntanos sobre ti")}</h3>
      <p className="text-xs text-muted-foreground">{t("Your full legal name as it appears on your documents", "Tu nombre legal completo tal como aparece en tus documentos")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.lastName} onChange={e => set("lastName", e.target.value)} /></Field>
        <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.firstName} onChange={e => set("firstName", e.target.value)} /></Field>
        <Field label={t("Middle Name", "Segundo Nombre")}><Input className={inputCls} value={data.middleName} onChange={e => set("middleName", e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted-foreground mt-4">{t("Have you ever used a different name?", "¿Has usado algún otro nombre?")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Other Last Name", "Otro Apellido")}><Input className={inputCls} value={data.otherLastName} onChange={e => set("otherLastName", e.target.value)} /></Field>
        <Field label={t("Other First Name", "Otro Nombre")}><Input className={inputCls} value={data.otherFirstName} onChange={e => set("otherFirstName", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Field label="A-Number"><Input className={inputCls} value={data.aNumber} onChange={e => set("aNumber", e.target.value)} placeholder="A-" /></Field>
        <Field label="USCIS Online Account #"><Input className={inputCls} value={data.uscisAccountNumber} onChange={e => set("uscisAccountNumber", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="SSN"><Input className={inputCls} value={data.ssn} onChange={e => set("ssn", e.target.value)} placeholder="XXX-XX-XXXX" /></Field>
      </div>
    </div>
  );

  const renderAddress = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("Where do you receive your mail?", "¿Dónde recibes tu correo?")}</h3>
      <Field label={t("In Care Of", "A/C de")}><Input className={inputCls} value={data.mailingCareOf} onChange={e => set("mailingCareOf", e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.mailingStreet} onChange={e => set("mailingStreet", e.target.value)} /></Field>
        <Field label="Apt/Ste/Flr"><Input className={inputCls} value={data.mailingApt} onChange={e => set("mailingApt", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.mailingCity} onChange={e => set("mailingCity", e.target.value)} /></Field>
        <Field label={t("State", "Estado")}><StateSelect value={data.mailingState} onChange={v => set("mailingState", v)} /></Field>
        <Field label="ZIP"><Input className={inputCls} value={data.mailingZip} onChange={e => set("mailingZip", e.target.value)} /></Field>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Checkbox checked={data.sameAddress} onCheckedChange={v => set("sameAddress", !!v)} id="same-addr" />
        <Label htmlFor="same-addr" className="text-sm cursor-pointer">
          {t("Physical address is the same as mailing address", "La dirección física es la misma que la postal")}
        </Label>
      </div>

      {!data.sameAddress && (
        <div className="space-y-4 pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground font-medium mt-3">{t("U.S. Physical Address", "Dirección Física en EE.UU.")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.physicalStreet} onChange={e => set("physicalStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr"><Input className={inputCls} value={data.physicalApt} onChange={e => set("physicalApt", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.physicalCity} onChange={e => set("physicalCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.physicalState} onChange={v => set("physicalState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.physicalZip} onChange={e => set("physicalZip", e.target.value)} /></Field>
          </div>
        </div>
      )}
    </div>
  );

  const renderBackground = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("A little more about you", "Un poco más sobre ti")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Sex", "Sexo")}>
          <RadioGroup value={data.sex} onValueChange={v => set("sex", v as "male" | "female")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="male" />{t("Male", "Masculino")}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="female" />{t("Female", "Femenino")}</label>
          </RadioGroup>
        </Field>
        <Field label={t("Marital Status", "Estado Civil")}>
          <Select value={data.maritalStatus} onValueChange={v => set("maritalStatus", v as I765Data["maritalStatus"])}>
            <SelectTrigger className="bg-secondary/60 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t("Single", "Soltero/a")}</SelectItem>
              <SelectItem value="married">{t("Married", "Casado/a")}</SelectItem>
              <SelectItem value="divorced">{t("Divorced", "Divorciado/a")}</SelectItem>
              <SelectItem value="widowed">{t("Widowed", "Viudo/a")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={data.previouslyFiled} onCheckedChange={v => set("previouslyFiled", !!v)} id="prev-filed" />
        <Label htmlFor="prev-filed" className="text-sm cursor-pointer">{t("Have you previously filed Form I-765?", "¿Ha presentado anteriormente el Formulario I-765?")}</Label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Country of Citizenship", "País de Ciudadanía")}><Input className={inputCls} value={data.countryOfCitizenship1} onChange={e => set("countryOfCitizenship1", e.target.value)} /></Field>
        <Field label={t("2nd Country (if any)", "2do País (si aplica)")}><Input className={inputCls} value={data.countryOfCitizenship2} onChange={e => set("countryOfCitizenship2", e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{t("Place of Birth", "Lugar de Nacimiento")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City/Town", "Ciudad/Pueblo")}><Input className={inputCls} value={data.cityOfBirth} onChange={e => set("cityOfBirth", e.target.value)} /></Field>
        <Field label={t("State/Province", "Estado/Provincia")}><Input className={inputCls} value={data.stateOfBirth} onChange={e => set("stateOfBirth", e.target.value)} /></Field>
        <Field label={t("Country", "País")}><Input className={inputCls} value={data.countryOfBirth} onChange={e => set("countryOfBirth", e.target.value)} /></Field>
      </div>
      <Field label={t("Date of Birth", "Fecha de Nacimiento")}><Input type="date" className={cn(inputCls, "max-w-xs")} value={data.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} /></Field>
    </div>
  );

  const renderArrival = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("When did you arrive in the U.S.?", "¿Cuándo llegaste a EE.UU.?")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="I-94 #"><Input className={inputCls} value={data.i94Number} onChange={e => set("i94Number", e.target.value)} /></Field>
        <Field label={t("Passport Number", "Número de Pasaporte")}><Input className={inputCls} value={data.passportNumber} onChange={e => set("passportNumber", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Travel Document #", "# Documento de Viaje")}><Input className={inputCls} value={data.travelDocNumber} onChange={e => set("travelDocNumber", e.target.value)} /></Field>
        <Field label={t("Country that Issued Passport", "País que Emitió el Pasaporte")}><Input className={inputCls} value={data.passportCountry} onChange={e => set("passportCountry", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Passport Expiration", "Vencimiento del Pasaporte")}><Input type="date" className={inputCls} value={data.passportExpiration} onChange={e => set("passportExpiration", e.target.value)} /></Field>
        <Field label={t("Date of Last Arrival", "Fecha de Última Entrada")}><Input type="date" className={inputCls} value={data.lastArrivalDate} onChange={e => set("lastArrivalDate", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Place of Last Arrival", "Lugar de Última Entrada")}><Input className={inputCls} value={data.lastArrivalPlace} onChange={e => set("lastArrivalPlace", e.target.value)} /></Field>
        <Field label={t("Immigration Status at Arrival", "Estatus Migratorio al Entrar")}><Input className={inputCls} value={data.statusAtArrival} onChange={e => set("statusAtArrival", e.target.value)} placeholder="e.g. B-2, F-1" /></Field>
      </div>
      <Field label={t("Current Immigration Status", "Estatus Migratorio Actual")}><Input className={inputCls} value={data.currentStatus} onChange={e => set("currentStatus", e.target.value)} placeholder="e.g. B-2, parolee, deferred action" /></Field>
    </div>
  );

  const renderEligibility = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("What's your current situation?", "¿Cuál es tu situación actual?")}</h3>
      <p className="text-xs text-muted-foreground">{t("This helps us determine the right category for your case", "Esto nos ayuda a determinar la categoría correcta para tu caso")}</p>
      <Select value={data.eligibilityCategory} onValueChange={v => set("eligibilityCategory", v)}>
        <SelectTrigger className="bg-secondary/60 border-border/50"><SelectValue placeholder={t("Select category", "Seleccionar categoría")} /></SelectTrigger>
        <SelectContent>
          {ELIGIBILITY_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {data.eligibilityCategory === "other" && (
        <Field label={t("Specify Category", "Especificar Categoría")}>
          <Input className={inputCls} value={data.eligibilityCategorySpecific} onChange={e => set("eligibilityCategorySpecific", e.target.value)} placeholder="e.g. (a)(8)" />
        </Field>
      )}

      {data.eligibilityCategory === "(c)(26)" && (
        <Field label={t("H-1B Spouse's I-797 Receipt #", "# de Recibo I-797 del Cónyuge H-1B")}>
          <Input className={inputCls} value={data.h1bReceiptNumber} onChange={e => set("h1bReceiptNumber", e.target.value)} />
        </Field>
      )}

      {data.eligibilityCategory === "(c)(8)" && (
        <div className="space-y-3 p-3 rounded-lg border border-border/40 bg-secondary/20">
          <p className="text-sm">{t("Have you EVER been arrested and/or convicted of any crime?", "¿Ha sido ALGUNA VEZ arrestado y/o condenado por algún delito?")}</p>
          <RadioGroup value={data.c8EverArrested === null ? "" : data.c8EverArrested ? "yes" : "no"} onValueChange={v => set("c8EverArrested", v === "yes")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" />{t("Yes", "Sí")}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" />No</label>
          </RadioGroup>
        </div>
      )}

      {(data.eligibilityCategory === "(c)(35)" || data.eligibilityCategory === "(c)(36)") && (
        <div className="space-y-3">
          <Field label={t("I-140 Receipt #", "# de Recibo I-140")}>
            <Input className={inputCls} value={data.i140ReceiptNumber} onChange={e => set("i140ReceiptNumber", e.target.value)} />
          </Field>
          <div className="p-3 rounded-lg border border-border/40 bg-secondary/20">
            <p className="text-sm">{t("Have you EVER been arrested and/or convicted?", "¿Ha sido ALGUNA VEZ arrestado y/o condenado?")}</p>
            <RadioGroup value={data.c35EverArrested === null ? "" : data.c35EverArrested ? "yes" : "no"} onValueChange={v => set("c35EverArrested", v === "yes")} className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" />{t("Yes", "Sí")}</label>
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" />No</label>
            </RadioGroup>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatement = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("How can we reach you?", "¿Cómo te contactamos?")}</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox checked={data.applicantCanReadEnglish} onCheckedChange={v => { set("applicantCanReadEnglish", !!v); if (v) set("interpreterUsed", false); }} id="can-read" />
          <Label htmlFor="can-read" className="text-sm cursor-pointer">{t("I can read and understand English", "Puedo leer y entender inglés")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={data.interpreterUsed} onCheckedChange={v => { set("interpreterUsed", !!v); if (v) set("applicantCanReadEnglish", false); }} id="interpreter" />
          <Label htmlFor="interpreter" className="text-sm cursor-pointer">{t("An interpreter read this application to me", "Un intérprete me leyó esta solicitud")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={data.preparerUsed} onCheckedChange={v => set("preparerUsed", !!v)} id="preparer" />
          <Label htmlFor="preparer" className="text-sm cursor-pointer">{t("A preparer prepared this application for me", "Un preparador preparó esta solicitud para mí")}</Label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{t("Contact Information", "Información de Contacto")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Daytime Phone", "Teléfono de Día")}><Input className={inputCls} value={data.applicantPhone} onChange={e => set("applicantPhone", e.target.value)} /></Field>
        <Field label={t("Mobile Phone", "Celular")}><Input className={inputCls} value={data.applicantMobile} onChange={e => set("applicantMobile", e.target.value)} /></Field>
        <Field label="Email"><Input className={inputCls} type="email" value={data.applicantEmail} onChange={e => set("applicantEmail", e.target.value)} /></Field>
      </div>
    </div>
  );

  const renderPreparer = () => (
    <div className="space-y-5">
      {data.interpreterUsed && (
        <>
          <h3 className="text-lg font-semibold text-accent">{t("Interpreter Information", "Datos del Intérprete")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.interpreterLastName} onChange={e => set("interpreterLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.interpreterFirstName} onChange={e => set("interpreterFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.interpreterOrg} onChange={e => set("interpreterOrg", e.target.value)} /></Field>
          <Field label={t("Language", "Idioma")}><Input className={inputCls} value={data.interpreterLanguage} onChange={e => set("interpreterLanguage", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.interpreterPhone} onChange={e => set("interpreterPhone", e.target.value)} /></Field>
            <Field label={t("Mobile", "Celular")}><Input className={inputCls} value={data.interpreterMobile} onChange={e => set("interpreterMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.interpreterEmail} onChange={e => set("interpreterEmail", e.target.value)} /></Field>
          </div>
        </>
      )}

      {data.preparerUsed && (
        <>
          <h3 className="text-lg font-semibold text-accent">{t("Who prepared this for you?", "¿Quién te ayudó a preparar esto?")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.preparerLastName} onChange={e => set("preparerLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.preparerFirstName} onChange={e => set("preparerFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.preparerOrg} onChange={e => set("preparerOrg", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.preparerStreet} onChange={e => set("preparerStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr"><Input className={inputCls} value={data.preparerApt} onChange={e => set("preparerApt", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.preparerCity} onChange={e => set("preparerCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.preparerState} onChange={v => set("preparerState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.preparerZip} onChange={e => set("preparerZip", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.preparerPhone} onChange={e => set("preparerPhone", e.target.value)} /></Field>
            <Field label={t("Mobile", "Celular")}><Input className={inputCls} value={data.preparerMobile} onChange={e => set("preparerMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.preparerEmail} onChange={e => set("preparerEmail", e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.preparerIsAttorney} onCheckedChange={v => set("preparerIsAttorney", !!v)} id="is-atty" />
            <Label htmlFor="is-atty" className="text-sm cursor-pointer">{t("I am an attorney or accredited representative", "Soy abogado o representante acreditado")}</Label>
          </div>
        </>
      )}

      {!data.interpreterUsed && !data.preparerUsed && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">{t("No interpreter or preparer indicated in the previous step.", "No se indicó intérprete ni preparador en el paso anterior.")}</p>
          <p className="text-xs mt-2">{t("You can go back to add one, or finalize the form.", "Puede regresar para agregar uno, o finalizar el formulario.")}</p>
        </div>
      )}
    </div>
  );

  const stepRenderers: Record<I765Step, () => JSX.Element> = {
    reason: renderReason, personal: renderPersonal, address: renderAddress,
    background: renderBackground, arrival: renderArrival, eligibility: renderEligibility,
    statement: renderStatement, preparer: renderPreparer,
  };

  const isLast = stepIdx === I765_STEPS.length - 1;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-auto p-4 md:p-6 flex items-start md:items-center justify-center">
        <div className="max-w-2xl w-full">
          {stepRenderers[step]()}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 px-4 md:px-6 py-4 gap-3 bg-card/50">
        <Button variant="outline" onClick={prev} disabled={stepIdx === 0} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> {t("Back", "Atrás")}
        </Button>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => onSave(data, "draft")} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> <span className="hidden sm:inline">{t("Save Draft", "Guardar Borrador")}</span>
          </Button>
          {isLast ? (
            <div className="flex gap-2 flex-wrap">
              {onFillUSCIS && (
                <Button variant="outline" onClick={() => onFillUSCIS(data)} className="gap-2 border-accent/40 text-accent hover:bg-accent/10">
                  <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">{t("Fill USCIS PDF", "Llenar PDF USCIS")}</span>
                </Button>
              )}
              <Button onClick={() => onSave(data, "completed")} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">{t("Complete & Generate PDF", "Completar y Generar PDF")}</span>
              </Button>
            </div>
          ) : (
            <Button onClick={next} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              {t("Next", "Siguiente")} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
