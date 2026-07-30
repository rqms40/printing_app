# Rider Live Navigation (Phase B2, issue #84) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Camera-follow driving mode, off-route detection with a rider-triggered replan, and hardened queue-privacy gating for the already-shipped live position stream.

**Architecture:** The 2026-07-15 audit proved live rider positions already stream to the eligible customer over `ws/location` with `canTrackDelivery` gating (`server/src/riders/location.gateway.ts:66-137`), and `reoptimizePlan` exists behind an admin-only endpoint (`dispatch-plan.service.ts:135`, `/admin/riders/:id/dispatch-plan/re-optimize`). B2 therefore adds: (1) a rider-scoped replan endpoint reusing `reoptimizePlan` for the caller's own plan, (2) mobile camera-follow + off-route detection on the active delivery map, and (3) explicit gateway gating tests. Routing failure stays a hard 503 `routing_unavailable`.

**Tech Stack:** NestJS 11 + Socket.IO (server, codex `gpt-5.6-sol` xhigh in worktree `../printing_app-rider-nav`), Flutter/flutter_map/Riverpod (mobile, Claude, same worktree after server task merges), Grok 4.5 adversarial privacy review before merge.

## Global Constraints

- Branch `feat/rider-live-navigation` off `agent/beta-coherence-program`.
- Later-queue customers must never receive assignment ids, geometry, or coordinates — position/size only (queue privacy, beta spec).
- No haversine fallback; OSRM failure → 503 `routing_unavailable` with the preserved plan.
- Server checks: `cd server && npm run lint:check && npm test`. Mobile checks: `fvm flutter analyze lib/ && fvm flutter test`.

---

### Task 1 (server, sol xhigh): rider-scoped replan endpoint + gateway gating tests

**Files:**
- Modify: `server/src/riders/riders.controller.ts` (new route), `server/src/riders/riders.service.ts:470` (authorize rider-owned replan)
- Test: `server/src/riders/riders.service.spec.ts`, `server/src/riders/location.gateway.spec.ts` (create if absent)

**Interfaces:**
- Produces: `POST /riders/dispatch-plan/re-optimize` (rider JWT) → same response shape as the admin re-optimize (new versioned plan or 503 `routing_unavailable` with `preservedPlan`). No request body; the rider's own remaining (pending) stops are re-optimized.

- [ ] **Step 1: Failing tests** — (a) a rider can re-optimize their own plan (service called with their riderProfileId, remaining stops only); (b) a rider without an active plan gets 404; (c) OSRM failure surfaces 503 `routing_unavailable` and the persisted plan is unchanged; (d) gateway: a socket subscribing to an assignment whose order it does not own is rejected; a customer at queue position 2 receives no `locationUpdate` events.
- [ ] **Step 2: Implement** the controller route (rider role guard, resolve rider profile from JWT, delegate to the existing `reoptimizeDispatchPlan`), keeping the admin route untouched.
- [ ] **Step 3: Checks pass; commit** `feat(riders): rider-triggered dispatch plan re-optimize with gating tests`.

### Task 2 (mobile, Claude): camera-follow driving mode

**Files:**
- Modify: `apps/mobile/lib/features/rider/shared/widgets/rider_map_view.dart`
- Test: `apps/mobile/test/features/rider/shared/widgets/rider_map_view_test.dart`

- [ ] Toggle button on the live map (`Key('camera-follow-toggle')`, semantics 'Follow my position'): when on, each tracker point moves the camera (`_mapController.move(animatedPoint, zoom kept)`), auto-disengaged by a manual pan (`onPointerDown` → off). Default off. Test: enabling then emitting a tracker point recenters; panning disengages.

### Task 3 (mobile, Claude): off-route detection + replan request

**Files:**
- Create: `apps/mobile/lib/features/rider/shared/off_route.dart` — `bool isOffRoute(LatLng point, List<LatLng> leg, {double thresholdMeters = 120})` (min perpendicular distance to leg segments, pure function, unit-tested with on/near/far fixtures)
- Modify: `rider_map_view.dart` (banner `Key('off-route-banner')` 'Off route — request a new plan?' with a 'Request replan' action, shown after 3 consecutive off-route fixes), `deliveries_provider.dart` (`requestReplan()` → `POST /riders/dispatch-plan/re-optimize`, then refresh; surface 503 as 'Road routing unavailable — keeping your current route')
- Test: off_route unit tests + provider test for the 503 copy

### Task 4: verification gate

- [ ] Server + mobile checks green; Grok read-only adversarial review of the diff focused on queue-privacy leakage; findings verified before merge; merge to program branch; contract e2e re-run; comment #84.
