// @vitest-environment node
/**
 * TasksToolbar logic tests — Round 9.11
 *
 * Cobertura: defaults limpios + isFiltersDirty. Tests de DOM/render
 * se evitan acá porque la sandbox jsdom no levanta canvas; el botón
 * Limpiar se valida via Playwright/E2E sobre el preview real.
 */
import { describe, it, expect } from "vitest";
import { EMPTY_TASK_FILTERS, isFiltersDirty, type TaskFilters } from "../TasksToolbar";

describe("EMPTY_TASK_FILTERS defaults (Round 9.11 limpieza)", () => {
  it("entra limpio en todos los ejes", () => {
    expect(EMPTY_TASK_FILTERS).toEqual({
      assignee: "all",
      status: "all",
      due: "any",
      dueRangeFrom: null,
      dueRangeTo: null,
      caseType: null,
      taskType: "all",
    });
  });
});

describe("isFiltersDirty", () => {
  it("false con defaults completos", () => {
    expect(isFiltersDirty(EMPTY_TASK_FILTERS, "due_asc")).toBe(false);
  });

  it("true si assignee cambia a me/team/unassigned", () => {
    (["me", "team", "unassigned"] as const).forEach(a => {
      const f: TaskFilters = { ...EMPTY_TASK_FILTERS, assignee: a };
      expect(isFiltersDirty(f, "due_asc")).toBe(true);
    });
  });

  it("true si status cambia a pending/completed/snoozed", () => {
    (["pending", "completed", "snoozed"] as const).forEach(s => {
      const f: TaskFilters = { ...EMPTY_TASK_FILTERS, status: s };
      expect(isFiltersDirty(f, "due_asc")).toBe(true);
    });
  });

  it("true si due cambia (today/this_week/custom)", () => {
    (["today", "this_week", "custom"] as const).forEach(d => {
      const f: TaskFilters = { ...EMPTY_TASK_FILTERS, due: d };
      expect(isFiltersDirty(f, "due_asc")).toBe(true);
    });
  });

  it("true si caseType o taskType cambia", () => {
    expect(isFiltersDirty({ ...EMPTY_TASK_FILTERS, caseType: "i130" }, "due_asc")).toBe(true);
    expect(isFiltersDirty({ ...EMPTY_TASK_FILTERS, taskType: "call_client" }, "due_asc")).toBe(true);
  });

  it("true si sortBy cambia", () => {
    expect(isFiltersDirty(EMPTY_TASK_FILTERS, "priority_desc")).toBe(true);
    expect(isFiltersDirty(EMPTY_TASK_FILTERS, "created_desc")).toBe(true);
  });
});
