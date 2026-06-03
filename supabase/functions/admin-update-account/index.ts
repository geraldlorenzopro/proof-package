import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: adminUser }, error: userErr } = await userClient.auth.getUser();
    if (userErr) throw userErr;
    const adminUserId = adminUser?.id;

    const { data: isAdmin } = await userClient.rpc("is_platform_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { account_id, plan, is_active, external_crm_id, max_users } = body;

    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Max_users por plan (debe coincidir con provision-account/index.ts)
    const MAX_USERS_BY_PLAN: Record<string, number> = {
      essential: 2,
      professional: 5,
      elite: 10,
      enterprise: 999,
    };

    // Build update payload
    const updates: Record<string, unknown> = {};
    if (plan !== undefined) {
      updates.plan = plan;
      // Auto-ajustar max_users al límite del nuevo plan (a menos que se pase
      // override explícito en max_users). Mr. Lorenzo locked 2026-06-03:
      // cambiar plan debe ajustar el seat limit automáticamente.
      if (max_users === undefined && MAX_USERS_BY_PLAN[plan] !== undefined) {
        updates.max_users = MAX_USERS_BY_PLAN[plan];
      }
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (external_crm_id !== undefined) updates.external_crm_id = external_crm_id;
    if (max_users !== undefined) {
      // Override puntual del platform admin — caso de uso: vender 1 asiento
      // extra a una firma Essential ($217 vs $197) sin subirla a Professional.
      const parsedMax = Number(max_users);
      if (!Number.isInteger(parsedMax) || parsedMax < 1 || parsedMax > 999) {
        return new Response(JSON.stringify({ error: "max_users must be integer 1-999" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      updates.max_users = parsedMax;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error } = await adminClient.from("ner_accounts").update(updates).eq("id", account_id);
    if (error) throw error;

    // Log the change
    await adminClient.from("audit_logs").insert({
      account_id,
      user_id: adminUserId,
      user_display_name: "Platform Admin",
      action: "admin.account_updated",
      entity_type: "account",
      entity_id: account_id,
      entity_label: `Updated: ${Object.keys(updates).join(", ")}`,
      metadata: { changes: updates, admin_user_id: adminUserId },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
