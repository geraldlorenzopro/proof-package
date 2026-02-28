import { useState, forwardRef } from "react";
import { ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { VawaAnswers, getDefaultAnswers } from "./vawaEngine";

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
  client_info: { es: "Información del Cliente", en: "Client Information" },
  petitioner_type: { es: "Tipo de Peticionario", en: "Petitioner Type" },
  abuser_status: { es: "Estatus del Abusador", en: "Abuser Status" },
  relationship_details: { es: "Detalles de la Relación", en: "Relationship Details" },
  abuse: { es: "Maltrato o Crueldad Extrema", en: "Battery or Extreme Cruelty" },
  residence: { es: "Residencia con el Abusador", en: "Residence with Abuser" },
  gmc: { es: "Buen Carácter Moral", en: "Good Moral Character" },
  location: { es: "Ubicación Actual", en: "Current Location" },
};

const ABUSE_TYPES = [
  { id: "physical", es: "Violencia Física (golpes, empujones, patadas)", en: "Physical Violence (hitting, pushing, kicking)" },
  { id: "sexual", es: "Abuso Sexual", en: "Sexual Abuse" },
  { id: "emotional", es: "Crueldad Emocional / Psicológica", en: "Emotional / Psychological Cruelty" },
  { id: "isolation", es: "Aislamiento (impedir contacto con familia/amigos)", en: "Isolation (preventing contact with family/friends)" },
  { id: "economic", es: "Control Económico", en: "Economic Control" },
  { id: "threats", es: "Amenazas de violencia o deportación", en: "Threats of violence or deportation" },
  { id: "coercion", es: "Coerción / Control", en: "Coercion / Control" },
  { id: "degradation", es: "Degradación, humillación", en: "Degradation, humiliation" },
  { id: "denial", es: "Negar acceso a comida, atención médica", en: "Denying access to food, medical care" },
  { id: "child_threats", es: "Amenazas de quitar custodia de hijos", en: "Threats to remove child custody" },
];

const VawaWizard = forwardRef<HTMLDivElement, WizardProps>(({ lang, onComplete }, ref) => {
  const [answers, setAnswers] = useState<VawaAnswers>(getDefaultAnswers());
  const [currentStep, setCurrentStep] = useState(0);
  const t = (es: string, en: string) => (lang === "es" ? es : en);

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
      setCurrentStep((p) => p + 1);
    } else {
      onComplete(answers);
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
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
          <div className="space-y-4">
            <div>
              <Label>{t("Nombre Completo del Cliente", "Client Full Name")}</Label>
              <Input
                value={answers.clientName}
                onChange={(e) => update("clientName", e.target.value)}
                placeholder={t("Ej: Carlos Eduardo Martinez", "E.g.: Carlos Eduardo Martinez")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("Fecha de Nacimiento", "Date of Birth")}</Label>
              <Input
                type="date"
                value={answers.clientDob}
                onChange={(e) => update("clientDob", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("País de Nacimiento", "Country of Birth")}</Label>
              <Input
                value={answers.countryOfBirth}
                onChange={(e) => update("countryOfBirth", e.target.value)}
                placeholder={t("Ej: Honduras", "E.g.: Honduras")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("Hijos (Nombre y edad)", "Children (Name and age)")}</Label>
              <Input
                value={answers.childrenNames}
                onChange={(e) => update("childrenNames", e.target.value)}
                placeholder={t("Ej: Miguel, 5 años", "E.g.: Miguel, 5 years old")}
                className="mt-1"
              />
            </div>
          </div>
        );

      case "petitioner_type":
        return (
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t(
                "¿Cuál es la relación del cliente con el abusador?",
                "What is the client's relationship to the abuser?"
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
                    "Cónyuge — Esposo/a abusado/a por USC o LPR",
                    "Spouse — Abused spouse of USC or LPR"
                  ),
                  desc: t(
                    "Incluye ex-cónyuge si el divorcio fue dentro de 2 años y cónyuge cuyo hijo fue abusado",
                    "Includes ex-spouse if divorce was within 2 years and spouse whose child was abused"
                  ),
                },
                {
                  value: "child",
                  label: t(
                    "Hijo/a — Hijo/a abusado/a por padre/madre USC o LPR",
                    "Child — Abused child of USC or LPR parent"
                  ),
                  desc: t(
                    "Menor de 21 (o hasta 25 si el abuso causó el retraso). Debe estar soltero/a.",
                    "Under 21 (or up to 25 if abuse caused delay). Must be unmarried."
                  ),
                },
                {
                  value: "parent",
                  label: t(
                    "Padre/Madre — Padre/Madre abusado/a por hijo/a USC",
                    "Parent — Abused parent of USC son/daughter"
                  ),
                  desc: t(
                    "El hijo/a abusivo debe ser ciudadano americano y tener 21+ años",
                    "Abusive son/daughter must be USC and 21+ years old"
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
              {t("¿Cuál es el estatus migratorio del abusador?", "What is the abuser's immigration status?")}
            </Label>
            <RadioGroup
              value={answers.abuserStatus}
              onValueChange={(v) => update("abuserStatus", v as any)}
              className="space-y-3"
            >
              {[
                { value: "usc", label: t("Ciudadano Americano (USC)", "U.S. Citizen (USC)") },
                { value: "lpr", label: t("Residente Permanente Legal (LPR)", "Lawful Permanent Resident (LPR)") },
                { value: "lost_status", label: t("Perdió o renunció al estatus de USC/LPR", "Lost or renounced USC/LPR status") },
                { value: "never", label: t("Nunca fue USC ni LPR", "Never was USC or LPR") },
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
                    "¿La pérdida de estatus está relacionada con un incidente de abuso doméstico?",
                    "Is the loss of status related to an incident of domestic violence?"
                  ),
                  answers.lostStatusRelatedToAbuse,
                  (v) => update("lostStatusRelatedToAbuse", v)
                )}
                {renderYesNo(
                  t(
                    "¿La pérdida ocurrió dentro de los últimos 2 años?",
                    "Did the loss occur within the last 2 years?"
                  ),
                  answers.lostStatusWithin2Years,
                  (v) => update("lostStatusWithin2Years", v)
                )}
              </div>
            )}

            {answers.abuserStatus === "never" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                <p className="font-medium text-destructive">
                  {t("⚠ No elegible para VAWA", "⚠ Not eligible for VAWA")}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t(
                    "VAWA requiere que el abusador sea USC o LPR. Considere U-Visa como alternativa.",
                    "VAWA requires the abuser to be a USC or LPR. Consider U-Visa as an alternative."
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
          {t("¿Cuál es el estado actual del matrimonio?", "What is the current marital status?")}
        </Label>
        <RadioGroup
          value={answers.marriageStatus}
          onValueChange={(v) => update("marriageStatus", v as any)}
          className="space-y-2"
        >
          {[
            { value: "married", label: t("Actualmente casado/a con el abusador", "Currently married to the abuser") },
            { value: "divorced", label: t("Divorciado/a del abusador", "Divorced from the abuser") },
            { value: "death", label: t("El abusador falleció", "The abuser has died") },
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
            t("¿El divorcio ocurrió dentro de los últimos 2 años?", "Was the divorce within the last 2 years?"),
            answers.divorceWithin2Years,
            (v) => update("divorceWithin2Years", v)
          )}
          {renderYesNo(
            t("¿El divorcio está conectado al abuso?", "Is the divorce connected to the abuse?"),
            answers.divorceRelatedToAbuse,
            (v) => update("divorceRelatedToAbuse", v)
          )}
        </div>
      )}

      {answers.marriageStatus === "death" && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30 space-y-3">
          {renderYesNo(
            t("¿El fallecimiento ocurrió dentro de los últimos 2 años?", "Did the death occur within the last 2 years?"),
            answers.deathWithin2Years,
            (v) => update("deathWithin2Years", v)
          )}
        </div>
      )}

      {renderYesNo(
        t("¿El cliente se ha vuelto a casar?", "Has the client remarried?"),
        answers.hasRemarried,
        (v) => update("hasRemarried", v),
        t(
          "Si se vuelve a casar ANTES de la aprobación del I-360, la petición será denegada.",
          "If they remarry BEFORE I-360 approval, the petition will be denied."
        )
      )}

      {renderYesNo(
        t("¿El matrimonio es/fue legalmente válido?", "Is/was the marriage legally valid?"),
        answers.marriageLegallyValid,
        (v) => update("marriageLegallyValid", v)
      )}

      {answers.marriageLegallyValid === false && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30">
          {renderYesNo(
            t(
              "¿El matrimonio es inválido SOLO por bigamia del abusador? (Intended Spouse)",
              "Is the marriage invalid SOLELY due to the abuser's bigamy? (Intended Spouse)"
            ),
            answers.intendedSpouse,
            (v) => update("intendedSpouse", v)
          )}
        </div>
      )}

      {renderYesNo(
        t("¿El matrimonio fue de buena fe (bona fide)?", "Was the marriage entered into in good faith (bona fide)?"),
        answers.marriageBonaFide,
        (v) => update("marriageBonaFide", v),
        t(
          "¿Se conocían bien? ¿Vivían juntos? ¿Tenían finanzas compartidas? ¿La familia conocía el matrimonio?",
          "Did they know each other well? Did they live together? Shared finances? Family aware of the marriage?"
        )
      )}
    </div>
  );

  const renderChildDetails = () => (
    <div className="space-y-4">
      <div>
        <Label>{t("Edad actual del hijo/a", "Current age of the child")}</Label>
        <Input
          type="number"
          value={answers.childCurrentAge ?? ""}
          onChange={(e) => update("childCurrentAge", e.target.value ? parseInt(e.target.value) : null)}
          className="mt-1 w-32"
          min={0}
          max={99}
        />
      </div>

      {renderYesNo(
        t("¿Puede solicitar antes de cumplir 21 años?", "Can they file before turning 21?"),
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
              "¿Tiene entre 21-25 y el abuso fue la razón central del retraso?",
              "Is between 21-25 and abuse was the central reason for the delay?"
            ),
            answers.canFileBefore25WithAbuse,
            (v) => update("canFileBefore25WithAbuse", v)
          )}
        </div>
      )}

      {renderYesNo(
        t("¿El hijo/a está soltero/a (unmarried)?", "Is the child unmarried?"),
        answers.childIsUnmarried,
        (v) => update("childIsUnmarried", v),
        t("Debe estar soltero/a al momento de solicitar y al momento de aprobación.", "Must be unmarried at filing and at approval.")
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {t("Tipo de relación padre-hijo", "Type of parent-child relationship")}
        </Label>
        <RadioGroup
          value={answers.childRelationship}
          onValueChange={(v) => update("childRelationship", v as any)}
          className="space-y-2"
        >
          {[
            { value: "bio_wedlock", label: t("Hijo biológico nacido en matrimonio", "Biological child born in wedlock") },
            { value: "bio_out_mother", label: t("Hijo biológico fuera de matrimonio (madre)", "Biological child out of wedlock (mother)") },
            { value: "bio_out_father_legit", label: t("Hijo biológico fuera de matrimonio (padre, legitimado)", "Biological child out of wedlock (father, legitimated)") },
            { value: "bio_out_father_bonafide", label: t("Hijo biológico fuera de matrimonio (padre, relación bona fide)", "Biological child out of wedlock (father, bona fide relationship)") },
            { value: "stepchild", label: t("Hijastro/a (matrimonio antes de los 18)", "Stepchild (marriage before 18)") },
            { value: "adopted", label: t("Hijo/a adoptivo/a (antes de los 16)", "Adopted child (before 16)") },
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
        t("¿La relación padre-hijo actualmente existe?", "Does the parent-child relationship currently exist?"),
        answers.parentChildRelationshipExists,
        (v) => update("parentChildRelationshipExists", v)
      )}
    </div>
  );

  const renderParentDetails = () => (
    <div className="space-y-4">
      {renderYesNo(
        t("¿El hijo/a abusivo es Ciudadano Americano (USC)?", "Is the abusive son/daughter a U.S. Citizen (USC)?"),
        answers.abuserIsUSC,
        (v) => update("abuserIsUSC", v),
        t(
          "Solo los padres de hijos USC pueden auto-peticionar bajo VAWA. Hijos LPR no califican.",
          "Only parents of USC children can self-petition under VAWA. LPR children do not qualify."
        )
      )}

      {answers.abuserIsUSC === false && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
          <p className="font-medium text-destructive">
            {t("⚠ No elegible como padre/madre bajo VAWA", "⚠ Not eligible as parent under VAWA")}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("Considere U-Visa como alternativa.", "Consider U-Visa as an alternative.")}
          </p>
        </div>
      )}

      {renderYesNo(
        t("¿El hijo/a abusivo tiene 21 años o más?", "Is the abusive son/daughter 21 years old or older?"),
        answers.abuserSonDaughterOver21,
        (v) => update("abuserSonDaughterOver21", v)
      )}

      {renderYesNo(
        t("¿Es usted padre/madre para propósitos de inmigración?", "Are you a parent for immigration purposes?"),
        answers.isParentForImmigration,
        (v) => update("isParentForImmigration", v),
        t(
          "Padre biológico, padrastro/madrastra, o padre adoptivo del hijo/a abusivo.",
          "Biological parent, stepparent, or adoptive parent of the abusive child."
        )
      )}
    </div>
  );

  const renderAbuseStep = () => (
    <div className="space-y-4">
      {renderYesNo(
        t(
          "¿El cliente fue sometido a maltrato físico (battery) o crueldad extrema por el abusador?",
          "Was the client subjected to battery or extreme cruelty by the abuser?"
        ),
        answers.abuseOccurred,
        (v) => update("abuseOccurred", v)
      )}

      {answers.abuseOccurred && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("Seleccione los tipos de abuso que aplican:", "Select the types of abuse that apply:")}
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
              "¿El abuso ocurrió durante la relación calificante (matrimonio, relación padre-hijo, etc.)?",
              "Did the abuse occur during the qualifying relationship (marriage, parent-child, etc.)?"
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
          "¿El cliente alguna vez residió con el abusador?",
          "Did the client ever reside with the abuser?"
        ),
        answers.residedWithAbuser,
        (v) => update("residedWithAbuser", v),
        t(
          "No se requiere un período mínimo de residencia. No es necesario que resida con el abusador al momento de solicitar.",
          "No minimum period of residence required. Does not need to reside with abuser at time of filing."
        )
      )}

      {answers.residedWithAbuser === false && answers.petitionerType === "child" && (
        <div className="ml-4 pl-4 border-l-2 border-accent/30">
          {renderYesNo(
            t(
              "¿El abuso ocurrió durante un período de visita con el padre abusivo?",
              "Did the abuse occur during a visitation period with the abusive parent?"
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
          "USCIS evalúa el carácter moral del período de 3 años previo a la solicitud. INA §101(f)",
          "USCIS evaluates moral character for the 3-year period prior to filing. INA §101(f)"
        )}
      </p>

      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
        <p className="text-xs font-semibold text-destructive mb-2">
          {t("Barreras Permanentes (Permanent Bars)", "Permanent Bars")}
        </p>
        {renderYesNo(
          t(
            "¿Ha sido condenado por un delito grave agravado (Aggravated Felony)?",
            "Has the client been convicted of an aggravated felony?"
          ),
          answers.aggravatedFelony,
          (v) => update("aggravatedFelony", v)
        )}
        {renderYesNo(
          t(
            "¿Ha participado en persecución, genocidio, tortura o violaciones graves de libertad religiosa?",
            "Has the client been involved in persecution, genocide, torture, or severe violations of religious freedom?"
          ),
          answers.persecutionGenocide,
          (v) => update("persecutionGenocide", v)
        )}
      </div>

      {answers.aggravatedFelony === false && answers.persecutionGenocide === false && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-xs font-semibold text-accent mb-2">
            {t("Barreras Condicionales (Conditional Bars)", "Conditional Bars")}
          </p>
          {renderYesNo(
            t(
              "¿Tiene condenas por delitos que involucran bajeza moral (CIMTs)?",
              "Any convictions for crimes involving moral turpitude (CIMTs)?"
            ),
            answers.crimesInvolvingMoralTurpitude,
            (v) => update("crimesInvolvingMoralTurpitude", v)
          )}
          {renderYesNo(
            t(
              "¿Tiene violaciones relacionadas con sustancias controladas?",
              "Any controlled substance violations?"
            ),
            answers.controlledSubstance,
            (v) => update("controlledSubstance", v)
          )}
          {renderYesNo(
            t(
              "¿Ha estado encarcelado 180 días o más en total?",
              "Has been incarcerated for 180 days or more total?"
            ),
            answers.incarceration180Days,
            (v) => update("incarceration180Days", v)
          )}
          {renderYesNo(
            t(
              "¿Ha dado falso testimonio bajo juramento para obtener beneficios de inmigración?",
              "Has given false testimony under oath to obtain immigration benefits?"
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
                  "¿La conducta criminal está conectada con el abuso sufrido?",
                  "Is the criminal conduct connected to the abuse suffered?"
                ),
                answers.gmcConditionalBarConnectedToAbuse,
                (v) => update("gmcConditionalBarConnectedToAbuse", v),
                t(
                  "USCIS debe considerar si la conducta está conectada al abuso antes de determinar falta de buen carácter moral.",
                  "USCIS must consider whether conduct is connected to abuse before determining lack of good moral character."
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
        t("¿El cliente se encuentra actualmente en Estados Unidos?", "Is the client currently in the United States?"),
        answers.currentlyInUS,
        (v) => update("currentlyInUS", v)
      )}

      {answers.currentlyInUS === false && (
        <div className="space-y-3 ml-4 pl-4 border-l-2 border-accent/30">
          <Label className="text-sm font-medium">
            {t("¿Aplica alguna de las siguientes excepciones?", "Does any of the following exceptions apply?")}
          </Label>
          <RadioGroup
            value={answers.outsideUSException}
            onValueChange={(v) => update("outsideUSException", v as any)}
            className="space-y-2"
          >
            {[
              { value: "gov", label: t("Abusador empleado por gobierno de EE.UU. en el extranjero", "Abuser employed by US government abroad") },
              { value: "military", label: t("Abusador es militar de EE.UU. estacionado en el extranjero", "Abuser is US military stationed abroad") },
              { value: "abuse_in_us", label: t("El abuso ocurrió en Estados Unidos", "The abuse occurred in the United States") },
              { value: "none", label: t("Ninguna excepción aplica", "No exception applies") },
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
