import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logger } from "./logger";

export type AuditAction =
  | "client.created" | "client.updated" | "client.deleted" | "client.bulk_deleted"
  | "case.created" | "case.updated" | "case.status_changed" | "case.deleted"
  | "form.created" | "form.submitted" | "form.updated" | "form.deleted"
  | "evidence.uploaded" | "evidence.deleted"
  | "vawa.created" | "vawa.updated"
  | "tool.used"
  | "auth.login" | "auth.logout"
  | "task.created" | "task.completed" | "task.deleted"
  | "note.created" | "note.deleted"
  | "document.uploaded" | "document.deleted"
  | "tag.added" | "tag.removed"
  | "member.removed" | "settings.updated"
  | "viewed_contacts_list" | "viewed_client_profile" | "viewed_client_case"
  | "viewed_consultation_room" | "exported" | "downloaded" | "modified";

export type AuditEntityType = "client" | "case" | "form" | "evidence" | "vawa" | "tool" | "auth"
  | "contacts_list" | "client_profile" | "client_case" | "consultation_room"
  | "task" | "note" | "document" | "tag" | "settings";

interface AuditEntry {
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string;
  entity_label?: string;
  metadata?: Record<string, unknown>;
}

// Cache user context to avoid repeated queries within the same session
let _cachedUserId: string | null = null;
let _cachedAccountId: string | null = null;
let _cachedDisplayName: string | null = null;

async function resolveUserContext(): Promise<{
  userId: string;
  accountId: string;
  displayName: string;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // If cached and same user, reuse
  if (_cachedUserId === user.id && _cachedAccountId && _cachedDisplayName) {
    return { userId: user.id, accountId: _cachedAccountId, displayName: _cachedDisplayName };
  }

  const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
  if (!accountId) return null;

  // Get display name from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name || user.email || "Unknown";

  // Cache for future calls
  _cachedUserId = user.id;
  _cachedAccountId = accountId;
  _cachedDisplayName = displayName;

  return { userId: user.id, accountId, displayName };
}

/**
 * Record an audit log entry. Fails silently to never block UX.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const ctx = await resolveUserContext();
    if (!ctx) return;

    const payload = {
      account_id: ctx.accountId,
      user_id: ctx.userId,
      user_display_name: ctx.displayName,
      action: entry.action as string,
      entity_type: entry.entity_type as string,
      entity_id: entry.entity_id || null,
      entity_label: entry.entity_label || null,
      metadata: (entry.metadata || {}) as Json,
    };

    const { error } = await supabase.from("audit_logs").insert(payload);

    if (error) {
      logger.warn("[auditLog] insert failed", error.message);
    }
  } catch (err) {
    logger.warn("[auditLog] exception", err);
  }
}

/**
 * Convenience function for logging page/data access events.
 */
export async function logAccess({
  accountId,
  userId,
  userName,
  action,
  entityType,
  entityId,
  metadata = {},
}: {
  accountId: string;
  userId: string;
  userName?: string;
  action: "viewed" | "exported" | "downloaded" | "modified";
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // If userName not provided, try to resolve it
    let displayName = userName;
    if (!displayName || displayName === "Usuario") {
      const ctx = await resolveUserContext();
      displayName = ctx?.displayName || userName || "Usuario";
    }

    const { error } = await supabase.from("audit_logs").insert({
      account_id: accountId,
      user_id: userId,
      user_display_name: displayName,
      action: `${action}_${entityType}`,
      entity_type: entityType,
      entity_id: entityId || accountId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
      },
    });

    if (error) {
      logger.warn("[auditLog] logAccess insert failed", error.message);
    }
  } catch {
    // Silent — never block UX
  }
}

/**
 * Clear cached user context (call on logout).
 */
export function clearAuditCache(): void {
  _cachedUserId = null;
  _cachedAccountId = null;
  _cachedDisplayName = null;
}
