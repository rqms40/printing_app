# GRIDGO Managed Marketplace Migration — Frozen Decisions

**Date:** 2026-08-04  
**Status:** Locked for Phase 0+ implementation  
**Plan:** `docs/superpowers/plans/2026-08-04-managed-marketplace-migration.md`  
**Product sources:** `PRD.md` (v4.0), `docs/PRD_SysArchi.md` (v2.0)

> This document freezes **implementation decisions** for evolving the existing `printing_app` codebase into the managed printing marketplace. It does **not** invent product rules; it records choices already locked in the plan and global constraints. Product behavior remains defined by the PRDs.

---

## 1. Platform / stack (no rewrite)

| Decision | Choice |
|----------|--------|
| Platform rewrite | **No** |
| Pilot implementation stack | **NestJS + TypeORM + PostgreSQL + JWT/Passport + WebSockets + MinIO/S3 + Flutter (Riverpod/GoRouter) + Refine/Ant Design/Vite admin + Playwright e2e + Docker Compose** |
| Future option (not this program) | Supabase + React Native (and related PRD_SysArchi target diagrams) remain a **future platform option**, not the pilot delivery path |

**Rationale:** Ship marketplace product behavior on the existing codebase; product requirements do not require a stack swap for the pilot.

**Surfaces today (evolve, do not replace):**

| Surface | Path | Role focus after migration |
|---------|------|----------------------------|
| API | `server/` | Authoritative domain, guards, money, state machine |
| Mobile | `apps/mobile/` | Client + Rider + Supplier (time-sensitive) shells |
| Admin web | `admin/` | Ops Admin + Super Admin + supplier portal routes (role-gated) |
| Landing | `apps/Landing-page/` | Public marketing (Phase 12 cleanup) |
| E2E | `e2e/mobile-web/` | Beta contract until Phase 11; marketplace contract replaces |

---

## 2. Role enum values

**Target API / DB role strings:**

| Value | Product name | Notes |
|-------|--------------|-------|
| `client` | Client | Formerly `customer` |
| `supplier` | Supplier | New first-class role |
| `rider` | Rider | Unchanged value |
| `ops_admin` | Supplier Operations Admin | Formerly `admin` (ops gatekeeper) |
| `super_admin` | Super Admin | New; verification, policy, grants, recon |

**Migration aliases (temporary):**

- `customer` → `client`
- `admin` → `ops_admin`

Prefer a hard DB migrate over long dual-read; temporary JWT/guard acceptance of old strings only if required for rolling deploy safety.

**Client account types** (`business` | `organization` | `teacher`) are **metadata only** — not separate workflows or roles.

**UI language:** product copy uses Client / Supplier / Rider / Ops Admin / Super Admin. Folder names such as `features/customer` may remain short-term to reduce churn.

---

## 3. Order status enum (target list)

API style: **snake_case** (match existing codebase convention).

```text
draft
submitted
needs_qa
client_correction
proof_approval
approved_for_matching
supplier_assigned
supplier_accepted
awaiting_payment
payment_authorized
production
supplier_self_qc
ready_for_dispatch
rider_assigned
picked_up
out_for_delivery
delivered
collected_by_customer
issue_window_open
completed
cancelled
file_rejected
```

**Rules:**

- One marketplace enum long-term; **no dual-meaning** legacy statuses after migration adapter lands.
- Transitions are **role-aware** and server-enforced (`assertTransition`); clients never self-elevate.
- Production requires `payment_authorized` (see §4–§5).
- **24-hour** material issue window after delivery proof; issue can freeze payout.
- Every controlled transition writes an audit event (actor, from, to, reason, entity refs).

**Illustrative legacy → target mappings** (full matrix in Phase 2):

| Legacy (examples) | Target |
|-------------------|--------|
| `order_placed` | `submitted` or `needs_qa` |
| `file_verified` | `approved_for_matching` (until QA module enforces) |
| `printing_in_progress` / `finishing_mounting` / `quality_checked` | `production` / `supplier_self_qc` |
| `on_the_way` / `arrived_at_destination` | `out_for_delivery` |
| `completed_pickup` | `collected_by_customer` |

---

## 4. COD rules

| Rule | Value |
|------|--------|
| Cap | Final total (delivery fee + approved adjustments) **≤ ₱1,500** (`finalTotalMinor <= 150000`) |
| Concurrency | **One** active unpaid COD order per client |
| Enforcement | **Server-side** (reject even if client sends `cod`) |
| Eligibility | Client verified for pilot COD; address/zone eligible; ops risk flag not set |
| Authorization vs cash | COD **cash collection ≠ payment authorization**; production still needs `payment_authorized` via eligible COD **approval** (or Pilot Credits) |
| Collection evidence | On delivery: OTP/photo refs → `cash_collected` |
| Reconciliation | Ops/Super Admin recon → `cash_reconciled` |
| Payout | **Blocked** until reconciled when method is COD |
| Currency storage | All money in **PHP minor units (centavos)** |

PayMongo: **sandbox only** in pilot (`PAYMONGO_LIVE_ENABLED=false` by default); live digital collection is post-pilot.

---

## 5. Credit rules (Pilot Credits)

| Rule | Value |
|------|--------|
| Product name | **Pilot Credits** / **Test Credits** only |
| Forbidden UX language (pilot instrument) | Top Up / Cash Out / Transfer |
| Grant authority | Only `ops_admin` / `super_admin` can grant |
| Client capabilities | No purchase, transfer, or withdraw endpoints |
| Ledger events | `grant` \| `reserve` \| `spend` \| `release` \| `expire` \| `manual_adjustment` |
| Idempotency | Required on reserve/spend |
| Implementation path | Evolve existing `credits` module (atomic ledger already present); disable/repurpose top-up request UX (410/403) |
| Payment gate | `payment_authorized` via credit reserve/spend **or** eligible COD approval before `production` |

Beta enrollment grants may remain until Phase 11; new marketplace paths must not silently reuse beta one-order lockouts unless product still requires them.

---

## 6. Admin split

| Surface | Role | Responsibility (summary) |
|---------|------|---------------------------|
| **Ops (Supplier Operations Admin)** | `ops_admin` | QA/preflight, correction/proof loops, supplier matching, recovery, dispatch visibility, claims/payout holds, SLA, order audit timeline — **cannot** unaudited policy/finance overrides or skip normal QA gate |
| **Super Admin** | `super_admin` | Supplier/rider verification, catalog/zones/fees/commissions, Pilot Credit grants, COD recon, finance/audit, governance — **does not** remove the normal Ops QA gate |
| **Supplier portal** | `supplier` | Same admin app initially under role gates (e.g. `/supplier` section) or dedicated nav; full job workspace, capacity, payouts, settings. Mobile = time-sensitive only |
| **In-app mobile Admin** | — | Deprecate marketplace Ops use; Ops lives on **web** |

Split Refine **navigation and permissions**; prefer role gates over a greenfield Next.js portal for pilot speed.

---

## 7. Beta coexistence

| Decision | Choice |
|----------|--------|
| Beta module | **Keep** until marketplace pilot replace |
| Retirement | **Phase 11** decides retire vs thin compatibility layer |
| E2E | Preserve `e2e/mobile-web/tests/beta-workflow.spec.ts` until Phase 11; add marketplace contract in parallel |
| Feature flag | Beta workflow may remain behind a flag; marketplace paths are separate |
| Risk | Do not destroy working beta e2e mid-migration; do not silently apply beta one-order lockouts to marketplace orders unless still required |

---

## 8. Global constraints (carry into every phase)

Copied from the plan for implementers — do not weaken without an explicit decision change:

- All money stored and computed in **PHP minor units (centavos)**.
- Suppliers **never** see unapproved artwork.
- Exact live tracking starts at **confirmed pickup** and stops at terminal states; **10s** foreground / **30s** background pings.
- **24-hour** material issue window after delivery proof freezes payout when issues are timely.
- Product Preview is **never** production source of truth.
- Light/Dark theme parity; yellow is one primary action/current state per context.
- Server-side authorization is mandatory (guards + service checks); UI hide is not enough.
- Prefer smallest reviewable PRs; do not mix unrelated phases.
- Preserve secrets out of git; use ignored env files only.
- Do not break seed accounts without updating `server/src/seed.ts` and docs together.

---

## 9. Related documents

| Doc | Role |
|-----|------|
| `docs/superpowers/plans/2026-08-04-managed-marketplace-migration.md` | Phased implementation plan |
| `PRD.md` | Product requirements (behavior, acceptance) |
| `docs/PRD_SysArchi.md` | System architecture product model (includes future-stack diagrams) |
| `e2e/mobile-web/tests/beta-workflow.spec.ts` | Current beta contract (until Phase 11) |

---

## Appendix A — Baseline test snapshot

Captured on **2026-08-04** at `a22fdbb` (Task 0.1 complete) on Windows PowerShell, branch `GRIDGOv3`. Pre-existing failures are recorded only — do **not** “fix” them inside unrelated marketplace phases without a tracked issue.

| Check | Command (PowerShell-adapted) | Result | Date |
|-------|------------------------------|--------|------|
| Server unit | `cd server; npm test -- --passWithNoTests` | **FAIL** — 90/93 suites passed; **4 tests failed** / 922 passed (926 total); ~127s | 2026-08-04 |
| Admin typecheck | `cd admin; npx --no-install tsc --noEmit` | **PASS** — exit 0, no diagnostics | 2026-08-04 |
| Mobile analyze | `cd apps/mobile; flutter analyze lib/` *(fvm not on PATH; used system Flutter)* | **PASS** — `No issues found!` (~218s after pub get) | 2026-08-04 |
| Beta e2e contract | `cd e2e/mobile-web; $env:MOBILE_WEB_E2E_NO_SERVER=1; npm test -- tests/beta-workflow.spec.ts` | **PASS** — 14 passed, 2 skipped (opt-in live preflight); ~1.6s | 2026-08-04 |

### Environment notes

- Host: Windows / PowerShell; Flutter via `C:\flutter\bin\flutter.bat` (no `fvm` on PATH).
- `e2e/mobile-web`: `node_modules` was missing; ran `npm ci` first, then the contract suite succeeded. Initial run failed with `'playwright' is not recognized`.
- Unrelated dirty tree at capture time: `apps/Landing-page/src/App.tsx` (not part of this baseline commit).

### Notable pre-existing server failures (do not fix in Phase 0–N without an issue)

1. **`src/seed.spec.ts` — `isolates release signing from publication with job-level least privilege`**  
   Regex expects two consecutive newlines between “Build signed release APK” and “Remove decoded signing material after build”; workflow YAML on this checkout does not match that gap (likely formatting / line-ending sensitivity).

2. **`src/seed.spec.ts` — `seeds beta mode disabled after reset`**  
   Expects literal multi-line substring `[\n    false,\n  ]` in `seed.ts`; current source formatting does not contain that exact string (seed still inserts `false` for `is_enabled`, but not in the expected layout).

3. **`src/files/files.service.spec.ts` — disk-backed upload without multer buffer**  
   `EPERM: operation not permitted, lstat` under `%TEMP%\gridgo-test-upload-*\upload.jpg` — Windows temp / file-lock behavior during cleanup.

4. **`src/database/migration-config.spec.ts` — registers migrations path**  
   Assertion expects `stringContaining('migrations/*{.ts,.js}')` but Windows resolves to an absolute path with backslashes (`C:\...\server\migrations\*{.ts,.js}`), so the deep-equality check fails on path separators.

### Baseline one-liner for later comparison

`server: 922/926 pass (4 fail, env/Windows-sensitive); admin tsc: pass; mobile analyze: pass; beta e2e contract: 14 pass / 2 skip.`

---

*Decisions version 1.0 — 2026-08-04 — frozen for marketplace migration Phase 0. Appendix A filled by Task 0.2.*
