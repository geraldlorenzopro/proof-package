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
    const body = await req.json();
    const { account_id, note_id, ghl_contact_id, content, author_name } = body;

    if (!account_id || !ghl_contact_id || !content) {
      return new Response(
        JSON.stringify({ error: "account_id, ghl_contact_id y content son requeridos", pushed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado", pushed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey } = ghlConfig;

    const noteBody = {
      body: author_name ? `[${author_name}]: ${content}` : content,
    };

    const ghlUrl = `${GHL_BASE}/contacts/${ghl_contact_id}/notes`;
    console.log("Pushing note to GHL:", ghlUrl, JSON.stringify(noteBody));

    const res = await fetch(
      ghlUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteBody),
      }
    );

    const data = await res.json();

    if (res.ok && data.note?.id && note_id) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await admin.from("case_notes").update({ ghl_note_id: data.note.id }).eq("id", note_id);
    }

    return new Response(
      JSON.stringify({ pushed: res.ok, ghl_note_id: data.note?.id || null, status: res.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message, pushed: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
