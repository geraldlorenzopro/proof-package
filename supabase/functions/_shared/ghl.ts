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

  const { data } = await supabase
    .from("office_config")
    .select("ghl_api_key, ghl_location_id")
    .eq("account_id", accountId)
    .single();

  // Per-account key takes priority
  if (data?.ghl_api_key && data?.ghl_location_id) {
    return {
      apiKey: data.ghl_api_key,
      locationId: data.ghl_location_id,
    };
  }

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
