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
