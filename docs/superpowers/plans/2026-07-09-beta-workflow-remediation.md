# Beta Workflow Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and verify the complete GRIDGO beta workflow across server, mobile, admin, live UI, and GitHub tracking.

**Architecture:** The server is authoritative for enrollment, payment, routing, identifiers, and location privacy. Mobile and admin render those contracts and prevent invalid actions. Playwright keeps non-mutating checks separate from opt-in isolated mutation.

**Tech Stack:** NestJS, TypeORM, Jest, Flutter/Riverpod, React/Vite/Ant Design, Playwright, GitHub CLI.

## Global Constraints

- Beta customers use only GRIDGO Credits while global beta mode is enabled.
- Starting beta credit grant is exactly 100 credits and remains idempotent.
- Mark, Ven, and Juan remain separate actors.
- Later delivery stops never receive live rider location access.
- Preserve all Trello source markers and unrelated user changes.
- Do not run destructive beta scenarios against shared data.

---

### Task 1: Secure Customer Delivery Tracking (#76)

**Files:**
- Create: `server/src/riders/delivery-route.ts`
- Create: `server/src/riders/location.gateway.spec.ts`
- Modify: `server/src/riders/location.gateway.ts`
- Modify: `server/src/riders/riders.service.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `server/src/riders/riders.service.spec.ts`
- Modify: `apps/mobile/lib/shared/models/order.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/customer/home/providers/live_delivery_map_provider.dart`
- Modify: `apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart`
- Modify: relevant mobile provider/widget tests

- [ ] Write failing gateway, route-order, response privacy, stop-sequence, parser, and widget tests.
- [ ] Run focused tests and confirm expected failures.
- [ ] Add authenticated/authorized socket subscriptions and remove client location publishing.
- [ ] Attach queue position/size/current-stop metadata and withhold tracking identifiers for later stops.
- [ ] Enforce optimized stop order for rider transitions.
- [ ] Run focused server/mobile tests until green.

### Task 2: Repair Checkout Creation (#72, #73, #75, #79)

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`
- Modify: upload tests
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `apps/mobile/lib/features/customer/order/providers/checkout_payment_settings_provider.dart`
- Modify: payment sheet/card and tests
- Modify: `apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart`
- Modify: address provider and tests

- [ ] Write failing tests for real upload IDs, non-contiguous references, beta payment rejection/paid status, and address persistence.
- [ ] Run focused tests and confirm expected failures.
- [ ] Require positive upload metadata and remove mock fallback.
- [ ] Generate references from max suffix with bounded conflict retry.
- [ ] Enforce credits-only beta payment in API and mobile; record successful credit payments paid.
- [ ] Persist pinned addresses with one-time fallback on failure.
- [ ] Run focused tests until green.

### Task 3: Repair Registration, Tutorials, and Locked State (#74, #77, #78)

**Files:**
- Modify: `server/src/auth/auth.service.ts`
- Modify: `server/src/auth/auth.service.spec.ts`
- Modify: `server/src/common/filters/http-exception.filter.ts`
- Create: `server/src/common/filters/http-exception.filter.spec.ts`
- Modify: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`
- Modify: home screen tests
- Modify: `apps/mobile/lib/features/customer/beta/models/beta_locked_info.dart`
- Modify: beta locked tests

- [ ] Write failing auto-enrollment, error-payload, tutorial suppression, and blank-name tests.
- [ ] Run focused tests and confirm expected failures.
- [ ] Auto-enroll/refetch new customers during beta registration.
- [ ] Preserve structured held-account payload fields and render a clean name fallback.
- [ ] Delay/suppress home tutorials while delivery state loads or is active.
- [ ] Run focused tests until green.

### Task 4: Complete Survey and Beta Success Features (#26, #30, #49, #50)

**Files:**
- Modify: TAM survey mobile/server/admin files and tests
- Modify: beta success/locked screens and tests
- Create: focused beta share image/save helpers with platform implementations

- [ ] Write failing tests for the two additional survey answers, admin display, mandatory photo copy/state, branded share output, and save/download action.
- [ ] Run focused tests and confirm expected failures.
- [ ] Preserve and display `price_value` and `upload_friction`.
- [ ] Add a branded share-ready photo composition and dedicated save/download control.
- [ ] Remove optional completion copy from the mandatory beta photo path.
- [ ] Run focused server/mobile/admin tests until green.

### Task 5: Harden Public Login Surfaces

**Files:**
- Modify: mobile login/auth provider and tests
- Modify: admin login, title, and tests/styles
- Modify: beta status provider and tests

- [ ] Write failing tests for hidden deployed dev-login controls, empty admin credentials, responsive layout, GRIDGO title, and authenticated beta-status behavior.
- [ ] Run focused tests and confirm expected failures.
- [ ] Gate dev shortcuts behind explicit development configuration.
- [ ] Remove credential presets, make admin login responsive, and set the product title.
- [ ] Avoid authenticated beta-status calls before login.
- [ ] Run focused tests until green.

### Task 6: Upgrade End-to-End Coverage and Tracker State

**Files:**
- Modify: `e2e/mobile-web/tests/beta-workflow.spec.ts`
- Modify: E2E README/fixtures as needed
- Modify: GitHub issues through `gh`

- [ ] Add isolated credential-driven admin/customer/rider workflow tests while preserving non-mutating default mode.
- [ ] Run contract and live non-mutating preflight.
- [ ] Run full isolated workflow only when safe test credentials/data are available.
- [ ] Run server, mobile, admin, and E2E verification suites.
- [ ] Close #51 with evidence; update every other beta issue with exact pass/fail evidence and remaining risk.
- [ ] Confirm final `git status --short --branch` and review the complete diff.
