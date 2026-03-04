import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SeatStatus {
  granted: boolean;
  sessionId?: string;
  reason?: string;
  loading: boolean;
  kicked: boolean;
}

const HEARTBEAT_INTERVAL = 30_000; // 30s

/**
 * Hook that acquires a seat for the given app slug on mount,
 * sends heartbeats, and detects if the user gets kicked.
 * Call release() or let unmount handle cleanup.
 */
export function useAppSeat(appSlug: string | null): SeatStatus & { release: () => void } {
  const [status, setStatus] = useState<SeatStatus>({
    granted: false,
    loading: true,
    kicked: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const acquire = useCallback(async () => {
    if (!appSlug) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus({ granted: false, loading: false, kicked: false, reason: "not_authenticated" });
      return;
    }

    const { data, error } = await supabase.rpc("acquire_app_seat", {
      _user_id: user.id,
      _app_slug: appSlug,
    });

    if (error || !data) {
      console.warn("[useAppSeat] acquire error:", error);
      // Fallback: allow access to not block users if DB issue
      setStatus({ granted: true, loading: false, kicked: false, reason: "fallback" });
      return;
    }

    const result = data as unknown as { granted: boolean; session_id?: string; reason?: string };
    if (mountedRef.current) {
      setStatus({
        granted: result.granted,
        sessionId: result.session_id,
        reason: result.reason,
        loading: false,
        kicked: false,
      });
    }
  }, [appSlug]);

  const heartbeat = useCallback(async () => {
    if (!appSlug) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc("heartbeat_app_seat", {
      _user_id: user.id,
      _app_slug: appSlug,
    });

    if (error) {
      console.warn("[useAppSeat] heartbeat error:", error);
      return;
    }

    const result = data as unknown as { valid: boolean; reason?: string };
    if (!result.valid && mountedRef.current) {
      setStatus((prev) => ({ ...prev, granted: false, kicked: true, reason: result.reason }));
      // Stop heartbeat
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [appSlug]);

  const release = useCallback(async () => {
    if (!appSlug) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.rpc("release_app_seat", { _user_id: user.id, _app_slug: appSlug });
  }, [appSlug]);

  useEffect(() => {
    mountedRef.current = true;
    if (appSlug) {
      acquire();
      intervalRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Release seat on unmount (best-effort)
      if (appSlug) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase.rpc("release_app_seat", { _user_id: user.id, _app_slug: appSlug });
          }
        });
      }
    };
  }, [appSlug, acquire, heartbeat]);

  return { ...status, release };
}
