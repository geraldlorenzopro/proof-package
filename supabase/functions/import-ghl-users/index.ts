import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getGHLConfig } from "../_shared/ghl.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado", imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, locationId } = ghlConfig;

    // Fetch users from GHL
    const url = `${GHL_BASE}/users/?locationId=${locationId}`;
    console.log("Fetching GHL users:", url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
      },
    });

    const rawText = await res.text();
    console.log("GHL users response status:", res.status);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `GHL API error ${res.status}`, detail: rawText.substring(0, 500), imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: any;
    try { data = JSON.parse(rawText); } catch { 
      return new Response(
        JSON.stringify({ error: "Invalid JSON from GHL", imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const users = data.users || [];
    console.log(`Found ${users.length} GHL users`);

    if (users.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, users: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert each user into ghl_user_mappings
    const rows = users.map((u: any) => ({
      account_id,
      ghl_user_id: u.id,
      ghl_user_name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || null,
      ghl_user_email: u.email || null,
      ghl_user_role: u.role || u.type || null,
      ghl_user_phone: u.phone || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await admin
      .from("ghl_user_mappings")
      .upsert(rows, { onConflict: "account_id,ghl_user_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: upsertError.message, imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-map by email: match ghl_user_email to profiles.email → account_members.user_id
    const { data: mappings } = await admin
      .from("ghl_user_mappings")
      .select("id, ghl_user_email")
      .eq("account_id", account_id)
      .is("mapped_user_id", null);

    if (mappings && mappings.length > 0) {
      const { data: members } = await admin
        .from("account_members")
        .select("user_id")
        .eq("account_id", account_id);

      if (members) {
        const memberIds = members.map((m: any) => m.user_id);
        const { data: profiles } = await admin
          .from("profiles")
          .select("user_id, email")
          .in("user_id", memberIds);

        if (profiles) {
          const emailMap = new Map<string, string>();
          for (const p of profiles) {
            if (p.email) emailMap.set(p.email.toLowerCase(), p.user_id);
          }

          for (const m of mappings) {
            if (m.ghl_user_email) {
              const userId = emailMap.get(m.ghl_user_email.toLowerCase());
              if (userId) {
                await admin
                  .from("ghl_user_mappings")
                  .update({ mapped_user_id: userId })
                  .eq("id", m.id);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ imported: rows.length, users: rows.map((r: any) => ({ name: r.ghl_user_name, email: r.ghl_user_email, ghl_id: r.ghl_user_id })) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, imported: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
