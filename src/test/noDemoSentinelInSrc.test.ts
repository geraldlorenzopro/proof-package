/**
 * Regression guard: the literal "demo-account-mendez" sentinel string
 * (or any contiguous reconstruction of it) must NOT appear anywhere in
 * src/**.
 *
 * History:
 *   - sec-fix/A0.5d removed the sentinel as a string export from
 *     `src/hooks/useNerAccountId.ts`. After that PR, demo mode returned
 *     `{ accountId: null, source: "demo" }` instead of a synthetic UUID-shaped
 *     string. A regression guard in `useNerAccountId.test.ts` blocks any
 *     re-introduction of `DEMO_ACCOUNT_ID` / `isDemoAccountId` exports from
 *     that one file.
 *   - sec-fix/B1 (this guard) closes the remaining surface: the same literal
 *     was duplicated in `src/pages/HubPage.tsx:18` as
 *     `DEMO_HUB_DATA.account_id`. B1 changed it to `null` and propagated
 *     `string | null` through HubPage → HubDashboard → 4 widgets + 1
 *     async helper (`fetchOfficeContextLite`). After B1, the literal must
 *     not exist anywhere in `src/`.
 *
 * Scope:
 *   Scans every file under `src/` with extension .ts, .tsx, .js, .jsx.
 *   Excludes this test file itself (otherwise the FORBIDDEN constant would
 *   self-match).
 *
 * Failure mode:
 *   If any file contains the literal, the test prints the offending paths
 *   relative to `src/`. To fix, replace the literal with `null` (preferred)
 *   or with a more meaningful value if there is a legitimate reason — but
 *   the literal `demo-account-mendez` is reserved as "must never be used".
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";

// `__dirname` is not defined in ESM; use import.meta.url instead.
// vitest exposes import.meta.url even in jsdom environment.
const __filename = new URL(import.meta.url).pathname;
const __dirname_local = __filename.substring(0, __filename.lastIndexOf("/"));
const SRC_DIR = resolve(__dirname_local, "..");

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SELF_BASENAME = basename(__filename);

// Build the forbidden string at runtime via concatenation, so that this
// file itself does not match a naïve grep for the literal. (Belt and
// suspenders alongside the self-skip below.)
const FORBIDDEN = ["demo", "account", "mendez"].join("-");

function* walkSrc(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    // Defensive: skip node_modules if it ever ends up under src.
    if (entry === "node_modules" || entry === ".git") continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walkSrc(fullPath);
    } else if (EXTENSIONS.has(extname(entry))) {
      yield fullPath;
    }
  }
}

describe("sec-fix/B1 regression guard — sentinel literal removed from src", () => {
  it(`does not appear anywhere in src/**/*.{ts,tsx,js,jsx} (forbidden: "${FORBIDDEN}")`, () => {
    const hits: string[] = [];
    for (const filePath of walkSrc(SRC_DIR)) {
      // Skip this test file itself — it intentionally references the literal.
      if (basename(filePath) === SELF_BASENAME) continue;
      const content = readFileSync(filePath, "utf-8");
      if (content.includes(FORBIDDEN)) {
        hits.push(filePath.replace(SRC_DIR + "/", ""));
      }
    }
    if (hits.length > 0) {
      // Print a nice diagnostic for the CI log before failing.
      console.error(
        `\n[sec-fix/B1 regression guard] The forbidden sentinel literal\n` +
        `  "${FORBIDDEN}"\n` +
        `was found in ${hits.length} file(s) under src/:\n` +
        hits.map((h) => `  - src/${h}`).join("\n") +
        `\n\nReplace the literal with \`null\` (preferred) and propagate the\n` +
        `\`string | null\` type through any prop/return type chain that touches it.\n` +
        `See sec-fix/B1 PR description for the canonical pattern.\n`
      );
    }
    expect(hits).toEqual([]);
  });
});
