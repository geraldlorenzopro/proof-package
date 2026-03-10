import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Shield } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import HubDashboard from "@/components/hub/HubDashboard";

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

export default function HubPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [stats, setStats] = useState<HubStats>({ totalClients: 0, activeForms: 0, recentActivity: 0 });
  const navigate = useNavigate();

  const cid = searchParams.get("cid");
  const sig = searchParams.get("sig");
  const ts = searchParams.get("ts");
  const uemail = searchParams.get("uemail");
  const uname = searchParams.get("uname");

  useEffect(() => {
    if (cid && sig && ts) {
      resolveHub(cid, sig, ts, uemail, uname);
      return;
    }
    const cached = sessionStorage.getItem("ner_hub_data");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as HubData;
        setData(parsed);
        if (parsed.auth_token) {
          establishSession(parsed.auth_token);
        } else {
          setAuthReady(true);
        }
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }
    // No query params and no cache — try to recover from existing auth session
    recoverFromSession();
  }, [cid, sig, ts]);

  async function recoverFromSession() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        setError("Enlace inválido o incompleto. Por favor usa el enlace desde tu CRM.");
        setLoading(false);
        return;
      }
      const userId = sessionData.session.user.id;

      // Get account info
      const { data: member } = await supabase
        .from("account_members")
        .select("account_id, role")
        .eq("user_id", userId)
        .limit(1)
        .single();

      if (!member) {
        setError("No se encontró una cuenta asociada.");
        setLoading(false);
        return;
      }

      const { data: account } = await supabase
        .from("ner_accounts")
        .select("account_name, plan")
        .eq("id", member.account_id)
        .single();

      if (!account) {
        setError("Cuenta no encontrada.");
        setLoading(false);
        return;
      }

      // Get apps the account has access to
      const { data: appAccess } = await supabase
        .from("account_app_access")
        .select("app_id")
        .eq("account_id", member.account_id);

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
        account_id: member.account_id,
        account_name: account.account_name,
        plan: account.plan,
        apps,
        staff_info: profile?.full_name ? { ghl_user_email: "", display_name: profile.full_name } : null,
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

  // Load stats once auth is ready
  useEffect(() => {
    if (!authReady) return;
    loadStats();
  }, [authReady]);

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
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: authToken.access_token,
        refresh_token: authToken.refresh_token,
      });
      if (sessionErr) console.error("Auto-login session error:", sessionErr.message);
      else console.log("Auto-login session established successfully");
    } catch (err) {
      console.error("Auto-login failed:", err);
    } finally {
      setAuthReady(true);
    }
  }

  async function resolveHub(contactId: string, signature: string, timestamp: string, staffEmail?: string | null, staffName?: string | null) {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ cid: contactId, sig: signature, ts: timestamp });
      if (staffEmail) params.set("uemail", staffEmail);
      if (staffName) params.set("uname", staffName);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/resolve-hub?${params.toString()}`,
        { headers: { "Content-Type": "application/json" } }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al resolver la cuenta.");
        setLoading(false);
      } else {
        setData(json);
        sessionStorage.setItem("ner_hub_data", JSON.stringify(json));
        if (json.auth_token) {
          await establishSession(json.auth_token);
        } else {
          setAuthReady(true);
        }
        setLoading(false);
      }
    } catch (err: any) {
      setError("Error de conexión. Intente de nuevo.");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-jarvis/10 border border-jarvis/15 flex items-center justify-center mx-auto mb-4 relative">
            <Loader2 className="w-7 h-7 animate-spin text-jarvis" />
            <div className="absolute inset-0 rounded-2xl animate-pulse bg-jarvis/5" />
          </div>
          <p className="text-sm text-muted-foreground">Preparando tu workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="rounded-2xl border border-destructive/20 bg-card p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Acceso no disponible</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const availableAppSlugs = data.apps.map(a => a.slug).filter(s => s !== "case-engine");

  return (
    <HubLayout
      accountName={data.account_name}
      staffName={data.staff_info?.display_name}
      plan={data.plan}
      availableApps={availableAppSlugs}
    >
      <HubDashboard
        accountName={data.account_name}
        staffName={data.staff_info?.display_name}
        plan={data.plan}
        apps={data.apps}
        stats={stats}
      />
    </HubLayout>
  );
}
