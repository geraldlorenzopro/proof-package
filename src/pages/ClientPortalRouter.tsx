import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, AlertTriangle } from "lucide-react";

/**
 * /portal/:cid — Smart router page
 * Receives GHL contact ID, resolves cases via edge function,
 * and redirects to the appropriate portal.
 */
export default function ClientPortalRouter() {
  const { cid } = useParams<{ cid: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) return;
    resolvePortal();
  }, [cid]);

  const resolvePortal = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("resolve-client-portal", {
        body: { cid },
      });

      if (fnErr) throw fnErr;

      if (!data?.cases || data.cases.length === 0) {
        setError("No se encontraron casos activos para este contacto.");
        return;
      }

      // If single case, redirect directly to client portal
      if (data.cases.length === 1) {
        const token = data.cases[0].access_token;
        navigate(`/case-track/${token}`, { replace: true });
        return;
      }

      // Multiple cases — redirect to first B1/B2 or first case
      const b1b2Case = data.cases.find((c: any) =>
        c.process_type === "b1b2-visa" || c.process_type === "b1-b2-tourist"
      );
      const targetCase = b1b2Case || data.cases[0];
      navigate(`/case-track/${targetCase.access_token}`, { replace: true });
    } catch (e: any) {
      console.error("Portal resolve error:", e);
      setError("Error al cargar el portal. Contacta a tu abogado.");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Shield className="h-10 w-10 text-primary mx-auto animate-pulse" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Cargando tu portal...</p>
      </div>
    </div>
  );
}
