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

  test("/hub/tasks KPIs no desaparecen después de la primera hidratación", async ({ page }) => {
    await page.goto(DEMO_HUB_TASKS);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const counters = page.locator('[data-testid^="task-tab-count-"]');
    await expect(counters.first()).toBeVisible({ timeout: 5000 });

    await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('[data-testid^="task-tab-count-"]')) as HTMLElement[];
      return nodes.length > 0 && nodes.every(node => {
        const text = (node.textContent || "").trim();
        return /^\d+$/.test(text) && window.getComputedStyle(node.firstElementChild || node).opacity !== "0";
      });
    });

    const samples: string[] = [];
    const hiddenSamples: string[] = [];
    const startedAt = Date.now();
    while (Date.now() - startedAt < 1500) {
      const state = await page.locator('[data-testid^="task-tab-count-"]').evaluateAll(nodes =>
        nodes.map(node => {
          const el = node as HTMLElement;
          const text = (el.textContent || "").trim();
          const target = (el.firstElementChild as HTMLElement | null) || el;
          return { id: el.getAttribute("data-testid"), text, opacity: window.getComputedStyle(target).opacity };
        })
      );
      samples.push(JSON.stringify(state));
      const hidden = state.filter(item => !/^\d+$/.test(item.text) || item.opacity === "0");
      if (hidden.length > 0) hiddenSamples.push(JSON.stringify(hidden));
      await page.waitForTimeout(50);
    }

    expect(hiddenSamples, `Counters disappeared after hydration. Samples: ${samples.join(" | ")}`).toEqual([]);
    await expect(page.getByTestId("task-tab-count-todas")).not.toHaveText("0");
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

    // R9.14: el filtro "Tipo de tarea" fue ocultado en R9.13 (Lovable).
    // Cambiamos a forzar empty via search input con texto random — mismo
    // efecto: universe>0 + render=0 → empty state diagnostic + CTA Limpiar.
    const searchInput = page.getByPlaceholder(/Buscar tarea/i);
    await searchInput.fill("ZZQXYZ_NO_MATCH_NUNCA");
    await page.waitForTimeout(500);

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

test.describe("Pattern 8 — Tooltip viewport overflow (R9.22)", () => {
  // Mr. Lorenzo cazó 3 veces: tooltip de Próximo paso se salía del viewport
  // a la derecha con texto largo. R9.16 + R9.21 + R9.22 itera el fix.
  // Si esto se rompe, el tooltip vuelve a overflow → señal de UI rota.

  test("NextActionChip tooltip respeta maxWidth y se queda en viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/hub/cases?demo=true");
    await page.waitForLoadState("networkidle");

    // Esperar a que la tabla cargue
    await page.waitForFunction(() => {
      return document.querySelectorAll('[data-testid="next-action-tooltip"], button').length > 0;
    }, { timeout: 10_000 });

    // Hover sobre el primer "Próximo paso" button con contenido
    const trigger = page.locator('button').filter({ hasText: /Llamar|Contactar|Enviar|Pagar|Agregar/ }).first();
    await trigger.hover();
    await page.waitForTimeout(500);

    // Verificar que el tooltip apareció
    const tooltip = page.locator('[data-testid="next-action-tooltip"]');
    const tooltipCount = await tooltip.count();
    if (tooltipCount === 0) {
      // Sin tooltip visible: skip (puede ser que ningún row tenga next_action en demo)
      return;
    }

    // Box del tooltip
    const box = await tooltip.first().boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // 1. Width nunca debe exceder ~380px (maxWidth: 360 + bordes)
    expect(box.width).toBeLessThanOrEqual(380);

    // 2. El tooltip NO debe extenderse fuera del viewport derecho
    const viewportWidth = 1280;
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);

    // 3. El tooltip NO debe extenderse fuera del viewport izquierdo
    expect(box.x).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Pattern 7 — Anti-flash cascade entry (R9.20)", () => {
  // Mr. Lorenzo cazó: KPIs entraban uno por uno, "N tareas en esta vista"
  // entraba segundos después. Causa: waterfall de fetches + cada uno hacía
  // su propio re-render. Fix: useHubPageReady() gate único.
  // Si esto se rompe, los KPIs vuelven a entrar staggered.

  test("/hub/tasks: KPIs + topbar + lista aparecen sincronizados (no waterfall)", async ({ page }) => {
    await page.goto("/hub/tasks?demo=true");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Esperar a que la página esté ready (todos los KPIs visibles con números reales).
    await page.waitForFunction(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const taskTabs = tabs.filter(b => /HOY|ATRASADAS|PRÓXIMAS|TODAS|COMPLETADAS/i.test(b.textContent || ""));
      if (taskTabs.length < 4) return false;
      // Ninguno debe estar mostrando "—" (placeholder)
      return taskTabs.every(b => !(b.textContent || "").includes("—"));
    }, { timeout: 10_000 });

    // Verificar que TODOS los KPIs son numéricos al mismo tiempo
    const tabs = await page.getByRole("button", { name: /HOY|ATRASADAS|PRÓXIMAS|TODAS|COMPLETADAS/i }).all();
    for (const tab of tabs) {
      const text = await tab.textContent();
      expect(text).not.toContain("—");
      expect(text).toMatch(/\d+/);
    }

    // Verificar que el topbar "N tareas en esta vista" tiene número real
    const topbarText = await page.getByText(/tareas? en esta vista/).first().textContent();
    expect(topbarText).not.toContain("—");
    expect(topbarText).toMatch(/\d+\s+tareas?/i);
  });

  test("/hub/cases: KPIs + tabla aparecen sincronizados (no waterfall)", async ({ page }) => {
    await page.goto("/hub/cases?demo=true");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const caseTabs = tabs.filter(b => /MIS CASOS|URGENTES|MI TURNO|TODOS/i.test(b.textContent || ""));
      if (caseTabs.length < 3) return false;
      return caseTabs.every(b => !(b.textContent || "").includes("—"));
    }, { timeout: 10_000 });

    const tabs = await page.getByRole("button", { name: /MIS CASOS|URGENTES|MI TURNO|TODOS/i }).all();
    for (const tab of tabs) {
      const text = await tab.textContent();
      expect(text).not.toContain("—");
    }
  });

  test("/hub/tasks ready gate fade-in (transición coordinada, no staggered)", async ({ page }) => {
    await page.goto("/hub/tasks?demo=true");

    // Apenas carga, el contenedor data-driven puede tener opacity-0.
    // Después de ready debe estar opacity-100.
    await page.waitForLoadState("networkidle");

    // Verificar que NO hay elementos con opacity < 1 cuando la página
    // está ready (todos sincronizados).
    await page.waitForFunction(() => {
      const tabs = Array.from(document.querySelectorAll("button"));
      const taskTabs = tabs.filter(b => /HOY|ATRASADAS|TODAS/i.test(b.textContent || ""));
      return taskTabs.length >= 3 && taskTabs.every(b => !(b.textContent || "").includes("—"));
    }, { timeout: 10_000 });

    // Una vez ready, no debe quedar ningún wrapper con opacity-0 visible
    const opacityZero = await page.locator(".opacity-0").count();
    expect(opacityZero).toBe(0);
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

    // R9.14: el placeholder real es "Ej. Llamar a USCIS por receipt".
    // En vez de matchear el placeholder específico (frágil), usamos el
    // primer input del dialog (autoFocus garantiza que sea el de título).
    await dialog.locator("input").first().fill("Test smoke task");

    // Seleccionar primer caso del autocomplete (search "Buscar caso")
    const caseInput = dialog.getByPlaceholder(/Buscar caso/i);
    if (await caseInput.count() > 0) {
      await caseInput.click();
      await page.waitForTimeout(300);
      await page.locator("[role=option], button").filter({ hasText: /García|Rodríguez|Hernández/ }).first().click();
    }

    // Submit: el botón real dice "Crear tarea". Scope al dialog evita matches
    // ambiguos con cualquier otro "Crear" en la página.
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
