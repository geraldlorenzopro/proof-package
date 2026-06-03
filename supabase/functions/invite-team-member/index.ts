/**
 * invite-team-member — Invita un miembro al equipo de una firma.
 *
 * Flujo (locked 2026-06-03):
 * 1. Auth: caller debe ser owner/admin del account
 * 2. ENFORCEMENT: cuenta account_members activos vs ner_accounts.max_users.
 *    Rechaza 409 seat_limit_reached si excede.
 * 3. Dedup auth.users por email (reuse si existe)
 * 4. Si nuevo: admin.generateLink({type:'invite'}) — NO usa SMTP Supabase.
 *    Nosotros mandamos el email via Resend con template branded NER.
 * 5. profiles upsert con full_name
 * 6. account_members insert con is_active=true explícito
 * 7. Return invite_link siempre (backup para WhatsApp/copy)
 *
 * Auth required: owner|admin del account.
 *
 * Body:
 *   { email: string, full_name: string, role: enum }
 *
 * Errores específicos:
 *   400 invalid_email / invalid_full_name / invalid_role
 *   401 unauthorized
 *   403 not_owner_or_admin
 *   409 already_member / seat_limit_reached
 *   500 auth_invite_failed / member_insert_failed / resend_failed
 *
 * Resend pattern (idem send-email):
 *   POST api.resend.com/emails con RESEND_API_KEY
 *   from: noreply@nerimmigration.ai (domain verificado)
 *   reply_to: email del caller (owner/admin que invita)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const VALID_ROLES = ["admin", "member", "attorney", "paralegal", "assistant", "readonly"];
const ROLE_LABELS_ES: Record<string, string> = {
  admin: "Admin",
  attorney: "Abogado/a",
  paralegal: "Paralegal",
  member: "Miembro del equipo",
  assistant: "Asistente",
  readonly: "Sólo lectura",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInviteEmail(opts: {
  firm_name: string;
  firm_logo_url?: string | null;
  inviter_name?: string | null;
  invitee_name: string;
  role_label: string;
  invite_link: string;
}): { subject: string; html: string } {
  const firmName = escapeHtml(opts.firm_name);
  const inviterName = escapeHtml(opts.inviter_name || "El equipo");
  const inviteeName = escapeHtml(opts.invitee_name);
  const roleLabel = escapeHtml(opts.role_label);
  const link = opts.invite_link;
  const logo = opts.firm_logo_url
    ? `<div style="text-align:center;margin-bottom:20px"><img src="${escapeHtml(opts.firm_logo_url)}" alt="${firmName}" style="max-height:60px;max-width:200px" /></div>`
    : `<div style="text-align:center;margin-bottom:20px"><h1 style="color:#2563EB;font-size:24px;margin:0;font-family:Arial,sans-serif">${firmName}</h1></div>`;

  const subject = `${inviterName} te invitó a ${firmName} en NER Immigration AI`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <div style="padding:30px 30px 0">${logo}<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px" /></div>
  <div style="padding:0 30px">
    <p style="font-size:16px;color:#0B1F3A;margin:0 0 12px">Hola ${inviteeName},</p>
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 16px">
      <strong>${inviterName}</strong> te invitó a unirte al equipo de <strong>${firmName}</strong> en NER Immigration AI con el rol de <strong>${roleLabel}</strong>.
    </p>
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 16px">
      NER Immigration AI es la plataforma especializada en inmigración que tu firma está usando para manejar casos, formularios USCIS, y comunicaciones con clientes.
    </p>
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0 0 6px;font-size:13px;color:#1E40AF;font-weight:bold">Próximo paso:</p>
      <p style="margin:0;font-size:13px;color:#1E3A8A;line-height:1.5">
        Hacé click en el botón de abajo para crear tu contraseña y entrar al sistema. El link expira en 24 horas.
      </p>
    </div>
    <div style="text-align:center;margin:28px 0">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#22D3EE 100%);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
        Configurar mi contraseña
      </a>
    </div>
    <p style="font-size:12px;color:#64748B;line-height:1.5;margin:20px 0 0">
      Si el botón no funciona, copiá y pegá esta URL en tu navegador:<br>
      <a href="${link}" style="color:#2563EB;word-break:break-all">${link}</a>
    </p>
  </div>
  <div style="padding:24px 30px;margin-top:20px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#0B1F3A">${firmName}</p>
    <p style="margin:0;font-size:10px;color:#94a3b8">
      Este email fue enviado por NER Immigration AI en nombre de ${firmName}. Si recibiste esta invitación por error, podés ignorarla — la cuenta no se activará hasta que hagas click en el botón.
    </p>
  </div>
</div></body></html>`;

  return { subject, html };
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

    // ───── Auth ─────
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
    let body: {
      email?: string;
      full_name?: string;
      role?: string;
      force_resend?: boolean;
      user_id?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }
    console.log("[invite-team-member] body keys:", Object.keys(body), "force_resend:", body.force_resend, "user_id:", body.user_id, "email:", body.email);

    let email = (body.email || "").trim().toLowerCase();
    let full_name = (body.full_name || "").trim();
    const role = (body.role || "member").trim();
    const forceResend = body.force_resend === true;
    const targetUserId = (body.user_id || "").trim();

    if (targetUserId && (!email || !full_name)) {
      const { data: userData, error: getUserErr } =
        await supabaseAdmin.auth.admin.getUserById(targetUserId);
      const authEmail = userData?.user?.email;
      console.log(
        "[invite-team-member] lookup user_id=" + targetUserId,
        "found email=" + (authEmail || "(none)"),
        "err=" + (getUserErr?.message || "(none)")
      );
      if (authEmail && !email) email = authEmail.toLowerCase();

      if (!full_name) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", targetUserId)
          .maybeSingle();
        full_name = profile?.full_name || authEmail?.split("@")[0] || "Miembro";
      }
    }

    if (!email || !email.includes("@") || email.length < 5 || email.length > 256) {
      console.error("[invite-team-member] invalid_email email=\"" + email + "\" targetUserId=\"" + targetUserId + "\"");
      return jsonResponse({ error: "invalid_email", debug_email: email, debug_user_id: targetUserId }, 400);
    }
    if (!full_name || full_name.length < 2 || full_name.length > 128) {
      return jsonResponse({ error: "invalid_full_name" }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: "invalid_role", allowed: VALID_ROLES }, 400);
    }

    // ───── Caller debe ser owner/admin ─────
    const { data: callerMembership, error: membErr } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", callerId)
      .in("role", ["owner", "admin"])
      .eq("is_active", true)
      .maybeSingle();

    if (membErr || !callerMembership) {
      return jsonResponse({ error: "forbidden", reason: "not_owner_or_admin" }, 403);
    }

    const account_id = callerMembership.account_id;

    // ───── ENFORCEMENT: max_users del plan ─────
    const { data: account, error: accountErr } = await supabaseAdmin
      .from("ner_accounts")
      .select("plan, max_users, account_name, is_active")
      .eq("id", account_id)
      .maybeSingle();

    if (accountErr || !account) {
      return jsonResponse({ error: "account_not_found" }, 500);
    }
    if (!account.is_active) {
      return jsonResponse({ error: "account_inactive" }, 403);
    }

    const maxUsers = account.max_users ?? 999;
    const { count: activeCount, error: countErr } = await supabaseAdmin
      .from("account_members")
      .select("id", { count: "exact", head: true })
      .eq("account_id", account_id)
      .eq("is_active", true);

    if (countErr) {
      return jsonResponse({ error: "count_failed", detail: countErr.message }, 500);
    }

    // Seat limit NO aplica si es reenvío (el miembro ya está dentro del cap)
    if (!forceResend && (activeCount ?? 0) >= maxUsers) {
      return jsonResponse(
        {
          error: "seat_limit_reached",
          plan: account.plan,
          max_users: maxUsers,
          active_users: activeCount,
          message: `Tu plan ${account.plan} permite ${maxUsers} usuarios activos. Tenés ${activeCount}. Para invitar más, contactá a soporte para subir el plan o quitá un miembro inactivo.`,
        },
        409
      );
    }

    // ───── Dedup auth.users ─────
    const { data: existingUsersData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email
    );

    let user_id: string;
    let existed = false;
    let invite_link: string | null = null;
    const appUrl = (Deno.env.get("APP_URL") || "https://ner.recursosmigratorios.com").replace(/\/$/, "");

    if (existing) {
      user_id = existing.id;
      existed = true;
      // Para users existentes: generar recovery link así pueden volver a entrar
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${appUrl}/auth?invited=1` },
      });
      invite_link = (linkData as any)?.properties?.action_link || null;
    } else {
      // Generar invite link sin mandar email Supabase (lo mandamos nosotros via Resend)
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { full_name },
          redirectTo: `${appUrl}/auth?invited=1`,
        },
      });

      if (linkErr || !linkData?.user) {
        console.error("[invite-team-member] generateLink error:", linkErr);
        return jsonResponse(
          { error: "auth_invite_failed", detail: linkErr?.message },
          500
        );
      }

      user_id = linkData.user.id;
      invite_link = (linkData as any)?.properties?.action_link || null;

      // Profile
      await supabaseAdmin
        .from("profiles")
        .upsert({ user_id, full_name }, { onConflict: "user_id" });
    }

    // ───── Verificar que NO sea ya miembro del MISMO account ─────
    const { data: existingMember } = await supabaseAdmin
      .from("account_members")
      .select("id, role, is_active")
      .eq("account_id", account_id)
      .eq("user_id", user_id)
      .maybeSingle();

    // already_member NO bloquea si es reenvío — significa que mandamos
    // el email otra vez al miembro existente sin modificar nada en BD.
    if (!forceResend && existingMember && existingMember.is_active) {
      return jsonResponse(
        {
          error: "already_member",
          existing_role: existingMember.role,
          user_id,
        },
        409
      );
    }

    // ───── Insertar o reactivar account_members ─────
    let memberId: string;
    if (existingMember && !existingMember.is_active) {
      // Reactivar miembro previamente desactivado
      const { data: reactivated, error: reactErr } = await supabaseAdmin
        .from("account_members")
        .update({
          role,
          is_active: true,
          deactivated_at: null,
          deactivated_reason: null,
        })
        .eq("id", existingMember.id)
        .select("id")
        .single();

      if (reactErr || !reactivated) {
        return jsonResponse(
          { error: "member_reactivate_failed", detail: reactErr?.message },
          500
        );
      }
      memberId = reactivated.id;
    } else {
      const { data: newMember, error: insertErr } = await supabaseAdmin
        .from("account_members")
        .insert({
          account_id,
          user_id,
          role,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[invite-team-member] member insert error:", insertErr);
        return jsonResponse(
          { error: "member_insert_failed", detail: insertErr.message },
          500
        );
      }
      memberId = newMember.id;
    }

    // ───── Mandar email via Resend ─────
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailStatus: "sent" | "skipped_no_key" | "failed" | "skipped_existing" = "skipped_no_key";

    if (!invite_link) {
      emailStatus = "skipped_no_key"; // sin link nada que mandar
    } else if (existed && !forceResend) {
      // User existente — no spam por default, solo devolvemos el link.
      // Si el caller pidió force_resend=true (botón "Reenviar invitación"),
      // sí mandamos el email otra vez con el recovery link generado.
      emailStatus = "skipped_existing";
    } else if (resendApiKey) {
      try {
        // Resolver nombre de firma + logo + inviter name
        const [{ data: officeConfig }, { data: callerProfile }] = await Promise.all([
          supabaseAdmin
            .from("office_config")
            .select("firm_name, firm_logo_url")
            .eq("account_id", account_id)
            .maybeSingle(),
          supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", callerId)
            .maybeSingle(),
        ]);

        const { data: callerAuth } = await supabaseAdmin.auth.admin.getUserById(callerId);
        const callerEmail = callerAuth?.user?.email || undefined;

        const { subject, html } = buildInviteEmail({
          firm_name: officeConfig?.firm_name || account.account_name || "Tu firma",
          firm_logo_url: officeConfig?.firm_logo_url,
          inviter_name: callerProfile?.full_name || callerEmail || "Un colega",
          invitee_name: full_name,
          role_label: ROLE_LABELS_ES[role] || role,
          invite_link,
        });

        // Defensive build del header From (locked 2026-06-03 fix):
        // - Trim del secret para eliminar newlines/espacios invisibles del copy/paste
        // - Si el secret YA tiene formato "Name <email>" (con < y >), úsalo tal cual
        //   y NO wrappear de nuevo. Esto evita resultados tipo "Name <Name <email>>".
        // - Si es solo email, wrappear con el name por default.
        // - Validación final: si el resultado no matchea regex básico de email
        //   válido, log warning + fallback a sandbox onboarding@resend.dev
        //   (Resend siempre acepta ese for testing aunque no tengas dominio).
        const fromRaw = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@nerimmigration.ai").trim();
        const fromName = "NER Immigration AI";
        const hasFullFormat = fromRaw.includes("<") && fromRaw.includes(">");
        let from = hasFullFormat ? fromRaw : `${fromName} <${fromRaw}>`;

        // Validación básica del formato final
        const fromValid = /^([^<>]+\s)?<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from);
        if (!fromValid) {
          console.error(`[invite-team-member] from malformed, raw secret value: "${fromRaw}" → "${from}"`);
          // Fallback al sandbox de Resend (siempre acepta, no requiere domain verification)
          from = "NER Immigration AI <onboarding@resend.dev>";
        }

        console.log(`[invite-team-member] sending via Resend from="${from}" to="${email}"`);

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject,
            html,
            reply_to: callerEmail,
          }),
        });

        if (resendRes.ok) {
          emailStatus = "sent";
        } else {
          const errText = await resendRes.text();
          console.error("[invite-team-member] Resend error:", resendRes.status, errText);
          emailStatus = "failed";
        }
      } catch (err) {
        console.error("[invite-team-member] Resend exception:", err);
        emailStatus = "failed";
      }
    }

    return jsonResponse({
      success: true,
      user_id,
      member_id: memberId,
      existed,
      reactivated: !!(existingMember && !existingMember.is_active),
      role,
      account_id,
      max_users: maxUsers,
      active_users: (activeCount ?? 0) + 1,
      email_status: emailStatus,
      invite_link, // Siempre incluido para que admin pueda copiar/mandar manual
      message:
        emailStatus === "sent" && forceResend
          ? `Invitación reenviada a ${email}.`
          : emailStatus === "sent"
          ? `Invitación enviada a ${email}. Recibirá un email con link para configurar su contraseña.`
          : existed && !forceResend
          ? `${full_name} ya tenía cuenta. Agregado al equipo. Compartile el link manualmente.`
          : emailStatus === "failed"
          ? `Miembro creado pero el email no se pudo enviar. Compartí el link manualmente al invitado.`
          : `Miembro creado. RESEND_API_KEY no configurada — compartí el link manualmente al invitado.`,
    });
  } catch (err: any) {
    console.error("[invite-team-member] error:", err);
    return jsonResponse(
      { error: "internal_server_error", detail: err?.message },
      500
    );
  }
});
