/**
 * useHubPageState unit tests (sec-fix/A0.5a/c/e)
 *
 * Documenta el contrato de la discriminated union:
 *
 *   - demoMode=true → { status: "demo" } (bypass de todo, incluso accountId).
 *   - !authReady o cualquier flag de loading truthy → { status: "loading" }.
 *   - authReady=true + accountId=null → { status: "error_no_account" }.
 *   - authReady=true + accountId presente → { status: "ready" }.
 *
 * sec-fix/A0.5e: agregado `authReady`. Antes este bloque colapsaba
 * "auth en vuelo (no llamamos getUser aún)" con "auth resolvió devolviendo
 * null (sin sesión)". El hook quedaba en `loading` permanente y
 * `SessionExpiredView` nunca se renderizaba. Pattern 12 E2E lo cazó.
 *
 * sec-fix/A0.5c: el bloque de tests del wrapper deprecated `useHubPageReady`
 * se eliminó junto con el wrapper mismo cuando los 2 callers
 * (HubCasesPage, HubTasksPage) terminaron de migrar.
 */

import { describe, it, expect } from "vitest";
import { useHubPageState } from "@/hooks/useHubPageReady";

describe("useHubPageState — discriminated union", () => {
  describe("demo mode", () => {
    it('returns { status: "demo" } when demoMode=true (gana sobre todo, incluso !authReady)', () => {
      expect(useHubPageState({
        demoMode: true,
        loading: [true, true, true],
        accountId: null,
        userId: null,
        authReady: false,
      })).toEqual({ status: "demo" });
    });

    it("demo wins even with accountId + userId + authReady resueltos", () => {
      expect(useHubPageState({
        demoMode: true,
        loading: [],
        accountId: "real-acct",
        userId: "real-user",
        authReady: true,
      })).toEqual({ status: "demo" });
    });
  });

  describe("loading state", () => {
    it('returns { status: "loading" } when authReady=false (auth en vuelo)', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
        authReady: false,
      })).toEqual({ status: "loading" });
    });

    it('returns { status: "loading" } when alguna flag de loading es true (auth ya resolvió)', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [false, true, false],
        accountId: "acct-1",
        userId: "user-1",
        authReady: true,
      })).toEqual({ status: "loading" });
    });

    it("loading wins over error_no_account when authReady=false (no distinguimos aún)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
        authReady: false,
      })).toEqual({ status: "loading" });
    });
  });

  describe("error_no_account state (sec-fix/A0.5e — caso crítico de Pattern 12)", () => {
    /**
     * Este es el caso que Pattern 12 E2E simula: paralegal sin sesión visita
     * /hub/cases o /hub/tasks. supabase.auth.getUser() resuelve devolviendo
     * `null`, sessionStorage["ner_hub_data"] no existe, accountId queda null.
     * El hook debe entrar a `error_no_account` para que la página renderice
     * <SessionExpiredView /> en vez de quedarse en skeleton infinito.
     */
    it('authReady=true + accountId=null + userId=null → { status: "error_no_account" }', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [false, false, false],
        accountId: null,
        userId: null,
        authReady: true,
      })).toEqual({ status: "error_no_account" });
    });

    it("error_no_account fires even with userId resolved (account_members query returned nothing)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: "user-1",
        authReady: true,
      })).toEqual({ status: "error_no_account" });
    });

    it("error_no_account fires with empty loading[] array (no queries configuradas)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
        authReady: true,
      })).toEqual({ status: "error_no_account" });
    });
  });

  describe("ready state", () => {
    it('returns { status: "ready" } when authReady + accountId + userId + all loading false', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [false, false, false],
        accountId: "acct-1",
        userId: "user-1",
        authReady: true,
      })).toEqual({ status: "ready" });
    });

    it("ready with empty loading[] (no async deps)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: "acct-1",
        userId: "user-1",
        authReady: true,
      })).toEqual({ status: "ready" });
    });
  });

  describe("priority ordering (demo > loading > error_no_account > ready)", () => {
    it("demo wins over loading, error, ready", () => {
      const s = useHubPageState({
        demoMode: true,
        loading: [true],
        accountId: null,
        userId: null,
        authReady: false,
      });
      expect(s.status).toBe("demo");
    });

    it("loading wins over error, ready (when not demo)", () => {
      const s = useHubPageState({
        demoMode: false,
        loading: [true],
        accountId: null,
        userId: null,
        authReady: true,
      });
      expect(s.status).toBe("loading");
    });

    it("!authReady puts in loading even if accountId would be null (auth en vuelo)", () => {
      const s = useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
        authReady: false,
      });
      expect(s.status).toBe("loading");
    });

    it("error wins over ready (when not demo, not loading)", () => {
      const s = useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: "u",
        authReady: true,
      });
      expect(s.status).toBe("error_no_account");
    });
  });

  describe("sec-fix/A0.5e regression guard — distinción authReady vs userId null", () => {
    /**
     * El bug que Pattern 12 cazó:
     *   - userId=null (auth en vuelo) producía `loading` ✅
     *   - userId=null (auth resolvió sin sesión) producía `loading` ❌
     *     (debería ser error_no_account).
     *
     * Estos 2 tests anclan que los 2 casos ahora se distinguen via authReady.
     */
    it("auth en vuelo (authReady=false, userId=null) → loading", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
        authReady: false,
      }).status).toBe("loading");
    });

    it("auth resolvió sin sesión (authReady=true, userId=null, accountId=null) → error_no_account (NO loading)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
        authReady: true,
      }).status).toBe("error_no_account");
    });
  });
});

// sec-fix/A0.5c: el bloque "useHubPageReady — backward-compat wrapper
// (deprecated)" (4 tests) se eliminó junto con el wrapper mismo cuando
// HubTasksPage terminó de migrar. La API canónica es useHubPageState.
