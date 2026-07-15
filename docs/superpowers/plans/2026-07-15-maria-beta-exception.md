# Maria Beta Exception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `maria@gridgo.ph` (seeded demo customer) standing beta access that is excluded from beta numbering and never survey-held, without hardcoding her email in business logic.

**Design:** `docs/superpowers/specs/2026-07-15-maria-beta-exception-design.md`

**Architecture:** New `users.is_beta_unranked` flag; rank derivation in `beta-mode.service.ts` ignores unranked users; seed marks maria unranked + survey-exempt; admin beta members table shows a badge (and gains the missing rank column); destructive e2e covers the seeded-maria path.

**Tech Stack:** NestJS 11 + TypeORM migrations, React/Refine admin, Flutter mobile, Playwright e2e.

## Global Constraints

- Rank must stay derived — no stored beta number.
- Mark/Ven numbering (1, 2) must be unaffected by maria's enrollment.
- Reuse `is_beta_survey_exempt` for hold exemption; do not add a second hold-exemption mechanism.
- Keep `maria@gridgo.ph` hardcoded only in `server/src/seed.ts`.
- Run destructive e2e only against an isolated loopback stack (AGENTS.md rules).

---

### Task 1: Migration + entity flag

**Files:**
- Create: `server/migrations/<timestamp>-add-beta-unranked-flag.ts` (+ spec in `server/src/database/`)
- Modify: `server/src/users/entities/user.entity.ts`

- [ ] **Step 1:** Write a failing migration spec (pattern: existing specs in `server/src/database/` for `1777853400000-beta-credit-ledger-and-rank-index`) asserting `users.is_beta_unranked` exists, boolean, default false, with down-revert.
- [ ] **Step 2:** Add the migration and the `isBetaUnranked` column to `User` next to `isBetaSurveyExempt` (user.entity.ts:157).
- [ ] **Step 3:** `cd server && npm run build && npm test -- database` green.

### Task 2: Rank derivation excludes unranked users

**Files:**
- Modify: `server/src/beta-mode/beta-mode.service.ts` (`getBetaUsers` ~:114, `getBetaStatus` ~:272, `searchBetaMembers` ~:176)
- Modify: `server/src/beta-mode/*.spec.ts`

- [ ] **Step 1:** Failing unit specs: unranked user gets `rank: null` from `getBetaStatus`; an unranked user enrolled *before* two ranked users does not shift their ranks (1 and 2); `getBetaUsers`/`searchBetaMembers` expose `isBetaUnranked`.
- [ ] **Step 2:** Implement per the design (filter `is_beta_unranked = false` in rank ordering and rank-count queries; `rank: null` for unranked callers).
- [ ] **Step 3:** Verify enrollment path: `enrollUser()` still grants the idempotent 100-credit ledger row for unranked users; add a spec.
- [ ] **Step 4:** `cd server && npm run lint:check && npm test` green.

### Task 3: Seed maria as unranked beta user

**Files:**
- Modify: `server/src/seed.ts` (maria creation ~:232)

- [ ] **Step 1:** Set `isBetaUser: true`, `isBetaUnranked: true`, `isBetaSurveyExempt: true`, `betaEnrolledAt` = fixed early timestamp; grant her enrollment credits through the same `grantBetaEnrollmentCredits` path (not a raw column write).
- [ ] **Step 2:** Fresh-stack check: empty DB → migrate → seed → `GET /beta-mode/me` as maria returns `isBetaUser: true, rank: null`; login works while beta is enabled.

### Task 4: Admin beta members table — badge + missing rank column

**Files:**
- Modify: `admin/src/pages/beta-mode/index.tsx`, `admin/src/services/betaModeApi.ts`, tests alongside

- [ ] **Step 1:** Failing component tests: members table renders a rank/number column from the API `rank` field, and an "Unranked" badge (no number) for `isBetaUnranked` members.
- [ ] **Step 2:** Implement; `cd admin && npx tsc --noEmit && npm test && npm run build` green.

### Task 5: Mobile rankless badge check

**Files:**
- Verify/modify: `apps/mobile/lib/features/customer/beta/widgets/beta_indicator.dart`, `beta/providers/beta_status_provider.dart`

- [ ] **Step 1:** Widget test: `BetaStatus(rank: null, isBetaUser: true)` renders the beta badge without a `#NNN` number (no `#000`).
- [ ] **Step 2:** Fix rendering if needed; `cd apps/mobile && fvm flutter analyze lib/ && fvm flutter test` green.

### Task 6: E2E coverage for the seeded-maria path

**Files:**
- Modify: `e2e/mobile-web/tests/beta-workflow-destructive.spec.ts` (+ `beta-workflow.spec.ts` step metadata if flow text changes)

- [ ] **Step 1:** In the destructive run, after Mark and Ven enroll: login as seeded maria (beta on) succeeds; `GET /beta-mode/me` → `rank: null`; Mark/Ven ranks remain 1/2.
- [ ] **Step 2:** If AGENTS.md flow wording changes, keep the contract assertions satisfied (`Beta Workflow Regression`, spec filenames, `GRIDGO_RUN_BETA_FLOW_*` strings).
- [ ] **Step 3:** Contract mode green locally: `cd e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts`.

### Task 7: Full verification

- [ ] Destructive e2e on an isolated loopback stack (`GRIDGO_TRUST_PROXY_HOPS=1`) green, including the new maria assertions.
- [ ] Update `CLAUDE.md` known-gaps list (remove the maria gap) and close/annotate any related GitHub issue with evidence.
