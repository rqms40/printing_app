# July 27 Metric, Chat, Delivery, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and track adjustable metric ruler scales, rider-message notifications, immediate post-order delivery UI, repeat-customer tutorial protection, and retirement of the legacy port 8089 deployment.

**Architecture:** Keep each change in its owning boundary: ruler behavior in the Flutter preview layer, chat notification orchestration in NestJS with existing notification/Firebase infrastructure, post-checkout state in the Flutter order flow, and tutorial eligibility in a pure mobile policy. Compose port 8088 remains canonical; host nginx cleanup is an operator action because its configuration is root-owned.

**Tech Stack:** Flutter/Dart/Riverpod/GoRouter, NestJS/TypeORM/Socket.IO/Firebase Admin, Jest/Supertest, Docker Compose, nginx, GitHub Issues/Actions.

## Global Constraints

- Deadline is exactly `2026-07-27`.
- Metric custom input uses `1:N`, where `N` is an integer greater than or equal to 1.
- Metric presets are exactly `1:20`, `1:25`, `1:50`, `1:75`, `1:100`, `1:125`, and `1:200`; default is `1:100`.
- Uploaded dimensions remain millimetres; no file-inspection API or database change is permitted.
- Ruler preference persistence is account-scoped.
- Rider chat alerts include persistent in-app notification, real-time unread update, and FCM device push.
- Notification delivery is best-effort after chat persistence and must not make a saved chat message fail.
- Post-order UI uses stable string identifiers and existing created-order state without a redundant fetch.
- Existing customers with any loaded order history never receive the first-order pipeline tutorial.
- Compose port `8088` is canonical; port `8089` must be retired, not redirected or left serving an ignored build.
- Preserve all unrelated user changes and the existing backend root-route work.
- Never commit secrets or the ignored `server/.env`.

---

### Task 1: Create GitHub Tracking

**Files:**
- Reference: `docs/superpowers/specs/2026-07-27-metric-chat-delivery-release-design.md`
- No repository source changes.

**Interfaces:**
- Consumes: GitHub repository `rqms40/printing_app`, existing labels, and the approved design.
- Produces: Five issue numbers and a `2026-07-27 Release` milestone due `2026-07-27`.

- [ ] **Step 1: Create or reuse the release milestone**

Use GitHub API/CLI to find a milestone titled `2026-07-27 Release`. If absent, create it with due date `2026-07-27T23:59:59Z` and description `Metric ruler, rider chat alerts, delivery UX, tutorial regression, and legacy deployment cleanup.`

- [ ] **Step 2: Create the adjustable metric ruler issue**

Title: `Mobile: replace imperial preview ruler with adjustable metric 1:N scales`

Body must contain the deadline, current imperial behavior, exact presets/default/custom validation, account-scoped persistence, acceptance criteria, relevant files, and Flutter test commands. Apply `surface:mobile`, `role:customer`, `type:feature`, `type:ux`, `priority:p1-high`, and `agent:mobile` when available.

- [ ] **Step 3: Create the rider chat alert issue**

Title: `Chat: notify customers in-app and by push for rider order messages`

Body must describe the missing global alert path, persistent notification, WebSocket unread update, FCM push, deep link, best-effort failure semantics, acceptance criteria, backend/mobile files, and test commands. Apply backend/mobile, customer/rider, chat/notification, feature, high-priority, and cross-surface labels when available.

- [ ] **Step 4: Create the immediate post-order delivery issue**

Title: `Mobile: show delivery state immediately after checkout`

Body must describe discarded created-order state, stable string IDs, delivery/pickup/slot/status UI, batch behavior, fallback state, acceptance criteria, and tests. Apply mobile/customer/checkout/orders/delivery labels.

- [ ] **Step 5: Create the repeat-customer tutorial issue**

Title: `Mobile: prevent first-order tutorial from returning for existing customers`

Body must state the order-history fail-safe, initial-load requirement, account isolation, persistence behavior, acceptance criteria, and tests. Apply mobile/customer/bug/high-priority labels.

- [ ] **Step 6: Create the port retirement issue**

Title: `Deployment: retire legacy host nginx mobile site on port 8089`

Body must record that 8089 is root-owned, stale, outside Compose, and blocked pending privileged operator action. Acceptance requires 8089 closed and 8088 healthy. Apply docs/deployment labels that exist; do not invent repository labels unnecessarily.

- [ ] **Step 7: Record issue URLs**

Write issue URLs and milestone number to the SDD report. Do not close issues before implementation evidence exists.

---

### Task 2: Adjustable Metric Ruler

**Files:**
- Modify: `apps/mobile/lib/shared/widgets/ruler_overlay.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/file_preview_sheet.dart`
- Modify: `apps/mobile/lib/features/tutorial/repository/tutorial_repository.dart` or create a focused account-scoped ruler preference repository alongside the ruler
- Test: `apps/mobile/test/shared/widgets/ruler_overlay_test.dart`
- Test: add or update the nearest file-preview widget test

**Interfaces:**
- Consumes: uploaded `widthMm` and `heightMm`, fitted preview rectangle, authenticated user ID.
- Produces: `MetricScale` with `denominator`, label `1:N`, metre tick conversion, preset/custom picker, and account-scoped saved selection.

- [ ] **Step 1: Write failing metric model/calibration tests**

Add tests proving presets equal `[20, 25, 50, 75, 100, 125, 200]`, default is `100`, `1:100` maps one real metre to 10 drawing millimetres, `1:50` maps it to 20 drawing millimetres, and public labels contain no inch/foot marks.

- [ ] **Step 2: Run the ruler tests and verify RED**

Run `cd apps/mobile && fvm flutter test test/shared/widgets/ruler_overlay_test.dart`. Expected failure: imperial `ArchitectScale` behavior does not provide metric ratios.

- [ ] **Step 3: Implement the metric model and painter**

Replace imperial scale math with a focused `MetricScale` abstraction. Use `drawingMillimetresForRealMetres(realMetres) => realMetres * 1000 / denominator`. Keep fitted-rectangle calibration and uploaded dimensions unchanged. Draw major labels in `m` and choose subdivisions based on pixel density.

- [ ] **Step 4: Run calibration tests and verify GREEN**

Run the focused ruler test and require zero failures.

- [ ] **Step 5: Write failing picker and persistence tests**

Test exact presets, Custom selection, `1:N` display, rejection of empty/decimal/nonnumeric/zero/negative values, immediate apply, default `1:100`, and account-scoped restoration for two distinct user IDs.

- [ ] **Step 6: Run picker tests and verify RED**

Run the focused file-preview/widget tests. Expected failure: no Custom metric picker or account-scoped saved scale exists.

- [ ] **Step 7: Implement picker and account-scoped persistence**

Add preset and Custom controls following existing sheet patterns. Store the denominator under a key derived from authenticated user ID. Never reuse the tutorial global key. If the user is unavailable, use the session default without cross-account persistence.

- [ ] **Step 8: Verify metric ruler scope**

Run focused tests, `fvm flutter analyze lib/`, and confirm `rg -n "Architect scale|inchesPerFoot|realFeetForDrawingInches" apps/mobile/lib/shared/widgets/ruler_overlay.dart apps/mobile/lib/features/customer/order/widgets/file_preview_sheet.dart` returns no production imperial ruler behavior.

- [ ] **Step 9: Commit**

Commit only ruler/picker/tests with `feat(mobile): add adjustable metric preview scales`.

---

### Task 3: Rider Chat In-App and Push Notifications

**Files:**
- Modify: `server/src/chat/chat.module.ts`
- Modify: `server/src/chat/chat.gateway.ts`
- Modify: `server/src/chat/chat.service.ts`
- Test: `server/src/chat/chat.gateway.spec.ts`
- Test: `server/src/chat/chat.service.spec.ts`
- Modify: `apps/mobile/lib/features/customer/notifications/screens/notifications_screen.dart`
- Modify: relevant mobile notification model/provider if metadata parsing is incomplete
- Modify: mobile FCM notification handling/deep-link service identified by existing auth startup
- Test: relevant files under `apps/mobile/test/features/customer/notifications/`

**Interfaces:**
- Consumes: authorized saved rider chat message, conversation customer/order IDs, public order reference, existing `NotificationsService` and `FirebaseService`.
- Produces: notification type `rider_message` with metadata `{conversationId, conversationType: "rider", orderId, orderRef}`, real-time notification, FCM data, and route `/customer/chat/<conversationId>?type=rider`.

- [ ] **Step 1: Write failing backend notification tests**

Cover rider message creates exactly one customer notification, customer message creates none, attachment-only message uses `Sent an attachment`, public order reference and conversation metadata are present, authorization/save failures notify nobody, and notification/push failures do not reject a successfully saved message.

- [ ] **Step 2: Run backend tests and verify RED**

Run `cd server && npm test -- --runInBand src/chat/chat.gateway.spec.ts src/chat/chat.service.spec.ts`. Expected failure: chat has no notification integration.

- [ ] **Step 3: Implement backend context and delivery**

Expose a narrow chat-service notification context lookup returning customer ID, internal order ID, and public order reference. Import notification/Firebase dependencies through Nest module boundaries. After persistence and room emission, create the in-app notification and send FCM data/notification payload. Catch and log downstream notification errors.

- [ ] **Step 4: Verify backend GREEN**

Run chat, notification, and Firebase unit tests plus backend lint/build.

- [ ] **Step 5: Write failing mobile routing tests**

Test foreground realtime `rider_message` insertion, unread increment/deduplication, tap-to-mark-read and open the rider conversation, FCM tap using the same route metadata, and malformed metadata without crash/navigation.

- [ ] **Step 6: Run mobile tests and verify RED**

Run the relevant notification/provider/screen/service tests. Expected failure: notification taps do not deep-link to chat and FCM metadata has no rider-message routing path.

- [ ] **Step 7: Implement mobile notification routing**

Centralize parsing of `rider_message` routing metadata so in-app and FCM taps share one safe route builder. Preserve notification-center readability when metadata is invalid.

- [ ] **Step 8: Verify chat notification scope**

Run focused server/mobile tests, backend lint/build, and Flutter analyze.

- [ ] **Step 9: Commit**

Commit backend and mobile notification integration with `feat(chat): notify customers of rider messages`.

---

### Task 4: Immediate Delivery State After Checkout

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/order_success_screen.dart`
- Modify: route definitions under `apps/mobile/lib/config/routes/app_router.dart` if typed route payload handling requires it
- Test: checkout and order-success tests under `apps/mobile/test/features/customer/order/screens/`

**Interfaces:**
- Consumes: created `Order` objects returned by `ordersProvider.addBatchOrder`, existing order status/display helpers, booked slot data.
- Produces: immutable success payload with created-order snapshots and stable string route IDs.

- [ ] **Step 1: Write failing success payload/UI tests**

Test immediate status, delivery/pickup method, booked slot, public reference, string route ID navigation, multi-order summary, live provider update, missing-payload fallback, cart reset, and unchanged beta routing.

- [ ] **Step 2: Run focused tests and verify RED**

Expected failure: checkout passes only references and an integer-coerced first ID; success UI lacks delivery state.

- [ ] **Step 3: Implement immutable route payload**

Pass the created orders or a focused immutable snapshot through GoRouter `extra`. Never parse the identifier to integer. Reuse orders-provider state for updates and avoid a redundant REST fetch.

- [ ] **Step 4: Implement delivery summary card**

Render the existing status language, delivery/pickup choice, slot when present, and appropriate View order/View orders/Track delivery action. Preserve safe generic fallback.

- [ ] **Step 5: Verify GREEN and commit**

Run focused tests and Flutter analyze, then commit with `feat(mobile): show delivery state after checkout`.

---

### Task 5: Repeat-Customer Tutorial Regression

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`
- Modify: pure tutorial eligibility policy file used by home, or create one under the same feature
- Modify only if needed: `apps/mobile/lib/features/tutorial/providers/pipeline_tutorial_provider.dart`
- Test: `apps/mobile/test/features/customer/home/home_tutorial_policy_test.dart`
- Test: relevant auth/tutorial persistence tests

**Interfaces:**
- Consumes: order history initial-load state, complete order list, pipeline tutorial seen state, active-delivery deferral state.
- Produces: pure eligibility decision requiring loaded empty order history for first-order tutorial.

- [ ] **Step 1: Write failing eligibility tests**

Prove loaded nonempty history suppresses the pipeline tutorial even if its key is absent; loaded empty history/key absent permits it; loading state, seen state, and active-delivery deferral suppress it; a second order never restarts it.

- [ ] **Step 2: Run focused policy tests and verify RED**

Expected failure: current policy relies on tutorial key without checking historical orders.

- [ ] **Step 3: Implement the order-history fail-safe**

Keep the decision pure and require completed initial loading plus an empty order list before showing the pipeline welcome.

- [ ] **Step 4: Write persistence transition tests**

Test that marking the pipeline complete is not discarded by immediate logout/navigation and that two accounts on one device do not share tutorial state.

- [ ] **Step 5: Harden persistence minimally**

Await or safely queue the existing server update at logout-sensitive transitions. Do not merge global local keys across users; use server authority or account-scoped local storage.

- [ ] **Step 6: Verify GREEN and commit**

Run home/tutorial/auth focused tests and Flutter analyze, then commit with `fix(mobile): keep first-order tutorial for new customers`.

---

### Task 6: Integrate Existing API Root Work

**Files:**
- Existing new file: `server/src/app.controller.ts`
- Existing modifications: `server/src/app.module.ts`
- Existing modifications: `server/src/main.ts`
- Existing test: `server/test/app.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /` returns API entry points while `/api/health` and `/docs` remain unchanged.

- [ ] **Step 1: Review the existing diff**

Confirm the root response is informational only, does not expose secrets, and global prefix exclusion applies only to `GET /`.

- [ ] **Step 2: Run focused and broad backend verification**

Run the app e2e test, backend lint, build, unit tests, and e2e tests.

- [ ] **Step 3: Commit**

Commit only this existing root endpoint scope with `fix(api): add service root endpoint`.

---

### Task 7: Fresh Deployment, Port Retirement, and Release

**Files:**
- No repository source file required for port 8089.
- Update GitHub issues with evidence and blocker state.

**Interfaces:**
- Consumes: all implementation commits, ignored local environment, Compose stack, privileged operator availability, GitHub Actions.
- Produces: pristine seeded deployment on `192.168.40.201`, local release evidence, pushed `main`, and accurate issue status.

- [ ] **Step 1: Run full local verification**

Run backend lint/build/unit/e2e, admin typecheck/test/build, landing lint/content tests/build, Flutter analyze/test/release-web build, mobile-web beta contracts, and `git diff --check`.

- [ ] **Step 2: Recreate the development stack fresh**

With `GRIDGO_PUBLIC_HOST=192.168.40.201` and `GRIDGO_BIND_ADDR=192.168.40.201`, remove Compose containers and project volumes, rebuild, run all migrations, and seed exactly the three demo users. Keep seed passwords in ignored environment only.

- [ ] **Step 3: Run live smoke tests**

Verify API root, health body database connection, docs, customer/rider/admin login, mobile 8088, admin 8189, landing 8090, and the rider-message notification path. Confirm migration/user/order/file counts match pristine seed expectations afterward.

- [ ] **Step 4: Retire port 8089 with privilege**

If sudo/root becomes available, unlink only `/etc/nginx/sites-enabled/flutter`, run `nginx -t`, reload nginx, verify no listener on 8089, and verify 8088 remains HTTP 200. If privilege remains unavailable, leave the GitHub issue open and report the exact operator command; do not claim completion.

- [ ] **Step 5: Final review**

Dispatch a whole-branch code review, fix Critical/Important findings, re-run affected checks, and inspect `git status --short --branch`.

- [ ] **Step 6: Push main**

Fetch origin, ensure no divergence, push the verified commits to `origin/main`, and record the pushed SHA.

- [ ] **Step 7: Inspect GitHub checks**

Watch the triggered workflows. If GitHub billing still prevents jobs from starting, record the exact billing annotation on the release/issues and leave affected issues open or blocked; do not describe GitHub as green. Once billing is fixed, rerun and require all checks green.

- [ ] **Step 8: Update issue status**

Add commit, local test, deployment, and live-probe evidence to each issue. Close only issues whose acceptance criteria are actually satisfied; keep the 8089 issue open if privileged cleanup was not performed.
