import { supabase } from "@/integrations/supabase/client";
import { checkRateLimit, rateLimitMessage } from "./rateLimiter";

interface TrackResult {
  allowed: boolean;
  message?: string;
  used?: number;
  limit?: number;
}

/**
 * Checks rate limit and logs a tool usage event.
 * Returns whether the action is allowed.
 */
export async function trackToolUsage(
  toolSlug: string,
  action: string = "use",
  metadata: Record<string, unknown> = {}
): Promise<TrackResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: true }; // Allow unauthenticated (CSPA public)

    // Check rate limit before logging
    const limit = await checkRateLimit(toolSlug);
    if (!limit.allowed) {
      return {
        allowed: false,
        message: rateLimitMessage(limit),
        used: limit.used,
        limit: limit.limit,
      };
    }

    // Get account_id via RPC
    const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });

    await supabase.from("tool_usage_logs" as any).insert({
      user_id: user.id,
      account_id: accountId || null,
      tool_slug: toolSlug,
      action,
      metadata,
    });

    return {
      allowed: true,
      used: limit.used + 1,
      limit: limit.limit,
    };
  } catch (err) {
    console.warn("[trackUsage]", err);
    return { allowed: true }; // Fail open – never block UX for analytics
  }
}
