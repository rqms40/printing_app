# Client Preference Auto-Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clients set Quality / Price / Speed, get an auto-matched shop when they pick a product category, browse the shared catalog, and pay a shop-to-address delivery fee.

**Architecture:** Server-authoritative preview-match + fee quote. Real `SupplierAssignment` is created by system after artwork QA. Shared GRID catalog is unchanged.

**Tech Stack:** NestJS + TypeORM + Postgres, Flutter/Riverpod client, existing OSRM routing provider.

**Spec:** `docs/superpowers/specs/2026-08-20-client-preference-auto-match-design.md`

## Global Constraints

- Clients never call a routing service or rank shops locally.
- Suppliers never see unapproved artwork (assignment after `approved_for_matching`).
- Money in PHP pesos + minor units; client `deliveryFee` is a hint.
- Do not revert unrelated local changes on `GridGOv3.1`.
- Beta store-origin dispatch is unchanged.

## Files

- Create: `server/migrations/1786516700000-matching-preference.ts`
- Modify: `server/src/users/profile.constants.ts`
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/users/dto/update-profile.dto.ts`
- Modify: `server/src/users/users.service.ts`
- Modify: `server/src/matching/matching.ranking.ts`
- Modify: `server/src/matching/matching.ranking.spec.ts`
- Modify: `server/src/matching/matching.service.ts`
- Modify: `server/src/matching/matching.module.ts`
- Create: `server/src/matching/matching-preview.controller.ts`
- Modify: `server/src/orders/entities/order.entity.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/quality/quality.service.ts`
- Modify: mobile auth/profile/order/checkout files listed in tasks 5–6

---

### Task 1: Ranking by preference

- [ ] Tests for quality / price / speed sort, missing pin, price without dest
- [ ] Implement `sortByMatchingPreference` + pin filter + haversine
- [ ] Run `cd server && npx jest src/matching/matching.ranking.spec.ts --no-coverage`

### Task 2: Persistence

- [ ] Migration `users.matching_preference` + `orders.preferred_supplier_id`
- [ ] Entity / DTO / profile update
- [ ] User service + spec

### Task 3: Preview API + fee quote

- [ ] `POST /matching/preview` (client JWT)
- [ ] OSRM fee for winner; haversine only for ranking
- [ ] Specs for no-eligible, fee formula, 401

### Task 4: Place order + post-QA auto-assign

- [ ] Server re-rank writes `preferredSupplierId` and delivery fee
- [ ] On `approved_for_matching`, system `autoMatchPreferred`
- [ ] Ops assign still works as override

### Task 5: Mobile preference

- [ ] Onboarding + account details Quality / Price / Speed
- [ ] Parse/save `matchingPreference`

### Task 6: Mobile catalog + checkout

- [ ] Preview on orderable category select
- [ ] Matched-shop chip; empty state
- [ ] Checkout uses quoted fee; refresh on address change
