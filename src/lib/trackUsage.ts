import { supabase } from "@/integrations/supabase/client";

/**
 * Logs a tool usage event for analytics and billing.
 * Fires asynchronously without blocking the UI.
 */
export async function trackToolUsage(
  toolSlug: string,
  action: string = "use",
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Only track authenticated users

    // Get account_id via RPC
    const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });

    await supabase.from("tool_usage_logs" as any).insert({
      user_id: user.id,
      account_id: accountId || null,
      tool_slug: toolSlug,
      action,
      metadata,
    });
  } catch (err) {
    // Silent fail – never block UX for analytics
    console.warn("[trackUsage]", err);
  }
}
