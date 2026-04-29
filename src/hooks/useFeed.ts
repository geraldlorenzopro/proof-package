/**
 * useFeed — hook que consume el edge function feed-builder.
 *
 * Cache 30s vía React Query — alineado con el TTL del cache server-side.
 * Refetch on window focus para que cuando la paralegal vuelve a la pestaña
 * vea data fresca.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FeedResponse } from "@/types/feed";

const FEED_FUNCTION_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feed-builder`;

async function fetchFeed(accountId: string | null): Promise<FeedResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No hay sesión activa");
  }

  const resp = await fetch(FEED_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(accountId ? { account_id: accountId } : {}),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`feed-builder ${resp.status}: ${body}`);
  }

  return resp.json();
}

/**
 * Hook principal del feed.
 *
 * @param accountId - opcional, si se pasa fuerza ese account.
 *   Si no, el edge function resuelve el account activo del usuario.
 */
export function useFeed(accountId: string | null = null) {
  return useQuery<FeedResponse, Error>({
    queryKey: ["feed", accountId],
    queryFn: () => fetchFeed(accountId),
    staleTime: 30 * 1000, // 30s — alineado con cache server-side
    refetchInterval: 60 * 1000, // refetch cada 1 min en background
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
