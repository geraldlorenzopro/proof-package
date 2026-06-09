# HUMAN-ACTIONS — Security remediation Sprint A

**Audience:** Mr. Lorenzo (CEO) + Lovable operator.
**Purpose:** items that are NOT code and therefore cannot be resolved by a
PR alone. Each one needs a human decision, contract, manual application
against production, or deferred coordination.

This file lives in git so the SOC 2 Type II auditor can see the open
items. It is not the dossier of vulnerabilities — that one stays in
private storage.

---

## 1. Cross-tool dependency tree equivalence (bun vs npm)

**Status:** Sandbox-verified. Not verified in real CI yet.

The sandbox where Claude Code runs cannot reach the Bun registry
(`europe-west*-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache` returns
HTTP 403 for outbound `bun install`). To unblock the pre-push hook
(`bun run build`), Claude Code populates `node_modules/` with
`npm install --legacy-peer-deps` and then runs `bun run build` against
that tree.

`bun` reads the npm-generated `node_modules/` and the build passes in
sandbox. However: the dependency tree that `bun install` would produce
on real CI (Lovable / GitHub Actions, where the Bun registry is
reachable) may differ from the npm-generated tree, because `bun install`
is stricter about peer dependencies than `npm install --legacy-peer-deps`.

**Action:** Watch the first CI build that runs after a sec-fix/* PR is
opened. If CI's `bun install` fails or its build fails, the discrepancy
is real and needs a manual reconciliation (e.g. lock peer dependencies
in `package.json`, or upgrade the offending dependency).

The most likely failure mode is a missing or duplicated transitive
dependency that npm was lenient about. The first PR that exposes this
is most likely the first one merged to `main` after this date.

**Owner:** Mr. Lorenzo (via Lovable or GH Actions output).

---

## 2. A30 deploy dependency — DO NOT open PR yet

**Status:** Branch `sec-fix/A30-revoke-pii` is pushed, NO PR opened
intentionally.

`sec-fix/A30-revoke-pii` revokes column-level SELECT grants on
`client_profiles.{a_number, phone, mobile_phone, dob, ssn_last4}`. The
current frontend hook `useCasePipeline.ts` reads those columns directly
in its nested SELECT, so applying A30 against prod **before**
`sec-fix/A1-pii-safe-view` (the refactor that routes the hook through
`client_profiles_safe`) is merged and deployed will return
`42501 permission denied for column a_number` and break `/hub/cases` in
production.

**Why no PR yet:** Lovable is active on this repo (see lovable-sync-*
branches from 2026-06-06). An open PR on A30 raises the risk that
someone — Lovable, a reviewer, the auto-merge bot — applies the
migration before A1 is in main.

**Required sequence:**
1. Merge `feat/R9.32-rescue-auto-save-gaps` to main (R9.32 is needed by A16/A25).
2. Open and merge `sec-fix/A1-pii-safe-view` to main.
3. Confirm Lovable preview / prod runs A1 code live.
4. **THEN** Claude Code opens the PR for `sec-fix/A30-revoke-pii`.
5. Mr. Lorenzo asks Lovable to apply the A30 migration against prod.
6. Verify `/hub/cases` still works after migration.

**Owner:** Claude Code (gated on Mr. Lorenzo's confirmation that A1 is
merged + live).

---

## 3. A29 deploy timing — safe standalone

**Status:** Branch `sec-fix/A29-with-check` is pushed, PR opened.

`sec-fix/A29-with-check` adds `WITH CHECK` to UPDATE policies on
`client_cases`, `client_profiles`, `vawa_cases`. There is no current
code path (frontend or edge function) that legitimately mutates
`account_id` of an existing row mid-update. The migration is therefore
safe to apply against prod independently of any frontend deploy.

**Required sequence:**
1. Mr. Lorenzo reviews PR.
2. Merge to main when convenient.
3. Mr. Lorenzo asks Lovable to apply the migration against prod.
4. Verify with: `SELECT policyname, with_check IS NOT NULL AS has_check
   FROM pg_policies WHERE tablename IN ('client_cases','client_profiles',
   'vawa_cases') AND cmd='UPDATE';` — all should be `true`.

**Owner:** Mr. Lorenzo.

---

## 4. BAA contracts with PHI sub-processors (Cubeta C)

**Status:** Pending decision + contract execution.

The audit confirmed that the following vendors receive PHI/PII from the
app (some via JWT-protected edge functions, some via public). The code
does not verify BAA status; it assumes the vendor has one.

| Vendor | What data | Path |
|---|---|---|
| Anthropic | Full case + profile + intake + notes | agent-felix, agent-nina, agent-max, summarize-consultation, morning-briefing |
| Lovable AI Gateway → Google Gemini | Operative dataset + USCIS docs + evidence text | camila-chat, analyze-uscis-document, translate-evidence, generate-checklist |
| ElevenLabs | Voice with client names + paralegal audio | camila-tts, elevenlabs-conversation-token |
| OpenAI | Briefing text for TTS | camila-tts-openai |
| Google TTS | Briefing text (fallback) | camila-tts |
| GoHighLevel | Client name, email, phone, note bodies, task titles | push-{contact,note,task}-to-ghl |
| Resend | Email subject + body with client_name + case_type | send-email |

**Required actions:**
1. For each vendor, confirm BAA status (Enterprise/Business plan + signed
   BAA + ZDR where applicable).
2. If a vendor cannot sign a BAA: either replace the vendor or remove
   the PHI from the call (e.g. pseudonymize names before TTS).
3. Document each vendor's BAA execution date + scope in this file or in
   a private vendor management spreadsheet referenced from this file.

**Owner:** Mr. Lorenzo.

---

## 5. Column-level encryption of `case_secrets` (Cubeta C)

**Status:** Pending DDL + key management decision.

`case_secrets.uscis_password`, `case_secrets.uscis_recovery_codes`,
`case_secrets.nvc_cas_password` are stored as plaintext. RLS gates
SELECT to owner/admin/attorney, so Tier 3+ cannot read them — but any
backup, any compromise of service_role, or any DROP TRIGGER + read by a
privileged actor exposes the cleartext.

**Required actions:**
1. Decide on encryption mechanism: `pgcrypto` (symmetric, key in Vault)
   or `pgsodium` (per-column transparent encryption).
2. Generate and store the encryption key in Supabase Vault, NEVER in
   git, NEVER in env vars exposed to the frontend.
3. Write a migration that re-encrypts existing rows (when there are any)
   and rotates the column type.
4. Update `PortalTrackingPanel.tsx` to call an RPC instead of direct
   table writes, so the encryption happens server-side.

**Owner:** Mr. Lorenzo + Lovable (DDL execution).

---

## 6. Session branch + dossier disposition (deferred)

**Status:** Frozen by user instruction until R9.32 is safely merged to main.

`claude/check-last-session-AGjyF` is a feature branch (NOT main) whose
commit `1fb06f8` contains a security audit dossier with reproductions
of confirmed vulnerabilities. The dossier was moved out of the working
tree on `sec-fix/A0-purge-dossier` (preventive `.gitignore`) but remains
accessible via `git show 1fb06f8:<path>`.

**Required sequence:**
1. `feat/R9.32-rescue-auto-save-gaps` merges to main → R9.32 is safe.
2. Mr. Lorenzo confirms no collaborator, Lovable runner, or CI worker
   has `claude/check-last-session-AGjyF` checked out.
3. Decide between:
   - **B'**: Delete the branch from GitHub UI. The commit `1fb06f8`
     remains in git history (~90 days GC) but is no longer reachable
     by name.
   - **C**: `git filter-repo --path <dossier> --invert-paths` + force-push.
     More invasive, eliminates from history immediately.
4. Apply the chosen option. The dossier in private storage (Drive/Notion
   with access audit) remains the canonical reference.

**Owner:** Mr. Lorenzo.

---

## 7. Verify migration state in prod (one-time)

**Status:** Smoke test already verified 2026-06-06. Re-verify quarterly.

The Phase 0 verification confirmed (via SQL Editor against the prod DB):
- USCIS columns dropped from `client_cases` ✅
- `case_secrets` table exists ✅
- `client_profiles_safe`, `client_cases_revenue` views exist ✅
- `user_can_view_visibility()`, `user_account_id()` functions exist ✅
- Legacy "Anyone with token" policy dropped ✅
- `is_test` seed contamination: 0 rows ✅
- RLS enabled on all 4 tenant tables ✅

The ones that remain to verify after A29 + A30 are applied:
- `WITH CHECK` present on UPDATE policies of client_cases / client_profiles / vawa_cases (post-A29)
- column_privileges of `client_profiles.{a_number, phone, mobile_phone, dob, ssn_last4}` has NO grant to authenticated (post-A30)

**Owner:** Mr. Lorenzo (via Supabase SQL Editor).

---

## 8. Lovable side-channel branches deleting CI gates (🔴 process risk)

**Status:** Discovered 2026-06-06 during routine git fetch. NOT MERGED to
main as of this date — main still carries the full E2E suite. Action
required: triage and decide on disposition before they can be merged.

**What happened**

After pushing `sec-fix/A0-purge-dossier`, a `git fetch --prune origin`
surfaced two new remote branches authored by Lovable's automated
workflow:

- `origin/lovable-sync-1779996417`
- `origin/lovable-sync-1779996490` (inspected)

The newer branch carries **170 files changed, 1140 insertions(+),
18468 deletions(-)** compared to main. Among the deletions:

- `tests/e2e/regression.spec.ts` — **completely removed** (568 lines).
  This is the CI gate that asserts the 6 known bug patterns and
  blocks merges that regress any of them. Its removal would let
  Pattern-A through Pattern-K bugs ship to production without warning.
- `tests/e2e/hub-smoke.spec.ts` — **completely removed** (114 lines).
  Visual-diff smoke test that blocks merges with > 2% visual regression
  in the Hub. Without it, any Lovable UI change can land silently.
- 7 PNG screenshot baselines under
  `tests/e2e/hub-smoke.spec.ts-snapshots/` — all removed. Even if the
  spec were restored later, the baselines would have to be regenerated
  by hand.

Commit messages on these branches are non-descriptive ("Changes",
"Changes", "Eliminó menciones a GHL", "Agregó selects extra forms").
The deletes are mixed in with what appear to be cosmetic UI / form
adjustments.

**Hypothesis**

A request was made to Lovable (likely a cosmetic one — "elimina
menciones a GHL del UI", "agrega selects al form de intake", or similar),
and Lovable's generation either (a) decided the tests referenced
something no longer present and pruned them, or (b) regenerated the
test files in a way that overwrote them with empty content. Either
behavior is collateral damage from a request whose scope did not
contemplate the test suite.

**Why this is process risk of the first order**

The entire Sprint A remediation plan rests on the assumption that the
`.github/workflows/e2e.yml` gate (which runs `regression.spec.ts` +
`hub-smoke.spec.ts` on every PR and push to main) will catch
regressions before they reach production. If a future Lovable PR lands
that deletes these specs, every subsequent PR — including future
sec-fix/* PRs — flies blind. The 6 bug patterns we hardened against
become silently reintroducible.

**Required actions**

1. **DO NOT auto-merge `lovable-sync-*` branches.** Treat any Lovable PR
   as requiring manual review of the diff for unrelated deletions,
   especially under `tests/`, `.github/`, `supabase/migrations/`, and
   `HUMAN-ACTIONS.md`.
2. **Decide disposition** of the two existing branches:
   - Are the cosmetic changes (UI text, selects) worth keeping? If yes,
     cherry-pick the survivable commits to a clean branch on top of
     main and discard the rest.
   - If no — close both branches without merging.
3. **Add a pre-merge gate** that fails CI if a PR deletes any file
   matching `tests/e2e/**/*.spec.ts`, `tests/screenshots/**/*.png`, or
   `.github/workflows/**`. This is a one-time hook addition; it
   protects all future PRs.
4. **Train the Lovable prompt** — when asking Lovable for changes,
   prepend a contract clause: *"Do not modify or delete files under
   tests/, .github/, supabase/migrations/, or HUMAN-ACTIONS.md.
   If your change would require touching them, stop and report."*

**Verification (re-run periodically)**

```bash
git ls-tree origin/main tests/e2e/regression.spec.ts \
                       tests/e2e/hub-smoke.spec.ts \
                       tests/e2e/hub-smoke.spec.ts-snapshots
# Should always return both blobs + the snapshots tree. If empty → main is compromised.
```

**Current state (verified 2026-06-06)**

```
tests/e2e/regression.spec.ts       blob 21dc2d6b... — 568 lines
tests/e2e/hub-smoke.spec.ts        blob e8826f81... — 114 lines
tests/e2e/hub-smoke.spec.ts-snapshots/  tree 3afaea7f... — present
```

Main is clean. The risk is forward-looking: prevent a future merge from
breaking these.

**Owner:** Mr. Lorenzo (decide branch disposition + add CI gate +
adjust Lovable prompts).

---

### Resolution (2026-06-09) — branches triaged, picker rescued, rest closed

**Status:** Disposition closed. Both `lovable-sync-*` branches awaiting
delete from GitHub UI (sandbox restriction — see operational note below).

**What was decided**

Read-only triage 2026-06-09 of both branches (current state, NOT the
2026-06-06 state described above) found that the destructive test-deletion
content described in this entry is **no longer present**. The branches
appear to have been rebased/cleaned by Lovable in the interim. Current
contents:

| Branch | Files changed | Tests deleted? |
|---|:--:|:--:|
| `lovable-sync-1779996417` | 4 files (+225/-84) | NO |
| `lovable-sync-1779996490` | 5 files (+233/-92, superset of 417) | NO |

However, while no test files are deleted, the current branch contents
**REVERT Mr. Lorenzo's own fixes**:

- `src/lib/hubSections.ts` (branch 490 only): removes keys `'tareas'`
  and `'auditoria'` from the `HubSectionKey` enum → would TS-error the
  modern code and regress Pattern 12 work.
- `src/components/smartforms/SmartFormsLayout.tsx`: reverts Mr. Lorenzo's
  v8.6 simplification (2026-05-28) that removed Smart Forms branding,
  nav tabs, and settings gear from the top bar.
- `src/pages/SmartFormsList.tsx`: removes the anti-staff filter
  Mr. Lorenzo demanded 2026-05-28 (*"Lorenzo, Gerald aparece como
  cliente — NO"*) + removes the `is_test=false` filter.
- `supabase/functions/send-email/index.ts`: reverts the Resend → GHL
  migration completed 2026-06-03. Restoring this would break the
  branded NER email path.

The branches' base predates Sprint A; their diff vs current `main` is
not "what they add" but "what they revert." Merging either would
mass-undo recent work.

**One feature was genuinely additive and worth rescuing:** the extra
forms picker (commit `ac34d31`, 2026-05-28) lets a paralegal add ad-hoc
USCIS forms (I-601A waiver, I-907 premium, etc.) at case-creation time
in `ConvertLeadToCaseModal`, instead of needing to navigate elsewhere
after the case opens. Real I-130-with-waiver scenario.

**Action taken**

- Cherry-pick of ONLY the picker delta (`ConvertLeadToCaseModal.tsx`)
  in PR #22 (`feat/extra-forms-picker-convert-lead`), merged
  2026-06-09 as commit `75e2c55`. Mejora sobre el original: filtro
  defensivo previo al insert en `case_forms` para evitar
  `UNIQUE(case_id, form_type)` collision, vs el `console.warn`
  silencioso de la branch.
- Schema verification documented: `extra_forms` is NOT a new column;
  the picker inserts rows in `case_forms` (existing migration
  2026-03-12) and writes `extra_forms` + `forms_count` into the audit
  log metadata (JSONB, no schema change). Backward compatible.
- All other parts of both branches discarded.

**Pending: physical branch deletion from GitHub UI**

The sandbox where Claude Code runs blocks `git push --delete` against
the remote (network policy). Both branches remain visible at:

- https://github.com/geraldlorenzopro/proof-package/branches
- Filter by `lovable-sync` → click trash icon for each

Once deleted, this entry can be marked fully closed. Until then, the
risk is residual but bounded: the branches' destructive content lives
in their history, but they cannot reach `main` without an explicit PR
+ merge that an auditor would see in the change log.

**Forward-looking actions from the original entry that remain open**

The follow-up actions #3 (pre-merge CI gate against deletion of
`tests/e2e/**`, `.github/**`, etc.) and #4 (train Lovable prompt) from
the 2026-06-06 list are **independent of this disposition** and should
still be addressed. They protect against future destructive Lovable PRs,
not the two branches at hand.

**Owner of the residual:**
- Mr. Lorenzo: physical delete of the 2 branches from GitHub UI.
- Claude Code (future session): implement the pre-merge deletion-gate
  CI check (action #3) when scope is reached.

---

## 9. Chronic red CI on `main` — quality gate non-operational (🔴 SOC 2 first-order risk)

**Status:** Discovered 2026-06-06 while opening PR #1 (R9.32 rescue).
Confirmed via `mcp__github__actions_list`: the last **5 consecutive
merges to `main`** all show `conclusion: failure` on the `e2e.yml`
workflow:

| SHA | Round | CI conclusion |
|---|---|---|
| `7f3bb89` | R9.31 (current `main` HEAD) | ❌ failure |
| `10c7e88` | R9.30 | ❌ failure |
| `e09350d` | R9.29 | ❌ failure |
| `633b041` | "Corrigió comentario JSX en src/" | ❌ failure |
| `aaece78` | R9.28 | ❌ failure |

**The CI gate that the entire Phase-2 security remediation depends on
to provide SOC 2 Type II evidence has not been operational for at least
5 versions.** Every one of those merges was waved through with a red
check. For an auditor of Type II, the existence of a configured gate
plus 5 consecutive bypasses is materially worse than not having a gate
at all — it is documented proof that the control is ignored when
inconvenient.

**Root cause of the chronic red (diagnosed 2026-06-06 during PR #1):**

The 7 failing E2E tests do not reflect 7 different bugs. They reflect
ONE functional bug in demo mode, plus tests correctly detecting it.

`HubCasesPage.tsx:55-60` reads `accountId` from
`sessionStorage["ner_hub_data"].account_id`. The `useDemoMode` hook
(`hooks/useDemoData.ts:24-41`) sets `sessionStorage["ner_demo_mode"]="1"`
when the `?demo=true` query param is present, but **never sets
`sessionStorage["ner_hub_data"]`**. So in `/hub/cases?demo=true`:

- `accountId === null`
- `useHubPageReady(loading, permsLoading, teamLoading, !userId, !accountId)`
  always has `!accountId === true` as one of its flags
- → `ready === false` PERMANENT
- → wrapper at `HubCasesPage.tsx:380-383` keeps `pointer-events-none`
  (intercepts clicks Playwright tries on chips/tabs)
- → `<CaseViewTabs loading={true} />` renders all counts as the literal
  `"—"` (CaseViewTabs.tsx:137: `{loading ? "—" : count}`)

The 6 "overlay intercepts pointer events" failures (Patterns 4, 8, 9,
10×2, 11) all click chips inside that frozen wrapper. Pattern 7 fails
because `waitForFunction` rejects tabs whose text contains `"—"` — and
in demo mode they all do, forever.

`HubTasksPage.tsx:238` has the same pattern with a mitigation via
`tasksHydrated`; partial improvement, the wrapper still has
`pointer-events-none` while `ready=false`.

**This means the modo demo of `/hub/cases` has been broken in
production since R9.20.** Anyone navigating to
`app.nerimmigration.com/hub/cases?demo=true` (Mr. Lorenzo for sales
demos, prospect firms, etc.) sees a screen frozen with `"—"` counts
and unclickable chips.

**Likely connection to entry #8 (Lovable side-channel deleting CI gates):**

Hypothesis: when Lovable was asked for unrelated changes and the CI was
already chronically red, the path of least resistance for its automated
worker may have been to "fix" the visible red by deleting the tests
that were flagging the demo-mode bug. The `lovable-sync-*` branches
that delete `regression.spec.ts` + `hub-smoke.spec.ts` would, if
merged, turn a screaming gate into silence — not by fixing the bug,
but by removing the detector. Entries #8 and #9 are likely two faces
of the same dysfunction.

**Required actions:**

1. **Fix the root cause first.** Smallest change: in `useDemoMode`,
   when activating `?demo=true`, also seed
   `sessionStorage["ner_hub_data"]` with a synthetic
   `{ account_id: "<demo-uuid>" }`. `exitDemoMode` already cleans it
   up (`hooks/useDemoData.ts:50`). Verify in CI that the 7 failing
   tests turn green.
2. **Then merge R9.32.** With a green CI, R9.32 lands on a baseline
   that the gate actually validates.
3. **From that point forward, no merge to `main` with red CI.** Treat
   the gate as a real gate. If a future test fails, fix the underlying
   issue or open a `chore/quarantine-test-X` PR that documents why
   and links to the follow-up bug ticket — never a silent override.
4. **Document this incident** as part of the Sprint A retrospective
   for the auditor: "control was not operational from R9.28 through
   R9.31; root cause was a demo-mode `ready` flag never resolving;
   detected and fixed during Sprint A remediation as part of opening
   PR #1; gate operative from R9.33 onward."

**Owner:** Claude Code (proposes the demo-mode `ready` fix as a
pre-merge sec-fix/A0.5) + Mr. Lorenzo (approves, merges, then merges
R9.32 on top of a green main).

**Re-verification (after the fix):**

```
git fetch origin main
# Confirm CI shows ✅ on the latest main commit.
# Confirm gh pr view <future-PR> --json statusCheckRollup returns
# conclusion=success for the E2E job.
```

---

### Resolution (2026-06-08)

**P-1 cerrado con evidencia E2E (9 patterns verdes). #9 cerrado en su
criterio FUNCIONAL.** CI overall sigue rojo por un único motivo: baselines
de visual regression existen solo para `darwin`, nunca se generaron para
`linux` — pre-existente, no relacionado con la remediación, documentado
como deuda de infra con su propio PR pendiente.

**Cadena de PRs que cerró el criterio funcional:**

| PR | sec-fix | Contribución |
|---|---|---|
| #8 | A0.5a | `useHubPageState` discriminated union (loading/ready/demo/error_no_account) |
| #9 | A0.5b | `HubCasesPage` migración + `SessionExpiredView` con `data-testid` |
| #10 | A0.5c | `HubTasksPage` migración + wrapper `useHubPageReady` deprecated eliminado |
| #11 | A0.5e | `authReady` distingue auth-en-vuelo vs auth-resolvió-null + `.catch`/`.finally`/`cancelled` |
| #12 | A0.5f | Reorden de prioridad coalescer + reset `setLoading(false)` en origen |
| #13 | A0.5g | Pattern 12 E2E reescrito al escenario P-1 REAL (sesión válida + `ner_hub_data` ausente) |
| #14 | A0.5h | Pattern 4 + 10a anclados a `data-testid` (frágiles confirmados con evidencia) |

**Resultado empírico CI (run #64, commit pre-merge `fd1d8b4`):**

```
✓  7  Pattern 4 — Chips Tipo proceso tienen tooltip Radix Wrapper (1.7s)
✓  9  Pattern 10 — QuickNoteModal chip caso muestra label legible (no raw key)
✓ 24  Pattern 12 — [P-1 real] /hub/cases con sesión Supabase válida + ner_hub_data ausente
✓ 25  Pattern 12 — [P-1 real] /hub/tasks con sesión Supabase válida + ner_hub_data ausente
+ 21 patterns adicionales — 25/25 regression.spec.ts pasaron
```

**Lo que SÍ está cerrado (criterio funcional):**

- Bug funcional P-1 (`HubCasesPage`/`HubTasksPage` con `accountId=null` se
  congelaban en `pointer-events-none` con counts "—") → fixed por A0.5b/c/e/f
- Regression guards E2E del escenario P-1 real → A0.5g verde
- Tests frágiles que enmascaraban estado verdadero → A0.5h anclados a `data-testid`
- Discriminated union `useHubPageState` + 20 unit tests de `useHubPageState`
- Vitest step en CI (#1, #11 cerrados anteriormente) — los unit tests bloquean merge

**Lo que sigue rojo (deuda de infra, NO funcional):**

- `hub-smoke.spec.ts` falla con `"A snapshot doesn't exist at .../hub-leads-chromium-desktop-linux.png, writing actual."` en los 7 views
- Evidencia: commit baseline `67c14a8` ("test: initial baseline screenshots Sprint A", 5 jun 2026) tiene 7 archivos TODOS `-darwin.png`, ningún `-linux.png`
- Los baselines `-linux.png` jamás fueron commiteados — 74 commits antes de A0.5b
- Patrón de error es **"doesn't exist"** (no hay baseline para comparar), NO **"doesn't match"** (regresión visual) — descarta categóricamente que A0.5b-h hayan roto la UI
- Antes de A0.5h, regression.spec.ts siempre falló primero y el smoke step nunca llegó a ejecutarse en Linux — la discrepancia darwin/linux estuvo OCULTA por el rojo más temprano

**Para el auditor:**

- El control E2E sobre el escenario crítico P-1 (sesión Supabase válida +
  `ner_hub_data` ausente o corrupto en `/hub/cases` y `/hub/tasks`) está
  **funcionalmente operativo**, demostrado por `regression.spec.ts` Pattern 12 ×2
  pasando contra el escenario REAL (vía inyección de sesión fake JWT-shaped en
  localStorage, security review documentada en PR #13 body).
- El rojo de `main` es atribuible al hub-smoke visual regression test cuyas
  baselines Linux nunca se generaron — esto NO es un control funcional fallido,
  es una pieza de infraestructura nunca completada al setup del Sprint A.
- Plan de cierre del CI rojo: PR separado regenera baselines Linux con review
  visual de Mr. Lorenzo antes de commit (no regenerar a ciegas, que grabaría
  como "correcto" lo que sea que se vea en CI). Sin urgencia.

**Owner del cierre pendiente:** Claude Code (genera Linux baselines en
container Linux, muestra screenshots a Mr. Lorenzo, abre PR aparte cuando él
confirme visualmente que el estado es correcto).

---

## 10. CI does not execute vitest — security regression guards are non-operational (🔴 SOC 2 first-order risk)

**Status:** Discovered 2026-06-06 immediately after PR #2 (sec-fix/A0.5d)
merged. The PR shipped a regression-guard unit test
(`expect(mod.DEMO_ACCOUNT_ID).toBeUndefined()`) designed to fail any
future attempt to re-introduce the sentinel string. **That test runs
locally via the pre-push hook, but NOT in the CI gate
(`.github/workflows/e2e.yml`).** The workflow only runs `tsc`,
`vite build`, and two Playwright suites — no `vitest` step at all.

**Confirmed via direct read of the workflow file (e2e.yml lines 25-59):**

```yaml
- name: TypeScript check
  run: bunx tsc --noEmit
- name: Build production
  run: bun run build
# (no vitest step)
- name: Run regression tests
  run: bunx playwright test tests/e2e/regression.spec.ts
- name: Run smoke tests
  run: bunx playwright test tests/e2e/hub-smoke.spec.ts
```

**Inventory of vitest tests that currently exist but DO NOT block any
merge:**

  - `src/test/cspaCalc.test.ts` — 6 tests
  - `src/test/intakeIncomplete.test.ts` — 6 tests
  - `src/test/useNerAccountId.test.ts` — 13 tests (the A0.5d guard)
  - `src/test/example.test.ts` — 1 test
  - `src/components/hub/__tests__/TasksToolbar.test.tsx` — 7 tests
  - **TOTAL: 33 tests, all passing locally, none enforced by CI.**

**Why this is first-order risk:**

The Sprint A security remediation produces regression guards in the
shape of unit tests. Examples already planned:

  - `sec-fix/B1-hubpage` will add a `grep-all-src "demo-account-mendez"`
    test to prevent the sentinel from being re-introduced anywhere.
  - `sec-fix/A0.5a/b/c` will add guards on the `useHubPageState`
    discriminated union and on the `EmptyState` rendering for
    `error_no_account`.
  - Future B-1 work (refactor 15+ inline `sessionStorage["ner_hub_data"]`
    reads to `useNerAccountId`) will need a test that fails if a new
    inline read appears.

Without a vitest step in CI, **every one of those guards exists only on
the disciplined developer's local machine**. They are bypassed by:

  (a) `--no-verify` on `git push` (the developer skipping the hook),
  (b) Lovable's automated workers (who don't run the human's pre-push
      hook — see HUMAN-ACTIONS #8: their `lovable-sync-*` branches
      delete tests outright).

**Connection to entries #8, #9, and the chronic `--no-verify` pattern:**

This is the same dysfunction surface as:

  - **#8** (Lovable side-channel deleting `regression.spec.ts` /
    `hub-smoke.spec.ts`): when the CI is treated as the source of
    truth, deleting tests that aren't enforced is "free"; the gate
    doesn't care.
  - **#9** (chronic red CI on main, 5 consecutive failed merges
    R9.28 → R9.31): a gate that fires red routinely teaches the team
    that red is normal. Adding more tests (here: unit) to a gate that
    doesn't even check them lets the "red == normal" pattern compound.
  - **`--no-verify`**: each time it's used, the local hook gets skipped
    AND the CI never has a chance to catch what the hook would have.

For SOC 2 Type II, a control that runs only on the developer's machine
is **not a control**. The auditor will ask for the configured workflow.
Today it shows tsc + build + playwright. The unit tests we ship as
"regression guards" do not appear anywhere in that artifact.

**Required actions:**

  1. **Add a `bun run test` step to `.github/workflows/e2e.yml`** —
     after `bunx tsc --noEmit` (TS catches the most), before
     `bun run build` (fail fast on logic before paying for the bundle).
     Diff is ~4 lines. PR `chore/ci-add-vitest-step` opens this.
  2. **Verify the existing 33 vitest tests pass on the GitHub runner
     with `bun install` native** — same risk surface as HUMAN-ACTIONS
     #1 (cross-tool dep tree equivalence). PR #2 already cleared that
     specific risk for the Vite build; the unit test step is the
     second real exposure. Watch the CI run on the chore PR.
  3. **Going forward, every Sprint A sec-fix PR that adds a unit-test
     regression guard must verify that guard runs in CI on its own
     PR**, not just locally. The Sprint A retrospective for the auditor
     must show that A0.5d's guard (and B1-hubpage's, and A0.5a/b/c's)
     were enforced by the workflow at the time of merge.

**Out of scope of `chore/ci-add-vitest-step` (documented separately):**

`supabase/functions/resolve-hub/index.test.ts` is a **Deno test**, not
a vitest test. Adding `bun run test` will not execute it. A second
follow-up step (a dedicated `deno test` job, or a separate edge-function
CI workflow) is the right home for that coverage. Tracked here as a
known gap, not blocking this entry's fix.

**Owner:** Claude Code (writes the chore PR with the workflow change) +
Mr. Lorenzo (reviews the diff, opens the PR, watches the first CI run
to confirm 33/33 vitest tests pass on the GH runner).

---

## 11. Bypass-of-CI-gate audit (2026-06-08) — both faces documented

**Status:** Search conducted 2026-06-08 as part of closing the
sec-fix/A0.5 chain. The auditor's first question on any merge-with-red-CI
sequence is *"how often did `--no-verify` get used?"*. The answer has
two faces. Documenting both, because a half-honest answer to that
question is worse than the underlying issue.

### Face 1 — the literal bypass: NOT found

`--no-verify` is the git flag that skips local hooks. Searched for any
trace in repository history:

```
git log --all --grep="--no-verify"          # 0 matches (modulo false positives on "verify"/"vitest")
grep -r "no-verify\|HUSKY=0\|skip-hooks"     # 1 match: tests/README.md:71 (documentation)
```

The pre-push hook itself (`.husky/pre-push`, installed 2026-06-05 in
`7e0ca74`, "Sprint A · Pre-push hook + Playwright smoke") is correctly
implemented:

- 3 fast checks (<30s): `tsc --noEmit`, `vite build`, anti-pattern grep
- `set -e` — any check failure aborts the push
- Escape hatch documented IN THE HOOK FILE itself:
  > *"Para BYPASS temporal (URGENT only): `git push --no-verify`. Pero
  > después abrir PR con explicación + fix."*
- Mirrored in `tests/README.md:71`

**No silent bypass pattern.** Zero developers ran `--no-verify` and
hid it from history. The hook is on, documented, with a documented
escape hatch that nobody used.

### Face 2 — the REAL bypass: merges with red CI did happen

The literal flag tells half the story. The OTHER half — the half an
auditor will see when they run `gh pr list --json statusCheckRollup`
against `main` — is that **every single merge on `main` during the
window of entries #9/#10 happened with `conclusion: failure` on the
`e2e.yml` workflow.** That is the bypass that actually occurred. Not
ignored; *waved through* with a documented reason. The distinction
matters for the auditor.

Categorized by cause:

#### (A) Era pre-A0.5 — chronic red was entry #9's root cause

PRs and direct pushes from `Round 9.20` (commit `63b63a6`, 2026-06-03)
through PR #7 (`B1-hubpage-sentinel`, 2026-06-07) merged red because
of **one functional bug**: `useDemoMode` set `sessionStorage["ner_demo_mode"]`
but never seeded `sessionStorage["ner_hub_data"]`, so `/hub/cases?demo=true`
froze with `pointer-events-none` and `"—"` counts. 7 regression.spec.ts
tests failed, but they were detecting **one demo-mode bug**, not 7
distinct regressions. Diagnosed during Sprint A (entry #9). Fixed in
the sec-fix/A0.5a/b/c chain.

Commits in this window with red CI from this single cause:

| Commit | Title | CI red because |
|---|---|---|
| `63b63a6` | Round 9.20 · Anti-flash universal pattern | demo bug + Patterns 4/10a fragile |
| `020d646` | Round 9.22 · Tooltip overflow fix robusto | ditto |
| `5539e18` | Round 9.23 · Próximo Paso completion flow | ditto |
| `29e419a` | Round 9.25 · Tipo Proceso stack format | ditto |
| `04cdb18` | Round 9.26 · Sprint legal + compliance | ditto |
| `4843f31` | Round 9.27 · 5 bugs Mr. Lorenzo screenshots | ditto |
| `aaece78` | Round 9.28 · Reactivar tarea completada | ditto |
| `e09350d` | Round 9.29 · 2 fixes | ditto |
| `10c7e88` | Round 9.30 · Popovers cierran on scroll | ditto |
| `7f3bb89` | Round 9.31 · Auto-save audit Pipeline | ditto |
| `99be121` | PR #1 R9.32 rescue | ditto (Sprint A diagnostic phase) |
| `727c331` | PR #2 sec-fix/A0.5d | ditto |
| `c09ba9e` | PR #3 chore/ci-add-vitest-step | ditto |
| `94bd496` | PR #4 sec-fix/A0-purge-dossier | ditto |
| `82dca57` | PR #5 sec-fix/A29-with-check | ditto |
| `d87aeec` | PR #6 chore/human-actions-v2 | ditto |
| `e116544` | PR #7 sec-fix/B1-hubpage-sentinel | ditto |

**Encuadre:** these merges did not ignore functional failures. The
red was a single, identified, documented, in-flight remediation
(entry #9). The Sprint A retrospective for the auditor is the
existence of #9 itself — *"control was non-operational from R9.28
through R9.31; root cause was a demo-mode `ready` flag never resolving;
detected and fixed during Sprint A remediation."*

#### (B) Era A0.5 — smoke baseline infra debt

PRs #8 (`A0.5a`, 2026-06-08) through PR #16 (rename, 2026-06-08)
merged red because of **hub-smoke.spec.ts Linux baselines missing**.
This is documented in detail in #9's Resolution block, but the
relevant facts for the audit register:

- Smoke baseline commit `67c14a8` ("test: initial baseline screenshots
  Sprint A", 2026-06-05) committed 7 `.png` files **all with the
  `-darwin` suffix**. Linux baselines were never generated.
- That baseline commit is **74 commits ANTES** de A0.5b — pre-existing
  to the sec-fix/A0.5 work.
- Error pattern in CI: `"A snapshot doesn't exist at .../*-linux.png,
  writing actual."` (no baseline to compare against), NOT
  `"doesn't match"` (visual regression introduced).
- During the A0.5 chain, regression.spec.ts went green
  progressively (Pattern 12 ×2 green at PR #13, Pattern 4 + 10a
  green at PR #14). Smoke remained red the whole time because of
  the same darwin-only baseline issue.

| Commit | PR | CI status detail |
|---|---|---|
| `5d18dbd` | #8 A0.5a | regression red (in-flight remediation) + smoke red (baseline) |
| `56b2907` | #9 A0.5b | ditto |
| `56e97a0` | #10 A0.5c | ditto |
| `94d00df` | #11 A0.5e | ditto |
| `c9816ed` | #12 A0.5f | ditto |
| `164ab7b` | #13 A0.5g | regression GREEN for Pattern 12 ×2 (P-1 real); smoke red (baseline) |
| `d572e5c` | #14 A0.5h | **regression 25/25 GREEN** (Pattern 4 + 10a fixed); smoke red (baseline) |
| `6d8da80` | #15 chore human-actions | docs only; regression 25/25 GREEN; smoke red (baseline) |
| `2ccf27c` | #16 chore rename hook | rename only; regression 25/25 GREEN; smoke red (baseline) |

**Encuadre:** zero new failures introduced by any A0.5 PR. The smoke
red is the documented infra debt from entry #9's Resolution. Each
merge was on a clearly attributable known cause, on a PR explicitly
documented as such in its body, with the underlying functional
remediation visible to the auditor as the same window where
`regression.spec.ts` went from 14 failing to 25 passing.

### Net statement for the auditor

> *"During the window covered by entries #9 and #10, every merge on
> `main` carried `conclusion: failure` on the `e2e.yml` workflow.
> Causes are categorized in entry #11: (A) a single chronic demo-mode
> bug detected and remediated during Sprint A (entries #9 root cause +
> sec-fix/A0.5a-h chain), and (B) a pre-existing visual regression
> baseline gap that was always darwin-only and never generated for
> linux (entry #9 Resolution block). No commit in history bypassed
> the local pre-push hook via `--no-verify`. No silent skip pattern
> was found. The hook is correctly implemented, documents its escape
> hatch, and was not actually used as such. The merges on red CI
> were not silent overrides; each had a known, documented cause and
> a remediation path. Functional closure: 25/25 `regression.spec.ts`
> tests green. Visual baselines for linux remain pending, tracked as
> its own PR with visual review required."*

### Open residual risk — `lovable-sync-*` branches

Carried over from entry #8: 2 `lovable-sync-*` branches remain alive
in remote, not merged to `main`:

- `lovable-sync-1779996417` — touches `ConvertLeadToCaseModal`,
  `SmartFormsLayout`, `SmartFormsList`, `send-email` edge function
- `lovable-sync-1779996490` — touches `SmartFormsLayout`,
  `hubSections.ts`, `SmartFormsList`, `send-email` edge function
  (commit `1fc5be8` "Eliminó menciones a GHL")

These are NOT the test-deleting branches that entry #8 warned about
(those were purged earlier in Sprint A). They touch product code,
not the CI gate itself. **But they are side-channel branches**: if
Lovable is asked to merge them while CI is still red for any reason,
they could merge bypassing review of their actual content. Decision
pending on what to do with them (review + merge, close, or fold into
explicit PRs with full diff visible).

**Owner of follow-up:**
- Mr. Lorenzo decides fate of the 2 `lovable-sync-*` branches.
- Claude Code (this entry) flags them as open risk in #11 so they
  are not invisible in the audit register.

---

## 12. `sandbox_exec` role — platform-managed migration executor (closed 2026-06-09)

**Status:** Investigated, documented, closed. No action required.

**Discovery context:** During the Bloque 1 PHI investigation (A1/A29/A30
deploy planning), a SQL audit of column-level grants on `client_profiles`
surfaced a Postgres role named `sandbox_exec` with:

- `rolcanlogin = true` (can login)
- `rolbypassrls = true` (bypasses Row Level Security on all tables)
- `rolsuper = false`
- `SELECT` privileges on 50+ columns of `client_profiles` (a_number, dob,
  phone, mobile_phone, ssn_last4 — all PII) + 57 columns of `client_cases`
  (incl. matter_value)
- Listed in `pg_default_acl` with `defaclrole = postgres` receiving
  default grants (`ar` = INSERT + REFERENCES) on every new public table

The combination of `rolbypassrls + rolcanlogin + PHI access across all
firms` would, if reachable, be a cross-tenant PII bypass that defeats the
RLS isolation verified for the 12-firm launch.

**Read-only verification performed (2026-06-08):**

| Check | Result | Interpretation |
|---|---|---|
| `sandbox_exec` appearances in NER source tree (grep all extensions) | 0 matches | NER code never invokes it |
| `.env*` / `supabase/config.toml` / `src/integrations/lovable/` mentions | 0 | Not exposed via NER config |
| Edge function connection strings reference | 0 | Not used by NER backend |
| `authenticator` PostgREST member-of `sandbox_exec` | NO | JWT cannot SET ROLE to it |
| `pg_stat_activity` connections as `sandbox_exec` | only normal pool | No anomalous active sessions |
| Password set (`pg_authid.rolpassword IS NOT NULL`) | YES | Credential exists somewhere in platform infra |

**Lovable's confirmation (2026-06-09):**

Lovable Cloud support clarified:

> *"`sandbox_exec` is the Lovable Cloud migration executor role. It runs
> DDL on behalf of the platform during deploys. `rolbypassrls` is
> required because DDL operations cross tenant boundaries (the platform
> applies schema changes to the multi-tenant database). The `postgres`
> role inherits from it. The role is platform-managed and provisioned
> automatically; any external modification (grants, attributes,
> existence) will be re-applied by Lovable's reconciliation process
> on the next deploy. Equivalent in privilege scope to `service_role`,
> with the additional `bypassrls` justified for DDL."*

**Risk assessment (post-Lovable response):**

- **Attack surface from NER side**: ZERO. Code never references the role,
  no env exposes credential, JWT path cannot reach it.
- **Attack surface from platform side**: equivalent to compromise of
  Lovable infra itself (which would already compromise the `service_role`
  key and the postgres superuser). Not a new vector introduced by the
  presence of `sandbox_exec` — it shares the trust model of the platform's
  service_role.
- **Compliance framing for auditor**: documented as platform-managed
  privileged role with `bypassrls` justified by multi-tenant DDL.
  Equivalent control category to `service_role`. No incremental gap.

**Action policy:** **DO NOT modify** `sandbox_exec` attributes,
membership, or grants. Lovable's reconciliation re-provisions any
local change. The PII grants on its row in `pg_default_acl` and on
existing tables are residual from when the role was created (with
defaults that we cannot revoke without breaking Lovable's deploy
pipeline). When A30 runs, it MUST NOT include `sandbox_exec` in its
REVOKE list — only `anon` and `authenticated`.

**Owner:** Closed. Documented for auditor. No follow-up unless Lovable
notifies of changes to the platform's role model.

---

## 13. Single-database environment — no staging (CC8.1 control gap, 2026-06-09)

**Status:** Open control gap. Documented honestly for auditor.
Mitigation defined; permanent resolution depends on Lovable's product
roadmap.

**Discovery context:** During Bloque 1 PHI deploy planning, asked
Lovable Cloud whether the NER project has a non-production environment
(staging / preview / branch DB) to validate migrations before they
touch prod. Lovable's response:

> *"Supabase Database Branching is discontinued and not available on
> Lovable Cloud-managed projects. There is a single database. The
> preview URL of a feature branch deployment connects to the same
> production database. This is a known platform-level limitation on
> the current Lovable Cloud architecture. CC8.1 (change management)
> control gap — documented and acknowledged."*

**Impact:** Every schema migration goes directly against the
production database that serves 12 firms with PHI. There is no
isolated environment in which to:

- Test that a migration applies cleanly (no errors)
- Verify that the post-migration state matches expectations
- Validate that no live functionality breaks
- Rollback in isolation if something goes wrong

This is the classic CC8.1 (Change Management) control gap from the
SOC 2 Trust Services Criteria.

**Mitigation protocol (locked 2026-06-09 with Mr. Lorenzo):**

Until Lovable provides a staging path, every schema migration applied
to production must follow this protocol:

1. **Read-only audit first.** Migration SQL reviewed by Mr. Lorenzo +
   Claude Code; cross-references current schema state (via SQL queries
   in the Supabase dashboard SQL editor) to predict impact and detect
   anything that would fail.
2. **Backup verified BEFORE apply.** Either:
   - On-demand backup taken via Supabase dashboard immediately before,
     OR
   - Confirmation of automated backup within the last 24h that includes
     the relevant tables
   The backup snapshot ID and timestamp are recorded in the deploy log.
3. **One migration at a time.** No batched apply. Each migration runs,
   gets verified with a follow-up SELECT/SHOW query proving the
   intended state, before moving to the next.
4. **Documented rollback plan per migration.** Either an inverse SQL
   script, or a documented "restore from backup snapshot X" with
   estimated downtime, prepared and reviewed BEFORE apply.
5. **Lovable runner OR SQL editor manual.** Mr. Lorenzo decides per
   migration which path. SQL editor manual gives more control (full
   transaction visibility, instant abort); Lovable runner integrates
   with the deploy workflow but the platform error reporting is
   sometimes opaque.
6. **No apply in business hours** unless emergency. Window prefers
   off-hours to bound user impact if rollback is needed.

**Open question requiring Lovable answer (2026-06-09):**

- What backup retention / on-demand backup / PITR options exist on the
  current NER project tier? Free tier = daily 7-day retention only.
  Pro tier = daily + on-demand. Pro + PITR add-on = point-in-time
  recovery to the second. The mitigation above assumes at least
  on-demand backups; if the project is on Free tier, the protocol
  needs to factor in 24h granularity as the recovery floor.

**Owner of follow-up:**
- Mr. Lorenzo: confirm tier + backup options with Lovable.
- Mr. Lorenzo + Claude Code: design the per-migration deploy package
  (SQL + rollback + verification queries) following the protocol above.
- Lovable (long-term): provide a staging / branching path; this entry
  remains open until that exists.

---

## Last updated

2026-06-06 — initial creation during Sprint A security remediation. Add
follow-up entries as new HUMAN-ACTIONS surface.
2026-06-06 — entry #8 added after Lovable-sync branches discovered
deleting CI gates.
2026-06-06 — entry #9 added after diagnosis of chronic red CI on main
(5+ consecutive failed merges); root cause is a demo-mode `ready` flag
that never resolves; the SOC 2 control was non-operational across
R9.28–R9.31; likely related to entry #8 (Lovable's response to a
chronically red gate may have been to delete the tests).
2026-06-06 — entry #10 added after the CI workflow was confirmed to
NOT execute vitest. The regression guard shipped by sec-fix/A0.5d
(blocking re-introduction of the `DEMO_ACCOUNT_ID` sentinel) was found
to run only in the local pre-push hook, not in the gate that decides
merges. Same dysfunction shape as entries #8 and #9 and the chronic
`--no-verify` pattern. Fix tracked as `chore/ci-add-vitest-step`.
2026-06-08 — entry #9 functional closure block appended after the
sec-fix/A0.5a/b/c/e/f/g/h chain landed all 25 regression.spec.ts tests
green (Pattern 12 ×2 against the real P-1 scenario via fake-session
injection, Pattern 4 + 10a re-anchored to `data-testid`). CI overall
still red due to pre-existing missing Linux baselines for
hub-smoke.spec.ts visual regression — documented as separate infra
debt, baselines PR pending visual review by Mr. Lorenzo before commit.
2026-06-08 — entry #11 added after closing the sec-fix/A0.5 chain.
Documents both faces of the bypass-of-CI-gate question: no `--no-verify`
literal traces in repo history; but merges with red CI did occur,
categorized into (A) pre-A0.5 era with chronic red from entry #9's
demo-mode root cause and (B) A0.5 era with red from pre-existing
hub-smoke darwin-only baselines. Encuadre: not silent overrides;
each red had documented cause + remediation path. `lovable-sync-*`
branches flagged as residual open risk pending Mr. Lorenzo's decision.
2026-06-09 — entry #8 Resolution block appended. Read-only triage
2026-06-09 found both `lovable-sync-*` branches no longer contain
the destructive test-deletion content (cleaned by Lovable in the
interim), but their current state reverts Mr. Lorenzo's own fixes
(filtro anti-staff, simplificación v8.6 SmartFormsLayout, Resend → GHL,
removal of `tareas`/`auditoria` from hubSections enum). The extra
forms picker (commit ac34d31) was rescued via PR #22 cherry-pick with
a defensive UNIQUE-collision filter improvement over the original.
Physical branch deletion pending Mr. Lorenzo's manual action in GitHub
UI (sandbox blocks `git push --delete`). Forward-looking actions #3
(pre-merge deletion gate) and #4 (Lovable prompt training) remain open.
2026-06-09 — entry #12 added documenting the `sandbox_exec` Postgres
role discovered during Bloque 1 PHI audit. Role has rolcanlogin + rolbypassrls
+ PII column grants across all firms, which would be a cross-tenant bypass
if reachable. Read-only verification (NER source / config / JWT path / active
connections) showed NO reachability from app side. Lovable Cloud confirmed
the role is their platform-managed migration executor with bypassrls
justified by multi-tenant DDL. Trust scope equivalent to service_role.
DO NOT modify — any change re-applied by Lovable reconciliation. Closed.
2026-06-09 — entry #13 added documenting CC8.1 control gap: NER project
runs on a single Lovable Cloud database with no staging / branching
available (Lovable confirmed branching discontinued on their platform).
Every migration touches prod directly. Mitigation protocol locked: read-only
audit + backup-before-apply + one-migration-at-a-time + per-migration
rollback plan + off-hours window. Backup tier (Free vs Pro vs PITR) still
to be confirmed with Lovable. This gap is honest evidence for the auditor,
not something to hide.
