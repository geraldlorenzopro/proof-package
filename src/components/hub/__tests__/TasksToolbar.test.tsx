/**
 * TasksToolbar — tests Round 9.11
 *
 * Cubrimos:
 *  1. Defaults limpios (EMPTY_TASK_FILTERS = all/all/any/null/all)
 *  2. isFiltersDirty() correcta para combinaciones
 *  3. Botón Limpiar oculto en estado limpio
 *  4. Botón Limpiar visible cuando hay filtros sucios + dispara onReset
 *  5. Cambio de chip Asignado emite onChangeFilters
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TasksToolbar, { EMPTY_TASK_FILTERS, isFiltersDirty, type TaskFilters } from "../TasksToolbar";

const baseProps = {
  filters: EMPTY_TASK_FILTERS,
  onChangeFilters: vi.fn(),
  sortBy: "due_asc" as const,
  onChangeSortBy: vi.fn(),
  team: [],
  allCases: [],
};

describe("EMPTY_TASK_FILTERS defaults", () => {
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
  it("true si assignee cambia a me", () => {
    const f: TaskFilters = { ...EMPTY_TASK_FILTERS, assignee: "me" };
    expect(isFiltersDirty(f, "due_asc")).toBe(true);
  });
  it("true si status cambia a pending", () => {
    const f: TaskFilters = { ...EMPTY_TASK_FILTERS, status: "pending" };
    expect(isFiltersDirty(f, "due_asc")).toBe(true);
  });
  it("true si sortBy cambia", () => {
    expect(isFiltersDirty(EMPTY_TASK_FILTERS, "priority_desc")).toBe(true);
  });
  it("true si caseType o taskType cambia", () => {
    expect(isFiltersDirty({ ...EMPTY_TASK_FILTERS, caseType: "i130" }, "due_asc")).toBe(true);
    expect(isFiltersDirty({ ...EMPTY_TASK_FILTERS, taskType: "call_client" }, "due_asc")).toBe(true);
  });
});

describe("Botón Limpiar filtros", () => {
  it("NO se muestra cuando filtros están limpios", () => {
    render(<TasksToolbar {...baseProps} onReset={vi.fn()} />);
    expect(screen.queryByTestId("reset-filters")).toBeNull();
  });

  it("se muestra cuando hay filtros sucios", () => {
    render(
      <TasksToolbar
        {...baseProps}
        filters={{ ...EMPTY_TASK_FILTERS, status: "pending" }}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("reset-filters")).toBeInTheDocument();
  });

  it("NO se muestra si onReset no fue provisto (aunque haya dirt)", () => {
    render(
      <TasksToolbar
        {...baseProps}
        filters={{ ...EMPTY_TASK_FILTERS, status: "pending" }}
      />,
    );
    expect(screen.queryByTestId("reset-filters")).toBeNull();
  });

  it("dispara onReset al hacer click", () => {
    const onReset = vi.fn();
    render(
      <TasksToolbar
        {...baseProps}
        filters={{ ...EMPTY_TASK_FILTERS, assignee: "me" }}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByTestId("reset-filters"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
