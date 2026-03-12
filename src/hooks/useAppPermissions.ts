import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks which apps the current user can access based on their role.
 * Owners/admins always see everything.
 * If no restrictions are configured for an app, all roles see it.
 */
export function useAppPermissions() {
  const [allowedSlugs, setAllowedSlugs] = useState<Set<string> | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  async function checkPermissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get user's role
      const { data: member } = await supabase
        .from("account_members")
        .select("account_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }
      setUserRole(member.role);

      // Owners and admins see everything
      if (member.role === "owner" || member.role === "admin") {
        setAllowedSlugs(null); // null = no restrictions
        setLoading(false);
        return;
      }

      // Get all restrictions for this account
      const { data: restrictions } = await supabase
        .from("app_role_access" as any)
        .select("app_id, role")
        .eq("account_id", member.account_id);

      if (!restrictions || restrictions.length === 0) {
        // No restrictions configured = everything allowed
        setAllowedSlugs(null);
        setLoading(false);
        return;
      }

      // Get all apps to map id→slug
      const { data: apps } = await supabase
        .from("hub_apps")
        .select("id, slug")
        .eq("is_active", true);

      if (!apps) { setAllowedSlugs(null); setLoading(false); return; }

      const appMap = new Map(apps.map(a => [a.id, a.slug]));
      
      // Find which apps have restrictions
      const restrictedAppIds = new Set((restrictions as any[]).map((r: any) => r.app_id));
      
      // Find which apps this role is allowed for
      const allowedAppIds = new Set(
        (restrictions as any[])
          .filter((r: any) => r.role === member.role)
          .map((r: any) => r.app_id)
      );

      // Build allowed slugs: unrestricted apps + explicitly allowed apps
      const allowed = new Set<string>();
      for (const app of apps) {
        if (!restrictedAppIds.has(app.id) || allowedAppIds.has(app.id)) {
          allowed.add(app.slug);
        }
      }

      setAllowedSlugs(allowed);
    } catch (err) {
      console.warn("[permissions]", err);
      setAllowedSlugs(null); // fail-open
    } finally {
      setLoading(false);
    }
  }

  function canAccess(slug: string): boolean {
    if (allowedSlugs === null) return true; // no restrictions
    return allowedSlugs.has(slug);
  }

  return { canAccess, userRole, loading };
}
