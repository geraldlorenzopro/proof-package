import { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { FeatureFlag } from "@/components/FeatureFlag";

/**
 * Gate para las rutas de Strategic Packs (I-130, I-485, I-765).
 *
 * Si la firma NO tiene el flag `strategic-packs-v1` activo, muestra una
 * pantalla amigable explicando que el feature no está disponible aún.
 * Si lo tiene, renderiza los children (los workspaces / docs).
 *
 * Esto permite que SOLO las firmas en piloto (hoy: Ner Tech LLC) vean
 * los packs. Las otras 7 firmas que entren a la URL por casualidad ven
 * la pantalla "no disponible".
 */
export function PacksGate({ children }: { children: ReactNode }) {
  return (
    <FeatureFlag slug="strategic-packs-v1" fallback={<PacksUnavailable />}>
      {children}
    </FeatureFlag>
  );
}

function PacksUnavailable() {
  return (
    <HubLayout>
      <div className="h-full flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-jarvis/10 border border-jarvis/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-jarvis" />
          </div>
          <h2 className="text-[16px] font-display font-bold text-foreground mb-2">
            Strategic Packs · No disponible en tu firma
          </h2>
          <p className="text-[12px] text-muted-foreground leading-snug mb-4">
            Esta funcionalidad está en piloto cerrado. Si te interesa probarla
            antes del release general, hablá con el equipo NER.
          </p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Beta · strategic-packs-v1
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
