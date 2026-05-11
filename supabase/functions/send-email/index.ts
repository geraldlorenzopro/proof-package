import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ghlApiKey = Deno.env.get("GHL_API_KEY");

const supabase = createClient(supabaseUrl, serviceKey);

// SECURITY FIX 2026-05-10: escape HTML en TODAS las interpolaciones de variables
// hacia templates (firm_name, client_name, attorney_name, update_message, etc.)
// para evitar XSS persistente vía email — attorney malicioso o cliente con HTML
// inyectado en su nombre podría triggerear scripts en clientes del bufete.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// SECURITY: sanitize URLs — solo permitir https:, http:, mailto:, tel:, # (placeholder).
// Bloquea javascript:, data:, vbscript: que ejecutan código en clients que renderizan emails.
function safeUrl(value: unknown): string {
  if (!value) return "#";
  const str = String(value).trim();
  if (str === "#") return "#";
  const lower = str.toLowerCase();
  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("/")
  ) {
    return escapeHtml(str);
  }
  return "#";
}

// Sanitizer de objeto: aplica escapeHtml a todos los strings (no profundo).
// Mantiene arrays/objects intactos para handling especial en cada template.
function sanitizeVars(v: any): any {
  if (!v || typeof v !== "object") return v;
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") {
      // URLs reciben safeUrl; resto escapeHtml
      if (/_(link|url)$/i.test(k)) {
        out[k] = safeUrl(val);
      } else {
        out[k] = escapeHtml(val);
      }
    } else {
      out[k] = val;
    }
  }
  return out;
}

// ── Template definitions ──
interface TemplateResult { subject: string; html: string; }

const TEMPLATE_TYPE_LABELS_ES: Record<string, string> = {
  welcome: "Bienvenida",
  questionnaire: "Cuestionario",
  document_checklist: "Lista de documentos",
  document_received: "Documento recibido",
  payment_confirmed: "Pago confirmado",
  case_update: "Actualización de caso",
  appointment_reminder: "Recordatorio de cita",
  case_approved: "Caso aprobado",
  firm_welcome: "Bienvenida de firma",
};

function baseLayout(vars: any, bodyHtml: string): string {
  const firmName = vars.firm_name || "NER Immigration AI";
  const firmLogo = vars.firm_logo_url;
  const firmPhone = vars.firm_phone || "";
  const firmEmail = vars.firm_email || "";
  const attorneyName = vars.attorney_name || "";
  const fileNumber = vars.file_number;

  const headerHtml = firmLogo
    ? `<div style="text-align:center;margin-bottom:20px"><img src="${firmLogo}" alt="${firmName}" style="max-height:60px;max-width:200px" /></div>`
    : `<div style="text-align:center;margin-bottom:20px"><h1 style="color:#0ea5e9;font-size:24px;margin:0">${firmName}</h1></div>`;

  const fileNumberHtml = fileNumber
    ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 16px;margin:16px 0;font-family:monospace;font-size:14px;color:#0284c7"><strong>Expediente:</strong> ${fileNumber}</div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <div style="padding:30px 30px 0">${headerHtml}<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px" /></div>
  <div style="padding:0 30px">${fileNumberHtml}${bodyHtml}</div>
  <div style="padding:24px 30px;margin-top:20px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#334155">${firmName}</p>
    ${firmPhone ? `<p style="margin:0 0 2px;font-size:12px;color:#64748b">📞 ${firmPhone}</p>` : ""}
    ${firmEmail ? `<p style="margin:0 0 2px;font-size:12px;color:#64748b">✉️ ${firmEmail}</p>` : ""}
    ${attorneyName ? `<p style="margin:0 0 8px;font-size:12px;color:#64748b">👤 ${attorneyName}</p>` : ""}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0" />
    <p style="margin:0;font-size:10px;color:#94a3b8">Este email fue enviado por ${firmName}. Si tienes preguntas contacta a tu preparador.</p>
  </div>
</div></body></html>`;
}

function btn(text: string, url?: string): string {
  const href = url || "#";
  return `<div style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">${text}</a></div>`;
}

// ── ES Templates ──
function welcomeES(v: any): TemplateResult {
  return {
    subject: `Bienvenido/a a ${v.firm_name || "nuestra firma"} — Tu expediente ${v.file_number || ""} ha comenzado`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Tu expediente de <strong>${v.case_type || "inmigración"}</strong> ha sido abierto en <strong>${v.firm_name || ""}</strong>.</p>
      <p style="font-size:14px;color:#475569">Tu preparador/a <strong>${v.attorney_name || ""}</strong> estará trabajando en tu caso. Próximamente recibirás instrucciones sobre los documentos necesarios.</p>
      ${btn("Ver mi portal", v.portal_link)}
    `)
  };
}

function questionnaireES(v: any): TemplateResult {
  return {
    subject: `Acción requerida — Completa tu cuestionario (Exp. ${v.file_number || ""})`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Para continuar con tu caso necesitamos que completes el cuestionario de información.</p>
      <p style="font-size:14px;color:#475569">Esto nos tomará aproximadamente 15-20 minutos.</p>
      ${btn("Completar cuestionario ahora", v.questionnaire_link)}
      <p style="font-size:13px;color:#94a3b8">Por favor complétalo en los próximos 7 días.</p>
    `)
  };
}

function documentChecklistES(v: any): TemplateResult {
  const docs = (v.documents || []) as string[];
  const docList = docs.map((d: string) => `<li style="margin:4px 0;font-size:14px;color:#475569">${escapeHtml(d)}</li>`).join("");
  return {
    subject: `Documentos requeridos — Exp. ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Para procesar tu caso necesitamos los siguientes documentos:</p>
      <ul style="padding-left:20px">${docList}</ul>
      ${btn("Subir documentos", v.portal_link)}
      <p style="font-size:13px;color:#94a3b8">Sube los documentos en formato PDF o imagen. Asegúrate de que sean legibles y completos.</p>
    `)
  };
}

function documentReceivedES(v: any): TemplateResult {
  return {
    subject: `Documento recibido ✓ — Exp. ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Hemos recibido tu documento:</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:12px 0"><strong style="color:#16a34a">${v.document_name || "Documento"}</strong></div>
      <p style="font-size:14px;color:#475569">Lo revisaremos pronto y te contactaremos si necesitamos algo adicional.</p>
    `)
  };
}

function paymentConfirmedES(v: any): TemplateResult {
  return {
    subject: `Pago confirmado — ${v.firm_name || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Hemos recibido tu pago de <strong>$${v.amount || "0"}</strong>.</p>
      <p style="font-size:14px;color:#475569">Tu expediente está activo y en proceso.</p>
      ${btn("Ver mi caso", v.portal_link)}
    `)
  };
}

function appointmentReminderES(v: any): TemplateResult {
  return {
    subject: `Recordatorio de consulta — ${v.appointment_date || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Tienes una consulta programada:</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:12px 0">
        <p style="margin:0 0 4px;font-size:14px;color:#334155"><strong>Fecha:</strong> ${v.appointment_date || ""}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#334155"><strong>Con:</strong> ${v.attorney_name || ""}</p>
        <p style="margin:0;font-size:14px;color:#334155"><strong>Firma:</strong> ${v.firm_name || ""}</p>
      </div>
      <p style="font-size:13px;color:#94a3b8">Si necesitas reprogramar, contáctanos.</p>
    `)
  };
}

function caseApprovedES(v: any): TemplateResult {
  return {
    subject: `🎉 ¡Tu caso fue aprobado! — Exp. ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:18px;color:#334155;font-weight:bold">¡Felicitaciones ${v.client_name || ""}! 🎉</p>
      <p style="font-size:14px;color:#475569">Tu caso de <strong>${v.case_type || "inmigración"}</strong> fue aprobado.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:12px 0;text-align:center"><p style="margin:0;font-size:20px;color:#16a34a;font-weight:bold">✅ APROBADO</p></div>
      <p style="font-size:14px;color:#475569">Ha sido un honor acompañarte en este proceso.</p>
      ${btn("Ver mi expediente", v.portal_link)}
      <p style="font-size:13px;color:#94a3b8">Si conoces a alguien que necesite ayuda con su proceso de inmigración, nos encantaría ayudarles también.</p>
    `)
  };
}

function firmWelcomeES(v: any): TemplateResult {
  return {
    subject: `¡Bienvenido/a a NER Immigration AI!`,
    html: baseLayout({ ...v, firm_name: "NER Immigration AI" }, `
      <p style="font-size:16px;color:#334155">Hola ${v.attorney_name || ""},</p>
      <p style="font-size:14px;color:#475569">Tu firma <strong>${v.firm_name || ""}</strong> ya está configurada en NER Immigration AI.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:12px 0">
        <p style="margin:0 0 4px;font-size:14px;color:#334155"><strong>Número de firma:</strong> ${v.file_prefix || ""}</p>
        <p style="margin:0;font-size:14px;color:#334155"><strong>Tu primer expediente será:</strong> ${v.file_prefix || "NER"}-2026-0001</p>
      </div>
      <p style="font-size:14px;color:#475569;font-weight:bold">Próximos pasos:</p>
      <ol style="padding-left:20px;color:#475569;font-size:14px"><li>Completa tu Office Setup</li><li>Crea tu primer caso</li><li>Conecta tu GHL para comunicaciones</li></ol>
      ${btn("Ir al Hub", v.hub_link || "#")}
    `)
  };
}

function caseUpdateES(v: any): TemplateResult {
  return {
    subject: `Actualización de caso — Exp. ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hola ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Hay una actualización en tu expediente.</p>
      <p style="font-size:14px;color:#475569">${v.update_message || "Tu preparador ha actualizado tu caso. Revisa tu portal para más detalles."}</p>
      ${btn("Ver mi caso", v.portal_link)}
    `)
  };
}

// ── EN Templates ──
function welcomeEN(v: any): TemplateResult {
  return {
    subject: `Welcome to ${v.firm_name || "our firm"} — Your case ${v.file_number || ""} has started`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">Your <strong>${v.case_type || "immigration"}</strong> case has been opened at <strong>${v.firm_name || ""}</strong>.</p>
      <p style="font-size:14px;color:#475569">Your preparer <strong>${v.attorney_name || ""}</strong> will be working on your case. You will soon receive instructions about the required documents.</p>
      ${btn("View my portal", v.portal_link)}
    `)
  };
}

function questionnaireEN(v: any): TemplateResult {
  return {
    subject: `Action required — Complete your questionnaire (Case ${v.file_number || ""})`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">To continue with your case we need you to complete the information questionnaire.</p>
      <p style="font-size:14px;color:#475569">This will take approximately 15-20 minutes.</p>
      ${btn("Complete questionnaire now", v.questionnaire_link)}
      <p style="font-size:13px;color:#94a3b8">Please complete it within the next 7 days.</p>
    `)
  };
}

function documentChecklistEN(v: any): TemplateResult {
  const docs = (v.documents || []) as string[];
  const docList = docs.map((d: string) => `<li style="margin:4px 0;font-size:14px;color:#475569">${escapeHtml(d)}</li>`).join("");
  return {
    subject: `Documents required — Case ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">To process your case we need the following documents:</p>
      <ul style="padding-left:20px">${docList}</ul>
      ${btn("Upload documents", v.portal_link)}
      <p style="font-size:13px;color:#94a3b8">Upload documents in PDF or image format. Make sure they are legible and complete.</p>
    `)
  };
}

function documentReceivedEN(v: any): TemplateResult {
  return {
    subject: `Document received ✓ — Case ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">We have received your document:</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:12px 0"><strong style="color:#16a34a">${v.document_name || "Document"}</strong></div>
      <p style="font-size:14px;color:#475569">We will review it soon and contact you if we need anything else.</p>
    `)
  };
}

function paymentConfirmedEN(v: any): TemplateResult {
  return {
    subject: `Payment confirmed — ${v.firm_name || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">We have received your payment of <strong>$${v.amount || "0"}</strong>.</p>
      <p style="font-size:14px;color:#475569">Your case is active and in progress.</p>
      ${btn("View my case", v.portal_link)}
    `)
  };
}

function appointmentReminderEN(v: any): TemplateResult {
  return {
    subject: `Appointment reminder — ${v.appointment_date || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">You have a scheduled consultation:</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:12px 0">
        <p style="margin:0 0 4px;font-size:14px;color:#334155"><strong>Date:</strong> ${v.appointment_date || ""}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#334155"><strong>With:</strong> ${v.attorney_name || ""}</p>
        <p style="margin:0;font-size:14px;color:#334155"><strong>Firm:</strong> ${v.firm_name || ""}</p>
      </div>
      <p style="font-size:13px;color:#94a3b8">If you need to reschedule, please contact us.</p>
    `)
  };
}

function caseApprovedEN(v: any): TemplateResult {
  return {
    subject: `🎉 Your case was approved! — Case ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:18px;color:#334155;font-weight:bold">Congratulations ${v.client_name || ""}! 🎉</p>
      <p style="font-size:14px;color:#475569">Your <strong>${v.case_type || "immigration"}</strong> case was approved.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:12px 0;text-align:center"><p style="margin:0;font-size:20px;color:#16a34a;font-weight:bold">✅ APPROVED</p></div>
      <p style="font-size:14px;color:#475569">It has been an honor to accompany you through this process.</p>
      ${btn("View my case", v.portal_link)}
      <p style="font-size:13px;color:#94a3b8">If you know someone who needs help with their immigration process, we would love to help them too.</p>
    `)
  };
}

function firmWelcomeEN(v: any): TemplateResult {
  return {
    subject: `Welcome to NER Immigration AI!`,
    html: baseLayout({ ...v, firm_name: "NER Immigration AI" }, `
      <p style="font-size:16px;color:#334155">Hello ${v.attorney_name || ""},</p>
      <p style="font-size:14px;color:#475569">Your firm <strong>${v.firm_name || ""}</strong> is now set up in NER Immigration AI.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:12px 0">
        <p style="margin:0 0 4px;font-size:14px;color:#334155"><strong>Firm code:</strong> ${v.file_prefix || ""}</p>
        <p style="margin:0;font-size:14px;color:#334155"><strong>Your first case will be:</strong> ${v.file_prefix || "NER"}-2026-0001</p>
      </div>
      <p style="font-size:14px;color:#475569;font-weight:bold">Next steps:</p>
      <ol style="padding-left:20px;color:#475569;font-size:14px"><li>Complete your Office Setup</li><li>Create your first case</li><li>Connect your GHL for communications</li></ol>
      ${btn("Go to Hub", v.hub_link || "#")}
    `)
  };
}

function caseUpdateEN(v: any): TemplateResult {
  return {
    subject: `Case update — Case ${v.file_number || ""}`,
    html: baseLayout(v, `
      <p style="font-size:16px;color:#334155">Hello ${v.client_name || ""},</p>
      <p style="font-size:14px;color:#475569">There is an update on your case.</p>
      <p style="font-size:14px;color:#475569">${v.update_message || "Your preparer has updated your case. Check your portal for more details."}</p>
      ${btn("View my case", v.portal_link)}
    `)
  };
}

const TEMPLATES: Record<string, Record<string, (v: any) => TemplateResult>> = {
  welcome: { es: welcomeES, en: welcomeEN },
  questionnaire: { es: questionnaireES, en: questionnaireEN },
  document_checklist: { es: documentChecklistES, en: documentChecklistEN },
  document_received: { es: documentReceivedES, en: documentReceivedEN },
  payment_confirmed: { es: paymentConfirmedES, en: paymentConfirmedEN },
  appointment_reminder: { es: appointmentReminderES, en: appointmentReminderEN },
  case_approved: { es: caseApprovedES, en: caseApprovedEN },
  firm_welcome: { es: firmWelcomeES, en: firmWelcomeEN },
  case_update: { es: caseUpdateES, en: caseUpdateEN },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: verify JWT and account membership ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { template_type, to_email, to_name, account_id, case_id, language, variables = {} } = body;

    if (!template_type || !to_email || !account_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify user belongs to this account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("account_id", account_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Get office config
    const { data: config } = await supabase
      .from("office_config")
      .select("*")
      .eq("account_id", account_id)
      .maybeSingle();

    const vars = {
      firm_name: config?.firm_name || variables.firm_name || "NER Immigration",
      firm_logo_url: config?.firm_logo_url || variables.firm_logo_url || "",
      firm_phone: config?.firm_phone || variables.firm_phone || "",
      firm_email: config?.firm_email || variables.firm_email || "",
      attorney_name: config?.attorney_name || variables.attorney_name || "",
      ...variables,
    };

    const lang = language || (config as any)?.preferred_language || "es";

    // 2. Render template
    const templateFn = TEMPLATES[template_type]?.[lang] || TEMPLATES[template_type]?.es;
    if (!templateFn) {
      return new Response(JSON.stringify({ error: `Unknown template: ${template_type}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SECURITY 2026-05-10: sanitize ALL string vars antes de pasarlas al template.
    // documents (array) se sanitiza dentro de cada template ES/EN.
    const { subject, html } = templateFn(sanitizeVars(vars));

    // 3. Get case file_number if case_id provided
    let fileNumber = variables.file_number || null;
    if (!fileNumber && case_id) {
      const { data: caseData } = await supabase.from("client_cases").select("file_number").eq("id", case_id).maybeSingle();
      fileNumber = caseData?.file_number || null;
    }

    // 4. Send via GHL or queue as pending
    let status = "pending";
    let ghlMessageId: string | null = null;

    if (ghlApiKey && (config as any)?.ghl_location_id) {
      try {
        const ghlRes = await fetch("https://services.leadconnectorhq.com/conversations/messages/outbound", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-04-15",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "Email",
            locationId: (config as any).ghl_location_id,
            emailFrom: "noreply@nerimmigration.ai",
            emailFromName: vars.firm_name,
            emailTo: to_email,
            subject,
            html,
          }),
        });

        if (ghlRes.ok) {
          const ghlData = await ghlRes.json();
          status = "sent";
          ghlMessageId = ghlData.messageId || ghlData.id || null;
        } else {
          const errText = await ghlRes.text();
          console.error("GHL send error:", ghlRes.status, errText);
          status = "failed";
        }
      } catch (err) {
        console.error("GHL send exception:", err);
        status = "failed";
      }
    } else {
      console.log("GHL_API_KEY or ghl_location_id not configured, queuing as pending");
      status = "pending";
    }

    // 5. Log to email_logs
    await supabase.from("email_logs").insert({
      account_id,
      recipient_email: to_email,
      recipient_name: to_name || vars.client_name || null,
      template_type,
      subject,
      status,
      ghl_message_id: ghlMessageId,
      case_id: case_id || null,
      file_number: fileNumber,
      metadata: { language: lang, variables: vars },
    });

    return new Response(JSON.stringify({ success: true, status, queued: status === "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
