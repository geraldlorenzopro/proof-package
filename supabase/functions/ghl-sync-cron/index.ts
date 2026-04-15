import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all active offices with GHL configured
    const { data: offices } = await supabase
      .from("office_config")
      .select("account_id, ghl_location_id, ghl_api_key")
      .not("ghl_location_id", "is", null);

    // Resolve API keys: use DB column or fall back to env secrets
    const resolvedOffices = (offices || [])
      .map((o) => ({
        ...o,
        ghl_api_key: o.ghl_api_key || Deno.env.get("MRVISA_API_KEY") || null,
      }))
      .filter((o) => o.ghl_api_key !== null);

    if (!resolvedOffices.length) {
      return new Response(
        JSON.stringify({ message: "No offices configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${resolvedOffices.length} offices`);

    const results = await Promise.allSettled(
      resolvedOffices.map((office) => syncOfficeContacts(supabase, office))
    );

    const summary = results.map((r, i) => ({
      account_id: resolvedOffices[i].account_id,
      status: r.status,
      value: r.status === "fulfilled" ? r.value : (r as PromiseRejectedResult).reason?.message,
    }));

    console.log("Sync complete:", JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, offices: summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cron error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncOfficeContacts(
  supabase: ReturnType<typeof createClient>,
  office: { account_id: string; ghl_location_id: string; ghl_api_key: string }
) {
  // Get last sync timestamp
  const { data: syncLog } = await supabase
    .from("ghl_sync_log")
    .select("last_synced_at")
    .eq("account_id", office.account_id)
    .single();

  // If never synced, use 2 minutes ago to avoid importing everything
  const lastSynced = syncLog?.last_synced_at
    ? new Date(syncLog.last_synced_at)
    : new Date(Date.now() - 2 * 60 * 1000);

  const lastSyncedUnix = Math.floor(lastSynced.getTime() / 1000);

  // Call GHL API for contacts created/updated since last sync
  const ghlUrl = new URL("https://services.leadconnectorhq.com/contacts/");
  ghlUrl.searchParams.set("locationId", office.ghl_location_id);
  ghlUrl.searchParams.set("startAfterDate", String(lastSyncedUnix));
  ghlUrl.searchParams.set("limit", "100");

  const ghlResp = await fetch(ghlUrl.toString(), {
    headers: {
      Authorization: `Bearer ${office.ghl_api_key}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!ghlResp.ok) {
    const body = await ghlResp.text().catch(() => "");
    throw new Error(`GHL API error: ${ghlResp.status} ${body.slice(0, 200)}`);
  }

  const ghlData = await ghlResp.json();
  const contacts = ghlData.contacts || [];

  console.log(`Office ${office.account_id}: ${contacts.length} new/updated contacts`);

  let created = 0;
  let updated = 0;

  for (const c of contacts) {
    const ghlId = c.id;
    if (!ghlId) continue;

    const phone = c.phone || c.phoneRaw || null;
    const email = c.email || null;
    const firstName = c.firstName || c.first_name || "Sin nombre";
    const lastName = c.lastName || c.last_name || "";

    // Check if contact already exists by ghl_contact_id
    const { data: existing } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("account_id", office.account_id)
      .eq("ghl_contact_id", ghlId)
      .maybeSingle();

    if (existing) {
      // Update existing
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (firstName && firstName !== "Sin nombre") updateData.first_name = firstName;
      if (lastName) updateData.last_name = lastName;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;

      await supabase
        .from("client_profiles")
        .update(updateData)
        .eq("id", existing.id);
      updated++;
    } else {
      // Also check by phone or email to avoid duplicates
      let duplicateId: string | null = null;

      if (phone) {
        const { data: byPhone } = await supabase
          .from("client_profiles")
          .select("id")
          .eq("account_id", office.account_id)
          .eq("phone", phone)
          .maybeSingle();
        if (byPhone) duplicateId = byPhone.id;
      }

      if (!duplicateId && email) {
        const { data: byEmail } = await supabase
          .from("client_profiles")
          .select("id")
          .eq("account_id", office.account_id)
          .eq("email", email)
          .maybeSingle();
        if (byEmail) duplicateId = byEmail.id;
      }

      if (duplicateId) {
        // Link existing profile to GHL and update
        await supabase
          .from("client_profiles")
          .update({
            ghl_contact_id: ghlId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", duplicateId);
        updated++;
      } else {
        // Create new profile - use service role, so we need a created_by
        // Use a system UUID or the first owner of the account
        const { data: owner } = await supabase
          .from("account_members")
          .select("user_id")
          .eq("account_id", office.account_id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();

        const createdBy = owner?.user_id || office.account_id;

        await supabase.from("client_profiles").insert({
          account_id: office.account_id,
          created_by: createdBy,
          ghl_contact_id: ghlId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          source_channel: normalizeChannel(c.source || ""),
          contact_stage: "lead",
          is_test: false,
        });
        created++;
      }
    }
  }

  // Update sync log
  await supabase.from("ghl_sync_log").upsert(
    {
      account_id: office.account_id,
      last_synced_at: new Date().toISOString(),
      contacts_created: created,
      contacts_updated: updated,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" }
  );

  return { created, updated };
}

function normalizeChannel(source: string): string {
  const s = (source || "").toLowerCase();
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("facebook")) return "facebook";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("referr")) return "referido";
  if (s.includes("ad")) return "anuncio";
  if (s.includes("web")) return "website";
  if (s.includes("call")) return "llamada";
  if (s.includes("walk")) return "walk-in";
  if (s.includes("youtube")) return "youtube";
  return "otro";
}
