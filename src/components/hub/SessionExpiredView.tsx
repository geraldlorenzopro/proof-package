/**
 * SessionExpiredView — Estado de error explícito cuando `accountId` es null
 * en modo no-demo (sesión expirada, ner_hub_data corrupto, handshake GHL
 * falló).
 *
 * sec-fix/A0.5b (2026-06-06): reemplaza el bug histórico documentado en
 * HUMAN-ACTIONS #9 — antes de este componente, cuando `accountId` quedaba
 * null en producción, las páginas `/hub/cases` y `/hub/tasks` se quedaban
 * con `opacity-0 pointer-events-none` infinito y counts en `"—"`,
 * indistinguible de un loading state. Ahora se renderiza este EmptyState
 * con CTA clickeable real (Refrescar / Iniciar sesión).
 *
 * Test E2E (Pattern 12 en regression.spec.ts):
 *   - `data-testid="session-expired-view"` para anclar las assertions sin
 *     depender del texto (que puede cambiar para humanos).
 *   - `data-testid="session-expired-refresh-cta"` y
 *     `data-testid="session-expired-login-cta"` para los 2 botones.
 *
 * NUNCA debe contener `pointer-events-none` ni `opacity-0`. NUNCA debe
 * renderizar `"—"`. El test E2E lo verifica.
 */
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import HubLayout from "@/components/hub/HubLayout";

export default function SessionExpiredView() {
  const navigate = useNavigate();
  return (
    <HubLayout>
      <div
        className="w-full px-6 py-4"
        data-testid="session-expired-view"
      >
        <div className="max-w-md mx-auto mt-16 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-bold font-sora text-foreground">
            Sesión expirada
          </h2>
          <p className="text-sm text-muted-foreground">
            No pudimos cargar tu cuenta. Esto puede pasar si tu sesión expiró,
            si refrescaste sin login activo, o si el handshake con GHL falló.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              data-testid="session-expired-refresh-cta"
            >
              Refrescar página
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              data-testid="session-expired-login-cta"
            >
              Iniciar sesión
            </Button>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
