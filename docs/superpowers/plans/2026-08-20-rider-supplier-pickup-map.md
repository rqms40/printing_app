# Rider Supplier Pickup Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On marketplace rider assignment, auto-build a two-stop OSRM plan (supplier pickup then customer delivery) and show both pins on the rider map, switching the active route at pickup.

**Architecture:** Server-authoritative. Supplier profiles store lat/lng. Marketplace assignments expand to two `dispatch_plan_stops` (`pickup` + `dropoff`). Rider clients render pins from the assignment payload and polylines from persisted geometry only. Beta store→customer dispatch is unchanged.

**Tech Stack:** NestJS + TypeORM + Postgres, Flutter/Riverpod rider + supplier surfaces, Refine/Ant Design admin.

**Spec:** `docs/superpowers/specs/2026-08-20-rider-supplier-pickup-map-design.md`

## Global Constraints

- Clients never call a routing service.
- Customer tracking stays after confirmed pickup; no supplier coords on customer payloads.
- One marketplace job per rider; beta multi-stop is unchanged.
- Routing failure at auto-plan keeps the assignment (pins without route).
- Do not revert unrelated local changes on `GridGOv3.1`.
- Money stays PHP minor units; no secrets in git.

## Files

- Create: `server/migrations/1786516600000-supplier-pickup-map.ts`
- Modify: `server/src/suppliers/entities/supplier-profile.entity.ts`
- Modify: `server/src/suppliers/dto/update-supplier-profile.dto.ts`
- Modify: `server/src/suppliers/suppliers.service.ts`
- Modify: `server/src/riders/entities/dispatch-plan-stop.entity.ts`
- Modify: `server/src/riders/dispatch-plan.service.ts`
- Modify: `server/src/riders/riders.service.ts`
- Modify: `server/src/riders/riders.module.ts`
- Modify: `server/src/seed.ts`
- Modify: `apps/mobile` rider map + parser + supplier profile
- Modify: `admin` supplier profile + order assign errors
- Modify: `e2e/mobile-web/tests/marketplace-workflow.spec.ts`

---

### Task 1: Persistence (supplier coords + stop kind)

- [x] Spec locked
- [ ] Migration + entities + seed pin + DTO/service + unit tests

### Task 2: Dispatch planning + assignment JSON

- [ ] Two-stop expansion, origin from rider GPS, assert/advance/skip, auto-plan, queue privacy

### Task 3: Supplier pin UI

- [ ] Mobile + admin profile map pin; API wiring

### Task 4: Rider map

- [ ] Parse payload; two pins; bold/faded legs; active card/rail

### Task 5: Admin assign errors + marketplace contract

- [ ] Error copy; contract step 9/10 note

### Task 6: Surface checks

- [ ] `cd server && npm test` (targeted then broader)
- [ ] `cd admin && npx tsc --noEmit`
- [ ] `cd apps/mobile && flutter analyze lib/` (or fvm)
)
