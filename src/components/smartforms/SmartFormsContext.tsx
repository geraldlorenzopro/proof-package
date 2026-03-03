import { createContext, useContext, useState, type ReactNode } from "react";
import type { I765Step } from "./i765Schema";

interface WizardNav {
  steps: I765Step[];
  currentStep: number;
  setStep: (idx: number) => void;
  lang: "en" | "es";
}

interface SmartFormsContextType {
  wizardNav: WizardNav | null;
  setWizardNav: (nav: WizardNav | null) => void;
}

const SmartFormsContext = createContext<SmartFormsContextType>({
  wizardNav: null,
  setWizardNav: () => {},
});

export function SmartFormsProvider({ children }: { children: ReactNode }) {
  const [wizardNav, setWizardNav] = useState<WizardNav | null>(null);
  return (
    <SmartFormsContext.Provider value={{ wizardNav, setWizardNav }}>
      {children}
    </SmartFormsContext.Provider>
  );
}

export function useSmartFormsContext() {
  return useContext(SmartFormsContext);
}
