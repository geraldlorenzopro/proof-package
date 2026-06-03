/**
 * invite-team-member — Invita un miembro al equipo de una firma.
 *
 * Patrón Docketwise/Clio: owner/admin invita por email + nombre + rol.
 * Sistema crea auth user (si no existe) + manda magic-link de
 * confirmación + crea row en account_members linkeando al account.
 *
 * Llamado desde OfficeSettingsPage.tsx → inviteMember().
 *
 * Auth required: owner o admin del account.
 *
 * Body:
 *   { email: string, full_name: string, role: "admin"|"member"|"attorney"|"paralegal"|"assistant"|"readonly" }
 *
 * Response:
 *   200 { success: true, user_id, member_id, existed: bool, link?: string }
 *   400 invalid input
 *   401 unauthorized
 *   403 no admin/owner role
 *   409 already member of this account
 *   500 server error
 *
 * Locked 2026-06-03 para que las 5 firmas piloto puedan invitar a su
 * equipo desde día 1. Versión simple: usa supabase.auth.admin.inviteUserByEmail
 * que dispara email automáticamente via Supabase SMTP — no requiere Resend
 * setup separado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const VALID_ROLES = ["admin", "member", "attorney", "paralegal", "assistant", "readonly"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ───── Auth: caller debe ser owner/admin de un account ─────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized", reason: "missing_bearer" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabaseAdmin.auth.getClaims(token);
    const callerId = claims?.claims?.sub;
    if (!callerId) {
      return jsonResponse({ error: "unauthorized", reason: "invalid_token" }, 401);
    }

    // ───── Body ─────
    let body: { email?: string; full_name?: string; role?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const email = (body.email || "").trim().toLowerCase();
    const full_name = (body.full_name || "").trim();
    const role = (body.role || "member").trim();

    if (!email || !email.includes("@") || email.length < 5 || email.length > 256) {
      return jsonResponse({ error: "invalid_email" }, 400);
    }
    if (!full_name || full_name.length < 2 || full_name.length > 128) {
      return jsonResponse({ error: "invalid_full_name" }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: "invalid_role", allowed: VALID_ROLES }, 400);
    }

    // ───── Resolver account_id del caller (debe ser owner/admin) ─────
    const { data: callerMembership, error: membErr } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", callerId)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (membErr || !callerMembership) {
      return jsonResponse({ error: "forbidden", reason: "not_owner_or_admin" }, 403);
    }

    const account_id = callerMembership.account_id;

    // ───── Buscar si el email ya tiene auth.users ─────
    const { data: existingUsersData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsersData?.users?.find((u: any) => u.email?.toLowerCase() === email);

    let user_id: string;
    let existed = false;
    let invite_link: string | null = null;

    if (existing) {
      user_id = existing.id;
      existed = true;
    } else {
      // Invitar — Supabase manda email automáticamente via su SMTP
      // (configurable en Dashboard → Auth → SMTP Settings).
      // redirectTo: ner.recursosmigratorios.com/auth para que el invitee
      // aterrice en login y complete el registro.
      const appUrl = (Deno.env.get("APP_URL") || "https://ner.recursosmigratorios.com").replace(/\/$/, "");
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: { full_name },
          redirectTo: `${appUrl}/auth?invited=1`,
        }
      );

      if (inviteErr || !inviteData?.user) {
        console.error("[invite-team-member] inviteUserByEmail error:", inviteErr);
        return jsonResponse(
          { error: "auth_invite_failed", detail: inviteErr?.message },
          500
        );
      }

      user_id = inviteData.user.id;
      invite_link = (inviteData as any).action_link || null;

      // Profile (idempotente — si existe por dispatcher, no rompe)
      await supabaseAdmin
        .from("profiles")
        .upsert({ user_id, full_name }, { onConflict: "user_id" });
    }

    // ───── Verificar que NO sea ya miembro del MISMO account ─────
    const { data: existingMember } = await supabaseAdmin
      .from("account_members")
      .select("id, role")
      .eq("account_id", account_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existingMember) {
      return jsonResponse(
        {
          error: "already_member",
          existing_role: existingMember.role,
          user_id,
        },
        409
      );
    }

    // ───── Crear row en account_members ─────
    const { data: newMember, error: insertErr } = await supabaseAdmin
      .from("account_members")
      .insert({
        account_id,
        user_id,
        role,
      })
      .select("id, role")
      .single();

    if (insertErr) {
      console.error("[invite-team-member] member insert error:", insertErr);
      return jsonResponse(
        { error: "member_insert_failed", detail: insertErr.message },
        500
      );
    }

    return jsonResponse({
      success: true,
      user_id,
      member_id: newMember.id,
      existed,
      role,
      account_id,
      invite_link, // Útil para mostrar al admin si el SMTP de Supabase no entrega
      message: existed
        ? `${full_name} ya tenía cuenta. Agregado al equipo.`
        : `Invitación enviada a ${email}. Recibirá un email para completar el registro.`,
    });
  } catch (err: any) {
    console.error("[invite-team-member] error:", err);
    return jsonResponse(
      { error: "internal_server_error", detail: err?.message },
      500
    );
  }
});
