import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { location_id, contact_email, contact_name, contract_title } = body;

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

    // 2. Find case
    let caseData: any = null;
    if (contact_email) {
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

    // 3. Add note to case
    if (caseData) {
      const now = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
      await supabase.from("case_notes").insert({
        account_id: accountId,
        case_id: caseData.id,
        author_id: caseData.professional_id,
        author_name: "Sistema",
        content: `📝 Contrato firmado el ${now}${contract_title ? ` — "${contract_title}"` : ""} por ${contact_name || "el cliente"}`,
        note_type: "system",
        is_pinned: false,
      });
    }

    // 4. Notify preparer
    const { data: config } = await supabase
      .from("office_config")
      .select("firm_email, firm_name, attorney_name")
      .eq("account_id", accountId)
      .maybeSingle();

    if (config?.firm_email) {
      await supabase.functions.invoke("send-email", {
        body: {
          template_type: "case_update",
          to_email: config.firm_email,
          to_name: config.attorney_name || "Preparador",
          account_id: accountId,
          case_id: caseData?.id,
          language: "es",
          variables: {
            client_name: config.attorney_name || "Preparador",
            file_number: caseData?.file_number,
            update_message: `${contact_name || "El cliente"} firmó el contrato${contract_title ? ` "${contract_title}"` : ""} para el expediente ${caseData?.file_number || ""}`,
          },
        },
      });
    }

    return new Response(JSON.stringify({ success: true, case_id: caseData?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("contract-signed error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
