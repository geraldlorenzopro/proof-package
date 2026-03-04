import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Occupant {
  user_id: string;
  display_name: string;
  since: string;
}

interface SeatStatus {
  granted: boolean;
  sessionId?: string;
  reason?: string;
  loading: boolean;
  kicked: boolean;
  /** When seats are full, contains info about who to kick */
  pendingKick?: {
    occupants: Occupant[];
    maxSeats: number;
  } | null;
}

const HEARTBEAT_INTERVAL = 30_000; // 30s

/**
 * Hook that acquires a seat for the given app slug on mount,
 * sends heartbeats, and detects if the user gets kicked.
 * 
 * When seats are full, sets pendingKick with occupant info.
 * Call confirmKick() to proceed or cancelKick() to back out.
 */
export function useAppSeat(appSlug: string | null): SeatStatus & {
  release: () => void;
  confirmKick: () => void;
  cancelKick: () => void;
} {
  const [status, setStatus] = useState<SeatStatus>({
    granted: false,
    loading: true,
    kicked: false,
    pendingKick: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const checkAndAcquire = useCallback(async () => {
    if (!appSlug) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus({ granted: false, loading: false, kicked: false, reason: "not_authenticated", pendingKick: null });
      return;
    }

    // First, check seat status without acquiring
    const { data: checkData, error: checkErr } = await supabase.rpc("check_app_seat_status" as any, {
      _user_id: user.id,
      _app_slug: appSlug,
    });

    if (checkErr || !checkData) {
      console.warn("[useAppSeat] check error:", checkErr);
      // Fallback: try direct acquire
      await directAcquire(user.id);
      return;
    }

    const check = checkData as unknown as {
      status: string;
      max_seats?: number;
      active?: number;
      occupants?: Occupant[];
    };

    if (check.status === "full" && check.occupants && check.occupants.length > 0) {
      // Seats are full — ask user for confirmation before kicking
      if (mountedRef.current) {
        setStatus({
          granted: false,
          loading: false,
          kicked: false,
          reason: "seats_full",
          pendingKick: {
            occupants: check.occupants,
            maxSeats: check.max_seats || 1,
          },
        });
      }
      return;
    }

    // Available, already_active, or unlimited — proceed with acquire
    await directAcquire(user.id);
  }, [appSlug]);

  const directAcquire = useCallback(async (userId: string) => {
    if (!appSlug) return;

    const { data, error } = await supabase.rpc("acquire_app_seat", {
      _user_id: userId,
      _app_slug: appSlug,
    });

    if (error || !data) {
      console.warn("[useAppSeat] acquire error:", error);
      setStatus({ granted: true, loading: false, kicked: false, reason: "fallback", pendingKick: null });
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
        pendingKick: null,
      });

      // Start heartbeat if granted
      if (result.granted && !intervalRef.current) {
        intervalRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);
      }
    }
  }, [appSlug]);

  const confirmKick = useCallback(async () => {
    if (!appSlug) return;
    setStatus(prev => ({ ...prev, loading: true, pendingKick: null }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await directAcquire(user.id);
  }, [appSlug, directAcquire]);

  const cancelKick = useCallback(() => {
    setStatus({
      granted: false,
      loading: false,
      kicked: false,
      reason: "user_cancelled",
      pendingKick: null,
    });
  }, []);

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
      setStatus((prev) => ({ ...prev, granted: false, kicked: true, reason: result.reason, pendingKick: null }));
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

  // Realtime subscription to detect instant kicks
  useEffect(() => {
    if (!appSlug) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`seat-${appSlug}-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'app_active_sessions',
          },
          (payload) => {
            // If the deleted row belongs to this user, they got kicked
            const old = payload.old as { user_id?: string };
            if (old.user_id === user.id && mountedRef.current) {
              setStatus(prev => ({ ...prev, granted: false, kicked: true, reason: 'kicked', pendingKick: null }));
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [appSlug]);

  useEffect(() => {
    mountedRef.current = true;
    if (appSlug) {
      checkAndAcquire();
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (appSlug) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase.rpc("release_app_seat", { _user_id: user.id, _app_slug: appSlug });
          }
        });
      }
    };
  }, [appSlug, checkAndAcquire]);

  return { ...status, release, confirmKick, cancelKick };
}
