# Rider Cockpit UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rider mobile home/shell match the supplied cockpit screenshot while fixing rider provider semantics that affect route order and active-stop UX.

**Architecture:** Add rider-specific shell/nav styling and tighten the rider home widgets without changing customer/admin visuals. Preserve backend route ordering in the mobile deliveries provider and make rider status mutations update local state only after successful API responses.

**Tech Stack:** Flutter/Dart, Riverpod, GoRouter, flutter_map, existing HugeIcons, existing NestJS rider APIs.

---

## File Structure

- Modify `apps/mobile/lib/features/rider/deliveries/providers/deliveries_provider.dart`: route-order preservation and mutation error semantics.
- Modify `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart`: compact cockpit composition and active/new separation.
- Modify `apps/mobile/lib/features/rider/home/widgets/rider_branding_banner.dart`: compact dense banner.
- Modify `apps/mobile/lib/features/rider/home/widgets/rider_route_map_panel.dart`: dominant map board, dark/yellow markers, stable layout.
- Modify `apps/mobile/lib/features/rider/home/widgets/rider_stop_timeline.dart`: screenshot-style right stop rail.
- Modify `apps/mobile/lib/features/rider/home/widgets/rider_active_stop_card.dart`: compact active stop card.
- Modify `apps/mobile/lib/shared/widgets/app_bottom_nav.dart`: rider-specific nav visual mode.
- Modify `apps/mobile/lib/shared/widgets/scaffold_with_nav.dart`: pass rider nav mode and style centered plus trigger.
- Modify `apps/mobile/lib/config/routes/app_router.dart`: enable rider nav mode only for rider shell.
- Modify `apps/mobile/test/features/rider/deliveries/providers/deliveries_provider_test.dart`: provider TDD tests.
- Create `apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart`: home behavior tests.
- Create `apps/mobile/test/features/rider/home/widgets/rider_active_stop_card_test.dart`: card widget tests.
- Create `apps/mobile/test/features/rider/home/widgets/rider_stop_timeline_test.dart`: rail widget tests.

---

### Task 1: Provider Route Order And Status Error Semantics

**Files:**
- Modify: `apps/mobile/lib/features/rider/deliveries/providers/deliveries_provider.dart`
- Modify: `apps/mobile/test/features/rider/deliveries/providers/deliveries_provider_test.dart`

- [ ] **Step 1: Write failing provider tests**

Add tests proving active route order is preserved and assigned-only jobs do not become active deliveries. Use `DeliveriesState` directly for pure state behavior and add a notifier-level test for mutation failure once the provider exposes failure state.

- [ ] **Step 2: Run provider tests to verify failure**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/deliveries/providers/deliveries_provider_test.dart
```

Expected: at least the new route-order or mutation-failure test fails before implementation.

- [ ] **Step 3: Implement provider behavior**

Change `_mergeViews(active, history)` so it keeps active response order first, de-duplicates history against active ids, and sorts only appended history. Change `acceptAssignment`, `declineAssignment`, and `_patchStatus` so local state changes happen only after the PATCH succeeds; on failure, keep existing state and set `errorMessage`.

- [ ] **Step 4: Run provider tests to verify pass**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/deliveries/providers/deliveries_provider_test.dart
```

Expected: provider tests pass.

---

### Task 2: Rider Home Active/New Semantics And Layout

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart`
- Create: `apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart`

- [ ] **Step 1: Write failing home tests**

Add widget tests for:

- assigned-only state does not show `Active Stop`
- mixed active and assigned state shows `Active Stop` for the in-progress assignment
- cockpit shell renders the GRID banner and route map panel

- [ ] **Step 2: Run home tests to verify failure**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/screens/rider_home_screen_test.dart
```

Expected: assigned-only behavior fails before implementation.

- [ ] **Step 3: Implement home layout**

Update `RiderHomeScreen` so the header is a single compact row, `active` comes only from `state.activeDelivery`, and new assignments remain route stops without becoming active stop cards. Use a fallback route panel/empty message when no active assignment exists.

- [ ] **Step 4: Run home tests to verify pass**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/screens/rider_home_screen_test.dart
```

Expected: home screen tests pass.

---

### Task 3: Screenshot-Aligned Home Widgets

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_branding_banner.dart`
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_panel.dart`
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_stop_timeline.dart`
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_active_stop_card.dart`
- Create: `apps/mobile/test/features/rider/home/widgets/rider_active_stop_card_test.dart`
- Create: `apps/mobile/test/features/rider/home/widgets/rider_stop_timeline_test.dart`

- [ ] **Step 1: Write failing widget tests**

Add widget assertions for active stop content/actions and stop rail structure. Avoid brittle pixel goldens; assert text, action widgets, capped stop count, check node, chevron node, and theme-colored containers where practical.

- [ ] **Step 2: Run widget tests to verify failure**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/widgets/
```

Expected: at least one new visual-structure assertion fails before implementation.

- [ ] **Step 3: Implement widget visual pass**

Tighten banner padding/typography/dot density, make the route map a stable dominant board, replace map stop markers with rider-specific dark/yellow stop pins, replace the rider marker with an angled yellow car treatment, change the rail to screenshot-style check/five-stop/chevron structure, and compact the active stop card.

- [ ] **Step 4: Run widget tests to verify pass**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/widgets/
```

Expected: home widget tests pass.

---

### Task 4: Rider-Specific Bottom Navigation

**Files:**
- Modify: `apps/mobile/lib/shared/widgets/app_bottom_nav.dart`
- Modify: `apps/mobile/lib/shared/widgets/scaffold_with_nav.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`

- [ ] **Step 1: Add or extend widget coverage**

If existing shared nav tests are present, extend them; otherwise add focused assertions in rider home tests that the rider shell can build with the rider nav mode. The rider nav mode should be opt-in.

- [ ] **Step 2: Run focused tests**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/screens/rider_home_screen_test.dart
```

Expected: tests compile and expose any missing constructor/API updates.

- [ ] **Step 3: Implement rider nav mode**

Add an enum or boolean style option to `ScaffoldWithNav`/`AppBottomNav` so rider can keep the center plus slot but render it as a compact embedded yellow rounded square. Update only the rider shell in `app_router.dart` to use the rider mode. Leave customer/admin defaults unchanged.

- [ ] **Step 4: Run rider home tests**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/screens/rider_home_screen_test.dart
```

Expected: rider home tests pass.

---

### Task 5: Focused Rider Verification

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: Run provider tests**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/deliveries/providers/deliveries_provider_test.dart
```

Expected: pass.

- [ ] **Step 2: Run rider home tests**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/home/
```

Expected: pass.

- [ ] **Step 3: Run rider test suite**

Run:

```bash
cd apps/mobile && fvm flutter test test/features/rider/
```

Expected: pass or report exact unrelated/pre-existing failures.

---

## Self-Review

- Spec coverage: screenshot-aligned rider home, rider-only nav style, route order, active/new semantics, status error semantics, and tests are represented.
- Placeholder scan: no placeholder-only tasks remain; each task has concrete files, commands, and expected outcomes.
- Type consistency: plan references existing `DeliveriesState`, `DeliveriesNotifier`, `RiderHomeScreen`, `RiderRouteMapPanel`, `RiderStopTimeline`, `RiderActiveStopCard`, `ScaffoldWithNav`, and `AppBottomNav`.
