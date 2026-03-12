import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Upload, FileCheck, X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Notification {
  id: string;
  type: "evidence_uploaded" | "form_completed";
  title: string;
  detail: string;
  timestamp: Date;
  read: boolean;
}

export default function HubNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const addNotification = useCallback((notif: Omit<Notification, "id" | "read">) => {
    const newNotif: Notification = {
      ...notif,
      id: crypto.randomUUID(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    setHasNew(true);
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("hub-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "evidence_items" },
        (payload) => {
          const item = payload.new as any;
          addNotification({
            type: "evidence_uploaded",
            title: "Nueva evidencia subida",
            detail: item.file_name || "Archivo subido por cliente",
            timestamp: new Date(item.created_at),
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "form_submissions" },
        (payload) => {
          const form = payload.new as any;
          if (form.status === "completed") {
            addNotification({
              type: "form_completed",
              title: "Cuestionario completado",
              detail: form.client_name
                ? `${form.client_name} completó ${form.form_type?.toUpperCase() || "formulario"}`
                : `Formulario ${form.form_type?.toUpperCase() || ""} completado`,
              timestamp: new Date(form.updated_at),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setHasNew(false);
  }

  function clearAll() {
    setNotifications([]);
    setHasNew(false);
  }

  function toggleOpen() {
    setOpen(prev => !prev);
    if (!open && hasNew) {
      setHasNew(false);
    }
  }

  const ICON_MAP = {
    evidence_uploaded: Upload,
    form_completed: FileCheck,
  };

  const COLOR_MAP = {
    evidence_uploaded: "text-emerald-400 bg-emerald-500/15",
    form_completed: "text-cyan-400 bg-cyan-500/15",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        className="relative w-9 h-9 rounded-lg border border-border/30 bg-card flex items-center justify-center hover:bg-muted/30 transition-colors"
      >
        <Bell className={`w-4 h-4 ${hasNew ? "text-jarvis" : "text-muted-foreground"}`} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-jarvis text-[9px] font-bold text-background flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
        {hasNew && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: 2, duration: 0.6 }}
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-jarvis"
          />
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[420px] rounded-xl border border-border/40 bg-card shadow-2xl shadow-black/30 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-jarvis" />
                <span className="text-xs font-bold text-foreground">Notificaciones</span>
                {unreadCount > 0 && (
                  <Badge className="text-[8px] bg-jarvis/10 text-jarvis border-jarvis/20">
                    {unreadCount} nueva{unreadCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/30"
                    >
                      Marcar leídas
                    </button>
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-1 rounded hover:bg-muted/30"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[340px] divide-y divide-border/20">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/60">Sin notificaciones</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">
                    Las alertas aparecerán cuando un cliente suba evidencia o complete un cuestionario
                  </p>
                </div>
              ) : (
                notifications.map(notif => {
                  const IconComp = ICON_MAP[notif.type];
                  const colors = COLOR_MAP[notif.type];

                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        notif.read ? "opacity-60" : "bg-jarvis/[0.02]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${colors} flex items-center justify-center shrink-0 mt-0.5`}>
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground leading-tight">
                          {notif.title}
                          {!notif.read && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-jarvis ml-1.5 align-middle" />
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {notif.detail}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
                          <span className="text-[9px] text-muted-foreground/50">
                            {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
