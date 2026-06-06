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

## Last updated

2026-06-06 — initial creation during Sprint A security remediation. Add
follow-up entries as new HUMAN-ACTIONS surface.
