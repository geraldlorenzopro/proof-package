/**
 * seed-team-members — Crea 5 miembros del equipo en una cuenta existente
 * para probar features SaaS multi-tenant (visibility tier + assignment).
 *
 * Uso (Lovable invoca):
 *   POST { account_id: "uuid-de-la-firma" }
 *
 * Crea 5 auth.users + profiles + account_members con roles:
 *   - 1 attorney  (ve team + attorney_only)
 *   - 1 admin     (ve TODO)
 *   - 2 paralegal (ven solo team)
 *   - 1 assistant (ven solo team, limitado)
 *
 * Nombres realistas firma hispana Miami. Emails sufijo @team.demo.test
 * para cleanup fácil:
 *   DELETE FROM auth.users WHERE email LIKE '%@team.demo.test';
 *
 * Devuelve array con user_ids generados para que SQL seed asigne tareas
 * a estos team members.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TEAM_MEMBERS = [
  { first: "Pablo",    last: "Méndez",     role: "attorney",  email: "pablo.mendez@team.demo.test" },
  { first: "Vanessa",  last: "Rivera",     role: "paralegal", email: "vanessa.rivera@team.demo.test" },
  { first: "Daniela",  last: "Pérez",      role: "paralegal", email: "daniela.perez@team.demo.test" },
  { first: "Carmen",   last: "Báez",       role: "admin",     email: "carmen.baez@team.demo.test" },
  { first: "Sofía",    last: "Restrepo",   role: "assistant", email: "sofia.restrepo@team.demo.test" },
];

function generateTempPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authorize: admin/owner del account o webhook secret
    const authHeader = req.headers.get("Authorization");
    let isAuthorized = false;
    let callerId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const { data: claims } = await supabaseAdmin.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (claims?.claims?.sub) {
        callerId = claims.claims.sub;
        const { data: member } = await supabaseAdmin
          .from("account_members")
          .select("role")
          .eq("user_id", callerId)
          .in("role", ["owner", "admin"])
          .maybeSingle();
        if (member) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const account_id = body.account_id;

    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirmar que el account existe + el caller pertenece
    const { data: callerAccount } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", callerId)
      .eq("account_id", account_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!callerAccount) {
      return new Response(JSON.stringify({ error: "No autorizado para este account" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const created: Array<{ user_id: string; email: string; role: string; full_name: string; existed: boolean }> = [];

    for (const m of TEAM_MEMBERS) {
      const full_name = `${m.first} ${m.last}`;

      // Dedup: si ya existe el email, reuse
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === m.email);

      let user_id: string;
      let existed = false;

      if (existing) {
        user_id = existing.id;
        existed = true;
      } else {
        const tempPassword = generateTempPassword();
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: m.email,
          password: tempPassword,
          email_confirm: true,
        });
        if (authError) {
          console.error(`[seed-team] createUser fail ${m.email}:`, authError.message);
          continue;
        }
        user_id = authUser.user.id;

        // Profile
        await supabaseAdmin.from("profiles").insert({
          user_id,
          full_name,
        });
      }

      // Member (skip si ya está)
      const { data: existingMember } = await supabaseAdmin
        .from("account_members")
        .select("id")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (!existingMember) {
        await supabaseAdmin.from("account_members").insert({
          account_id,
          user_id,
          role: m.role,
        });
      }

      created.push({ user_id, email: m.email, role: m.role, full_name, existed });
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_id,
        team: created,
        sql_helper: `-- Para usar estos UUIDs en seed SQL:
-- SELECT user_id, role FROM account_members
-- WHERE account_id = '${account_id}' AND user_id IN (
${created.map(c => `--   '${c.user_id}', -- ${c.full_name} (${c.role})`).join("\n")}
-- )`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[seed-team-members] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
