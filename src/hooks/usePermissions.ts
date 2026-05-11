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

export function usePermissions(accountIdOverride?: string | null) {
  const [role, setRole] = useState<UserRole>("readonly");
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS.readonly);
  const [isLoading, setIsLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(accountIdOverride ?? null);

  useEffect(() => {
    loadPermissions();
  }, [accountIdOverride]);

  async function loadPermissions() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const membershipQuery = supabase
        .from("account_members")
        .select("account_id, role, custom_permissions")
        .eq("user_id", user.id);

      const { data: member } = await (accountIdOverride
        ? membershipQuery.eq("account_id", accountIdOverride).maybeSingle()
        : membershipQuery.limit(1).maybeSingle());

      if (!member) return;

      const userRole = (member.role as UserRole) || "readonly";
      setRole(userRole);
      setAccountId(member.account_id);

      const base = DEFAULT_PERMISSIONS[userRole] || DEFAULT_PERMISSIONS.readonly;
      const custom = (member.custom_permissions as Record<string, boolean>) || {};
      setPermissions({ ...base, ...custom });
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

  // Hierarchical visibility — espejo de user_can_view_visibility() en SQL.
  // Útil cuando el frontend necesita saber si mostrar UI controls (ej:
  // dropdown visibility en creación de notas) sin esperar al RLS check.
  function canViewVisibility(visibility: VisibilityLevel | string | null): boolean {
    if (!visibility || visibility === "team") return true;
    if (visibility === "attorney_only") {
      return role === "owner" || role === "admin" || role === "attorney";
    }
    if (visibility === "admin_only") {
      return role === "owner" || role === "admin";
    }
    return false;
  }

  // Niveles de visibility que el user puede ASIGNAR al crear contenido.
  // Un paralegal puede crear notas team (no las propias attorney_only).
  function assignableVisibilityLevels(): VisibilityLevel[] {
    if (role === "owner" || role === "admin") {
      return ["team", "attorney_only", "admin_only"];
    }
    if (role === "attorney") {
      return ["team", "attorney_only"];
    }
    return ["team"];
  }

  return {
    role,
    permissions,
    can,
    canViewVisibility,
    assignableVisibilityLevels,
    isOwner,
    isLoading,
    accountId,
  };
}

export type VisibilityLevel = "team" | "attorney_only" | "admin_only";

export { DEFAULT_PERMISSIONS };
