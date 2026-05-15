import { corsHeaders } from "../_shared/cors.ts";
import { verifyGhlWebhook } from "../_shared/verify-ghl-webhook.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

const DOCS_BY_TYPE: Record<string, string[]> = {
  "adjustment-of-status": ["Pasaporte", "Acta de nacimiento", "I-94", "Fotos 2x2", "I-130 aprobado", "Evidencia de domicilio"],
  naturalization: ["Green Card", "Pasaporte", "Tax returns 3 años", "Fotos 2x2", "Historial de viajes"],
  "family-petition": ["Pasaporte", "Certificado de ciudadanía", "Acta de matrimonio", "Tax returns", "Fotos de la pareja"],
  "daca-tps": ["Pasaporte", "Evidencia de presencia", "Tax returns o W-2", "Fotos 2x2"],
};
const DEFAULT_DOCS = ["Pasaporte", "Acta de nacimiento", "Evidencia de estatus migratorio"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // SECURITY FIX 2026-05-10: webhook GHL debe llevar x-webhook-secret válido.
  // Sin esto, atacante con location_id (semi-público) podía disparar payment-confirmed
  // contra cualquier firma y activar casos falsos + emails a clientes reales.
  // Audit hallazgo crítico #2.
  const webhookCheck = verifyGhlWebhook(req);
  if (!webhookCheck.valid) {
    return new Response(
      JSON.stringify({ error: "unauthorized_webhook", reason: webhookCheck.reason }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { location_id, contact_email, contact_name, contact_phone, amount } = body;

    if (!location_id) {
      return new Response(JSON.stringify({ error: "Missing location_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Find account
    const { data: account } = await supabase
      .from("ner_accounts")
      .select("id")
      .eq("external_crm_id", location_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accountId = account.id;

    // 2. Find client profile
    let profileId: string | null = null;
    if (contact_email) {
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("account_id", accountId)
        .eq("email", contact_email)
        .maybeSingle();
      profileId = profile?.id || null;
    }
    if (!profileId && contact_phone) {
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("account_id", accountId)
        .eq("phone", contact_phone)
        .maybeSingle();
      profileId = profile?.id || null;
    }

    // 3. Find active case
    let caseData: any = null;
    if (profileId) {
      const { data } = await supabase
        .from("client_cases")
        .select("*")
        .eq("account_id", accountId)
        .eq("client_profile_id", profileId)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      caseData = data;
    }
    if (!caseData && contact_email) {
      const { data } = await supabase
        .from("client_cases")
        .select("*")
        .eq("account_id", accountId)
        .eq("client_email", contact_email)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      caseData = data;
    }

    // 4. Update case status
    if (caseData) {
      await supabase
        .from("client_cases")
        .update({ status: "active" })
        .eq("id", caseData.id);
    }

    // 5. Get office config
    const { data: config } = await supabase
      .from("office_config")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();

    const clientName = contact_name || caseData?.client_name || "Cliente";
    const caseId = caseData?.id;
    const fileNumber = caseData?.file_number;
    const caseType = caseData?.case_type || "general";
    const documents = DOCS_BY_TYPE[caseType] || DEFAULT_DOCS;
    // SECURITY FIX 2026-05-10: hardcoded app URL en lugar de req.headers.get("origin")
    // (controlable por atacante para phishing vector en emails). Audit hallazgo medio.
    const APP_URL = Deno.env.get("APP_URL") || "https://ner.recursosmigratorios.com";
    const portalLink = caseData?.access_token ? `${APP_URL}/case-track/${caseData.access_token}` : "#";

    // 6. Send emails in parallel
    const sendEmail = (template_type: string, variables: any) =>
      supabase.functions.invoke("send-email", {
        body: {
          template_type,
          to_email: contact_email,
          to_name: clientName,
          account_id: accountId,
          case_id: caseId,
          variables: {
            client_name: clientName,
            file_number: fileNumber,
            case_type: caseType,
            portal_link: portalLink,
            ...variables,
          },
        },
      });

    await Promise.allSettled([
      sendEmail("welcome", {}),
      sendEmail("questionnaire", { questionnaire_link: portalLink }),
      sendEmail("document_checklist", { documents }),
      sendEmail("payment_confirmed", { amount: amount?.toString() || "0" }),
    ]);

    // 7. Update intake session
    if (caseData) {
      await supabase
        .from("intake_sessions")
        .update({ status: "converted" })
        .eq("case_id", caseData.id);
    }

    // Sprint D #6 — track billing.payment_confirmed event
    try {
      await supabase.from("events").insert({
        account_id: accountId,
        user_id: null,
        case_id: caseId,
        event_name: "billing.payment_confirmed",
        event_category: "billing",
        properties: {
          amount: amount ?? 0,
          source: "payment_confirmed_webhook",
          has_case: !!caseData,
        },
      });
    } catch (eventErr) {
      console.warn("[payment-confirmed] tracking failed:", eventErr);
    }

    return new Response(JSON.stringify({ success: true, case_id: caseId, emails_sent: 4 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("payment-confirmed error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
