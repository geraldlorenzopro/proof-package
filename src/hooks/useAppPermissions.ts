import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks which apps the current user can access based on their role.
 * Owners/admins always see everything.
 * If no restrictions are configured for an app, all roles see it.
 */
export function useAppPermissions(accountId?: string | null) {
  const [allowedSlugs, setAllowedSlugs] = useState<Set<string> | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, [accountId]);

  async function checkPermissions() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserRole(null);
        setAllowedSlugs(null);
        return;
      }

      const membershipQuery = supabase
        .from("account_members")
        .select("account_id, role")
        .eq("user_id", user.id);

      const { data: member } = await (accountId
        ? membershipQuery.eq("account_id", accountId).maybeSingle()
        : membershipQuery.limit(1).maybeSingle());

      if (!member) {
        setUserRole(null);
        setAllowedSlugs(null);
        return;
      }

      setUserRole(member.role);

      if (member.role === "owner" || member.role === "admin") {
        setAllowedSlugs(null);
        return;
      }

      const { data: restrictions } = await supabase
        .from("app_role_access" as any)
        .select("app_id, role")
        .eq("account_id", member.account_id);

      if (!restrictions || restrictions.length === 0) {
        setAllowedSlugs(null);
        return;
      }

      const { data: apps } = await supabase
        .from("hub_apps")
        .select("id, slug")
        .eq("is_active", true);

      if (!apps) {
        setAllowedSlugs(null);
        return;
      }

      const restrictedAppIds = new Set((restrictions as any[]).map((r: any) => r.app_id));
      const allowedAppIds = new Set(
        (restrictions as any[])
          .filter((r: any) => r.role === member.role)
          .map((r: any) => r.app_id)
      );

      const allowed = new Set<string>();
      for (const app of apps) {
        if (!restrictedAppIds.has(app.id) || allowedAppIds.has(app.id)) {
          allowed.add(app.slug);
        }
      }

      setAllowedSlugs(allowed);
    } catch (err) {
      console.warn("[permissions]", err);
      setAllowedSlugs(null);
    } finally {
      setLoading(false);
    }
  }

  function canAccess(slug: string): boolean {
    if (allowedSlugs === null) return true;
    return allowedSlugs.has(slug);
  }

  return { canAccess, userRole, loading };
}
