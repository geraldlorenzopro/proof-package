import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TOKEN_LENGTH = 128;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_CASE = 50;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const contentType = req.headers.get("content-type") || "";

    // ── File upload (multipart/form-data) ──────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const token = formData.get("token") as string;
      const file = formData.get("file") as File;
      const fileName = formData.get("file_name") as string;
      const fileType = (formData.get("file_type") as string) || "photo";
      const fileSize = parseInt(formData.get("file_size") as string) || 0;
      const uploadOrder = parseInt(formData.get("upload_order") as string) || 0;

      if (!token || !file || !fileName) {
        return jsonResponse({ error: "Missing required fields" }, 400);
      }
      if (token.length > MAX_TOKEN_LENGTH) {
        return jsonResponse({ error: "Invalid token format" }, 400);
      }
      if (fileSize > MAX_FILE_SIZE) {
        return jsonResponse({ error: "File too large (max 50MB)" }, 400);
      }

      // Validate token → get case_id
      const { data: caseId } = await supabase.rpc("get_case_id_by_token", {
        _token: token,
      });
      if (!caseId) {
        return jsonResponse({ error: "Invalid or expired token" }, 403);
      }

      // Check file count limit
      const { count } = await supabase
        .from("evidence_items")
        .select("id", { count: "exact", head: true })
        .eq("case_id", caseId);

      if ((count ?? 0) >= MAX_FILES_PER_CASE) {
        return jsonResponse(
          { error: `Límite alcanzado: máximo ${MAX_FILES_PER_CASE} archivos por caso` },
          400
        );
      }

      // Generate safe server-side path
      const safeName = fileName
        .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
        .substring(0, 200);
      const path = `${caseId}/${Date.now()}-${safeName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("evidence-files")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        return jsonResponse(
          { error: "Upload failed: " + uploadError.message },
          500
        );
      }

      // Insert evidence record
      const { data: record, error: insertError } = await supabase
        .from("evidence_items")
        .insert({
          case_id: caseId,
          file_name: fileName,
          file_path: path,
          file_type: fileType,
          file_size: fileSize,
          upload_order: uploadOrder,
        })
        .select()
        .single();

      if (insertError) {
        // Rollback: remove uploaded file
        await supabase.storage.from("evidence-files").remove([path]);
        return jsonResponse({ error: "Record creation failed" }, 500);
      }

      return jsonResponse({ success: true, record });
    }

    // ── JSON actions ───────────────────────────────────────────────────
    const body = await req.json();
    const { action, token } = body;

    if (
      !token ||
      typeof token !== "string" ||
      token.length > MAX_TOKEN_LENGTH
    ) {
      return jsonResponse({ error: "Invalid token" }, 400);
    }

    // Validate token → get case_id
    const { data: caseId } = await supabase.rpc("get_case_id_by_token", {
      _token: token,
    });
    if (!caseId) {
      return jsonResponse({ error: "Invalid or expired token" }, 403);
    }

    // ── Generate signed URLs ───────────────────────────────────────────
    if (action === "signed-urls") {
      const { paths } = body;
      if (!Array.isArray(paths) || paths.length === 0) {
        return jsonResponse({ error: "paths array required" }, 400);
      }

      // Only allow paths belonging to this case
      const casePrefix = caseId + "/";
      const validPaths = paths.filter(
        (p: string) => typeof p === "string" && p.startsWith(casePrefix)
      );

      if (validPaths.length === 0) {
        return jsonResponse({ urls: [] });
      }

      const { data } = await supabase.storage
        .from("evidence-files")
        .createSignedUrls(validPaths, 3600);

      return jsonResponse({ urls: data || [] });
    }

    // ── Delete file from storage ───────────────────────────────────────
    if (action === "delete") {
      const { path } = body;
      if (!path || typeof path !== "string") {
        return jsonResponse({ error: "path required" }, 400);
      }

      // Verify path belongs to this case
      if (!path.startsWith(caseId + "/")) {
        return jsonResponse({ error: "Unauthorized path" }, 403);
      }

      const { error } = await supabase.storage
        .from("evidence-files")
        .remove([path]);

      if (error) {
        return jsonResponse({ error: "Delete failed" }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("client-file-ops error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
