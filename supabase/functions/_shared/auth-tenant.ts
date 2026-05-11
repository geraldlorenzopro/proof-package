/**
 * auth-tenant.ts — verificación de tenancy multi-tenant.
 *
 * SECURITY CRITICAL — usar SIEMPRE después de auth.getUser() en cualquier
 * edge function que reciba account_id desde el body del request.
 *
 * El bug que cierra: paralegal de firma A pasa account_id de firma B,
 * la function consume créditos de B y lee sus datos. Sin este check,
 * cualquier authenticated user puede acceder a cualquier account_id.
 *
 * Decisión 2026-05-10 (security audit) — patrón canónico:
 *
 *   const { data: { user } } = await supabaseUser.auth.getUser();
 *   if (!user) return new Response(..., { status: 401 });
 *
 *   const { account_id } = await req.json();
 *   if (!account_id) return new Response(..., { status: 400 });
 *
 *   const isMember = await verifyAccountMembership(supabaseAdmin, user.id, account_id);
 *   if (!isMember) {
 *     return new Response(
 *       JSON.stringify({ error: "forbidden", reason: "not_member_of_account" }),
 *       { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
 *     );
 *   }
 *
 * Excepciones (NO usar este helper):
 * - Edge functions admin-* que validan is_platform_admin() (otro check, no este)
 * - Webhooks GHL (no tienen user, validan HMAC en su lugar)
 * - resolve-hub / hub-redirect (parte del flujo de auth inicial)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type SupabaseAdmin = ReturnType<typeof createClient>;

/**
 * Verifica que el user pertenece al account.
 *
 * @returns true si es miembro (incluye owner/admin/attorney/paralegal/etc),
 *          false si no es miembro o si hubo error de query
 */
export async function verifyAccountMembership(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  accountId: string,
): Promise<boolean> {
  if (!userId || !accountId) return false;

  const { data: member, error } = await supabaseAdmin
    .from("account_members")
    .select("role")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.warn("[verifyAccountMembership] query error:", error.message);
    return false;
  }

  return !!member;
}

/**
 * Verifica membership y devuelve el rol del usuario en la account.
 * Útil cuando además del membership necesitas saber qué rol tiene
 * (ej: para gates de tier owner/admin).
 *
 * @returns el rol string si es miembro (owner/admin/attorney/paralegal/etc),
 *          null si no es miembro
 */
export async function getAccountMemberRole(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  accountId: string,
): Promise<string | null> {
  if (!userId || !accountId) return null;

  const { data: member } = await supabaseAdmin
    .from("account_members")
    .select("role")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();

  return (member?.role as string) ?? null;
}
