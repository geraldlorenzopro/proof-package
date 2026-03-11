import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, X, ArrowRight } from "lucide-react";
import HubActivityFeed from "./HubActivityFeed";

export default function HubActivityDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger — History icon */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-border/30 bg-card/30 hover:bg-card/50 transition-all text-muted-foreground/50 hover:text-muted-foreground group"
        title="Actividad reciente"
      >
        <Clock className="w-3.5 h-3.5" />
        {/* Notification dot */}
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-jarvis/60 border border-background" />
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[90]"
            onClick={() => setOpen(false)}
          />

          {/* Side Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md z-[91] flex flex-col bg-secondary border-l border-foreground/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-jarvis/10 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-jarvis" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Actividad Reciente</h3>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-mono">Últimas acciones</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg border border-border/30 bg-background/50 hover:bg-background flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <HubActivityFeed />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/20">
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border/20 bg-card/50 hover:bg-card transition-colors text-xs text-muted-foreground hover:text-foreground group">
                <span>Ver historial completo</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </>
  );
}
