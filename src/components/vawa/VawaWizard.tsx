import { useState, forwardRef } from "react";
import { ChevronRight, ChevronLeft, CheckCircle2, User, Calendar, Globe, Users, Plus, Trash2 } from "lucide-react";
import { useStepHistory } from "@/hooks/useStepHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { VawaAnswers, ChildInfo, getDefaultAnswers } from "./vawaEngine";

interface WizardProps {
  lang: "es" | "en";
  onComplete: (answers: VawaAnswers) => void;
}

type WizardStep =
  | "client_info"
  | "petitioner_type"
  | "abuser_status"
  | "relationship_details"
  | "abuse"
  | "residence"
  | "gmc"
  | "location";

const STEP_ORDER: WizardStep[] = [
  "client_info",
  "petitioner_type",
  "abuser_status",
  "relationship_details",
  "abuse",
  "residence",
  "gmc",
  "location",
];

const STEP_LABELS: Record<WizardStep, { es: string; en: string }> = {
  client_info: { es: "¿Quién es el cliente?", en: "Who is the client?" },
  petitioner_type: { es: "¿Cuál es la relación?", en: "What is the relationship?" },
  abuser_status: { es: "Sobre el abusador", en: "About the abuser" },
  relationship_details: { es: "Más sobre la relación", en: "More about the relationship" },
  abuse: { es: "¿Qué pasó?", en: "What happened?" },
  residence: { es: "¿Vivían juntos?", en: "Did they live together?" },
  gmc: { es: "Historial del cliente", en: "Client's background" },
  location: { es: "¿Dónde está ahora?", en: "Where are they now?" },
};

const ABUSE_TYPES = [
  { id: "physical", es: "Le pegó, empujó o lastimó físicamente", en: "Hit, pushed, or physically hurt them" },
  { id: "sexual", es: "Abuso sexual", en: "Sexual abuse" },
  { id: "emotional", es: "Insultos, humillaciones o maltrato emocional", en: "Insults, humiliation, or emotional abuse" },
  { id: "isolation", es: "No lo/la dejaba ver a su familia o amigos", en: "Wouldn't let them see family or friends" },
  { id: "economic", es: "Controlaba todo el dinero", en: "Controlled all the money" },
  { id: "threats", es: "Lo/la amenazaba con hacerle daño o deportarlo/a", en: "Threatened to hurt or deport them" },
  { id: "coercion", es: "Lo/la obligaba a hacer cosas que no quería", en: "Forced them to do things they didn't want to" },
  { id: "degradation", es: "Lo/la humillaba o rebajaba constantemente", en: "Constantly humiliated or degraded them" },
  { id: "denial", es: "No le daba comida o no lo/la dejaba ir al doctor", en: "Denied food or wouldn't let them see a doctor" },
  { id: "child_threats", es: "Amenazaba con quitarle los hijos", en: "Threatened to take the children away" },
];

const VawaWizard = forwardRef<HTMLDivElement, WizardProps>(({ lang, onComplete }, ref) => {
  const [answers, setAnswers] = useState<VawaAnswers>(getDefaultAnswers());
  const [currentStep, setCurrentStep] = useState(0);
  const t = (es: string, en: string) => (lang === "es" ? es : en);

  const { goNext: historyNext, goBack } = useStepHistory(currentStep, setCurrentStep, STEP_ORDER.length - 1);

  const step = STEP_ORDER[currentStep];

  const update = <K extends keyof VawaAnswers>(key: K, val: VawaAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  };

  const canGoNext = (): boolean => {
    switch (step) {
      case "client_info":
        return answers.clientName.trim().length > 0;
      case "petitioner_type":
        return answers.petitionerType !== "";
      case "abuser_status":
        return answers.abuserStatus !== "";
      case "relationship_details":
        if (answers.petitionerType === "spouse") return answers.marriageStatus !== "";
        if (answers.petitionerType === "child") return answers.canFileBefore21 !== null;
        if (answers.petitionerType === "parent") return answers.abuserIsUSC !== null;
        return true;
      case "abuse":
        return answers.abuseOccurred !== null;
      case "residence":
        return answers.residedWithAbuser !== null;
      case "gmc":
        return answers.aggravatedFelony !== null;
      case "location":
        return answers.currentlyInUS !== null;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (currentStep < STEP_ORDER.length - 1) {
      historyNext();
    } else {
      onComplete(answers);
    }
  };

  const renderYesNo = (
    label: string,
    value: boolean | null,
    onChange: (v: boolean) => void,
    note?: string
  ) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <RadioGroup
        value={value === null ? "" : value ? "yes" : "no"}
        onValueChange={(v) => onChange(v === "yes")}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="yes" id={`${label}-yes`} />
          <Label htmlFor={`${label}-yes`} className="cursor-pointer">{t("Sí", "Yes")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="no" id={`${label}-no`} />
          <Label htmlFor={`${label}-no`} className="cursor-pointer">{t("No", "No")}</Label>
        </div>
      </RadioGroup>
      {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case "client_info":
        return (
          <div className="space-y-5">
            <div>
              <Label className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-accent" />
                {t("Nombre Completo del Cliente", "Client Full Name")}
              </Label>
              <Input
                value={answers.clientName}
                onChange={(e) => update("clientName", e.target.value)}
                placeholder={t("Nombre y apellidos", "Full name")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                {t("Fecha de Nacimiento", "Date of Birth")}
              </Label>
              <Input
                type="date"
                value={answers.clientDob}
                onChange={(e) => update("clientDob", e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("Formato: mes/día/año", "Format: month/day/year")}</p>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-accent" />
                {t("País de Nacimiento", "Country of Birth")}
              </Label>
              <Input
                value={answers.countryOfBirth}
                onChange={(e) => update("countryOfBirth", e.target.value)}
                placeholder={t("País donde nació el cliente", "Client's country of birth")}
                className="mt-1.5"
              />
            </div>
            {/* Children dynamic section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-accent" />
                {t("¿El cliente tiene hijos?", "Does the client have children?")}
              </Label>
              <RadioGroup
                value={answers.hasChildren === null ? "" : answers.hasChildren ? "yes" : "no"}
                onValueChange={(v) => {
                  const has = v === "yes";
                  update("hasChildren", has);
                  if (!has) update("children", []);
                  if (has && answers.children.length === 0) {
                    update("children", [{ name: "", age: null }]);
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="hasChildren-yes" />
                  <Label htmlFor="hasChildren-yes" className="cursor-pointer">{t("Sí", "Yes")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="hasChildren-no" />
                  <Label htmlFor="hasChildren-no" className="cursor-pointer">{t("No", "No")}</Label>
                </div>
              </RadioGroup>

              {answers.hasChildren && (
                <div className="space-y-3 ml-1 pl-4 border-l-2 border-accent/30 mt-3">
                  {answers.children.map((child, idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">
                          {t(`Hijo/a ${idx + 1}`, `Child ${idx + 1}`)}
                        </Label>
                        <Input
                          value={child.name}
                          onChange={(e) => {
                            const updated = [...answers.children];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            update("children", updated);
                          }}
                          placeholder={t("Nombre", "Name")}
                          className="mt-1"
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs text-muted-foreground">{t("Edad", "Age")}</Label>
                        <Select
                          value={child.age !== null ? String(child.age) : ""}
                          onValueChange={(v) => {
                            const updated = [...answers.children];
                            updated[idx] = { ...updated[idx], age: parseInt(v) };
                            update("children", updated);
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                {i} {t("año" + (i !== 1 ? "s" : ""), "yr" + (i !== 1 ? "s" : ""))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {answers.children.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => {
                            const updated = answers.children.filter((_, i) => i !== idx);
                            update("children", updated);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {answers.children.length < 10 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-accent hover:text-accent/80 text-xs"
                      onClick={() => {
                        update("children", [...answers.children, { name: "", age: null }]);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("Agregar otro hijo/a", "Add another child")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case "petitioner_type":
        return (
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t(
                "¿Qué relación tiene el cliente con la persona que lo maltrata?",
                "What is the client's relationship to the person who mistreats them?"
              )}
            </Label>
            <RadioGroup
              value={answers.petitionerType}
              onValueChange={(v) => update("petitionerType", v as any)}
              className="space-y-3"
            >
              {[
                {
                  value: "spouse",
                  label: t(
                    "Es su esposo/a",
                    "They are their spouse"
                  ),
                  desc: t(
                    "Están o estuvieron casados. Incluye ex-esposos si el divorcio fue reciente (menos de 2 años).",
                    "They are or were married. Includes ex-spouses if the divorce was recent (less than 2 years)."
                  ),
                },
                {
                  value: "child",
                  label: t(
                    "Es su hijo/a",
                    "They are their child"
                  ),
                  desc: t(
                    "El cliente es hijo/a del abusador. Generalmente debe ser menor de 21 años y soltero/a.",
                    "The client is the abuser's child. Generally must be under 21 and unmarried."
                  ),
                },
                {
                  value: "parent",
                  label: t(
                    "Es su padre o madre",
                    "They are their parent"
                  ),
                  desc: t(
                    "El cliente es padre/madre maltratado/a por su hijo/a adulto que es ciudadano americano.",
                    "The client is a parent mistreated by their adult child who is a U.S. citizen."
                  ),
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                    answers.petitionerType === opt.value
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={opt.value} className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
        );

      case "abuser_status":
        return (
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("¿El abusador tiene papeles en Estados Unidos?", "Does the abuser have legal status in the United States?")}
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              {t("Esto es muy importante porque VAWA solo aplica si el abusador es ciudadano o residente.", "This is very important because VAWA only applies if the abuser is a citizen or resident.")}
            </p>
            <RadioGroup
              value={answers.abuserStatus}
              onValueChange={(v) => update("abuserStatus", v as any)}
              className="space-y-3"
            >
              {[
                { value: "usc", label: t("Sí, es Ciudadano Americano", "Yes, they are a U.S. Citizen") },
                { value: "lpr", label: t("Sí, es Residente Permanente (tiene green card)", "Yes, they are a Permanent Resident (has green card)") },
                { value: "lost_status", label: t("Tenía papeles pero los perdió", "They had status but lost it") },
                { value: "never", label: t("Nunca ha tenido papeles", "They have never had legal status") },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    answers.abuserStatus === opt.value
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={opt.value} />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>

            {answers.abuserStatus === "lost_status" && (
              <div className="ml-4 pl-4 border-l-2 border-accent/30 space-y-3 mt-3">
                {renderYesNo(
                  t(
                    "¿Perdió los papeles por algo relacionado con la violencia doméstica?",
                    "Did they lose their status because of something related to the domestic violence?"
                  ),
                  answers.lostStatusRelatedToAbuse,
                  (v) => update("lostStatusRelatedToAbuse", v)
                )}
                {renderYesNo(
                  t(
                    "¿Esto pasó hace menos de 2 años?",
                    "Did this happen less than 2 years ago?"
                  ),
                  answers.lostStatusWithin2Years,
                  (v) => update("lostStatusWithin2Years", v)
                )}
              </div>
            )}

            {answers.abuserStatus === "never" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                <p className="font-medium text-destructive">
                  {t("⚠ No califica para VAWA", "⚠ Does not qualify for VAWA")}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t(
                    "Para usar VAWA, el abusador necesita ser ciudadano o residente. Pero hay otras opciones como la visa U que podrían funcionar.",
                    "To use VAWA, the abuser needs to be a citizen or resident. But there are other options like the U-Visa that might work."
                  )}
                </p>
              </div>
            )}
          </div>
        );

      case "relationship_details":
        if (answers.petitionerType === "spouse") return renderSpouseDetails();
        if (answers.petitionerType === "child") return renderChildDetails();
        if (answers.petitionerType === "parent") return renderParentDetails();
        return null;

      case "abuse":
        return renderAbuseStep();

      case "residence":
        return renderResidenceStep();

      case "gmc":
        return renderGMCStep();

      case "location":
        return renderLocationStep();

      default:
        return null;
    }
  };

  const renderSpouseDetails = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t("¿Están todavía casados?", "Are they still married?")}
        </Label>
        <RadioGroup
          value={answers.marriageStatus}
          onValueChange={(v) => update("marriageStatus", v as any)}
          className="space-y-2"
        >
          {[
            { value: "married", label: t("Sí, todavía están casados", "Yes, they are still married") },
            { value: "divorced", label: t("No, ya se divorciaron", "No, they are already divorced") },
            { value: "death", label: t("El abusador falleció", "The abuser has passed away") },
          ].map((opt) => (
            <label key={opt.value} className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
              answers.marriageStatus === opt.value ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground/30"
            )}>
              <RadioGroupItem value={opt.value} />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {answers.marriageStatus === "divorced" && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30 space-y-3">
          {renderYesNo(
            t("¿El divorcio fue hace menos de 2 años?", "Was the divorce less than 2 years ago?"),
            answers.divorceWithin2Years,
            (v) => update("divorceWithin2Years", v)
          )}
          {renderYesNo(
            t("¿Se divorciaron por culpa del maltrato?", "Did they divorce because of the abuse?"),
            answers.divorceRelatedToAbuse,
            (v) => update("divorceRelatedToAbuse", v)
          )}
        </div>
      )}

      {answers.marriageStatus === "death" && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30 space-y-3">
          {renderYesNo(
            t("¿Falleció hace menos de 2 años?", "Did they pass away less than 2 years ago?"),
            answers.deathWithin2Years,
            (v) => update("deathWithin2Years", v)
          )}
        </div>
      )}

      {renderYesNo(
        t("¿El cliente se volvió a casar con otra persona?", "Has the client remarried someone else?"),
        answers.hasRemarried,
        (v) => update("hasRemarried", v),
        t(
          "Importante: si se casa de nuevo ANTES de que le aprueben el caso, se lo van a negar.",
          "Important: if they remarry BEFORE the case is approved, it will be denied."
        )
      )}

      {renderYesNo(
        t("¿El matrimonio fue legal? (Se casaron legalmente)", "Was the marriage legal? (They were legally married)"),
        answers.marriageLegallyValid,
        (v) => update("marriageLegallyValid", v)
      )}

      {answers.marriageLegallyValid === false && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30">
          {renderYesNo(
            t(
              "¿El matrimonio es inválido porque el abusador ya estaba casado con otra persona?",
              "Is the marriage invalid because the abuser was already married to someone else?"
            ),
            answers.intendedSpouse,
            (v) => update("intendedSpouse", v)
          )}
        </div>
      )}

      {renderYesNo(
        t("¿Se casaron de verdad, por amor? (No fue un arreglo solo por papeles)", "Did they marry for real, out of love? (It wasn't just for immigration papers)"),
        answers.marriageBonaFide,
        (v) => update("marriageBonaFide", v),
        t(
          "¿Se conocían bien? ¿Vivían juntos? ¿Compartían gastos? ¿La familia sabía del matrimonio?",
          "Did they know each other well? Did they live together? Share expenses? Did family know about the marriage?"
        )
      )}
    </div>
  );

   const renderChildDetails = () => (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-accent" />
          {t("Edad actual del hijo/a", "Current age of the child")}
        </Label>
        <Input
          type="number"
          value={answers.childCurrentAge ?? ""}
          onChange={(e) => update("childCurrentAge", e.target.value ? parseInt(e.target.value) : null)}
          className="mt-1.5 w-32"
          min={0}
          max={99}
          placeholder={t("Edad", "Age")}
        />
      </div>

      {renderYesNo(
        t("¿Puede presentar el caso antes de cumplir 21 años?", "Can they file the case before turning 21?"),
        answers.canFileBefore21,
        (v) => {
          update("canFileBefore21", v);
          if (v) update("canFileBefore25WithAbuse", null);
        }
      )}

      {answers.canFileBefore21 === false && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30">
          {renderYesNo(
            t(
              "¿Tiene entre 21 y 25 años, y no pudo presentar antes por culpa del maltrato?",
              "Are they between 21-25, and couldn't file earlier because of the abuse?"
            ),
            answers.canFileBefore25WithAbuse,
            (v) => update("canFileBefore25WithAbuse", v)
          )}
        </div>
      )}

      {renderYesNo(
        t("¿Está soltero/a? (No se ha casado)", "Are they single? (Not married)"),
        answers.childIsUnmarried,
        (v) => update("childIsUnmarried", v),
        t("Para este tipo de caso, el hijo/a necesita estar soltero/a.", "For this type of case, the child needs to be single.")
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {t("¿Cómo es la relación entre el padre/madre y el hijo/a?", "What is the parent-child relationship?")}
        </Label>
        <RadioGroup
          value={answers.childRelationship}
          onValueChange={(v) => update("childRelationship", v as any)}
          className="space-y-2"
        >
          {[
            { value: "bio_wedlock", label: t("Hijo/a biológico, los padres estaban casados", "Biological child, parents were married") },
            { value: "bio_out_mother", label: t("Hijo/a biológico de la mamá (no estaban casados)", "Biological child of the mother (not married)") },
            { value: "bio_out_father_legit", label: t("Hijo/a biológico del papá (reconocido legalmente)", "Biological child of the father (legally recognized)") },
            { value: "bio_out_father_bonafide", label: t("Hijo/a biológico del papá (relación real padre-hijo)", "Biological child of the father (real parent-child bond)") },
            { value: "stepchild", label: t("Hijastro/a (el matrimonio fue antes de los 18)", "Stepchild (marriage was before age 18)") },
            { value: "adopted", label: t("Hijo/a adoptivo/a (adoptado antes de los 16)", "Adopted child (adopted before age 16)") },
          ].map((opt) => (
            <label key={opt.value} className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
              answers.childRelationship === opt.value ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground/30"
            )}>
              <RadioGroupItem value={opt.value} />
              <span>{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {renderYesNo(
        t("¿Actualmente existe una relación de padre/madre e hijo/a entre ellos?", "Does a parent-child relationship currently exist between them?"),
        answers.parentChildRelationshipExists,
        (v) => update("parentChildRelationshipExists", v)
      )}
    </div>
  );

  const renderParentDetails = () => (
    <div className="space-y-4">
      {renderYesNo(
        t("¿El hijo/a que lo maltrata es Ciudadano Americano?", "Is the son/daughter who mistreats them a U.S. Citizen?"),
        answers.abuserIsUSC,
        (v) => update("abuserIsUSC", v),
        t(
          "Solo funciona si el hijo/a es ciudadano americano. Si solo tiene green card, no califica por esta vía.",
          "This only works if the child is a U.S. citizen. If they only have a green card, this path doesn't apply."
        )
      )}

      {answers.abuserIsUSC === false && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
          <p className="font-medium text-destructive">
            {t("⚠ No califica por esta vía", "⚠ Does not qualify through this path")}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("Pero hay otras opciones como la visa U que podrían servir.", "But there are other options like the U-Visa that might work.")}
          </p>
        </div>
      )}

      {renderYesNo(
        t("¿El hijo/a que lo maltrata tiene 21 años o más?", "Is the son/daughter who mistreats them 21 years old or older?"),
        answers.abuserSonDaughterOver21,
        (v) => update("abuserSonDaughterOver21", v)
      )}

      {renderYesNo(
        t("¿El cliente es realmente el padre/madre del abusador?", "Is the client truly the parent of the abuser?"),
        answers.isParentForImmigration,
        (v) => update("isParentForImmigration", v),
        t(
          "Puede ser padre/madre biológico, padrastro/madrastra, o padre/madre adoptivo.",
          "Can be biological parent, stepparent, or adoptive parent."
        )
      )}
    </div>
  );

  const renderAbuseStep = () => (
    <div className="space-y-4">
      {renderYesNo(
        t(
          "¿El abusador le hizo daño físico al cliente, o lo trató con mucha crueldad?",
          "Did the abuser physically hurt the client, or treat them with extreme cruelty?"
        ),
        answers.abuseOccurred,
        (v) => update("abuseOccurred", v)
      )}

      {answers.abuseOccurred && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("¿Qué tipo de maltrato sufrió? (Marque todos los que apliquen)", "What type of mistreatment did they suffer? (Check all that apply)")}
            </Label>
            <div className="space-y-2">
              {ABUSE_TYPES.map((type) => (
                <label
                  key={type.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                    answers.abuseTypes.includes(type.id)
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <Checkbox
                    checked={answers.abuseTypes.includes(type.id)}
                    onCheckedChange={(checked) => {
                      update(
                        "abuseTypes",
                        checked
                          ? [...answers.abuseTypes, type.id]
                          : answers.abuseTypes.filter((t) => t !== type.id)
                      );
                    }}
                  />
                  <span>{lang === "es" ? type.es : type.en}</span>
                </label>
              ))}
            </div>
          </div>

          {renderYesNo(
            t(
              "¿El maltrato pasó mientras estaban en la relación (casados, viviendo juntos, etc.)?",
              "Did the mistreatment happen while they were in the relationship (married, living together, etc.)?"
            ),
            answers.abuseDuringRelationship,
            (v) => update("abuseDuringRelationship", v)
          )}
        </>
      )}
    </div>
  );

  const renderResidenceStep = () => (
    <div className="space-y-4">
      {renderYesNo(
        t(
          "¿El cliente vivió alguna vez en la misma casa con el abusador?",
          "Did the client ever live in the same home as the abuser?"
        ),
        answers.residedWithAbuser,
        (v) => update("residedWithAbuser", v),
        t(
          "No importa por cuánto tiempo. Tampoco necesita estar viviendo con el abusador ahora mismo.",
          "It doesn't matter for how long. They don't need to be living with the abuser right now either."
        )
      )}

      {answers.residedWithAbuser === false && answers.petitionerType === "child" && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30">
          {renderYesNo(
            t(
              "¿El maltrato pasó cuando el hijo/a estaba de visita con el padre/madre abusivo?",
              "Did the mistreatment happen while the child was visiting the abusive parent?"
            ),
            answers.childAbuseWhileResiding,
            (v) => update("childAbuseWhileResiding", v)
          )}
        </div>
      )}
    </div>
  );

  const renderGMCStep = () => (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t(
          "Necesitamos saber si el cliente ha tenido problemas con la ley. Esto es importante para el caso.",
          "We need to know if the client has had any problems with the law. This is important for the case."
        )}
      </p>

      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
        <p className="text-xs font-semibold text-destructive mb-2">
          {t("Problemas graves (esto puede impedir el caso)", "Serious issues (this can block the case)")}
        </p>
        {renderYesNo(
          t(
            "¿Ha sido condenado por un crimen muy grave (como asesinato, tráfico de drogas, etc.)?",
            "Have they been convicted of a very serious crime (like murder, drug trafficking, etc.)?"
          ),
          answers.aggravatedFelony,
          (v) => update("aggravatedFelony", v)
        )}
        {renderYesNo(
          t(
            "¿Ha participado en persecución, tortura o crímenes de guerra?",
            "Have they been involved in persecution, torture, or war crimes?"
          ),
          answers.persecutionGenocide,
          (v) => update("persecutionGenocide", v)
        )}
      </div>

      {answers.aggravatedFelony === false && answers.persecutionGenocide === false && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-xs font-semibold text-accent mb-2">
            {t("Otros problemas legales (se pueden resolver en algunos casos)", "Other legal issues (may be resolvable in some cases)")}
          </p>
          {renderYesNo(
            t(
              "¿Tiene alguna condena por crimen menor (robo, fraude, etc.)?",
              "Any convictions for minor crimes (theft, fraud, etc.)?"
            ),
            answers.crimesInvolvingMoralTurpitude,
            (v) => update("crimesInvolvingMoralTurpitude", v)
          )}
          {renderYesNo(
            t(
              "¿Ha tenido problemas con drogas (uso, posesión o venta)?",
              "Any drug-related issues (use, possession, or sales)?"
            ),
            answers.controlledSubstance,
            (v) => update("controlledSubstance", v)
          )}
          {renderYesNo(
            t(
              "¿Ha estado preso/a por 6 meses o más en total?",
              "Have they been in jail for 6 months or more total?"
            ),
            answers.incarceration180Days,
            (v) => update("incarceration180Days", v)
          )}
          {renderYesNo(
            t(
              "¿Ha mentido bajo juramento para obtener beneficios de inmigración?",
              "Have they lied under oath to get immigration benefits?"
            ),
            answers.falseTestimony,
            (v) => update("falseTestimony", v)
          )}

          {(answers.crimesInvolvingMoralTurpitude === true ||
            answers.controlledSubstance === true ||
            answers.incarceration180Days === true ||
            answers.falseTestimony === true) && (
            <div className="mt-3 ml-4 pl-4 border-l-2 border-accent/30">
              {renderYesNo(
                t(
                  "¿Esos problemas con la ley fueron causados por el maltrato que sufrió?",
                  "Were those legal problems caused by the abuse they suffered?"
                ),
                answers.gmcConditionalBarConnectedToAbuse,
                (v) => update("gmcConditionalBarConnectedToAbuse", v),
                t(
                  "Si los problemas legales fueron consecuencia del abuso, inmigración debe tomarlo en cuenta a favor del cliente.",
                  "If the legal issues were a consequence of the abuse, immigration must take that into account in the client's favor."
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderLocationStep = () => (
    <div className="space-y-4">
      {renderYesNo(
        t("¿El cliente está en Estados Unidos ahora mismo?", "Is the client in the United States right now?"),
        answers.currentlyInUS,
        (v) => update("currentlyInUS", v)
      )}

      {answers.currentlyInUS === false && (
        <div className="space-y-3 ml-4 pl-4 border-l-2 border-accent/30">
          <Label className="text-sm font-medium">
            {t("¿Aplica alguna de estas situaciones especiales?", "Does any of these special situations apply?")}
          </Label>
          <RadioGroup
            value={answers.outsideUSException}
            onValueChange={(v) => update("outsideUSException", v as any)}
            className="space-y-2"
          >
            {[
              { value: "gov", label: t("El abusador trabaja para el gobierno de EE.UU. en otro país", "The abuser works for the US government in another country") },
              { value: "military", label: t("El abusador es militar de EE.UU. en otro país", "The abuser is US military stationed in another country") },
              { value: "abuse_in_us", label: t("El maltrato pasó cuando estaban en Estados Unidos", "The abuse happened when they were in the United States") },
              { value: "none", label: t("Ninguna de las anteriores", "None of the above") },
            ].map((opt) => (
              <label key={opt.value} className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                answers.outsideUSException === opt.value ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground/30"
              )}>
                <RadioGroupItem value={opt.value} />
                <span>{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="flex items-center gap-1 px-2 py-3 overflow-x-auto">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                i < currentStep
                  ? "bg-[hsl(var(--step-done))] text-white"
                  : i === currentStep
                  ? "bg-[hsl(var(--step-active))] text-white shadow-[0_0_12px_hsl(var(--step-active)/0.4)]"
                  : "bg-[hsl(var(--step-pending))] text-muted-foreground"
              )}
            >
              {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div className={cn("w-4 h-0.5", i < currentStep ? "bg-[hsl(var(--step-done))]" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step label */}
      <div className="px-4 pb-2">
        <h2 className="text-lg font-bold text-foreground">{STEP_LABELS[step][lang]}</h2>
        <p className="text-xs text-muted-foreground">
          {t(`Paso ${currentStep + 1} de ${STEP_ORDER.length}`, `Step ${currentStep + 1} of ${STEP_ORDER.length}`)}
        </p>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <Button variant="ghost" onClick={goBack} disabled={currentStep === 0} className="gap-1">
          <ChevronLeft className="w-4 h-4" />
          {t("Atrás", "Back")}
        </Button>
        <Button
          onClick={goNext}
          disabled={!canGoNext()}
          className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {currentStep === STEP_ORDER.length - 1
            ? t("Ver Resultados", "View Results")
            : t("Siguiente", "Next")}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

VawaWizard.displayName = "VawaWizard";
export default VawaWizard;
