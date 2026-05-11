import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLConfig } from "../_shared/ghl.ts";
import { verifyAccountMembership } from "../_shared/auth-tenant.ts";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // SECURITY FIX 2026-05-10 (audit hallazgo alto): requerir auth + membership.
  // Sin esto, atacante puede disparar miles de POSTs → DoS contra GHL API
  // + drenar quota del cliente GHL.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { locationId: bodyLocationId, accountId, ownerId } = await req.json();

    if (!accountId || !ownerId) {
      return new Response(
        JSON.stringify({ error: "Missing accountId or ownerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: verificar que user pertenece al account
    const isMember = await verifyAccountMembership(supabaseAdmin, user.id, accountId);
    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: "not_member_of_account" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve GHL credentials per-account
    const ghlConfig = await getGHLConfig(accountId);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL not configured for this account", success: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, locationId: resolvedLocationId } = ghlConfig;
    const locationId = bodyLocationId || resolvedLocationId;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Paginate through all GHL contacts
    let allContacts: any[] = [];
    let nextPageUrl: string | null =
      `${GHL_API_BASE}/contacts/?locationId=${locationId}&limit=100`;

    while (nextPageUrl) {
      console.log(`Fetching: ${nextPageUrl}`);
      const res = await fetch(nextPageUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_API_VERSION,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`GHL API error ${res.status}:`, errText);
        return new Response(
          JSON.stringify({ error: `GHL API error: ${res.status}`, detail: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      const contacts = data.contacts || [];
      allContacts = allContacts.concat(contacts);
      console.log(`Fetched ${contacts.length} contacts (total: ${allContacts.length})`);

      // GHL v2 pagination
      const meta = data.meta;
      if (meta?.nextPageUrl) {
        nextPageUrl = meta.nextPageUrl;
      } else if (meta?.nextPage) {
        nextPageUrl = `${GHL_API_BASE}/contacts/?locationId=${locationId}&limit=100&startAfterId=${contacts[contacts.length - 1]?.id}`;
      } else {
        nextPageUrl = null;
      }

      // Safety: max 5000 contacts
      if (allContacts.length >= 5000) {
        console.warn("Hit 5000 contact limit, stopping pagination");
        break;
      }
    }

    // Normalize GHL source to canonical channel keys
    function normalizeGhlSource(raw: string | undefined | null): { channel: string | null; detail: string | null } {
      if (!raw) return { channel: null, detail: null };
      const lower = raw.toLowerCase().trim();
      if (lower === "facebook" || lower.includes("facebook")) return { channel: "facebook", detail: null };
      if (lower === "instagram" || lower.includes("instagram")) return { channel: "instagram", detail: null };
      if (lower === "whatsapp" || lower.includes("whatsapp")) return { channel: "whatsapp", detail: null };
      if (lower === "tiktok" || lower.includes("tiktok")) return { channel: "tiktok", detail: null };
      if (lower === "youtube" || lower.includes("youtube")) return { channel: "youtube", detail: null };
      if (lower.includes("website") || lower.includes("web form") || lower.includes("landing")) return { channel: "website", detail: null };
      if (lower.includes("referr") || lower.includes("referido")) return { channel: "referido", detail: raw };
      if (lower.includes("ad") || lower.includes("anuncio") || lower.includes("campaign") || lower.includes("google ads")) return { channel: "anuncio", detail: raw };
      if (lower.includes("call") || lower.includes("llamada") || lower.includes("phone")) return { channel: "llamada", detail: null };
      if (lower.includes("walk") || lower.includes("presencial")) return { channel: "walk-in", detail: null };
      return { channel: null, detail: raw };
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const c of allContacts) {
      const email = (c.email || "").trim();
      const phone = (c.phone || "").trim();
      const firstName = c.firstName || c.first_name || null;
      const lastName = c.lastName || c.last_name || null;

      if (!firstName && !lastName) {
        skipped++;
        continue;
      }

      const { channel, detail } = normalizeGhlSource(c.source);

      const profileData: Record<string, unknown> = {
        account_id: accountId,
        created_by: ownerId,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        mobile_phone: phone || null,
        address_street: c.address1 || null,
        address_city: c.city || null,
        address_state: c.state || null,
        address_zip: c.postalCode || null,
        address_country: c.country || "US",
        dob: c.dateOfBirth || null,
        source_channel: channel,
        source_detail: detail,
        updated_at: new Date().toISOString(),
      };

      if (email) {
        profileData.email = email;
      }

      // Try upsert by email if available
      if (email) {
        const { error } = await adminClient
          .from("client_profiles")
          .upsert(profileData, { onConflict: "account_id,email", ignoreDuplicates: false });

        if (error) {
          console.error(`Error upserting ${email}:`, error.message);
          skipped++;
        } else {
          inserted++;
        }
      } else {
        // No email: check by phone to avoid duplicates
        const { data: existing } = await adminClient
          .from("client_profiles")
          .select("id")
          .eq("account_id", accountId)
          .eq("phone", phone)
          .maybeSingle();

        if (existing) {
          const { error } = await adminClient
            .from("client_profiles")
            .update(profileData)
            .eq("id", existing.id);
          if (error) {
            console.error(`Error updating phone-only ${phone}:`, error.message);
            skipped++;
          } else {
            updated++;
          }
        } else {
          const { error } = await adminClient
            .from("client_profiles")
            .insert(profileData);
          if (error) {
            console.error(`Error inserting phone-only ${firstName}:`, error.message);
            skipped++;
          } else {
            inserted++;
          }
        }
      }
    }

    const summary = {
      success: true,
      total_from_ghl: allContacts.length,
      inserted,
      updated,
      skipped,
    };

    console.log("Import complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
