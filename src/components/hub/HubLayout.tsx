import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Home, LogOut, Users, MessageSquare,
  FolderOpen, Calendar, BarChart3, Bot, Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HubCreditsWidget from "./HubCreditsWidget";
import { TooltipProvider } from "@/components/ui/tooltip";

interface Props {
  children: ReactNode;
  accountName?: string;
  staffName?: string;
  plan?: string;
  availableApps?: string[];
}

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", path: "/hub", match: (p: string) => p === "/hub" },
  { icon: Users, label: "Clientes", path: "/hub/clients", match: (p: string) => p.startsWith("/hub/clients") },
  { icon: MessageSquare, label: "Consultas", path: "/hub/consultations", match: (p: string) => p === "/hub/consultations" },
  { icon: FolderOpen, label: "Casos", path: "/hub/cases", match: (p: string) => p.startsWith("/hub/cases") },
  { icon: Calendar, label: "Agenda", path: "/hub/agenda", match: (p: string) => p === "/hub/agenda" },
  { icon: BarChart3, label: "Reportes", path: "/hub/reports", match: (p: string) => p === "/hub/reports" },
  { icon: Bot, label: "Equipo AI", path: "/hub/ai", match: (p: string) => p === "/hub/ai" },
  { icon: Settings, label: "Config", path: "/hub/settings/office", match: (p: string) => p.startsWith("/hub/settings") },
];

export default function HubLayout({ children, accountName, staffName, plan }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

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
  const isHubSection = currentPath === "/hub" || currentPath.startsWith("/hub/");

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
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
        {/* ═══ SIDEBAR ═══ */}
        {isHubSection && (
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden lg:flex flex-col items-center w-[72px] border-r border-border/20 bg-card/30 py-4 gap-0.5 shrink-0"
          >
            <TooltipProvider delayDuration={200}>
              {/* Logo */}
              <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center mb-3">
                <span className="text-jarvis font-display font-extrabold text-sm">N</span>
              </div>

              {NAV_ITEMS.map((item) => {
                const isActive = item.match(currentPath);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-[60px] flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all relative ${
                      isActive
                        ? "bg-jarvis/15 text-jarvis"
                        : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/5"
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

              <div className="flex-1" />

              {/* Credits */}
              {accountId && (
                <div className="w-full px-1.5">
                  <HubCreditsWidget accountId={accountId} />
                </div>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-[60px] flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Salir</span>
              </button>
            </TooltipProvider>
          </motion.aside>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Compact top bar for non-hub routes */}
          {!isHubSection && (
            <motion.header
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 shrink-0"
            >
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
            </motion.header>
          )}

          <main className="flex-1 min-h-0 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
