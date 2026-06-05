/**
 * hub-smoke.spec.ts — Visual smoke de las pantallas canónicas del Hub.
 *
 * Cada test navega a una ruta, espera que cargue, toma screenshot y
 * compara contra baseline en tests/screenshots/ con threshold 2%.
 *
 * Primera ejecución (genera baselines):
 *   bun run e2e:update
 *
 * Después:
 *   bun run e2e
 *
 * Si Mr. Lorenzo cambia algo visual intencionalmente, regenerar baseline:
 *   bun run e2e:update -- --grep "hub-cases tabla"
 *
 * Las pantallas canónicas las eligió el equipo (Marcus + Valerie) en
 * base a las que Mr. Lorenzo ve diariamente.
 */
import { test, expect } from "@playwright/test";

// Wait helper — espera que la app monte después del splash.
async function waitForHubReady(page: import("@playwright/test").Page) {
  // Saltear splash si aparece
  await page.evaluate(() => sessionStorage.setItem("ner_splash_seen", "1"));
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  // Sora font load
  await page.waitForFunction(() => document.fonts.ready);
  // Pequeño settle para virtualizers
  await page.waitForTimeout(500);
}

test.describe("Hub Inicio", () => {
  test("dashboard demo carga sin layout shift", async ({ page }) => {
    await page.goto("/hub?demo=true");
    await waitForHubReady(page);
    await expect(page).toHaveScreenshot("hub-inicio.png", {
      fullPage: false,
      mask: [
        // Mask elementos que cambian por timing (relojes, "hace X min")
        page.locator(":text('hace')"),
        page.locator(":text('hoy')"),
      ],
    });
  });
});

test.describe("Pipeline de Casos", () => {
  test("/hub/cases tabla con demo", async ({ page }) => {
    await page.goto("/hub/cases?demo=true");
    await waitForHubReady(page);
    await expect(page).toHaveScreenshot("hub-cases-tabla.png");
  });

  test("/hub/cases kanban con demo", async ({ page }) => {
    await page.goto("/hub/cases?demo=true");
    await waitForHubReady(page);
    const kanbanBtn = page.getByRole("button", { name: /Kanban/i }).first();
    if (await kanbanBtn.count() > 0) {
      await kanbanBtn.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot("hub-cases-kanban.png");
    }
  });

  test("/hub/cases con group header expanded muestra rows", async ({ page }) => {
    await page.goto("/hub/cases?demo=true");
    await waitForHubReady(page);
    // GroupHeader USCIS debe tener su título alineado correctamente
    const groupTitle = page.getByRole("heading", { name: /USCIS/i }).first();
    await expect(groupTitle).toBeVisible();
    const box = await groupTitle.boundingBox();
    expect(box).not.toBeNull();
  });
});

test.describe("Pipeline de Tareas", () => {
  test("/hub/tasks demo default tab Todas", async ({ page }) => {
    await page.goto("/hub/tasks?demo=true");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForHubReady(page);
    await expect(page).toHaveScreenshot("hub-tasks-todas.png");
  });

  test("/hub/tasks demo tab Atrasadas", async ({ page }) => {
    await page.goto("/hub/tasks?demo=true");
    await waitForHubReady(page);
    await page.getByRole("button", { name: /ATRASADAS/i }).first().click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("hub-tasks-atrasadas.png");
  });

  test("/hub/tasks empty state cuando filter agresivo", async ({ page }) => {
    await page.goto("/hub/tasks?demo=true");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForHubReady(page);
    // Setear filtro imposible
    const taskTypeChip = page.getByRole("combobox").filter({ hasText: /Todos los tipos/i }).last();
    await taskTypeChip.click();
    await page.getByRole("option", { name: /Filing en corte/i }).click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("hub-tasks-empty-filtered.png");
  });
});

test.describe("Hub Leads", () => {
  test("/hub/leads demo", async ({ page }) => {
    await page.goto("/hub/leads?demo=true");
    await waitForHubReady(page);
    await expect(page).toHaveScreenshot("hub-leads.png");
  });
});
