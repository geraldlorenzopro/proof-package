import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, BarChart3, Home, LogOut, Crown, Building2, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import HubCreditsWidget from "./HubCreditsWidget";

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

  // Get account ID for credits widget
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  // Impersonation banner
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

  const isOnDashboard = location.pathname === "/hub";
  const isOnIntelligence = location.pathname === "/hub/intelligence";
  const isOnOfficeSettings = location.pathname === "/hub/settings/office";

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ SIDEBAR — Minimal icon rail ═══ */}
      {(isOnDashboard || isOnOfficeSettings) && (
        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden lg:flex flex-col items-center w-14 border-r border-border/20 bg-card/30 py-5 gap-3 shrink-0"
        >
          <button
            onClick={() => navigate("/hub")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isOnDashboard && !isOnIntelligence
                ? "bg-jarvis/15 text-jarvis border border-jarvis/20"
                : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/5"
            }`}
            title="Dashboard"
          >
            <Home className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate("/hub/intelligence")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isOnIntelligence
                ? "bg-accent/15 text-accent border border-accent/20"
                : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/5"
            }`}
            title="Centro de Inteligencia"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          {isPlatformAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Panel Admin"
            >
              <Crown className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => navigate("/hub/settings/office")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isOnOfficeSettings
                ? "bg-jarvis/15 text-jarvis border border-jarvis/20"
                : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-foreground/5"
            }`}
            title="Mi Firma"
          >
            <Building2 className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          {/* Credits Widget */}
          {accountId && (
            <div className="w-full px-1.5">
              <HubCreditsWidget accountId={accountId} />
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
        )
        {/* Compact top bar — only visible when inside a tool (not on dashboard) */}
        {!isOnDashboard && !isOnIntelligence && !isOnOfficeSettings && (
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
