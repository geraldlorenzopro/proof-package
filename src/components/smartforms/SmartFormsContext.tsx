import { createContext, useContext, useState, type ReactNode } from "react";
interface WizardNav {
  steps: string[];
  currentStep: number;
  setStep: (idx: number) => void;
  /** Labels para cada step key. Si no se pasa, se muestra el key crudo.
   *  Permite que SmartFormsLayout funcione con cualquier wizard (I-765, I-130, etc.)
   *  sin necesidad de importar todos los STEP_LABELS. */
  stepLabels?: Record<string, { en: string; es: string }>;
}

interface SmartFormsContextType {
  wizardNav: WizardNav | null;
  setWizardNav: (nav: WizardNav | null) => void;
  lang: "en" | "es";
  setLang: (lang: "en" | "es") => void;
}

const SmartFormsContext = createContext<SmartFormsContextType>({
  wizardNav: null,
  setWizardNav: () => {},
  lang: "es",
  setLang: () => {},
});

export function SmartFormsProvider({ children }: { children: ReactNode }) {
  const [wizardNav, setWizardNav] = useState<WizardNav | null>(null);
  const [lang, setLang] = useState<"en" | "es">("es");
  return (
    <SmartFormsContext.Provider value={{ wizardNav, setWizardNav, lang, setLang }}>
      {children}
    </SmartFormsContext.Provider>
  );
}

export function useSmartFormsContext() {
  return useContext(SmartFormsContext);
}
