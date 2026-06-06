/**
 * useNerAccountId unit tests (sec-fix/A0.5d)
 *
 * Documenta el contrato del hook canónico para resolver account_id activo:
 *
 *   - Demo mode → `{ accountId: null, source: "demo", loading: false }`.
 *     EL CAMBIO CLAVE: antes el hook devolvía `DEMO_ACCOUNT_ID` (un sentinel
 *     string que no era UUID válido). Eso replicaba el patrón frágil de
 *     B-1 — un valor controlado por el cliente viajando como param a queries
 *     Supabase, dependiendo de disciplina caller-por-caller para
 *     interceptarlo. Ahora demo es null + source flag; los callers
 *     distinguen demo via `source === "demo"`, no via accountId.
 *
 *   - Cache hit (sessionStorage) → resuelve sincrónico al primer render.
 *
 *   - No cache + no demo → entra en loading inicial, después resuelve a
 *     `none` o `query` según supabase.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Stable mocks ANTES del import del hook bajo test.
const mockUseDemoMode = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/hooks/useDemoData", () => ({
  useDemoMode: () => mockUseDemoMode(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { useNerAccountId, getCachedNerAccountId } from "@/hooks/useNerAccountId";

describe("useNerAccountId", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockUseDemoMode.mockReset();
    mockGetSession.mockReset();
    mockFrom.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("demo mode", () => {
    it("returns { accountId: null, source: 'demo', loading: false } and DOES NOT touch Supabase", () => {
      mockUseDemoMode.mockReturnValue(true);

      const { result } = renderHook(() => useNerAccountId());

      expect(result.current).toEqual({
        accountId: null,
        source: "demo",
        loading: false,
      });
      expect(mockGetSession).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("ignores sessionStorage cache when demo mode is on", () => {
      mockUseDemoMode.mockReturnValue(true);
      sessionStorage.setItem(
        "ner_hub_data",
        JSON.stringify({ account_id: "real-acct-from-cache" })
      );

      const { result } = renderHook(() => useNerAccountId());

      expect(result.current.source).toBe("demo");
      expect(result.current.accountId).toBeNull();
    });
  });

  describe("cache hit (sessionStorage)", () => {
    it("resolves synchronously from sessionStorage['ner_hub_data'].account_id", () => {
      mockUseDemoMode.mockReturnValue(false);
      sessionStorage.setItem(
        "ner_hub_data",
        JSON.stringify({ account_id: "acct-abc-123" })
      );

      const { result } = renderHook(() => useNerAccountId());

      expect(result.current).toEqual({
        accountId: "acct-abc-123",
        source: "cache",
        loading: false,
      });
      expect(mockGetSession).not.toHaveBeenCalled();
    });

    it("treats malformed ner_hub_data as no cache (returns to 'none' branch)", async () => {
      mockUseDemoMode.mockReturnValue(false);
      sessionStorage.setItem("ner_hub_data", "{not valid json");
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => useNerAccountId());

      // Inicial: loading=true porque no hay cache utilizable.
      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe("none");
      expect(result.current.accountId).toBeNull();
    });

    it("treats ner_hub_data without account_id field as no cache", async () => {
      mockUseDemoMode.mockReturnValue(false);
      sessionStorage.setItem(
        "ner_hub_data",
        JSON.stringify({ unrelated_field: "x" })
      );
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => useNerAccountId());

      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe("none");
    });
  });

  describe("no cache + no demo → supabase fallback", () => {
    it("returns 'none' when no session", async () => {
      mockUseDemoMode.mockReturnValue(false);
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => useNerAccountId());

      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe("none");
      expect(result.current.accountId).toBeNull();
    });

    it("returns 'query' with account_id when session + account_members row exists", async () => {
      mockUseDemoMode.mockReturnValue(false);
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
      });

      // Chain: supabase.from("account_members").select(...).eq(...).eq(...).limit(...).maybeSingle()
      const maybeSingleResult = Promise.resolve({
        data: { account_id: "acct-from-query" },
      });
      const chainTerminator = { maybeSingle: () => maybeSingleResult };
      const limitFn = () => chainTerminator;
      const eqFn2 = () => ({ limit: limitFn });
      const eqFn1 = () => ({ eq: eqFn2 });
      const selectFn = () => ({ eq: eqFn1 });
      mockFrom.mockReturnValue({ select: selectFn });

      const { result } = renderHook(() => useNerAccountId());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe("query");
      expect(result.current.accountId).toBe("acct-from-query");
    });

    it("returns 'none' when session exists but no account_members row", async () => {
      mockUseDemoMode.mockReturnValue(false);
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
      });

      const maybeSingleResult = Promise.resolve({ data: null });
      const chainTerminator = { maybeSingle: () => maybeSingleResult };
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({ eq: () => ({ limit: () => chainTerminator }) }),
        }),
      });

      const { result } = renderHook(() => useNerAccountId());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.source).toBe("none");
      expect(result.current.accountId).toBeNull();
    });
  });
});

describe("getCachedNerAccountId (synchronous helper for non-React modules)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns the cached account_id when present", () => {
    sessionStorage.setItem(
      "ner_hub_data",
      JSON.stringify({ account_id: "acct-sync-1" })
    );
    expect(getCachedNerAccountId()).toBe("acct-sync-1");
  });

  it("returns null when sessionStorage is empty", () => {
    expect(getCachedNerAccountId()).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    sessionStorage.setItem("ner_hub_data", "{not valid");
    expect(getCachedNerAccountId()).toBeNull();
  });

  it("returns null when account_id is not a string", () => {
    sessionStorage.setItem(
      "ner_hub_data",
      JSON.stringify({ account_id: 42 })
    );
    expect(getCachedNerAccountId()).toBeNull();
  });
});

/**
 * Regression guard: NO debe existir un export `DEMO_ACCOUNT_ID` ni
 * `isDemoAccountId` desde el hook. Esos eran el patrón del sentinel string
 * que A0.5d eliminó. Si alguien los reintroduce, el test falla.
 */
describe("sec-fix/A0.5d regression guard — no sentinel string exports", () => {
  it("does not export DEMO_ACCOUNT_ID nor isDemoAccountId", async () => {
    const mod: Record<string, unknown> = await import("@/hooks/useNerAccountId");
    expect(mod.DEMO_ACCOUNT_ID).toBeUndefined();
    expect(mod.isDemoAccountId).toBeUndefined();
  });
});
