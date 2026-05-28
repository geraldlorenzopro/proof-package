import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface GHLConfig {
  apiKey: string;
  locationId: string;
}

export async function getGHLConfig(
  accountId: string
): Promise<GHLConfig | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [{ data: cfg }, { data: secrets }] = await Promise.all([
    supabase
      .from("office_config")
      .select("ghl_location_id")
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("office_secrets")
      .select("ghl_api_key")
      .eq("account_id", accountId)
      .maybeSingle(),
  ]);

  // Per-account key takes priority
  if (secrets?.ghl_api_key && cfg?.ghl_location_id) {
    return {
      apiKey: secrets.ghl_api_key,
      locationId: cfg.ghl_location_id,
    };
  }

  const data = cfg;

  // Fallback to global secret (Mr Visa backward compat)
  const fallbackKey = Deno.env.get("MRVISA_API_KEY");
  const fallbackLocation =
    data?.ghl_location_id || "NgaxlyDdwg93PvQb5KCw";

  if (fallbackKey) {
    return {
      apiKey: fallbackKey,
      locationId: fallbackLocation,
    };
  }

  return null;
}
