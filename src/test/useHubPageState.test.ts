/**
 * useHubPageState unit tests (sec-fix/A0.5a/c)
 *
 * Documenta el contrato de la discriminated union:
 *
 *   - demoMode=true → { status: "demo" } (bypass de todo, incluso accountId).
 *   - cualquier flag de loading truthy o userId null → { status: "loading" }.
 *   - todo loading falso + userId resuelto + accountId null → { status: "error_no_account" }.
 *   - todo resuelto → { status: "ready" }.
 *
 * sec-fix/A0.5c: el bloque de tests del wrapper deprecated `useHubPageReady`
 * se eliminó junto con el wrapper mismo cuando los 2 callers
 * (HubCasesPage, HubTasksPage) terminaron de migrar.
 */

import { describe, it, expect } from "vitest";
import { useHubPageState } from "@/hooks/useHubPageReady";

describe("useHubPageState — discriminated union", () => {
  describe("demo mode", () => {
    it('returns { status: "demo" } when demoMode=true (no importa accountId/loading)', () => {
      expect(useHubPageState({
        demoMode: true,
        loading: [true, true, true],
        accountId: null,
        userId: null,
      })).toEqual({ status: "demo" });
    });

    it("demo wins even with accountId resolved", () => {
      expect(useHubPageState({
        demoMode: true,
        loading: [],
        accountId: "real-acct",
        userId: "real-user",
      })).toEqual({ status: "demo" });
    });
  });

  describe("loading state", () => {
    it('returns { status: "loading" } when any flag is true', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [false, true, false],
        accountId: "acct-1",
        userId: "user-1",
      })).toEqual({ status: "loading" });
    });

    it('returns { status: "loading" } when userId is null (auth aún resolviendo)', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: "acct-1",
        userId: null,
      })).toEqual({ status: "loading" });
    });

    it("loading wins over error_no_account when userId still null", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: null,
      })).toEqual({ status: "loading" });
    });
  });

  describe("error_no_account state", () => {
    it('returns { status: "error_no_account" } when loading done + userId resolved + accountId null', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [false, false, false],
        accountId: null,
        userId: "user-1",
      })).toEqual({ status: "error_no_account" });
    });

    it("error_no_account fires even with empty loading[] array (no queries pending)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: null,
        userId: "user-1",
      })).toEqual({ status: "error_no_account" });
    });
  });

  describe("ready state", () => {
    it('returns { status: "ready" } when everything resolved and accountId present', () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [false, false, false],
        accountId: "acct-1",
        userId: "user-1",
      })).toEqual({ status: "ready" });
    });

    it("ready with empty loading[] (no async deps configured)", () => {
      expect(useHubPageState({
        demoMode: false,
        loading: [],
        accountId: "acct-1",
        userId: "user-1",
      })).toEqual({ status: "ready" });
    });
  });

  describe("priority ordering (demo > loading > error_no_account > ready)", () => {
    it("demo wins over loading, error, ready", () => {
      const s = useHubPageState({ demoMode: true, loading: [true], accountId: null, userId: null });
      expect(s.status).toBe("demo");
    });
    it("loading wins over error, ready (when not demo)", () => {
      const s = useHubPageState({ demoMode: false, loading: [true], accountId: null, userId: null });
      expect(s.status).toBe("loading");
    });
    it("error wins over ready (when not demo, not loading)", () => {
      const s = useHubPageState({ demoMode: false, loading: [], accountId: null, userId: "u" });
      expect(s.status).toBe("error_no_account");
    });
  });
});

// sec-fix/A0.5c: el bloque "useHubPageReady — backward-compat wrapper
// (deprecated)" (4 tests) se eliminó junto con el wrapper mismo cuando
// HubTasksPage terminó de migrar. La API canónica es useHubPageState.
