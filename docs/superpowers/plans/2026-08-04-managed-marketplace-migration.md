# GRIDGO Managed Marketplace Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking. Execute **one phase at a time**; each phase must leave the system buildable and its phase tests green before the next phase starts.

**Goal:** Evolve the existing `printing_app` codebase (NestJS API, Flutter mobile, Refine admin, Playwright e2e) from a single-shop beta print-and-deliver app into the Davao City **managed printing marketplace** defined in `PRD.md` v4.0 and `docs/PRD_SysArchi.md` v2.0.

**Architecture:** Keep the **current stack** (NestJS + TypeORM + PostgreSQL + Flutter + Refine/Vite admin + MinIO + WebSockets + OSRM) and implement TINKER/PRD **product behavior** on top of it. Do **not** rewrite to Supabase/React Native in this program—those remain a future platform option. Split today’s `admin` role into **Supplier Operations Admin** and **Super Admin**, introduce **Supplier** as a first-class role, rename customer product language to **Client**, and replace the linear shop queue with the marketplace state machine (QA → match → accept → payment auth → production → self-QC → dispatch → issue window → payout).

**Tech Stack:** NestJS, TypeORM, PostgreSQL, JWT/Passport, WebSockets, MinIO/S3, Flutter (Riverpod/GoRouter), Refine + Ant Design + Vite, Playwright (`e2e/mobile-web`), Docker Compose dev stack.

**Spec sources:**
- `PRD.md` (v4.0)
- `docs/PRD_SysArchi.md` (v2.0)
- `C:\Mobile_App\GRIDGO-TINKER\` (ops, UX, research, acceptance)
- Existing beta contract: `e2e/mobile-web/tests/beta-workflow.spec.ts` (preserve until Phase 11 replaces it)

## Global Constraints

- All money stored and computed in **PHP minor units (centavos)**.
- UI language: **Pilot Credits** / **Test Credits** only — never Top Up / Cash Out / Transfer for the pilot instrument.
- COD final total (including delivery fee + approved adjustments) **≤ ₱1,500**; **one** active unpaid COD order per client; server-enforced.
- Production requires `payment_authorized`; COD cash collection ≠ authorization; payout needs recon for COD.
- Suppliers never see unapproved artwork.
- Exact live tracking starts at **confirmed pickup** and stops at terminal states; 10s foreground / 30s background pings.
- **24-hour** material issue window after delivery proof freezes payout.
- Product Preview is **never** production source of truth.
- Light/Dark theme parity; yellow is one primary action/current state per context.
- Server-side authorization is mandatory (guards + service checks); UI hide is not enough.
- Prefer smallest reviewable PRs; do not mix unrelated phases.
- Preserve secrets out of git; use ignored env files only.
- Do not break seed accounts used by local dev without updating `server/src/seed.ts` and docs together.
- Beta workflow code may remain behind a feature flag until Phase 11 retires it; new marketplace paths must not silently reuse beta one-order lockouts unless product still requires them.

---

## Strategic decisions (locked for this plan)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform rewrite | **No** — evolve NestJS/Flutter/admin | User asked for changes to the **existing** codebase; product requirements do not require a stack swap to ship pilot behavior |
| Role rename | API values: `client`, `supplier`, `rider`, `ops_admin`, `super_admin`; keep temporary aliases for `customer`→`client`, `admin`→`ops_admin` during migration | Avoid big-bang client breakage |
| Order states | Introduce marketplace enum values; migrate/map legacy statuses in one migration + adapter | Clear audit trail; no dual-meaning states long-term |
| Credits | Evolve `credits` module into Pilot Credits ledger (grant-only; disable purchase/top-up UX) | Reuse atomic ledger work already present |
| Admin UI | Split Refine admin into **Ops** and **Super Admin** navigation/permissions; supplier gets its own portal routes (same admin app initially under role gates, or `/supplier` section) | Faster than greenfield Next.js portal |
| Mobile | Flutter keeps Client + Rider; add **Supplier** role shell (time-sensitive flows); remove/repurpose in-app Admin tabs for marketplace Ops (Ops lives on web) | Matches TINKER surfaces |
| Beta mode | Keep module until marketplace pilot replace; Phase 11 decides retire vs thin compatibility layer | Avoid destroying working e2e mid-migration |

---

## Current → Target gap (summary)

| Area | Today | Target |
|------|-------|--------|
| Roles | `customer`, `rider`, `admin` | `client`, `supplier`, `rider`, `ops_admin`, `super_admin` |
| Order pipeline | Shop queue (`order_placed`…`delivered`) | Marketplace gates + QA + match + payment auth + self-QC + issue + payout |
| Credits | Top-up requests + beta enrollment grants | Ops/Super Admin grant-only Pilot Credits ledger |
| Payments | PayMongo + COD loosely | Pilot Credits + COD ≤₱1500 + sandbox PayMongo only |
| Production actor | Implicit “shop” / admin advances print | **Supplier** accepts, produces, self-QC |
| QA | Admin file verify / decline | Mandatory **Ops QualityReview** with correction/proof |
| Matching | None (single shop) | Ranked supplier assignment + 24h accept SLA |
| Admin web | One Refine dashboard | Ops command center + Super Admin governance |
| Tracking privacy | Queue privacy for multi-stop beta | Active-trip-only after pickup (all roles) |
| Tests | Beta 29-step contract | Marketplace acceptance matrix + phased unit/e2e |

---

## Phase map (ship order)

```text
P0 Foundations & contract freeze
 → P1 Domain model + migrations
 → P2 Order state machine + audit
 → P3 Pilot Credits + COD eligibility
 → P4 Ops QA + matching APIs
 → P5 Supplier APIs + portal/mobile shell
 → P6 Client mobile marketplace flow
 → P7 Rider COD/OTP/tracking hardening
 → P8 Super Admin config (zones/fees/commissions/verification)
 → P9 Product Preview + claims/payouts
 → P10 UX tokens dual-theme polish
 → P11 Testing harness replacement + beta retirement decision
 → P12 Docs, seeds, landing, cleanup
```

Each phase ends with: unit tests green for touched modules, typecheck/analyze where applicable, and a short phase demo checklist.

---

## File ownership map (primary)

### Backend (`server/`)

| Concern | Create / primary touch |
|---------|------------------------|
| Roles | `src/users/entities/user.entity.ts`, `src/auth/*`, migrations |
| Order states | `src/orders/entities/order.entity.ts`, `src/orders/order-status-transition.ts`, `src/orders/orders.service.ts` |
| Quality / QA | **New** `src/quality/` (module, entity, service, controller, specs) |
| Suppliers | **New** `src/suppliers/` (profile, capability, verification, service, controller) |
| Assignments | **New** `src/matching/` or under `suppliers/` (`supplier-assignment.entity.ts`) |
| Pilot credits | Evolve `src/credits/*` (rename events, grant-only paths, kill purchase if any) |
| COD | Evolve `src/payments/*` + **new** `cod-collection.entity.ts` |
| Payouts / issues | **New** `src/payouts/`, **new** `src/issues/` |
| Audit | **New** `src/audit/` or expand order status history into `audit-event` |
| Delivery privacy | `src/riders/*`, `src/orders/orders.service.ts` (enrichment) |
| Seed | `src/seed.ts` |
| Migrations | `server/migrations/*` |

### Admin (`admin/`)

| Concern | Touch |
|---------|-------|
| Auth roles | `src/providers/auth-provider.ts`, `src/types/user.ts`, `src/types/enums.ts` |
| Nav split | `src/components/grid-sider.tsx`, `src/App.tsx` |
| Ops QA | **New** pages under `src/pages/qa/`, order show extensions |
| Matching / dispatch | `src/pages/orders/*`, `src/pages/riders/*`, new matching panel |
| Super Admin | **New** pages: zones, commissions, verification, pilot-credit grants, COD recon |
| Credits UX | `src/pages/credit-requests/*` → rebrand to Pilot Credits grants |
| Supplier portal | **New** `src/pages/supplier/*` gated by `supplier` role |

### Mobile (`apps/mobile/`)

| Concern | Touch |
|---------|-------|
| Enums/models | `lib/shared/models/enums.dart`, `order.dart`, `user.dart` |
| Auth routing | `lib/config/routes/app_router.dart`, `lib/features/auth/*` |
| Client flow | `lib/features/customer/**` (keep folder name short-term; product copy = Client) |
| Checkout/payment | `lib/features/customer/order/**`, payment sheets |
| Tracking | `lib/features/customer/tracking/**`, `home/widgets/map_tracking_tile.dart` |
| Rider | `lib/features/rider/**` |
| Supplier | **New** `lib/features/supplier/**` |
| Admin in-app | Deprecate marketplace use; keep only if still needed for internal tools |
| Theme | `lib/config/theme/*` dual-theme tokens |

### E2E / packages

| Concern | Touch |
|---------|-------|
| Marketplace contract | **New** `e2e/mobile-web/tests/marketplace-workflow.spec.ts` |
| Beta contract | Keep until P11; then archive or slim |
| API types skeleton | `packages/api-types/` expand shared DTOs |

---

# Phase 0 — Foundations & contract freeze

**Goal:** Align the team and repo docs on the migration contract before schema churn.

### Task 0.1: Freeze decision log in-repo

**Files:**
- Create: `docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md`
- Modify: `PRD.md` (add “Implementation stack note”: pilot ships on NestJS/Flutter/admin; Supabase/RN remains future option)
- Modify: `docs/PRD_SysArchi.md` (same stack note under §1)

- [ ] **Step 1:** Write decisions doc with: role enum values, status enum target list, COD rules, credit rules, admin split, beta coexistence, no stack rewrite.
- [ ] **Step 2:** Add stack note to both PRDs (2–3 sentences, no product rule changes).
- [ ] **Step 3:** Commit

```bash
git add docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md PRD.md docs/PRD_SysArchi.md
git commit -m "docs: freeze marketplace migration decisions and stack note"
```

### Task 0.2: Baseline test snapshot

- [ ] **Step 1:** Run current baselines and capture results in the decisions doc appendix.

```bash
cd server ; npm test -- --passWithNoTests 2>&1 | tail -n 30
cd admin ; npx tsc --noEmit
cd apps/mobile ; fvm flutter analyze lib/
cd e2e/mobile-web ; MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
```

- [ ] **Step 2:** Note failures that pre-exist; do not “fix” unrelated failures inside later phases without a tracked issue.
- [ ] **Step 3:** Commit doc appendix only if updated.

**Phase 0 exit:** Decisions committed; baselines known.

---

# Phase 1 — Domain model, roles, migrations

**Goal:** Persist marketplace roles and core tables without yet forcing all clients onto the new flow.

### Task 1.1: Expand `UserRole`

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/auth/guards/roles.guard.ts` (if needed)
- Modify: `server/src/auth/auth.service.ts`, register/login DTOs
- Create: `server/migrations/<ts>-marketplace-roles.ts`
- Test: `server/src/auth/auth.service.spec.ts`, new role guard specs

**Target enum:**

```ts
export enum UserRole {
  CLIENT = 'client',
  SUPPLIER = 'supplier',
  RIDER = 'rider',
  OPS_ADMIN = 'ops_admin',
  SUPER_ADMIN = 'super_admin',
  // Temporary aliases during migration (DB migrate maps old → new):
  // customer → client, admin → ops_admin
}
```

- [ ] **Step 1:** Write failing tests: register/login for `client`; reject unknown roles; seed super admin.
- [ ] **Step 2:** Migration: alter enum; `UPDATE users SET role='client' WHERE role='customer'`; `admin`→`ops_admin`; insert/promote one `super_admin` seed.
- [ ] **Step 3:** Update JWT payload + guards to accept new roles; temporary accept `customer`/`admin` strings only if dual-read needed (prefer hard migrate).
- [ ] **Step 4:** Update `server/src/seed.ts` accounts: client (former maria), rider (juan), ops_admin, super_admin, and at least one supplier user.
- [ ] **Step 5:** Run `cd server ; npm test` for auth/users; `npm run build`.
- [ ] **Step 6:** Commit

### Task 1.2: Supplier profile + verification tables

**Files:**
- Create: `server/src/suppliers/entities/supplier-profile.entity.ts`
- Create: `server/src/suppliers/entities/supplier-capability.entity.ts`
- Create: `server/src/suppliers/entities/supplier-verification.entity.ts`
- Create: `server/src/suppliers/suppliers.module.ts` (+ service/controller stubs)
- Create: migration for tables
- Test: `server/src/suppliers/suppliers.service.spec.ts`

**Minimum columns:**
- profile: `userId`, `businessName`, `serviceZones` (json/text), `isActive`, ratings placeholders
- capability: `supplierId`, `productFamily`, `materials`, `maxCapacity`, `leadTimeDays`
- verification: `supplierId`, `status` (`pending|under_review|verified|rejected`), `payoutDetailsRef`, `reviewedBy`, timestamps

- [ ] **Step 1:** Failing service tests for create profile + set verification verified.
- [ ] **Step 2:** Implement entities + CRUD restricted to `super_admin` (write) and `ops_admin` (read).
- [ ] **Step 3:** Migration + build + tests.
- [ ] **Step 4:** Commit

### Task 1.3: QualityReview, SupplierAssignment, Issue, Payout, CODCollection, AuditEvent

**Files:**
- Create entities under new modules (can scaffold empty services):
  - `server/src/quality/entities/quality-review.entity.ts`
  - `server/src/matching/entities/supplier-assignment.entity.ts`
  - `server/src/issues/entities/issue.entity.ts`
  - `server/src/payouts/entities/payout.entity.ts`
  - `server/src/payments/entities/cod-collection.entity.ts`
  - `server/src/audit/entities/audit-event.entity.ts`
- Create: single or split migrations `marketplace-core-entities`
- Wire modules in `server/src/app.module.ts`

**Field contracts:** follow `PRD.md` §10 / `PRD_SysArchi.md` §9 (minor units, snapshots, idempotency keys where applicable).

- [ ] **Step 1:** Entity unit metadata tests (columns exist) following existing `*-entity-metadata.spec.ts` patterns.
- [ ] **Step 2:** Migration up/down smoke via existing migration review patterns.
- [ ] **Step 3:** Commit

### Task 1.4: Client metadata (business / organization / teacher)

**Files:**
- Modify: user entity or profile constants
- Modify: register DTO + mobile registration if needed
- Migration: `client_account_type` enum/text nullable

- [ ] Implement as metadata only (no workflow fork).
- [ ] Tests for validation enum.
- [ ] Commit

**Phase 1 exit:** DB has marketplace tables + roles; old clients can still log in as `client`/`ops_admin`; no full UI flow yet.

---

# Phase 2 — Order state machine + audit

**Goal:** Replace linear shop transitions with marketplace states, with explicit transition rules and audit events.

### Task 2.1: New `OrderStatus` enum + transition table

**Files:**
- Modify: `server/src/orders/entities/order.entity.ts`
- Modify: `server/src/orders/order-status-transition.ts`
- Modify: `server/src/orders/order-status-transition.spec.ts`
- Modify: `apps/mobile/lib/shared/models/enums.dart`
- Modify: `admin/src/types/enums.ts` (or order types)
- Migration: map legacy statuses → new statuses

**Target states (API snake or existing style — match codebase convention):**

```text
draft, submitted, needs_qa, client_correction, proof_approval,
approved_for_matching, supplier_assigned, supplier_accepted,
awaiting_payment, payment_authorized, production, supplier_self_qc,
ready_for_dispatch, rider_assigned, picked_up, out_for_delivery,
delivered, collected_by_customer, issue_window_open, completed,
cancelled, file_rejected  # keep rejected terminal
```

**Legacy mapping examples:**
- `order_placed` → `submitted` or `needs_qa`
- `file_verified` → `approved_for_matching` (temporary until QA module enforces)
- `printing_in_progress` / `finishing_mounting` / `quality_checked` → `production` / `supplier_self_qc`
- `on_the_way` / `arrived_at_destination` → `out_for_delivery`
- `completed_pickup` → `collected_by_customer`

- [ ] **Step 1:** Rewrite `ORDER_STATUS_TRANSITIONS` with role-aware allowed actors in pure functions:

```ts
// server/src/orders/order-status-transition.ts
export type TransitionActor =
  | 'client'
  | 'supplier'
  | 'rider'
  | 'ops_admin'
  | 'super_admin'
  | 'system';

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor,
): void { /* throw BadRequestException if illegal */ }
```

- [ ] **Step 2:** Exhaustive unit tests for happy path + illegal jumps (client cannot jump to production; supplier cannot skip payment_authorized; etc.).
- [ ] **Step 3:** Migration maps existing rows; update all server references (admin controller status filters, analytics).
- [ ] **Step 4:** Mobile/admin enum + displayName updates; compile.
- [ ] **Step 5:** Commit

### Task 2.2: Order snapshots + payment authorization fields

**Files:**
- Modify: `order.entity.ts` — `finalTotalMinor`, `deliveryFeeMinor`, `paymentMethod`, `paymentAuthorizationStatus`, `codEligible`, snapshot JSON columns
- Modify: `orders.service.ts` create/update paths
- Tests: pricing/snapshot unit tests

- [ ] Persist immutable snapshots at `payment_authorized`.
- [ ] Commit

### Task 2.3: Audit event writer

**Files:**
- Create: `server/src/audit/audit.service.ts`
- Hook from orders/quality/matching/payments/payouts
- Test: audit written on status change

- [ ] Every controlled transition writes `AuditEvent` with actor, from, to, reason, entity refs.
- [ ] Commit

**Phase 2 exit:** Status machine enforced server-side; clients updated to parse new statuses (UI may still be partial).

---

# Phase 3 — Pilot Credits + COD

**Goal:** Payment authorization matches PRD; remove pilot-hostile top-up product language.

### Task 3.1: Pilot Credits ledger semantics

**Files:**
- Modify: `server/src/credits/credits.service.ts`, entities, DTOs, controller
- Modify: admin `credit-requests` pages → grant UI
- Modify: mobile credits UI copy
- Tests: `credits.service.spec.ts` (expand)

**Rules to implement/tests:**
- Only `ops_admin` / `super_admin` can `grant`
- No client endpoint for purchase/transfer/withdraw
- Events: `grant|reserve|spend|release|expire|manual_adjustment`
- Idempotency key required on reserve/spend
- UI strings: Pilot Credits / Test Credits

- [ ] **Step 1:** Failing tests for forbidden client top-up and successful grant→reserve→spend.
- [ ] **Step 2:** Implement; disable or repurpose top-up request endpoints (410/403 with message).
- [ ] **Step 3:** Admin page: “Grant Pilot Credits” with reason + optional expiry.
- [ ] **Step 4:** Mobile: show balance + history; remove top-up CTA.
- [ ] **Step 5:** Commit

### Task 3.2: COD eligibility + CODCollection

**Files:**
- Modify: `server/src/payments/payments.service.ts`
- Create: COD collection service methods
- Modify: order checkout authorization path in `orders.service.ts`
- Tests: eligibility matrix

**Server checks:**
1. Client verified for pilot COD (flag on user/org)
2. `finalTotalMinor <= 150000`
3. No other active unpaid COD order for client
4. Address/zone eligible; ops risk flag not set

- [ ] Reject ₱1,501 even if client sends `cod`.
- [ ] On delivery collection: record OTP/photo refs, set `cash_collected`.
- [ ] Recon endpoint for ops/super_admin → `cash_reconciled`.
- [ ] Payout blocked until reconciled when method=cod.
- [ ] Commit

### Task 3.3: Payment authorization gate before production

**Files:**
- `orders.service.ts`, supplier production endpoints (Phase 5 will call these)
- Tests: cannot enter `production` without authorization

- [ ] `payment_authorized` via credits spend/reserve **or** COD eligibility approval.
- [ ] 24h payment timeout job (Nest schedule or existing patterns) releases assignment.
- [ ] Commit

### Task 3.4: PayMongo sandbox-only guard

**Files:**
- `server/src/payments/payments.service.ts`
- Config flag `PAYMONGO_LIVE_ENABLED=false` default

- [ ] Live charges blocked unless explicit env true (and document still “post-pilot”).
- [ ] Commit

**Phase 3 exit:** Credits + COD rules server-authoritative; admin can grant credits; production gate exists.

---

# Phase 4 — Ops QA + matching APIs

**Goal:** Mandatory QA before matching; matching creates supplier assignments.

### Task 4.1: Quality module API

**Files:**
- `server/src/quality/*` full implementation
- Admin pages: `admin/src/pages/qa/queue.tsx`, `workspace.tsx`
- Tests: quality.service.spec.ts

**Endpoints (illustrative — match Nest style):**
- `GET /ops/qa/queue`
- `GET /ops/qa/:orderId`
- `POST /ops/qa/:orderId/decision` body: `{ decision, checklist, riskLevel, correctionRequest?, proofRequired? }`

**Decisions:** `needs_correction` | `proof_required` | `approved_for_matching` | `blocked`

- [ ] Transition order status accordingly.
- [ ] Artwork signed URL only to ops until approved; suppliers still denied.
- [ ] Audit each decision.
- [ ] Admin UI: queue table + workspace with checklist (mirror TINKER Ops mockups).
- [ ] Commit

### Task 4.2: Matching module API

**Files:**
- `server/src/matching/*`
- Admin matching panel on order
- Tests: ranking + accept SLA

**Behavior:**
- Rank verified suppliers by capability, zone, capacity, quality score, acceptance rate (start with simple weighted score; document formula).
- Create `SupplierAssignment` with `acceptanceDeadline` (default 24h or configured).
- Ops selects or auto-match top eligible.
- Notify supplier (push/WS/email existing notification service).

- [ ] Unit tests for ranking filter (unverified excluded, wrong capability excluded).
- [ ] Expiry job reassigns / returns to `approved_for_matching`.
- [ ] Commit

### Task 4.3: Client correction / proof endpoints

**Files:**
- orders controller client routes
- mobile QA correction + proof screens (Phase 6 can complete UI)

- [ ] Client can upload revised artwork version; resubmits to `needs_qa`.
- [ ] Client can approve proof → `approved_for_matching`.
- [ ] Commit

**Phase 4 exit:** Ops can QA and assign; APIs tested; admin queue usable.

---

# Phase 5 — Supplier APIs + portal + mobile shell

**Goal:** Supplier is a real production actor.

### Task 5.1: Supplier job APIs

**Endpoints:**
- `GET /supplier/jobs` (assigned/accepted/in production)
- `GET /supplier/jobs/:id` (approved artwork + spec only)
- `POST /supplier/jobs/:id/accept` `{ finalPriceMinor, promisedDate }`
- `POST /supplier/jobs/:id/decline` `{ reason }`
- `POST /supplier/jobs/:id/production-status`
- `POST /supplier/jobs/:id/self-qc` (multipart evidence)
- `POST /supplier/jobs/:id/ready-for-pickup`

**Files:**
- `server/src/suppliers/suppliers.controller.ts` (role guard `supplier`)
- Services enforce: only own assignment; no pre-approval file access; no production before `payment_authorized`

- [ ] Full service specs for accept/decline/self-qc gates.
- [ ] Commit

### Task 5.2: Supplier portal (admin app role section)

**Files:**
- `admin/src/pages/supplier/jobs-list.tsx`
- `admin/src/pages/supplier/job-show.tsx`
- `admin/src/App.tsx` routes + sider branch for `supplier`

- [ ] Desktop-first job inbox, accept countdown, production milestones, self-QC upload, payout list (read-only until Phase 9).
- [ ] Responsive collapse acceptable (Ant breakpoints).
- [ ] Commit

### Task 5.3: Supplier mobile shell (Flutter)

**Files:**
- Create: `apps/mobile/lib/features/supplier/**`
- Router role home for supplier
- Providers calling supplier APIs

- [ ] Screens: alert/list, job detail accept/decline, self-QC upload, ready for pickup, payout notice stub.
- [ ] Widget tests for accept gate copy.
- [ ] Commit

**Phase 5 exit:** Seeded supplier can accept a QA-approved assigned job and advance production after payment auth (via API/admin).

---

# Phase 6 — Client mobile marketplace flow

**Goal:** Client app matches PRD flow (catalog → request → artwork → QA/proof → preview stub → pay → track → issue).

### Task 6.1: Copy + role rename UX

**Files:**
- Auth/profile strings Customer → Client where user-facing
- Keep code folder `features/customer` short-term to reduce churn (optional rename later)

- [ ] Analyze + golden string tests if any.
- [ ] Commit

### Task 6.2: Checkout payment methods

**Files:**
- `payment_method_sheet.dart`, checkout provider/service
- Order create DTO

- [ ] Methods: `pilot_credit`, `cod` (if eligible), hide live GCash/Maya unless sandbox flag.
- [ ] Show COD rules in UI; rely on server rejection.
- [ ] After `supplier_accepted`, force payment step with 24h messaging.
- [ ] Commit

### Task 6.3: QA correction & proof screens

**Files:**
- New screens under customer/order or orders
- Deep link from notifications

- [ ] Correction checklist display + re-upload.
- [ ] Proof approve/reject.
- [ ] Commit

### Task 6.4: Order timeline + status mapping

**Files:**
- `order_status_timeline.dart`, order detail, home recent orders

- [ ] Map all new statuses to human labels per PRD.
- [ ] Commit

### Task 6.5: Issue report within 24h

**Files:**
- Order detail action → create Issue API
- Tests: mobile unit + server issue service

- [ ] After delivered, show issue CTA until window ends.
- [ ] Commit

**Phase 6 exit:** Client can complete marketplace happy path against local API with seeded ops/supplier/rider.

---

# Phase 7 — Rider hardening (COD, OTP, tracking)

**Goal:** Rider flow matches pickup→track→deliver/COD/fail.

### Task 7.1: Pickup / delivery proof with OTP

**Files:**
- `server/src/riders/riders.service.ts`
- Flutter rider active delivery screens
- Extend proof_of_delivery purpose already in files module

- [ ] Generate OTP at assignment/pickup windows; verify server-side.
- [ ] Require photo (+ signature optional) per policy.
- [ ] Tests for wrong OTP and double-complete.
- [ ] Commit

### Task 7.2: Tracking start/stop enforcement

**Files:**
- `location.gateway.ts`, riders service, orders enrichment (`canTrackDelivery`)
- Mobile `live_delivery_map_provider.dart`, rider location tracker

- [ ] Pings accepted only when job in `picked_up`/`out_for_delivery`.
- [ ] Client map hidden/blocked otherwise.
- [ ] Stale threshold messaging (e.g. >120s).
- [ ] Commit

### Task 7.3: Failed delivery + return

**Files:**
- riders DTO/status transitions
- Flutter failed delivery UI

- [ ] Evidence required; order not delivered; ops notified; redelivery requires new fee path (can stub fee approval as ops action).
- [ ] Commit

### Task 7.4: COD collection UI

**Files:**
- Rider delivery detail
- Server CODCollection create

- [ ] Exact amount display; proof; failure path.
- [ ] Commit

**Phase 7 exit:** Rider e2e path works with proofs and privacy gates.

---

# Phase 8 — Super Admin configuration

**Goal:** Platform governance without skipping Ops QA.

### Task 8.1: Role + verification consoles

**Files:**
- `admin/src/pages/users/*` extended
- New verification page for suppliers/riders
- Server endpoints already partially in suppliers module

- [ ] Super admin only for role changes and verification decisions.
- [ ] Commit

### Task 8.2: Service zones + delivery fees + commissions

**Files:**
- New server module `server/src/geo-zones/` or extend `delivery-slots` settings
- Admin pages for zones map list, fee rules, commission rules
- Order quoting uses zone fee

- [ ] Seed Davao zones (can be simplified polygons).
- [ ] Orders outside zone rejected.
- [ ] Commit

### Task 8.3: Platform health + audit log viewer

**Files:**
- Super admin dashboard widgets
- `GET /super/audit` paginated

- [ ] Commit

### Task 8.4: COD reconciliation + payout approval UI

**Files:**
- Admin finance pages
- Server recon/payout release endpoints (from Phase 3/9)

- [ ] Commit

**Phase 8 exit:** Super admin can configure pilot policy and verify actors.

---

# Phase 9 — Product Preview + claims/payouts completion

### Task 9.1: ArtworkMockupRender service

**Files:**
- `server/src/files/` or new `mockup/` module
- Mobile Product Preview screen
- Store render URL + template version; invalidate on artwork change

- [ ] Label mockup not print-ready.
- [ ] Compatible templates: flyer, tarpaulin, signage, t-shirt (start with static template composites if full renderer deferred—must still version and flag non-production).
- [ ] Commit

### Task 9.2: Issue window job + payout holds

**Files:**
- `issues` + `payouts` services
- On `delivered`: create payout row `on_hold` + open issue window end time
- Timely issue keeps hold; resolve paths: reprint, refund, release

- [ ] Unit tests for freeze/release.
- [ ] Ops claims UI (admin).
- [ ] Commit

### Task 9.3: Supplier payout visibility

**Files:**
- Supplier portal payout list
- Mobile payout notice

- [ ] Commit

**Phase 9 exit:** Preview + issue/payout loop closed.

---

# Phase 10 — UX dual-theme polish

**Goal:** Align tokens and key screens with TINKER design requirements without blocking backend.

### Task 10.1: Shared token doc + Flutter/admin theme audit

**Files:**
- `apps/mobile/lib/config/theme/*`
- `admin/src/config/theme.ts`
- Optional: `packages/design-tokens` if monorepo ready

- [ ] Map `action-yellow` `#FFDE58`, surfaces, semantic status colors.
- [ ] Ensure status chips use icon+label.
- [ ] Commit

### Task 10.2: Ops/Supplier dense UI yellow budget

- [ ] Primary CTA only; no yellow row button grids.
- [ ] Commit

**Phase 10 exit:** Visual parity checklist from PRD §8 reviewed on Client, Ops, Supplier, Rider primary screens.

---

# Phase 11 — Testing harness

**Goal:** Replace beta-as-source-of-truth with marketplace acceptance tests.

### Task 11.1: Unit/integration suites (server)

**Minimum new/extended specs:**
- `order-status-transition.spec.ts` (complete)
- `quality.service.spec.ts`
- `matching.service.spec.ts`
- `credits` pilot grant/reserve/spend
- `cod` eligibility
- `payout` hold on issue
- `riders` tracking window + OTP
- `suppliers` file access control

```bash
cd server
npm run lint:check
npm test
npm run test:e2e -- --runInBand
```

### Task 11.2: Admin tests

```bash
cd admin
npx tsc --noEmit
npm test
```

Focus: auth role gates, QA queue page tests, credit grant page tests, supplier job list tests.

### Task 11.3: Mobile tests

```bash
cd apps/mobile
fvm flutter analyze lib/
fvm flutter test
```

Focus: enum mapping, payment sheet eligibility, order timeline, supplier accept widget, tracking privacy.

### Task 11.4: Marketplace Playwright contract

**Files:**
- Create: `e2e/mobile-web/tests/marketplace-workflow.spec.ts`
- Create: fixtures for client, supplier, ops, super, rider users
- Update: `e2e/mobile-web/README.md`

**Contract steps (non-mutating by default; destructive under flag like beta):**
1. Super verifies supplier + rider  
2. Ops grants Pilot Credits  
3. Client submits structured order + artwork  
4. Ops QA approve  
5. Ops match supplier  
6. Supplier accept price/date  
7. Client authorize Pilot Credits  
8. Supplier produce + self-QC  
9. Ops/rider dispatch  
10. Rider pickup (tracking starts)  
11. Deliver + proof (issue window)  
12. No issue → payout releasable; with issue → hold  

```bash
cd e2e/mobile-web
MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/marketplace-workflow.spec.ts
```

### Task 11.5: Beta retirement decision

- [ ] If marketplace contract covers pilot, mark beta tests deprecated and stop requiring AGENTS.md beta section sync—or keep beta as optional historical.
- [ ] Update `AGENTS.md` Development Commands / Beta section only when intentionally changing process (and fix any contract that asserts AGENTS.md content).
- [ ] Commit

**Phase 11 exit:** CI can run marketplace acceptance; known gaps listed.

---

# Phase 12 — Docs, seeds, landing, cleanup

### Task 12.1: Seed script complete pilot cast

**Files:** `server/src/seed.ts`

| Account | Role |
|---------|------|
| `client@gridgo.ph` (or keep maria as client) | client + pilot credits |
| `supplier@gridgo.ph` | supplier verified |
| `juan@gridgo.ph` | rider verified |
| `ops@gridgo.ph` | ops_admin |
| `admin@gridgo.ph` | super_admin |

- [ ] Document passwords only in ignored env / CLAUDE.md seed notes without committing secrets.
- [ ] Commit

### Task 12.2: Landing + marketing claims audit

**Files:** `apps/Landing-page/src/**`

- [ ] Remove/avoid cheapest/same-day/unqualified claims; align to managed marketplace messaging.
- [ ] Run landing checks: `npm run lint`, content scripts, `npm run build`.

### Task 12.3: PRD/AGENTS cross-links

- [ ] Ensure `PRD.md`, `docs/PRD_SysArchi.md`, this plan, and `AGENTS.md` commands stay consistent.
- [ ] Commit

### Task 12.4: Dead code pass

- [ ] Remove or quarantine unused top-up flows, obsolete admin-only production status paths that bypass supplier, and obsolete status strings.
- [ ] Commit

**Phase 12 exit:** Local docker compose pilot cast can demo full marketplace path.

---

## Cross-cutting testing strategy

| Layer | When | Commands |
|-------|------|----------|
| Server unit | Every backend task | `cd server && npm test` (targeted first: `npx jest path/to/spec`) |
| Server build | End of each backend phase | `cd server && npm run build` |
| Server e2e | Phases 3, 5, 7, 9, 11 | `cd server && npm run test:e2e -- --runInBand` |
| Admin unit/tsc | Each admin UI task | `cd admin && npx tsc --noEmit && npm test` |
| Flutter analyze/test | Each mobile task | `cd apps/mobile && fvm flutter analyze lib/ && fvm flutter test` |
| Playwright contract | Phase 11 (+ smoke after P6–P9) | `cd e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/marketplace-workflow.spec.ts` |
| Full stack manual | Phase demos | `GRIDGO_PUBLIC_HOST=127.0.0.1 docker compose -f docker-compose.dev.yml up --build` |

### TDD rule for agents

For each new business rule (COD cap, QA gate, tracking window, credit grant):
1. Write failing unit test  
2. Implement  
3. Pass  
4. Commit  

Do not ship gate logic without a server-side test.

### Regression risk watchlist

- Existing beta enrollment credit grant path — keep green until Phase 11  
- Dispatch plan OSRM multi-stop — preserve while generalizing tracking privacy  
- File purpose / proof of delivery integrity migrations — extend, don’t fork carelessly  
- Chat/support — keep auditable; prefer order-linked threads for client–supplier later  

---

## Suggested PR slicing (for humans)

| PR series | Phases | Review focus |
|-----------|--------|--------------|
| `feat/marketplace-roles-schema` | P1 | migrations, seeds, role guards |
| `feat/marketplace-order-states` | P2 | transitions + audit |
| `feat/pilot-credits-cod` | P3 | money + eligibility |
| `feat/ops-qa-matching` | P4 | ops APIs + admin QA |
| `feat/supplier-surface` | P5 | supplier API + UI |
| `feat/client-marketplace-flow` | P6 | Flutter client |
| `feat/rider-cod-tracking` | P7 | rider proofs/privacy |
| `feat/super-admin-config` | P8 | zones/fees/verification |
| `feat/preview-claims-payouts` | P9 | preview + money out |
| `feat/marketplace-e2e` | P11–P12 | tests + docs |

---

## Definition of Done (program)

- [ ] Five roles operational end-to-end on docker-compose dev stack  
- [ ] Mandatory Ops QA before supplier sees artwork  
- [ ] Supplier accept → payment auth → production → self-QC → dispatch  
- [ ] Pilot Credits grant-only; COD ≤₱1500 + one unpaid + recon before payout  
- [ ] Tracking only after pickup; issue window freezes payout  
- [ ] Super Admin cannot skip QA gate  
- [ ] Marketplace Playwright contract green in CI mode  
- [ ] `PRD.md` acceptance checklist §11 can be evidenced with tests or demo notes  

---

## Out of scope for this plan (explicit)

- Full rewrite to Supabase / React Native / Expo  
- Live PayMongo production collection  
- Nationwide multi-city expansion  
- Graphic design editor  
- Complete Google Navigation SDK production hardening (adapter stub + OSRM may remain interim if Google not provisioned—document in Phase 7)  
- Hardware printer node control  

---

## Spec coverage checklist (self-review)

| PRD requirement | Phase |
|-----------------|-------|
| Five roles + limits | P1, P4–P8 |
| State machine + gates | P2–P5, P7, P9 |
| Pilot Credits | P3 |
| COD rules | P3, P7, P8 |
| Ops QA + matching | P4 |
| Supplier portal/mobile | P5 |
| Client flows | P6 |
| Rider proofs/tracking | P7 |
| Super Admin config | P8 |
| Product Preview | P9 |
| Issues/payouts | P9 |
| Dual theme | P10 |
| Acceptance tests | P11 |
| PayMongo sandbox only | P3 |
| Audit trail | P2+ |
| Davao zones | P8 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-managed-marketplace-migration.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task/phase, review between tasks  
2. **Inline Execution** — execute in this session with checkpoints  

**Which approach?** Start with **Phase 0 + Phase 1** only unless you explicitly want a larger batch.

---

*Plan version 1.0 — 2026-08-04 — evolves existing NestJS/Flutter/admin codebase to GRIDGO managed marketplace PRD v4.*
