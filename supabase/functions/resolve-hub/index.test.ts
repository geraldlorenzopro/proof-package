import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const HUB_SECRET = Deno.env.get("NER_HUB_SECRET") || "3e0bfa6fd94f35a995545fe2130d6ab1e84f72c45f9d3585d38de605e5c04618";

async function hmacSign(cid: string, ts: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`${cid}:${ts}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("resolve-hub: rejects missing sig/ts", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-hub?cid=test_ghl_123`);
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "Missing signature or timestamp");
});

Deno.test("resolve-hub: rejects invalid signature", async () => {
  const ts = Date.now().toString();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/resolve-hub?cid=test_ghl_123&ts=${ts}&sig=invalidsig`
  );
  const json = await res.json();
  assertEquals(res.status, 403);
  assertEquals(json.error, "Invalid signature");
});

Deno.test("resolve-hub: rejects expired timestamp", async () => {
  const ts = (Date.now() - 10 * 60 * 1000).toString(); // 10 min ago
  const sig = await hmacSign("test_ghl_123", ts, HUB_SECRET);
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/resolve-hub?cid=test_ghl_123&ts=${ts}&sig=${sig}`
  );
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "Expired or invalid timestamp");
});

Deno.test("resolve-hub: valid signature returns account data", async () => {
  const ts = Date.now().toString();
  const sig = await hmacSign("test_ghl_123", ts, HUB_SECRET);
  console.log("Test sig:", sig.substring(0, 16), "ts:", ts);
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/resolve-hub?cid=test_ghl_123&ts=${ts}&sig=${sig}`
  );
  const body = await res.text();
  console.log("Response status:", res.status, "body:", body);
  assertEquals(res.status, 200);
});
