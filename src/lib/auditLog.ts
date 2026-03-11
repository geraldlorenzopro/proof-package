import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "client.created" | "client.updated" | "client.deleted"
  | "case.created" | "case.updated" | "case.status_changed" | "case.deleted"
  | "form.created" | "form.submitted" | "form.updated" | "form.deleted"
  | "evidence.uploaded" | "evidence.deleted"
  | "vawa.created" | "vawa.updated"
  | "tool.used"
  | "auth.login" | "auth.logout";

export type AuditEntityType = "client" | "case" | "form" | "evidence" | "vawa" | "tool" | "auth";

interface AuditEntry {
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string;
  entity_label?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit log entry. Fails silently to never block UX.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
    if (!accountId) return;

    // Try to get display name from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("audit_logs" as any).insert({
      account_id: accountId,
      user_id: user.id,
      user_display_name: profile?.full_name || user.email || "Unknown",
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      entity_label: entry.entity_label || null,
      metadata: entry.metadata || {},
    });
  } catch (err) {
    console.warn("[audit]", err);
  }
}
