import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Building2, Users, CreditCard, BarChart3,
  ScrollText, ArrowLeft, Shield,
} from "lucide-react";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Firmas", path: "/admin/accounts", icon: Building2 },
  { label: "Usuarios", path: "/admin/users", icon: Users },
  { label: "Billing", path: "/admin/billing", icon: CreditCard },
  { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
  { label: "Logs", path: "/admin/logs", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      navigate("/hub", { replace: true });
    }
  }, [loading, isPlatformAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPlatformAdmin) return null;

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-56 border-r border-white/5 bg-[hsl(220,20%,8%)] flex flex-col shrink-0"
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <span className="font-bold text-white text-sm tracking-wide">NER</span>
            <span className="text-[9px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full tracking-wider">
              ADMIN
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                  isActive
                    ? "bg-red-500/10 text-red-400 font-medium"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Back to Hub */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => navigate("/hub")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Hub
          </button>
        </div>
      </motion.aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
