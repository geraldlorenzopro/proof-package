import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Check, X, Loader2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AppWithAccess {
  id: string;
  name: string;
  slug: string;
  roles: Set<string>;
  hasRestrictions: boolean;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: "Owner", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  admin: { label: "Admin", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  member: { label: "Member", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
};

const ALL_ROLES = ["owner", "admin", "member"] as const;

export default function HubToolPermissions() {
  const [apps, setApps] = useState<AppWithAccess[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadPermissions(); }, []);

  async function loadPermissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (!member) return;
      setAccountId(member.account_id);

      // Get account's apps
      const { data: access } = await supabase
        .from("account_app_access")
        .select("app_id")
        .eq("account_id", member.account_id);

      if (!access || access.length === 0) { setLoading(false); return; }

      const appIds = access.map(a => a.app_id);
      const { data: hubApps } = await supabase
        .from("hub_apps")
        .select("id, name, slug")
        .in("id", appIds)
        .eq("is_active", true);

      // Get existing restrictions
      const { data: restrictions } = await supabase
        .from("app_role_access" as any)
        .select("app_id, role")
        .eq("account_id", member.account_id);

      const restrictionMap = new Map<string, Set<string>>();
      const restrictedApps = new Set<string>();
      if (restrictions) {
        for (const r of restrictions as any[]) {
          restrictedApps.add(r.app_id);
          if (!restrictionMap.has(r.app_id)) restrictionMap.set(r.app_id, new Set());
          restrictionMap.get(r.app_id)!.add(r.role);
        }
      }

      setApps(
        (hubApps || []).map(app => ({
          ...app,
          roles: restrictionMap.get(app.id) || new Set(),
          hasRestrictions: restrictedApps.has(app.id),
        }))
      );
    } catch (err) {
      console.warn("[permissions]", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(app: AppWithAccess, role: string) {
    if (!accountId || role === "owner" || role === "admin") return; // owners/admins always have access
    setSaving(app.id + role);

    try {
      const hasRole = app.roles.has(role);
      const isRestricted = app.hasRestrictions;

      if (!isRestricted && !hasRole) {
        // First restriction: add all roles except the one being removed
        // This means we're switching from "open" to "restricted"
        // Add member role as restricted (not allowed)
        // Actually: we need to add rows for roles that ARE allowed
        // If toggling member OFF: add owner+admin rows (they're always allowed but we mark them)
        // Simpler: just add no rows for the toggled role = denied
        for (const r of ALL_ROLES) {
          if (r === role) continue;
          await supabase.from("app_role_access" as any).insert({
            account_id: accountId,
            app_id: app.id,
            role: r,
          });
        }
      } else if (hasRole) {
        // Remove this role's access
        await supabase
          .from("app_role_access" as any)
          .delete()
          .eq("account_id", accountId)
          .eq("app_id", app.id)
          .eq("role", role);
      } else {
        // Add this role's access
        await supabase.from("app_role_access" as any).insert({
          account_id: accountId,
          app_id: app.id,
          role: role,
        });
      }

      // Check if after changes, all roles are now allowed — if so, remove all restrictions
      const { data: remaining } = await supabase
        .from("app_role_access" as any)
        .select("role")
        .eq("account_id", accountId)
        .eq("app_id", app.id);

      const remainingRoles = new Set((remaining || []).map((r: any) => r.role));
      const allRolesPresent = ALL_ROLES.every(r => remainingRoles.has(r));

      if (allRolesPresent) {
        // All roles allowed = remove restrictions (back to open)
        await supabase
          .from("app_role_access" as any)
          .delete()
          .eq("account_id", accountId)
          .eq("app_id", app.id);
        remainingRoles.clear();
      }

      // Update local state
      setApps(prev => prev.map(a => {
        if (a.id !== app.id) return a;
        return {
          ...a,
          roles: remainingRoles,
          hasRestrictions: remainingRoles.size > 0,
        };
      }));

      toast.success("Permisos actualizados");
    } catch (err) {
      toast.error("Error al actualizar permisos");
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  async function resetApp(appId: string) {
    if (!accountId) return;
    setSaving(appId);
    try {
      await supabase
        .from("app_role_access" as any)
        .delete()
        .eq("account_id", accountId)
        .eq("app_id", appId);

      setApps(prev => prev.map(a =>
        a.id === appId ? { ...a, roles: new Set(), hasRestrictions: false } : a
      ));
      toast.success("Restricciones eliminadas — todos los roles tienen acceso");
    } catch (err) {
      toast.error("Error al resetear permisos");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-jarvis" />
        <h3 className="text-sm font-bold text-foreground">Control de Acceso por Rol</h3>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
        <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Por defecto, todos los roles tienen acceso a todas las herramientas. 
          <strong className="text-foreground"> Owners y Admins siempre tienen acceso completo.</strong> Usa esta tabla para restringir el acceso de <strong className="text-foreground">Members</strong> a herramientas específicas.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left text-[10px] font-display font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                Herramienta
              </th>
              {ALL_ROLES.map(role => (
                <th key={role} className="text-center text-[10px] font-display font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-24">
                  {ROLE_LABELS[role].label}
                </th>
              ))}
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr key={app.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{app.name}</span>
                    {!app.hasRestrictions && (
                      <Badge className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Abierto
                      </Badge>
                    )}
                  </div>
                </td>
                {ALL_ROLES.map(role => {
                  const isAlwaysAllowed = role === "owner" || role === "admin";
                  const hasAccess = isAlwaysAllowed || !app.hasRestrictions || app.roles.has(role);
                  const isSaving = saving === app.id + role;

                  return (
                    <td key={role} className="text-center px-3 py-3">
                      <button
                        onClick={() => toggleRole(app, role)}
                        disabled={isAlwaysAllowed || isSaving}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                          isAlwaysAllowed
                            ? "bg-muted/30 cursor-not-allowed"
                            : hasAccess
                            ? "bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-destructive/10 border border-destructive/20 hover:bg-destructive/20"
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : isAlwaysAllowed ? (
                          <Check className="w-3.5 h-3.5 text-muted-foreground/50" />
                        ) : hasAccess ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-3">
                  {app.hasRestrictions && (
                    <button
                      onClick={() => resetApp(app.id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
