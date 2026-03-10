import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Sparkles } from "lucide-react";

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

  const isOnDashboard = location.pathname === "/hub";

  return (
    <div className="min-h-screen bg-background">
      {/* Compact top bar — only visible when inside a tool (not on dashboard) */}
      {!isOnDashboard && (
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

      {/* Main content — full width, no sidebar offset */}
      <main className="min-h-screen">
        {children}
      </main>
    </div>
  );
}
