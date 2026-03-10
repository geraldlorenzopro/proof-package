import { useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Briefcase, BarChart3, Calculator,
  FolderOpen, FileSearch, ClipboardList, Scale, FileText,
  Shield, ChevronRight, Menu, X, LogOut, Sparkles,
  ArrowLeft, Settings
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: any;
  route?: string;
  badge?: string;
}

const MAIN_NAV: NavItem[] = [
  { id: "home", label: "Dashboard", icon: LayoutDashboard, route: "/hub" },
  { id: "clients", label: "Clientes", icon: Users, route: "/dashboard/workspace-demo" },
];

const TOOL_NAV: NavItem[] = [
  { id: "smart-forms", label: "Smart Forms", icon: FileText, route: "/dashboard/smart-forms" },
  { id: "evidence", label: "Evidence Builder", icon: FolderOpen, route: "/dashboard/evidence" },
  { id: "cspa", label: "CSPA Calculator", icon: BarChart3, route: "/dashboard/cspa" },
  { id: "affidavit", label: "Affidavit Tool", icon: Calculator, route: "/dashboard/affidavit" },
  { id: "uscis-analyzer", label: "USCIS Analyzer", icon: FileSearch, route: "/dashboard/uscis-analyzer" },
  { id: "vawa-screener", label: "VAWA Screener", icon: Scale, route: "/dashboard/vawa-screener" },
  { id: "vawa-checklist", label: "VAWA Checklist", icon: ClipboardList, route: "/dashboard/vawa-checklist" },
  { id: "checklist", label: "Doc Checklist", icon: ClipboardList, route: "/dashboard/checklist" },
];

interface Props {
  children: ReactNode;
  accountName?: string;
  staffName?: string;
  plan?: string;
  availableApps?: string[];
}

export default function HubLayout({ children, accountName, staffName, plan, availableApps }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Filter tool nav by available apps
  const visibleTools = availableApps
    ? TOOL_NAV.filter(t => availableApps.includes(t.id))
    : TOOL_NAV;

  const isActive = (route?: string) => {
    if (!route) return false;
    if (route === "/hub") return location.pathname === "/hub";
    return location.pathname.startsWith(route);
  };

  const handleNav = (route?: string) => {
    if (route) {
      sessionStorage.setItem("ner_hub_return", "/hub");
      navigate(route);
    }
    setSidebarOpen(false);
  };

  const handleBackToGHL = () => {
    // Clear session and go back
    sessionStorage.removeItem("ner_hub_data");
    sessionStorage.removeItem("ner_hub_auto_launched");
    window.close(); // If opened as popup
  };

  const planColors: Record<string, string> = {
    essential: "text-muted-foreground",
    professional: "text-jarvis",
    elite: "text-accent",
    enterprise: "text-accent",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-secondary/80 transition-colors">
            {sidebarOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-jarvis" />
            <span className="font-display text-xs tracking-wider text-jarvis">NER AI</span>
          </div>
          <div className="w-9" />
        </div>
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 bottom-0 w-[260px] z-40 flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        bg-gradient-to-b from-[hsl(220_30%_7%)] to-[hsl(220_25%_5%)]
        border-r border-border/40`}
      >
        {/* Logo area */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/15 flex items-center justify-center relative overflow-hidden">
              <Shield className="w-5 h-5 text-jarvis relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-jarvis/20 to-transparent" />
            </div>
            <div>
              <h1 className="font-display text-sm font-bold tracking-wider text-jarvis">NER AI</h1>
              <p className="text-[9px] text-muted-foreground/60 tracking-[0.2em] uppercase">Immigration Suite</p>
            </div>
          </div>
        </div>

        {/* Account info chip */}
        {accountName && (
          <div className="mx-4 mb-4 p-3 rounded-xl bg-secondary/30 border border-border/30">
            <p className="text-xs font-semibold text-foreground truncate">{accountName}</p>
            <div className="flex items-center gap-2 mt-1">
              {staffName && <p className="text-[10px] text-muted-foreground truncate flex-1">{staffName}</p>}
              {plan && (
                <span className={`text-[9px] font-display font-bold uppercase tracking-wider ${planColors[plan] || ""}`}>
                  {plan}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main nav */}
        <nav className="px-3 space-y-0.5">
          <p className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">Principal</p>
          {MAIN_NAV.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.route)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group
                ${isActive(item.route)
                  ? "bg-jarvis/10 text-jarvis border border-jarvis/15 shadow-[0_0_12px_hsl(195_100%_50%/0.06)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                }`}
            >
              <item.icon className={`w-4 h-4 ${isActive(item.route) ? "text-jarvis" : "text-muted-foreground/60 group-hover:text-foreground"}`} />
              <span className="font-medium">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] font-bold bg-accent/20 text-accent px-1.5 py-0.5 rounded-md">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Tools section */}
        <div className="mt-4 px-3 flex-1 overflow-y-auto scrollbar-hide">
          <p className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">Herramientas</p>
          <div className="space-y-0.5">
            {visibleTools.map(item => (
              <button
                key={item.id}
                onClick={() => handleNav(item.route)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all group
                  ${isActive(item.route)
                    ? "bg-jarvis/10 text-jarvis border border-jarvis/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                  }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive(item.route) ? "text-jarvis" : "text-muted-foreground/50 group-hover:text-foreground"}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
            <Sparkles className="w-3 h-3 text-jarvis/30" />
            <span className="tracking-wider uppercase">Powered by NER AI</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-[260px] pt-14 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
