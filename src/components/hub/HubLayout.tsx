import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, BarChart3, Home, LogOut, Crown, Building2, FlaskConical, Users, ClipboardList, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import HubCreditsWidget from "./HubCreditsWidget";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface Props {
  children: ReactNode;
  accountName?: string;
  staffName?: string;
  plan?: string;
  availableApps?: string[];
}

const planColors: Record<string, string> = {
  essential: "text-muted-foreground",
  professional: "text-jarvis",
  elite: "text-accent",
  enterprise: "text-accent",
};

export default function HubLayout({ children, accountName, staffName, plan }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPlatformAdmin } = usePlatformAdmin();

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
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  const currentPath = location.pathname;
  const isHubSection = currentPath === "/hub" || currentPath.startsWith("/hub/");

  // FIX 7: Sidebar nav items with labels and new routes
  const navItems = [
    { icon: Home, label: "Inicio", path: "/hub", match: (p: string) => p === "/hub" },
    { icon: Users, label: "Clientes", path: "/dashboard/workspace-demo", match: (p: string) => p === "/dashboard/workspace-demo" },
    { icon: ClipboardList, label: "Consultas", path: "/hub/consultations", match: (p: string) => p === "/hub/consultations" },
    { icon: BarChart3, label: "Reportes", path: "/hub/intelligence", match: (p: string) => p === "/hub/intelligence" },
    { icon: Building2, label: "Firma", path: "/hub/settings/office", match: (p: string) => p === "/hub/settings/office" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ SIDEBAR — Icon rail with labels ═══ */}
      {isHubSection && (
        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden lg:flex flex-col items-center w-[72px] border-r border-border/20 bg-card/30 py-5 gap-1 shrink-0"
        >
          <TooltipProvider delayDuration={200}>
            {navItems.map((item) => {
              const isActive = item.match(currentPath);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-14 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                    isActive
                      ? "bg-jarvis/15 text-jarvis border border-jarvis/20"
                      : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-none">{item.label}</span>
                </button>
              );
            })}

            {isPlatformAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="w-14 flex flex-col items-center gap-0.5 py-2 rounded-xl text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent"
              >
                <Crown className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Admin</span>
              </button>
            )}

            <div className="flex-1" />

            {accountId && (
              <div className="w-full px-1.5">
                <HubCreditsWidget accountId={accountId} />
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-14 flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all border border-transparent"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Salir</span>
            </button>
          </TooltipProvider>
        </motion.aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Impersonation banner */}
        {impersonateData && (
          <div className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
            <span>⚠️ MODO SOPORTE — Estás viendo la cuenta de {impersonateData.account_name}</span>
            <button
              onClick={() => { sessionStorage.removeItem("ner_impersonate"); navigate("/admin/accounts"); }}
              className="bg-black/20 hover:bg-black/30 px-3 py-1 rounded text-xs font-bold transition-colors"
            >
              Salir
            </button>
          </div>
        )}
        {/* Test mode badge for platform admin */}
        {isPlatformAdmin && (
          <button
            onClick={() => navigate("/admin/test-suite")}
            className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="font-bold">🧪 MODO PRUEBA</span>
            <span className="text-amber-400/60">— Click para abrir checklist</span>
          </button>
        )}
        {/* Compact top bar — only visible when inside a tool (not on hub routes) */}
        {!isHubSection && (
          <motion.header
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40"
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
                {plan && (
                  <span className={`text-[9px] font-display font-bold uppercase tracking-wider ${planColors[plan] || "text-muted-foreground"}`}>
                    {plan}
                  </span>
                )}
              </div>
            </div>
          </motion.header>
        )}

        {/* Main content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
