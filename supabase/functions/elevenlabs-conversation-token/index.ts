import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkOrigin } from "../_shared/origin-allowlist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  agent_id: z.string().min(1).max(128),
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAgentId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const queryAgentId = url.searchParams.get("agent_id");
  if (queryAgentId) return queryAgentId;

  if (req.method !== "POST") return null;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return null;

  return parsed.data.agent_id;
}

async function callElevenLabs(url: string, apiKey: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  const text = await response.text();

  try {
    return {
      ok: response.ok,
      status: response.status,
      data: JSON.parse(text),
      text,
      url,
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      data: null,
      text,
      url,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SECURITY FIX 2026-05-10: Camila voice token consume créditos ElevenLabs.
  // Capa 1: Origin allowlist (bloquea curl directo).
  const originCheck = checkOrigin(req);
  if (originCheck.blocked) {
    console.warn("elevenlabs-conversation-token: origin blocked", originCheck.origin);
    return jsonResponse({ ok: false, error: "forbidden", reason: originCheck.reason }, 403);
  }

  // Capa 2: requerir usuario autenticado (Camila es para paralegales en /hub).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) {
      return jsonResponse({ ok: false, error: "ELEVENLABS_API_KEY not configured" }, 500);
    }

    const agentId = await getAgentId(req);
    if (!agentId) {
      return jsonResponse({ ok: false, error: "agent_id is required" }, 400);
    }

    const encodedAgentId = encodeURIComponent(agentId);
    const diagnostics: Array<{ url: string; status: number; body: string }> = [];

    const signedUrlEndpoints = [
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodedAgentId}`,
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodedAgentId}`,
    ];

    for (const endpoint of signedUrlEndpoints) {
      const result = await callElevenLabs(endpoint, elevenLabsApiKey);
      if (result.ok && result.data?.signed_url) {
        return jsonResponse({
          ok: true,
          signed_url: result.data.signed_url,
          connection_type: "websocket",
        });
      }

      diagnostics.push({
        url: endpoint,
        status: result.status,
        body: result.text.slice(0, 400),
      });
    }

    const tokenEndpoint = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodedAgentId}`;
    const tokenResult = await callElevenLabs(tokenEndpoint, elevenLabsApiKey);

    if (tokenResult.ok && tokenResult.data?.token) {
      return jsonResponse({
        ok: true,
        token: tokenResult.data.token,
        connection_type: "webrtc",
      });
    }

    diagnostics.push({
      url: tokenEndpoint,
      status: tokenResult.status,
      body: tokenResult.text.slice(0, 400),
    });

    console.error("ElevenLabs session error", diagnostics);
    return jsonResponse({
      ok: false,
      error: "No se pudo generar una sesión válida de ElevenLabs.",
      diagnostics,
    });
  } catch (error) {
    console.error("elevenlabs-conversation-token error:", error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
