/**
 * Playwright config — NER Immigration AI E2E smoke
 *
 * Filosofía (Sprint A locked 2026-06-06):
 *   - Smoke = barrido rápido de las 5-8 pantallas canónicas
 *   - Demo mode ?demo=true para no depender de Supabase real
 *   - 2 capas de tests:
 *     · regression.spec.ts → assertions sobre los 6 bug patterns conocidos
 *       (tail JIT, filter/tab parity, defaults, truncation, etc)
 *     · hub-smoke.spec.ts → screenshots con diff threshold
 *
 * Runtime: GitHub Actions (CI) y local opcional. NO corre en el
 * pre-push hook (muy lento para hook local — esos checks viven en
 * scripts/pre-push.sh).
 *
 * Primera ejecución (genera baselines):
 *   bun run dev (terminal 1)
 *   bun run e2e:update (terminal 2)
 *
 * Subsequent runs:
 *   bun run e2e
 *
 * UI mode (debug visual interactivo):
 *   bun run e2e:ui
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.NER_TEST_PORT || 5173);
const BASE_URL = process.env.NER_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // 1 worker para evitar race conditions con localStorage scoped
  workers: process.env.CI ? 1 : 1,
  fullyParallel: false,

  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02, // 2% — Valerie + Victoria convergence
      animations: "disabled",
    },
  },

  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Disable animations + caret blinking for deterministic screenshots
    launchOptions: {
      args: ["--disable-blink-features=AutomationControlled"],
    },
  },

  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  // En CI: vite dev arrancado por el workflow YAML separado.
  // En local: usuario corre `bun run dev` en terminal aparte.
  // NO webServer aquí — evita race conditions de port-in-use.
});
