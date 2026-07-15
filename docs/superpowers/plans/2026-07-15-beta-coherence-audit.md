# Beta Coherence Audit (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Exception: Tasks 1–7 (stack + destructive/visual e2e + screenshot review) are orchestrator-only and must NOT be delegated to background agents (AGENTS.md destructive-run rule).

**Goal:** Run the full four-mode beta-workflow e2e audit on a freshly recreated isolated stack, produce an evidence-backed findings register, and ship the five known coherence fixes (F1–F5).

**Architecture:** The Playwright harness in `e2e/mobile-web` drives contract → live preflight → destructive → visual runs against the loopback Docker stack. The orchestrator reviews every screenshot against the 29 canonical steps and files findings. Fixes land as five independent branches: three mobile (Claude), one server+admin (codex sol medium), one admin copy (codex terra).

**Tech Stack:** Docker Compose dev stack (Postgres/MinIO/OSRM/NestJS/Flutter web/React admin), Playwright, Flutter 3.x + Riverpod, NestJS 11 + TypeORM, React/Refine/AntD.

## Global Constraints

- Destructive/visual runs only on the loopback-bound isolated stack started with `GRIDGO_PUBLIC_HOST=127.0.0.1` and `GRIDGO_TRUST_PROXY_HOPS=1` (AGENTS.md).
- `server/.env` must contain `JWT_SECRET`, `MINIO_*`, `GRIDGO_SEED_{CUSTOMER,RIDER,ADMIN}_PASSWORD`; verify presence, never print values.
- Every finding recorded in `docs/superpowers/specs/2026-07-15-beta-coherence-findings.md` with: surface(s), step #, evidence (file:line or screenshot id), severity, disposition.
- Each fix is its own branch off `main`; owning-surface checks (AGENTS.md "Development Commands") pass before merge; contract + live preflight re-run after all fixes merge.
- Server remains authoritative; fixes only change what clients render/translate — no business-rule changes.
- Customer-facing currency name is exactly "GRIDGO Credits".

---

### Task 1: Preflight and fresh stack

**Files:** none modified (operational).

- [ ] **Step 1: Verify env prerequisites (presence only)**

```bash
cd /Users/admin/personal/mobile/printing_app
for k in JWT_SECRET MINIO_ROOT_USER MINIO_ROOT_PASSWORD GRIDGO_SEED_CUSTOMER_PASSWORD GRIDGO_SEED_RIDER_PASSWORD GRIDGO_SEED_ADMIN_PASSWORD; do
  grep -q "^$k=" server/.env && echo "$k present" || echo "$k MISSING"
done
```

Expected: six lines ending `present`. Any `MISSING` → stop and ask the user.

- [ ] **Step 2: Recreate the stack (wipes local dev volumes — user approved 2026-07-15)**

```bash
docker compose -f docker-compose.dev.yml down -v
GRIDGO_PUBLIC_HOST=127.0.0.1 GRIDGO_TRUST_PROXY_HOPS=1 docker compose -f docker-compose.dev.yml up --build -d
```

- [ ] **Step 3: Wait for health**

```bash
until curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; do sleep 5; done
curl -fsS http://127.0.0.1:8088 >/dev/null && curl -fsS http://127.0.0.1:8189 >/dev/null && echo STACK_READY
```

Expected: `STACK_READY` within ~5 minutes of image build completing.

### Task 2: Contract run

- [ ] **Step 1:**

```bash
cd e2e/mobile-web && npm ci && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
```

Expected: PASS (asserts the 29-step list and AGENTS.md sync). A failure is a Phase A finding, not something to patch silently.

### Task 3: Live preflight run

- [ ] **Step 1:**

```bash
cd e2e/mobile-web && \
  GRIDGO_RUN_BETA_FLOW_E2E=1 \
  MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
  GRIDGO_API_URL=http://127.0.0.1:3000/api \
npm test -- tests/beta-workflow.spec.ts
```

Expected: PASS. Record duration and any flaky retries in the findings register.

### Task 4: Destructive run

- [ ] **Step 1: Export seed credentials from the ignored env (never echo)**

```bash
cd e2e/mobile-web
set -a; source <(grep -E '^GRIDGO_SEED_(ADMIN|RIDER)_PASSWORD=' ../../server/.env); set +a
GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1 \
  MOBILE_WEB_E2E_NO_SERVER=1 \
  GRIDGO_API_URL=http://127.0.0.1:3000/api \
  GRIDGO_ADMIN_EMAIL=admin@gridgo.ph \
  GRIDGO_ADMIN_PASSWORD="$GRIDGO_SEED_ADMIN_PASSWORD" \
  GRIDGO_RIDER_EMAIL=juan@gridgo.ph \
  GRIDGO_RIDER_PASSWORD="$GRIDGO_SEED_RIDER_PASSWORD" \
npm test -- tests/beta-workflow-destructive.spec.ts
```

Expected: PASS — creates Mark/Ven/Juan flows through orders, dispatch, proofs, surveys, testimonials. Any failing step maps directly to a 29-step finding.

### Task 5: Visual run (after stack recreate)

- [ ] **Step 1: Recreate stack again (visual run requires a fresh stack)** — repeat Task 1 Steps 2–3.

- [ ] **Step 2:**

```bash
cd e2e/mobile-web
set -a; source <(grep -E '^GRIDGO_SEED_(ADMIN|RIDER)_PASSWORD=' ../../server/.env); set +a
GRIDGO_RUN_BETA_FLOW_VISUAL=1 \
  MOBILE_WEB_E2E_NO_SERVER=1 \
  MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
  GRIDGO_ADMIN_URL=http://127.0.0.1:8189 \
  GRIDGO_API_URL=http://127.0.0.1:3000/api \
  GRIDGO_ADMIN_EMAIL=admin@gridgo.ph \
  GRIDGO_ADMIN_PASSWORD="$GRIDGO_SEED_ADMIN_PASSWORD" \
  GRIDGO_RIDER_EMAIL=juan@gridgo.ph \
  GRIDGO_RIDER_PASSWORD="$GRIDGO_SEED_RIDER_PASSWORD" \
npm run test:beta:visual
```

Expected: PASS; note the screenshot/manifest output directory printed by the harness (kept outside committed source).

### Task 6: Screenshot review against the 29 steps

- [ ] **Step 1: Create the findings register** at `docs/superpowers/specs/2026-07-15-beta-coherence-findings.md` with this structure:

```markdown
# Beta Coherence Findings — 2026-07-15
| ID | Step # | Surface(s) | Severity | Evidence | Finding | Disposition |
|----|--------|-----------|----------|----------|---------|-------------|
```

- [ ] **Step 2:** Orchestrator reads every numbered screenshot (Read tool) in step order, checks the visible state against the step's expected outcome and the coherence map's per-step notes, and appends one row per discrepancy. Pre-seed rows for the six known incoherences (order-limit sheet, beta_credits_only, admin rank, queue "of N"/ETA, naming drift, deliveryPlanState dead payload).

### Task 7: Manual Laws-of-UX pass (admin + mobile web)

- [ ] **Step 1:** With the stack still up, drive Playwright MCP through: admin login → beta page → orders → assignment → dispatch panel; mobile web login (seeded `maria@gridgo.ph`) → home → order flow to payment step → tracking tiles. Screenshot each screen.
- [ ] **Step 2:** Judge each screen against: visibility of state, feedback on action, error copy quality, affordance clarity, target size, consistency of naming. Append findings rows (severity `ux`).

### Task 8: F1 — Wire BetaOrderLimitSheet into checkout (mobile, branch `fix/beta-order-limit-sheet`)

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart:398-409`
- Test: `apps/mobile/test/features/customer/order/checkout_beta_limit_test.dart` (create)

**Interfaces:**
- Consumes: `BetaOrderLimitException` (`apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart`), `BetaOrderLimitSheet.show(BuildContext)` (`apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart:6`).
- Produces: checkout `_placeOrder` that surfaces the sheet instead of a raw exception SnackBar.

- [ ] **Step 1: Write the failing widget test** — pump a `MaterialApp` + `ProviderScope` overriding `ordersProvider` with a notifier whose `placeCheckout` throws `const BetaOrderLimitException()`; tap the place-order button; expect `find.text("You've used your beta order")` to appear and no SnackBar containing `BetaOrderLimitException`.

```dart
testWidgets('order-limit 403 shows the friendly sheet', (tester) async {
  await tester.pumpWidget(buildCheckoutHarness(
    placeCheckout: (_) async => throw const BetaOrderLimitException(),
  ));
  await tester.tap(find.byKey(const Key('checkout-place-order')));
  await tester.pumpAndSettle();
  expect(find.text("You've used your beta order"), findsOneWidget);
  expect(find.textContaining('BetaOrderLimitException'), findsNothing);
});
```

(`buildCheckoutHarness` is the test-local helper this test file defines; reuse existing checkout test scaffolding under `apps/mobile/test/` if present — check before writing a new harness.)

- [ ] **Step 2: Run it, verify it fails** — `cd apps/mobile && fvm flutter test test/features/customer/order/checkout_beta_limit_test.dart` → FAIL (raw string SnackBar).

- [ ] **Step 3: Implement** — in `_placeOrder`, add a dedicated catch BEFORE the generic `catch (e)`:

```dart
    } on BetaOrderLimitException {
      if (!context.mounted) return;
      await BetaOrderLimitSheet.show(context);
    } on DioException catch (e) {
      // ... existing handler unchanged
```

Add the two imports. Note `BetaOrderLimitException` does not extend `DioException`, so catch order is: BetaOrderLimitException → DioException → generic.

- [ ] **Step 4: Re-run test** → PASS. Also `fvm flutter analyze lib/`.
- [ ] **Step 5: Commit** — `fix(mobile): show beta order-limit sheet instead of raw exception (#findings F1)`.

### Task 9: F2 — Code-aware `beta_credits_only` fallback (mobile, same branch as F1)

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart` (DioException branch)
- Test: extend `checkout_beta_limit_test.dart`

- [ ] **Step 1: Failing test** — harness throws a `DioException` with `response.data = {'code': 'beta_credits_only'}` (no `message`); expect SnackBar text `'Beta checkout uses GRIDGO Credits only. Switch your payment method to GRIDGO Credits.'`.
- [ ] **Step 2: Implement** — inside the existing `on DioException` branch, before the generic message fallback:

```dart
      if (data is Map && data['code'] == 'beta_credits_only') {
        msg =
            'Beta checkout uses GRIDGO Credits only. '
            'Switch your payment method to GRIDGO Credits.';
      } else if (data is Map && data['message'] is String) {
        msg = data['message'] as String;
      }
```

- [ ] **Step 3: Test + analyze pass; commit** — `fix(mobile): translate beta_credits_only checkout error`.

### Task 10: F3 — Rank in members search + admin Rank column (server+admin, branch `fix/admin-beta-rank`, delegate: codex `gpt-5.6-sol` medium)

**Files:**
- Modify: `server/src/beta-mode/beta-mode.service.ts:176-242` (`searchBetaMembers`)
- Modify: `admin/src/services/betaModeApi.ts:40-48` (`BetaMemberRow`)
- Modify: `admin/src/pages/beta-mode/index.tsx` (members table columns)
- Test: `server/src/beta-mode/beta-mode.service.spec.ts` (extend)

**Interfaces:**
- Produces: `BetaMemberRow.rank: number` — 1-based global enrollment rank ordered by `(beta_enrolled_at ASC, id ASC)`, identical to `getBetaUsers` ranking (`beta-mode.service.ts:129`).

- [ ] **Step 1: Failing server test** — with three enrolled users and `search` matching only the third, `searchBetaMembers` returns that row with `rank: 3` (global rank, not filtered-page index).
- [ ] **Step 2: Implement** — rank must be computed over ALL beta users before the search filter is applied. Use `ROW_NUMBER()`:

```sql
SELECT ranked.* FROM (
  SELECT u.*, ROW_NUMBER() OVER (ORDER BY u.beta_enrolled_at ASC, u.id ASC) AS rank
  FROM users u WHERE u.is_beta_user = true
) ranked
WHERE (:search IS NULL OR LOWER(ranked.email) LIKE :term OR LOWER(ranked.full_name) LIKE :term)
ORDER BY ranked.rank OFFSET :offset LIMIT :limit
```

(Adapt to the existing QueryBuilder/raw-query style in the file; keep the pending-survey count join unchanged; add `rank: Number(row.rank)` to the returned rows.)

- [ ] **Step 3: Admin** — add `rank: number` to `BetaMemberRow`; add a leading table column `Rank` rendering `#{String(rank).padStart(3, '0')}` (matches the mobile badge format `#001`).
- [ ] **Step 4: Checks** — `cd server && npm run lint:check && npm test`; `cd admin && npx tsc --noEmit && npm test && npm run build`.
- [ ] **Step 5: Commit** — `feat(beta): expose enrollment rank in members search and admin table`.

### Task 11: F4 — Queue "Nth of N" + server-authoritative ETA (mobile, branch `fix/customer-queue-eta`)

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart:796-799` (queued tile), `:877-879` (live tile queue label), `:1268-1274` (`_ActiveTile` ETA)
- Reference: `apps/mobile/lib/features/customer/home/providers/live_delivery_map_provider.dart` (verify exact `LiveDeliveryMapState` field names for queue size and leg duration/distance before coding)
- Test: `apps/mobile/test/features/customer/home/map_tracking_tile_test.dart` (extend or create)

- [ ] **Step 1: Failing tests** — (a) queued tile with `queuePosition: 2, queueSize: 3` renders `'2nd of 3 in queue'`; (b) `_ActiveTile` with server `legDurationSeconds: 540` renders an ETA of `'9 min'` even when the client geometry estimate differs.
- [ ] **Step 2: Implement** —

```dart
final label = position == null
    ? 'Waiting in delivery queue'
    : queueSize != null && queueSize > 1
        ? '${_ordinal(position)} of $queueSize in queue'
        : '${_ordinal(position)} in queue';
```

ETA: prefer the server value, keep the client estimate as fallback:

```dart
final serverEtaMinutes = state.legDurationSeconds != null
    ? (state.legDurationSeconds! / 60).ceil()
    : null;
final eta = serverEtaMinutes ?? (canShowRouteEta
    ? estimateRouteEtaMinutes(riderPoint, state.routePoints)
    : null);
```

If `LiveDeliveryMapState` lacks these fields, thread them from `Order.deliveryQueueSize` / `Order.deliveryLegDurationSeconds` (`apps/mobile/lib/shared/models/order.dart:208-215`) through the provider — parsing already exists.

- [ ] **Step 3: Tests + analyze pass; commit** — `feat(mobile): queue size and server ETA on customer tracking tiles`.

### Task 12: F5 — "GRID Credits" → "GRIDGO Credits" (admin, branch `fix/admin-credits-naming`, delegate: codex `gpt-5.6-terra`)

**Files:**
- Modify: `admin/src/pages/beta-mode/index.tsx:51` and `:535` (and any other hits from `grep -rn "GRID Credits" admin/src`)
- Test: existing admin tests must stay green.

- [ ] **Step 1:** Replace every user-facing "GRID Credits" with "GRIDGO Credits" (do not touch identifiers/keys). `grep -rn "GRID Credits" admin/src` afterwards → only "GRIDGO Credits" remains.
- [ ] **Step 2:** `cd admin && npx tsc --noEmit && npm test && npm run build` → PASS. Commit `fix(admin): unify credits naming to GRIDGO Credits`.

### Task 13: Disposition, regression, merge

- [ ] **Step 1:** Every findings-register row gets a disposition: fixed (F1–F5 or new small fix), merged into issue #N (Phase D executes), new issue, or out-of-scope note.
- [ ] **Step 2:** Merge the fix branches (orchestrator reviews each diff), then re-run Task 2 (contract) and Task 3 (live preflight) on the merged tree → both PASS.
- [ ] **Step 3:** Commit the completed findings register on `agent/beta-coherence-program`.
