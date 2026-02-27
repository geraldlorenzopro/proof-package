import { supabase } from "@/integrations/supabase/client";

interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  plan?: string;
  reason: string;
}

/**
 * Checks if the current user can use a tool based on their plan limits.
 * Returns the result with usage info.
 */
export async function checkRateLimit(toolSlug: string): Promise<RateLimitResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, used: 0, limit: 0, reason: 'not_authenticated' };

    const { data, error } = await supabase.rpc('check_rate_limit', {
      _user_id: user.id,
      _tool_slug: toolSlug,
    });

    if (error || !data) {
      console.warn('[rateLimiter] RPC error, allowing by default:', error);
      return { allowed: true, used: 0, limit: 999, reason: 'fallback' };
    }

    const result = data as unknown as RateLimitResult;
    return result;
  } catch (err) {
    console.warn('[rateLimiter] Error, allowing by default:', err);
    return { allowed: true, used: 0, limit: 999, reason: 'fallback' };
  }
}

/**
 * Human-readable message for rate limit exceeded.
 */
export function rateLimitMessage(result: RateLimitResult): string {
  if (result.reason === 'account_inactive') {
    return 'Tu cuenta está inactiva. Contacta al administrador.';
  }
  if (result.reason === 'no_account') {
    return 'No tienes una cuenta asociada. Contacta al administrador.';
  }
  return `Has alcanzado el límite mensual de tu plan ${result.plan || ''} (${result.used}/${result.limit}). Actualiza tu plan para continuar.`;
}
