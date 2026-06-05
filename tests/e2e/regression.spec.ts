/**
 * regression.spec.ts — Tests assertion-based para los 6 bug patterns
 * que el equipo (Marcus + Valerie + Victoria) identificó como recurrentes.
 *
 * NO usa screenshots — usa assertions sobre DOM + style + textContent.
 * Más rápido que visual diff, catch específico de cada pattern conocido.
 *
 * Si un assertion falla → significa que volvimos a meter el bug que
 * Mr. Lorenzo ya cazó antes. CI bloquea el merge.
 *
 * Lecciones referenciadas en cada test:
 *   - R9.8: tabs apiladas (Tailwind JIT dynamic class)
 *   - R9.8: filtros default trampa
 *   - R9.8: counter ≠ render (doble-gate tab/filter)
 *   - R9.7: chips truncadas sin tooltip
 *   - R9.6: GroupHeader icon flotando
 *   - R9.9: TaskCreateModal demo no inyecta
 *   - R9.10: guards accountId antes del isDemoMode branch
 */
import { test, expect } from "@playwright/test";

const DEMO_HUB_CASES = "/hub/cases?demo=true";
const DEMO_HUB_TASKS = "/hub/tasks?demo=true";

test.describe("Pattern 1 — Tailwind JIT dynamic class never collapses layout", () => {
  test("CaseViewTabs render horizontalmente (no apiladas)", async ({ page }) => {
    await page.goto(DEMO_HUB_CASES);
    await page.waitForLoadState("networkidle");

    // R9.13 fix: el selector anterior `'div'` agarraba el wrapper de la página
    // entera (1440x900) — falso negativo. Ahora medimos las tabs individuales:
    // si "Mis casos" y "Todos" están en la misma fila (Y idéntico) y separadas
    // horizontalmente (X muy distinto), las tabs son horizontales. Si estuvieran
    // apiladas, Y diferiría >50px.
    const misCasos = page.getByRole("button", { name: /MIS CASOS/i }).first();
    const todos = page.getByRole("button", { name: /TODOS/i }).first();

    const boxMis = await misCasos.boundingBox();
    const boxTodos = await todos.boundingBox();
    expect(boxMis).not.toBeNull();
    expect(boxTodos).not.toBeNull();

    if (boxMis && boxTodos) {
      expect(Math.abs(boxMis.y - boxTodos.y)).toBeLessThan(5);
      expect(Math.abs(boxMis.x - boxTodos.x)).toBeGreaterThan(100);
    }
  });

  test("TaskViewTabs render horizontalmente", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.waitForLoadState("networkidle");
    const hoy = page.getByRole("button", { name: /HOY/i }).first();
    const todas = page.getByRole("button", { name: /TODAS/i }).first();

    const boxHoy = await hoy.boundingBox();
    const boxTodas = await todas.boundingBox();
    expect(boxHoy).not.toBeNull();
    expect(boxTodas).not.toBeNull();

    if (boxHoy && boxTodas) {
      expect(Math.abs(boxHoy.y - boxTodas.y)).toBeLessThan(5);
      expect(Math.abs(boxHoy.x - boxTodas.x)).toBeGreaterThan(50);
    }
  });
});

test.describe("Pattern 2 — Counter ↔ render parity (no doble-gate)", () => {
  test("/hub/tasks counter de tab TODAS = filas renderizadas", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.waitForLoadState("networkidle");

    // Click tab "TODAS"
    await page.getByRole("button", { name: /TODAS/i }).first().click();
    await page.waitForTimeout(300);

    // Counter en topbar: "N tareas en esta vista"
    const topbarText = await page.getByText(/tareas? en esta vista/).first().textContent();
    const counterMatch = topbarText?.match(/(\d+)\s+tareas?\s+en\s+esta\s+vista/i);
    expect(counterMatch).not.toBeNull();
    const counterFromTopbar = Number(counterMatch?.[1] || 0);

    // Counter de la tab "TODAS" (número grande en la pill)
    const todasButton = page.getByRole("button", { name: /TODAS/i }).first();
    const counterFromTab = Number(await todasButton.locator(".tabular-nums").textContent());

    expect(counterFromTab).toBe(counterFromTopbar);
  });
});

test.describe("Pattern 3 — Filtros default neutrales (no trap)", () => {
  test("Chip 'Asignado' default debe verse NEUTRAL (no púrpura)", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.waitForLoadState("networkidle");

    // Clear localStorage para asegurar defaults frescos
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");

    const assigneeChip = page.getByRole("combobox").filter({ hasText: /Todas las tareas/i }).first();
    const className = await assigneeChip.getAttribute("class");
    // Default = no purple
    expect(className).not.toContain("purple");
    expect(className).toContain("border-white");
  });

  test("Chip 'Estado' default debe verse NEUTRAL (no amber)", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");

    const statusChip = page.getByRole("combobox").filter({ hasText: /Todos los estados/i }).first();
    const className = await statusChip.getAttribute("class");
    expect(className).not.toContain("amber");
    expect(className).toContain("border-white");
  });
});

test.describe("Pattern 4 — Truncate exige tooltip", () => {
  test("Chips truncadas en CaseTable tienen tooltip Radix wrapper", async ({ page }) => {
    await page.goto(DEMO_HUB_CASES);
    await page.waitForLoadState("networkidle");

    // Encontrar el primer chip Tipo de proceso
    const firstChip = page.locator('button:has-text("·")').first();
    await firstChip.hover();
    await page.waitForTimeout(500);

    // Tooltip Radix renderiza con [role=tooltip]
    const tooltip = page.getByRole("tooltip").first();
    await expect(tooltip).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Pattern 5 — Empty state diagnostico + Limpiar filtros", () => {
  test("Filtro caseType que no matchea muestra mensaje + CTA Limpiar", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Setear filtro Tipo de tarea a uno que NO matchee (court_filing)
    const taskTypeChip = page.getByRole("combobox").filter({ hasText: /Todos los tipos/i }).last();
    await taskTypeChip.click();
    await page.getByRole("option", { name: /Filing en corte/i }).click();
    await page.waitForTimeout(300);

    // Empty state debe aparecer
    await expect(page.getByText(/pero ninguna calza con los filtros/i)).toBeVisible();

    // R9.13 fix: Lovable agregó otro botón "Limpiar filtros" en el toolbar
    // (data-testid="reset-filters") como pieza del Round 9.11. Ahora existen
    // 2 botones con el mismo accessible name → strict mode violation. El del
    // empty state es el que viene CON texto visible (el del toolbar solo
    // tiene aria-label + icon). `getByText` matchea solo texto visible.
    const clearBtn = page.getByText("Limpiar filtros", { exact: true });
    await expect(clearBtn).toBeVisible();

    // Click → reset funciona
    await clearBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/pero ninguna calza con los filtros/i)).not.toBeVisible();
  });
});

test.describe("Pattern 6 — TaskCreateModal demo inyecta + no aborta por accountId", () => {
  test("Crear tarea en demo NO muestra 'Sin cuenta activa'", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Nueva tarea/i }).click();
    await page.waitForTimeout(500);

    // R9.13 fix: scope al modal dialog para evitar matches ambiguos.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Llenar título
    await dialog.getByPlaceholder(/título|qué hay que hacer/i).fill("Test smoke task");

    // Seleccionar primer caso del autocomplete
    const caseInput = dialog.getByPlaceholder(/buscar.*caso/i);
    if (await caseInput.count() > 0) {
      await caseInput.click();
      await page.waitForTimeout(300);
      await page.locator("[role=option], button").filter({ hasText: /García|Rodríguez|Hernández/ }).first().click();
    }

    // R9.13 fix: el regex anterior `^Crear$|^Guardar$` exigía match exacto.
    // El botón real dice "Crear tarea". Scopeado al dialog + regex permisivo.
    await dialog.getByRole("button", { name: /Crear/i }).last().click();
    await page.waitForTimeout(500);

    // NO debe aparecer toast "Sin cuenta activa"
    await expect(page.getByText(/Sin cuenta activa/i)).not.toBeVisible();
    // Debe aparecer toast "Tarea creada"
    await expect(page.getByText(/Tarea creada/i)).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Pattern 7 — Buckets vacíos ocultos cuando el tab no los necesita (R9.12)", () => {
  test("Atrasadas: solo muestra 'Vencidas' (oculta Hoy/Mañana/Esta semana vacíos)", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /ATRASADAS/i }).first().click();
    await page.waitForTimeout(400);

    await expect(page.getByRole("heading", { level: 3, name: "Vencidas" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Hoy" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Mañana" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Esta semana" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Más adelante" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Sin fecha" })).toHaveCount(0);
  });

  test("RFE Response: oculta 'Más adelante' y 'Sin fecha' si están vacíos", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /RFE/i }).first().click();
    await page.waitForTimeout(400);

    // "Más adelante" y "Sin fecha" no deben aparecer en RFE Response
    await expect(page.getByRole("heading", { level: 3, name: "Más adelante" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Sin fecha" })).toHaveCount(0);
  });

  test("Todas: 'Hoy' siempre visible aunque esté vacío (informativo)", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(400);

    // En tab Todas todos los buckets relevantes se muestran siempre
    await expect(page.getByRole("heading", { level: 3, name: "Hoy" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Vencidas" })).toBeVisible();
  });

  test("Hoy: solo muestra bucket 'Hoy' (oculta el resto vacíos)", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /^HOY/i }).first().click();
    await page.waitForTimeout(400);

    await expect(page.getByRole("heading", { level: 3, name: "Vencidas" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Mañana" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Esta semana" })).toHaveCount(0);
  });
});
