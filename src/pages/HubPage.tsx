import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import HubDashboard from "@/components/hub/HubDashboard";
import HubSplash from "@/components/hub/HubSplash";
import OnboardingWizard from "@/components/hub/OnboardingWizard";
import { useAppPermissions } from "@/hooks/useAppPermissions";
import { useDemoMode, DEMO_FIRM_NAME, DEMO_ATTORNEY } from "@/hooks/useDemoData";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { trackEvent } from "@/lib/analytics";

// Datos sintéticos para demo mode — bypassa auth completo, permite mostrar
// el hub a prospectos sin cuenta. SIN tocar BD: los hooks (HubFocusedWidgets,
// useCasePipeline) detectan demoMode y retornan mock data realista.
const DEMO_HUB_DATA: HubData = {
  account_id: "demo-account-mendez",
  account_name: DEMO_FIRM_NAME,
  plan: "elite",
  apps: [],
  staff_info: { ghl_user_email: "demo@nerimmigration.ai", display_name: DEMO_ATTORNEY },
};

interface HubApp {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface HubData {
  account_id: string;
  account_name: string;
  plan: string;
  apps: HubApp[];
  auth_token?: {
    access_token: string;
    refresh_token: string;
  } | null;
  staff_info?: {
    ghl_user_email: string;
    display_name: string;
  } | null;
}

interface HubStats {
  totalClients: number;
  activeForms: number;
  recentActivity: number;
}

function getCachedHubData() {
  try {
    const hasResolveParams = typeof window !== "undefined" && ["cid", "sig", "ts"].some((key) => new URLSearchParams(window.location.search).has(key));
    if (hasResolveParams) return null;
    const cached = sessionStorage.getItem("ner_hub_data");
    return cached ? (JSON.parse(cached) as HubData) : null;
  } catch {
    return null;
  }
}

export default function HubPage() {
  useTrackPageView("hub.dashboard");
  const [searchParams] = useSearchParams();
  const demoMode = useDemoMode();
  // En demo mode: bypassa cache + auth, usa data sintética de Méndez Immigration Law
  const [data, setData] = useState<HubData | null>(() => demoMode ? DEMO_HUB_DATA : getCachedHubData());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => {
    if (demoMode) return false;
    return !getCachedHubData();
  });
  const [authReady, setAuthReady] = useState(() => {
    if (demoMode) return true;
    const cached = getCachedHubData();
    return cached ? !cached.auth_token : false;
  });
  const [stats, setStats] = useState<HubStats>({ totalClients: 0, activeForms: 0, recentActivity: 0 });
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("ner_splash_seen") !== "1";
    } catch {
      return true;
    }
  });
  const navigate = useNavigate();
  const { canAccess, userRole, loading: permLoading } = useAppPermissions(data?.account_id ?? null);

  // M6 fix audit ronda 2: trackeamos auth.session_landed cuando el user
  // EFECTIVAMENTE llegó al hub con data cargada. Antes, auth.login_success
  // se disparaba post-signInWithPassword pero si resolvePostLoginDestination
  // o navigate fallaba, el funnel registraba success aunque user no llegó.
  //
  // Ahora: auth.login_success (intent) → auth.session_landed (arrived).
  // Pair en el funnel: drop = redirect/handshake problems.
  const cid = searchParams.get("cid");
  const sig = searchParams.get("sig");
  const ts = searchParams.get("ts");
  const exp = searchParams.get("exp");
  const uemail = searchParams.get("uemail");
  const uname = searchParams.get("uname");

  const sessionLandedRef = useRef(false);
  useEffect(() => {
    if (
      !sessionLandedRef.current &&
      data?.account_id &&
      !loading &&
      !demoMode
    ) {
      sessionLandedRef.current = true;
      void trackEvent("auth.session_landed", {
        accountId: data.account_id,
        properties: {
          source: cid && sig ? "ghl_handshake" : "direct_login",
        },
      });
    }
  }, [data?.account_id, loading, demoMode, cid, sig]);

  useEffect(() => {
    // DEMO MODE: bypassa toda la lógica de auth/cache/GHL handshake.
    // Permite presentar el hub a prospectos sin cuenta vía link público.
    if (demoMode) {
      setData(DEMO_HUB_DATA);
      setLoading(false);
      setAuthReady(true);
      setShowOnboarding(false);
      return;
    }

    if (cid && sig && ts) {
      resolveHub(cid, sig, ts, uemail, uname, exp);
      return;
    }

    const cached = getCachedHubData();
    if (cached) {
      setData(cached);
      setLoading(false);
      if (cached.auth_token) {
        establishSession(cached.auth_token);
      } else {
        setAuthReady(true);
      }
      return;
    }

    recoverFromSession();
  }, [cid, sig, ts, demoMode]);

  // Check onboarding status once we have an account
  useEffect(() => {
    if (demoMode) return; // demo mode: skip onboarding check
    if (!data?.account_id || !authReady) return;
    checkOnboarding(data.account_id);
  }, [data?.account_id, authReady, demoMode]);

  async function checkOnboarding(accountId: string) {
    try {
      const { data: account } = await supabase
        .from("ner_accounts")
        .select("onboarding_completed")
        .eq("id", accountId)
        .single();
      setShowOnboarding(account?.onboarding_completed === false);
    } catch {
      setShowOnboarding(false);
    }
  }

  async function recoverFromSession() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        setError("Enlace inválido o incompleto. Por favor usa el enlace desde tu CRM.");
        setLoading(false);
        return;
      }
      const userId = sessionData.session.user.id;

      // Step 1: Check sessionStorage for pinned account
      let resolvedAccountId = sessionStorage.getItem("ner_active_account_id");
      let resolvedAccountName = "";
      let resolvedPlan = "essential";

      if (resolvedAccountId) {
        // Validate it still exists
        const { data: account } = await supabase
          .from("ner_accounts")
          .select("account_name, plan")
          .eq("id", resolvedAccountId)
          .single();
        if (account) {
          resolvedAccountName = account.account_name;
          resolvedPlan = account.plan;
        } else {
          resolvedAccountId = null;
          sessionStorage.removeItem("ner_active_account_id");
        }
      }

      // Step 2: If not pinned, resolve from account_members with priority
      if (!resolvedAccountId) {
        const { data: members } = await supabase
          .from("account_members")
          .select("account_id, role")
          .eq("user_id", userId);

        if (!members || members.length === 0) {
          setError("No se encontró una cuenta asociada.");
          setLoading(false);
          return;
        }

        // Fetch account details for all memberships
        const accountIds = [...new Set(members.map(m => m.account_id))];
        const { data: accounts } = await supabase
          .from("ner_accounts")
          .select("id, account_name, plan, external_crm_id, is_active")
          .in("id", accountIds)
          .eq("is_active", true);

        if (!accounts || accounts.length === 0) {
          setError("No se encontró una cuenta activa.");
          setLoading(false);
          return;
        }

        // Sort: owner role first, then GHL-linked accounts
        const enriched = members
          .map(m => ({
            ...m,
            account: accounts.find(a => a.id === m.account_id),
          }))
          .filter(m => m.account);

        enriched.sort((a, b) => {
          if (a.role === "owner" && b.role !== "owner") return -1;
          if (b.role === "owner" && a.role !== "owner") return 1;
          const aHasGHL = a.account?.external_crm_id ? 0 : 1;
          const bHasGHL = b.account?.external_crm_id ? 0 : 1;
          return aHasGHL - bHasGHL;
        });

        const best = enriched[0];
        resolvedAccountId = best.account_id;
        resolvedAccountName = best.account?.account_name || "";
        resolvedPlan = best.account?.plan || "essential";

        // Pin for this session
        sessionStorage.setItem("ner_active_account_id", resolvedAccountId);
      }

      // Get apps
      const { data: appAccess } = await supabase
        .from("account_app_access")
        .select("app_id")
        .eq("account_id", resolvedAccountId);

      let apps: HubApp[] = [];
      if (appAccess && appAccess.length > 0) {
        const appIds = appAccess.map(a => a.app_id);
        const { data: hubApps } = await supabase
          .from("hub_apps")
          .select("id, name, slug, icon, description")
          .in("id", appIds)
          .eq("is_active", true);
        apps = hubApps || [];
      }

      // Get profile for staff name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();

      const recovered: HubData = {
        account_id: resolvedAccountId,
        account_name: resolvedAccountName,
        plan: resolvedPlan,
        apps,
        staff_info: profile?.full_name
          ? { ghl_user_email: "", display_name: profile.full_name }
          : null,
      };

      setData(recovered);
      sessionStorage.setItem("ner_hub_data", JSON.stringify(recovered));
      setAuthReady(true);
      setLoading(false);
    } catch (err) {
      console.error("Hub recovery failed:", err);
      setError("Enlace inválido o incompleto. Por favor usa el enlace desde tu CRM.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    if (demoMode) {
      // demo mode: stats sintéticas (no toques BD)
      setStats({ totalClients: 147, activeForms: 22, recentActivity: 9 });
      return;
    }
    loadStats();
  }, [authReady, demoMode]);

  async function loadStats() {
    const [clientsRes, formsRes, activityRes] = await Promise.all([
      supabase.from("client_profiles").select("id", { count: "exact", head: true }),
      supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("tool_usage_logs").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      totalClients: clientsRes.count || 0,
      activeForms: formsRes.count || 0,
      recentActivity: activityRes.count || 0,
    });
  }

  async function establishSession(authToken: { access_token: string; refresh_token: string }) {
    try {
      console.log("[Hub] Setting Supabase session...");
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: authToken.access_token,
        refresh_token: authToken.refresh_token,
      });
      if (sessionErr) {
        console.error("[Hub] setSession error:", sessionErr.message);
        await new Promise(r => setTimeout(r, 300));
        const { error: retryErr } = await supabase.auth.setSession({
          access_token: authToken.access_token,
          refresh_token: authToken.refresh_token,
        });
        if (retryErr) {
          console.error("[Hub] setSession retry also failed:", retryErr.message);
        } else {
          console.log("[Hub] Session established on retry");
        }
      } else {
        console.log("[Hub] Session established successfully");
      }
    } catch (err) {
      console.error("[Hub] establishSession exception:", err);
    } finally {
      setAuthReady(true);
    }
  }

  async function resolveHub(contactId: string, signature: string, timestamp: string, staffEmail?: string | null, staffName?: string | null, expiration?: string | null) {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ cid: contactId, sig: signature, ts: timestamp });
      if (expiration) params.set("exp", expiration);
      if (staffEmail) params.set("uemail", staffEmail);
      if (staffName) params.set("uname", staffName);
      
      console.log("[Hub] Resolving hub session...", { contactId: contactId.substring(0, 8) + "..." });
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/resolve-hub?${params.toString()}`,
        { headers: { "Content-Type": "application/json" } }
      );
      const json = await res.json();
      if (!res.ok) {
        console.error("[Hub] resolve-hub error:", json.error);
        setError(json.message || json.error || "Error al resolver la cuenta.");
        setLoading(false);
      } else {
        setData(json);
        sessionStorage.setItem("ner_hub_data", JSON.stringify(json));
        if (json.account_id) {
          sessionStorage.setItem("ner_active_account_id", json.account_id);
        }
        if (window.location.search.includes('cid=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        if (json.auth_token) {
          console.log("[Hub] Auth token received, establishing session...");
          await establishSession(json.auth_token);
        } else {
          console.warn("[Hub] No auth_token in response — auto-login may have failed on server");
          setAuthReady(true);
        }
        setLoading(false);
      }
    } catch (err: any) {
      console.error("[Hub] Connection error:", err);
      setError("Error de conexión. Intente de nuevo.");
      setLoading(false);
    }
  }

  if (loading) {
    // Fondo navy continuo (mismo gradient que splash) + loader "Conectando
    // con tu firma" con dots animados. La pantalla negra inicial se previene
    // desde index.html (script blocking que pinta el fondo antes de React).
    return (
      <>
        <style>{`
          @keyframes nerhub-dot {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50%      { opacity: 1; transform: scale(1.45); }
          }
        `}</style>
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "linear-gradient(135deg, #1d4ed8 0%, #2563EB 28%, #0f2d52 60%, #0B1F3A 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
            zIndex: 9998,
          }}
          aria-label="Conectando con tu firma"
        >
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", animation: "nerhub-dot 600ms cubic-bezier(0.4,0,0.2,1) 0ms infinite" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22D3EE", animation: "nerhub-dot 600ms cubic-bezier(0.4,0,0.2,1) 200ms infinite" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", animation: "nerhub-dot 600ms cubic-bezier(0.4,0,0.2,1) 400ms infinite" }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(243,244,246,0.7)", letterSpacing: "0.08em" }}>
            Conectando con tu firma...
          </div>
        </div>
      </>
    );
  }

  if (error) {
    // Error screen visualmente coherente con HubSplash + loading screen.
    // Mismo gradient navy. AlertTriangle estilizado en dorado-amber (no rojo
    // estridente). Mensaje específico (sin permisos / enlace inválido / etc).
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "linear-gradient(135deg, #1d4ed8 0%, #2563EB 28%, #0f2d52 60%, #0B1F3A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          zIndex: 9998,
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            background: "rgba(11,31,58,0.6)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "32px 28px",
            textAlign: "center",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 20px",
              borderRadius: "50%",
              background: "rgba(217,119,6,0.12)",
              border: "1px solid rgba(217,119,6,0.30)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle style={{ width: "24px", height: "24px", color: "#f59e0b" }} />
          </div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#F3F4F6",
              marginBottom: "8px",
              letterSpacing: "0.01em",
            }}
          >
            Acceso no disponible
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "rgba(243,244,246,0.7)",
              lineHeight: 1.55,
              marginBottom: "20px",
            }}
          >
            {error}
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "rgba(243,244,246,0.45)",
              letterSpacing: "0.06em",
            }}
          >
            Si el problema persiste, contactá al administrador de tu firma.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const availableAppSlugs = data.apps.map(a => a.slug).filter(s => s !== "case-engine");

  // Mientras splash activo: SOLO splash visible (no montar dashboard debajo
  // para evitar flash de KPIs en 0 antes que arranque la animación). Cuando
  // splash termina (onComplete), HubLayout + HubDashboard se montan limpio.
  if (showSplash) {
    return (
      <HubSplash
        firmName={data.account_name}
        firmInitials={getFirmInitials(data.account_name)}
        firmLogoUrl={null}
        onComplete={() => {
          try {
            sessionStorage.setItem("ner_splash_seen", "1");
          } catch {
            /* ignore storage errors */
          }
          setShowSplash(false);
        }}
      />
    );
  }

  return (
    <HubLayout
      accountName={data.account_name}
      staffName={data.staff_info?.display_name}
      plan={data.plan}
      availableApps={availableAppSlugs}
    >
      {/* Onboarding wizard overlay */}
      {showOnboarding && (
        <OnboardingWizard
          accountId={data.account_id}
          accountName={data.account_name}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <HubDashboard
        accountId={data.account_id}
        accountName={data.account_name}
        staffName={data.staff_info?.display_name}
        plan={data.plan}
        apps={data.apps}
        userRole={userRole}
        canAccessApp={canAccess}
        stats={stats}
        showOnboardingBanner={showOnboarding === true}
        onTriggerOnboarding={() => setShowOnboarding(true)}
      />
    </HubLayout>
  );
}

function getFirmInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NE";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
