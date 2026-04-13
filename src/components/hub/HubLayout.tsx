import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Shield, Home, LogOut, Users, UserSearch, MessageSquare,
  FolderOpen, Calendar, BarChart3, Bot, Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import HubCreditsWidget from "./HubCreditsWidget";
import CamilaFloatingPanel from "./CamilaFloatingPanel";
interface Props {
  children: ReactNode;
  accountName?: string;
  staffName?: string;
  plan?: string;
  availableApps?: string[];
}

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", path: "/hub", match: (p: string) => p === "/hub" },
  { icon: UserSearch, label: "Contactos", path: "/hub/leads", match: (p: string) => p.startsWith("/hub/leads") },
  { icon: Users, label: "Clientes", path: "/hub/clients", match: (p: string) => p.startsWith("/hub/clients") },
  { icon: MessageSquare, label: "Consultas", path: "/hub/consultations", match: (p: string) => p === "/hub/consultations" },
  { icon: FolderOpen, label: "Casos", path: "/hub/cases", match: (p: string) => p.startsWith("/hub/cases") },
  { icon: Calendar, label: "Agenda", path: "/hub/agenda", match: (p: string) => p === "/hub/agenda" },
  { icon: BarChart3, label: "Reportes", path: "/hub/reports", match: (p: string) => p === "/hub/reports" || p === "/hub/intelligence" },
  { icon: Bot, label: "Equipo AI", path: "/hub/ai", match: (p: string) => p === "/hub/ai" },
  { icon: Settings, label: "Config", path: "/hub/settings/office", match: (p: string) => p.startsWith("/hub/settings") },
];

const INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours

export default function HubLayout({ children, accountName, staffName, plan }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  // ═══ Inactivity timeout ═══
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        sessionStorage.removeItem("ner_hub_data");
        sessionStorage.removeItem("ner_impersonate");
        sessionStorage.removeItem("ner_active_account_id");
        await supabase.auth.signOut();
        toast.warning(
          "Sesión cerrada por inactividad. Tus datos de clientes están protegidos.",
          { duration: 6000 }
        );
        navigate("/auth", { replace: true });
      }, INACTIVITY_MS);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [navigate]);

  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const impersonateData = (() => {
    try {
      const raw = sessionStorage.getItem("ner_impersonate");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (new Date(parsed.expires_at) < new Date()) {
        sessionStorage.removeItem("ner_impersonate");
        return null;
      }
      return parsed;
    } catch { return null; }
  })();

  async function handleLogout() {
    sessionStorage.removeItem("ner_hub_data");
    sessionStorage.removeItem("ner_active_account_id");
    sessionStorage.removeItem("ner_impersonate");
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  const currentPath = location.pathname;
  const isHubSection = currentPath === "/hub" || currentPath.startsWith("/hub/") || currentPath.startsWith("/case-engine/");
  const isHubAiPage = currentPath === "/hub/ai";

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Impersonation banner */}
      {impersonateData && (
        <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between text-sm font-medium shrink-0 z-[9999]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔀</span>
            <span>Modo Soporte: <strong>{impersonateData.account_name}</strong></span>
            <span className="text-black/60 text-xs ml-2">Estás viendo esta cuenta como administrador</span>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("ner_impersonate");
              navigate("/admin/firms", { replace: true });
            }}
            className="bg-black/20 hover:bg-black/30 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Salir de la firma
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ═══ SIDEBAR — 72px fixed ═══ */}
        {isHubSection && (
          <aside className="hidden lg:flex flex-col items-center w-[72px] border-r border-border/20 bg-card/30 py-4 shrink-0">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center mb-4">
              <span className="text-jarvis font-display font-extrabold text-sm">N</span>
            </div>

            {/* Nav items */}
            <div className="flex flex-col items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = item.match(currentPath);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-[60px] flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all duration-150 relative ${
                      isActive
                        ? "bg-jarvis/15 text-jarvis"
                        : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-jarvis rounded-r" />
                    )}
                    <item.icon className="w-4 h-4" />
                    <span className="text-[9px] font-medium leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Credits Widget */}
            {accountId && (
              <div className="mb-1">
                <HubCreditsWidget accountId={accountId} />
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-[60px] flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Salir</span>
            </button>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!isHubSection && (
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 shrink-0">
              <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2.5">
                <button
                  onClick={() => navigate("/hub")}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <Shield className="w-3.5 h-3.5 text-jarvis" />
                  <span className="font-medium">Hub</span>
                </button>
                <div className="flex items-center gap-3">
                  {accountName && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">{staffName || accountName}</span>
                  )}
                </div>
              </div>
            </header>
          )}

          <main className={`flex-1 min-h-0 ${isHubAiPage ? "overflow-hidden" : "overflow-auto"}`}>
            {children}
          </main>
        </div>
      </div>

      {/* Camila Floating Panel — hidden on /hub home and /hub/chat */}
      {isHubSection && accountId && currentPath !== "/hub/chat" && currentPath !== "/hub" && (
        <CamilaFloatingPanel accountId={accountId} />
      )}

    </div>
  );
}
