import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePlatformAdmin() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    check();
  }, []);

  async function check() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsPlatformAdmin(false); setLoading(false); return; }
      
      const { data } = await supabase.rpc("is_platform_admin" as any);
      setIsPlatformAdmin(!!data);
    } catch {
      setIsPlatformAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  return { isPlatformAdmin, loading };
}
