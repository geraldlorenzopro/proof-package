import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "admin" | "attorney" | "paralegal" | "assistant" | "readonly" | "member";

export interface Permissions {
  ver_revenue: boolean;
  ver_todos_casos: boolean;
  ver_performance_equipo: boolean;
  ver_configuracion: boolean;
  gestionar_usuarios: boolean;
  eliminar_casos: boolean;
  ver_audit_logs: boolean;
  activar_agentes_ai: boolean;
  ver_analytics: boolean;
  ver_equipo_hub: boolean;
  ver_consultas: boolean;
  crear_casos: boolean;
  editar_casos: boolean;
  enviar_emails: boolean;
}

const DEFAULT_PERMISSIONS: Record<string, Permissions> = {
  owner: {
    ver_revenue: true,
    ver_todos_casos: true,
    ver_performance_equipo: true,
    ver_configuracion: true,
    gestionar_usuarios: true,
    eliminar_casos: true,
    ver_audit_logs: true,
    activar_agentes_ai: true,
    ver_analytics: true,
    ver_equipo_hub: true,
    ver_consultas: true,
    crear_casos: true,
    editar_casos: true,
    enviar_emails: true,
  },
  admin: {
    ver_revenue: true,
    ver_todos_casos: true,
    ver_performance_equipo: true,
    ver_configuracion: true,
    gestionar_usuarios: true,
    eliminar_casos: true,
    ver_audit_logs: true,
    activar_agentes_ai: true,
    ver_analytics: true,
    ver_equipo_hub: true,
    ver_consultas: true,
    crear_casos: true,
    editar_casos: true,
    enviar_emails: true,
  },
  attorney: {
    ver_revenue: false,
    ver_todos_casos: true,
    ver_performance_equipo: true,
    ver_configuracion: false,
    gestionar_usuarios: false,
    eliminar_casos: false,
    ver_audit_logs: false,
    activar_agentes_ai: true,
    ver_analytics: false,
    ver_equipo_hub: true,
    ver_consultas: true,
    crear_casos: true,
    editar_casos: true,
    enviar_emails: true,
  },
  paralegal: {
    ver_revenue: false,
    ver_todos_casos: false,
    ver_performance_equipo: false,
    ver_configuracion: false,
    gestionar_usuarios: false,
    eliminar_casos: false,
    ver_audit_logs: false,
    activar_agentes_ai: true,
    ver_analytics: false,
    ver_equipo_hub: true,
    ver_consultas: true,
    crear_casos: true,
    editar_casos: true,
    enviar_emails: true,
  },
  member: {
    ver_revenue: false,
    ver_todos_casos: false,
    ver_performance_equipo: false,
    ver_configuracion: false,
    gestionar_usuarios: false,
    eliminar_casos: false,
    ver_audit_logs: false,
    activar_agentes_ai: true,
    ver_analytics: false,
    ver_equipo_hub: true,
    ver_consultas: true,
    crear_casos: true,
    editar_casos: true,
    enviar_emails: true,
  },
  assistant: {
    ver_revenue: false,
    ver_todos_casos: false,
    ver_performance_equipo: false,
    ver_configuracion: false,
    gestionar_usuarios: false,
    eliminar_casos: false,
    ver_audit_logs: false,
    activar_agentes_ai: false,
    ver_analytics: false,
    ver_equipo_hub: false,
    ver_consultas: true,
    crear_casos: false,
    editar_casos: false,
    enviar_emails: true,
  },
  readonly: {
    ver_revenue: false,
    ver_todos_casos: false,
    ver_performance_equipo: false,
    ver_configuracion: false,
    gestionar_usuarios: false,
    eliminar_casos: false,
    ver_audit_logs: false,
    activar_agentes_ai: false,
    ver_analytics: false,
    ver_equipo_hub: false,
    ver_consultas: false,
    crear_casos: false,
    editar_casos: false,
    enviar_emails: false,
  },
};

export function usePermissions() {
  const [role, setRole] = useState<UserRole>("readonly");
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS.readonly);
  const [isLoading, setIsLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  async function loadPermissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data: member } = await supabase
        .from("account_members")
        .select("account_id, role, custom_permissions")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!member) { setIsLoading(false); return; }

      const userRole = (member.role as UserRole) || "readonly";
      setRole(userRole);
      setAccountId(member.account_id);

      // Get base permissions for role
      const base = DEFAULT_PERMISSIONS[userRole] || DEFAULT_PERMISSIONS.readonly;

      // Apply custom overrides
      const custom = (member.custom_permissions as Record<string, boolean>) || {};
      const merged = { ...base, ...custom };

      setPermissions(merged);
    } catch (err) {
      console.warn("[usePermissions]", err);
    } finally {
      setIsLoading(false);
    }
  }

  function can(permission: keyof Permissions): boolean {
    return permissions[permission] ?? false;
  }

  const isOwner = role === "owner" || role === "admin";

  return { role, permissions, can, isOwner, isLoading, accountId };
}

export { DEFAULT_PERMISSIONS };
