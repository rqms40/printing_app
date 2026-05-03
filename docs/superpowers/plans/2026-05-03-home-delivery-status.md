# Home Delivery Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show batch-slot progress on the customer Home screen unless a real rider location is available for an `on_the_way` delivery, and order driver queues by route proximity.

**Architecture:** Keep the Home bento layout intact and evolve `MapTrackingTile` into a delivery-status tile backed by the existing `deliverySlotProvider`, `liveDeliveryMapProvider`, and `liveDriverLocationProvider`. Route optimization stays server-side in `DriversService.getActiveAssignments` as a deterministic service-layer ordering over loaded assignment destinations.

**Tech Stack:** Flutter, Riverpod, flutter_map, NestJS, TypeORM, Jest.

---

### Task 1: Mobile Home Delivery Status Tile

**Files:**
- Modify: `apps/mobile/test/features/customer/home/widgets/map_tracking_tile_test.dart`
- Modify: `apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart`

- [ ] Write widget tests for idle batch rows, non-matching location gating, and active live map.
- [ ] Run `cd apps/mobile && flutter test test/features/customer/home/widgets/map_tracking_tile_test.dart` and confirm the new tests fail.
- [ ] Update `MapTrackingTile` to render the Delivery Status card, today's slot rows, and live map only for matching `on_the_way` location updates.
- [ ] Re-run the widget test and confirm it passes.

### Task 2: Driver Route Queue Ordering

**Files:**
- Modify: `server/src/drivers/drivers.service.spec.ts`
- Modify: `server/src/drivers/drivers.service.ts`

- [ ] Write Jest tests for nearest-neighbor active assignment ordering and missing-coordinate fallback ordering.
- [ ] Run `cd server && npx jest src/drivers/drivers.service.spec.ts --no-coverage` and confirm the new tests fail.
- [ ] Update `DriversService.getActiveAssignments` to load destinations and order active assignments from driver GPS or shop coordinates.
- [ ] Re-run the Jest test and confirm it passes.

### Task 3: Verification And Review

**Files:**
- Review: `apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart`
- Review: `server/src/drivers/drivers.service.ts`

- [ ] Run focused mobile and server tests.
- [ ] Dispatch reviewer/QA agents for mobile UI behavior and server queue behavior.
- [ ] Fix any critical or important findings.
