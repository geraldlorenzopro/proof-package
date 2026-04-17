// Reconcilia el equipo: GHL es la fuente de verdad.
// - Importa/vincula usuarios desde GHL (delegado a import-ghl-users)
// - Desactiva (soft delete) miembros NER cuyo email ya no existe en GHL
// - Envía magic link por Resend a usuarios recién creados
// - Devuelve resumen para la UI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getGHLConfig } from "../_shared/ghl.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function normEmail(e: string | null | undefined) {
  return e?.trim().toLowerCase() || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { account_id, send_magic_links = true } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica permiso owner/admin del caller
    const { data: caller } = await admin
      .from("account_members")
      .select("role, is_active")
      .eq("account_id", account_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!caller || !caller.is_active || !["owner", "admin"].includes(caller.role)) {
      return new Response(JSON.stringify({ error: "Permiso denegado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghl = await getGHLConfig(account_id);
    if (!ghl) {
      return new Response(JSON.stringify({ error: "GHL no configurado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Listar usuarios actuales de GHL
    const ghlRes = await fetch(`${GHL_BASE}/users/?locationId=${ghl.locationId}`, {
      headers: { Authorization: `Bearer ${ghl.apiKey}`, Version: GHL_VERSION },
    });
    if (!ghlRes.ok) {
      return new Response(JSON.stringify({ error: `GHL ${ghlRes.status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ghlData = await ghlRes.json();
    const ghlUsers: any[] = ghlData.users || [];
    const ghlEmails = new Set(ghlUsers.map(u => normEmail(u.email)).filter(Boolean) as string[]);

    // 2. Snapshot de miembros activos antes del import
    const { data: beforeMembers } = await admin
      .from("account_members")
      .select("id, user_id, role, is_active")
      .eq("account_id", account_id)
      .eq("is_active", true);

    const beforeUserIds = new Set((beforeMembers || []).map(m => m.user_id));

    // 3. Delegar import a la función existente
    const importUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/import-ghl-users`;
    const importRes = await fetch(importUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account_id }),
    });
    const importData = await importRes.json().catch(() => ({}));

    // 4. Identificar nuevos usuarios creados (no estaban antes y ahora están activos)
    const { data: afterMembers } = await admin
      .from("account_members")
      .select("id, user_id, role, is_active")
      .eq("account_id", account_id)
      .eq("is_active", true);

    const newMemberIds = (afterMembers || [])
      .filter(m => !beforeUserIds.has(m.user_id))
      .map(m => m.user_id);

    // 5. Soft-delete: miembros activos cuyo email ya no está en GHL
    //    (Excluye al owner para no perder el acceso por error)
    const memberUserIds = (afterMembers || []).map(m => m.user_id);
    let deactivated: string[] = [];

    if (memberUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", memberUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      for (const m of afterMembers || []) {
        if (m.role === "owner") continue; // Nunca desactivar al owner
        const profile = profileMap.get(m.user_id);
        const email = normEmail(profile?.email);
        if (!email) continue; // Sin email no podemos comparar
        if (!ghlEmails.has(email)) {
          // No está en GHL → desactivar
          const { error: deactErr } = await admin
            .from("account_members")
            .update({
              is_active: false,
              deactivated_at: new Date().toISOString(),
              deactivated_reason: "removed_from_ghl",
            })
            .eq("id", m.id);
          if (!deactErr) {
            deactivated.push(profile?.full_name || email);
            // Audit log
            await admin.from("audit_logs").insert({
              account_id,
              user_id: userData.user.id,
              user_display_name: "Sistema (sync GHL)",
              action: "member.deactivated",
              entity_type: "settings",
              entity_id: m.id,
              entity_label: profile?.full_name || email,
              metadata: { reason: "removed_from_ghl" },
            });
          }
        }
      }
    }

    // 6. Magic links a nuevos usuarios (vía Resend si está configurado)
    let magicLinksSent = 0;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (send_magic_links && newMemberIds.length > 0 && resendKey) {
      const { data: newProfiles } = await admin
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", newMemberIds);

      const { data: account } = await admin
        .from("ner_accounts")
        .select("name")
        .eq("id", account_id)
        .maybeSingle();

      const firmName = account?.name || "tu firma";

      for (const p of newProfiles || []) {
        if (!p.email) continue;
        try {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: "magiclink",
            email: p.email,
          });
          const link = linkData?.properties?.action_link;
          if (!link) continue;

          const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:40px auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">Bienvenido a NER</h2>
  <p>Hola ${p.full_name || ""},</p>
  <p>Has sido agregado al equipo de <strong>${firmName}</strong> en NER. Haz clic abajo para ingresar y crear tu contraseña:</p>
  <p style="margin:24px 0">
    <a href="${link}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Acceder a NER</a>
  </p>
  <p style="font-size:12px;color:#666">Este enlace caduca en 1 hora. Si no esperabas este correo, ignóralo.</p>
</body></html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "NER <onboarding@resend.dev>",
              to: [p.email],
              subject: `Acceso a NER · ${firmName}`,
              html,
            }),
          });
          magicLinksSent += 1;
        } catch (err) {
          console.error("Magic link error for", p.email, err);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ghl_users: ghlUsers.length,
      imported: importData?.imported || 0,
      created_ner_users: importData?.created_ner_users || 0,
      reused: importData?.reused_ner_users || 0,
      deactivated,
      magic_links_sent: magicLinksSent,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-ghl-team error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
