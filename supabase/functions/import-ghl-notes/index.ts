import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getGHLConfig } from "../_shared/ghl.ts";
import { verifyAccountMembership } from "../_shared/auth-tenant.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY FIX 2026-05-10 (audit hallazgo alto): auth + membership
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(
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
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { account_id, ghl_contact_id, case_id } = body;

    if (!account_id || !ghl_contact_id) {
      return new Response(
        JSON.stringify({ error: "account_id y ghl_contact_id son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isMember = await verifyAccountMembership(admin, user.id, account_id);
    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: "not_member_of_account" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado", notes: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey } = ghlConfig;

    // Fetch notes from GHL
    const res = await fetch(
      `${GHL_BASE}/contacts/${ghl_contact_id}/notes`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
        },
      }
    );

    const rawText = await res.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!res.ok || !data.notes) {
      return new Response(
        JSON.stringify({ error: "No se pudieron obtener las notas de GHL", notes: [], status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlNotes = data.notes as Array<{ id: string; body: string; dateAdded: string; userId?: string }>;

    if (!case_id || ghlNotes.length === 0) {
      // Just return the notes without saving
      return new Response(
        JSON.stringify({
          notes: ghlNotes.map((n: any) => ({
            id: n.id,
            body: n.body,
            date: n.dateAdded,
          })),
          count: ghlNotes.length,
          saved: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing ghl_note_ids to avoid duplicates
    const { data: existingNotes } = await admin
      .from("case_notes")
      .select("ghl_note_id")
      .eq("case_id", case_id)
      .not("ghl_note_id", "is", null);

    const existingGhlIds = new Set((existingNotes || []).map((n: any) => n.ghl_note_id));

    const newNotes = ghlNotes.filter((n: any) => !existingGhlIds.has(n.id));

    if (newNotes.length > 0) {
      const inserts = newNotes.map((n: any) => ({
        account_id,
        case_id,
        author_id: "00000000-0000-0000-0000-000000000000", // system
        author_name: "GHL Import",
        content: n.body,
        note_type: "general",
        is_pinned: false,
        ghl_note_id: n.id,
        created_at: n.dateAdded || new Date().toISOString(),
      }));

      await admin.from("case_notes").insert(inserts);
    }

    return new Response(
      JSON.stringify({
        notes: ghlNotes.map((n: any) => ({
          id: n.id,
          body: n.body,
          date: n.dateAdded,
        })),
        count: ghlNotes.length,
        new_imported: newNotes.length,
        saved: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("import-ghl-notes error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
