# Rider supplier pickup map (design)

Date: 2026-08-20
Status: approved for implementation
Surfaces: server, mobile rider, admin/supplier profile
Related: `docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md`,
`docs/superpowers/plans/2026-08-04-managed-marketplace-migration.md` Phase 7

## Problem

Marketplace jobs are picked up at the assigned supplier shop, then delivered
to the customer. The rider map today only pins the **customer delivery**
destination. Dispatch plans still treat `GRIDGO_STORE_*` as origin and one
`dispatch_plan_stops` row per assignment (customer coords only).

Supplier profiles store a text `address` and **no coordinates**, so the shop
cannot be routed or pinned.

## Goal

When ops/superadmin marks a **marketplace** order `rider_assigned`:

1. The rider map shows the **supplier shop** and the **customer delivery**
   as two pins.
2. A persisted OSRM route is built immediately (no extra dispatch-plan
   click).
3. Before pickup, the **active** route is the pickup leg (plan origin →
   supplier). After the rider marks **Picked up**, the **active** route
   becomes the delivery leg (supplier → customer). Both pins stay.
4. One marketplace job per rider at a time.

Beta multi-stop dispatch (store origin → up to five customer deliveries)
is unchanged.

Customer live tracking stays after confirmed pickup, customer address only.
Customers never see the supplier pin.

## Locked decisions

| Decision | Choice |
| --- | --- |
| Map after pickup | Keep both pins; switch the active route |
| Supplier coordinates | Lat/lng on `supplier_profiles`; pin on profile edit |
| Missing supplier pin | Block marketplace rider assignment (`supplier_location_required`) |
| When the route appears | Immediately on rider assignment (auto two-stop plan) |
| Concurrent jobs | One marketplace job at a time (`rider_has_active_assignment`) |
| Trip model | Two persisted OSRM stops per marketplace assignment |
| Routing down at assign | Assignment still created; pins show; route line waits |
| Next/previous leg | Draw it faded; bold only the current pending leg |
| Customer map | Unchanged (after-pickup, customer dest only) |

## Architecture

Server is authoritative. Clients never call a routing service.

A marketplace assignment expands to two `dispatch_plan_stops` on one plan:

```text
plan origin  →  stop 1 pickup (supplier)  →  stop 2 dropoff (customer)
```

- **Plan origin:** rider `lastLatitude`/`lastLongitude` when those coords
  are valid (finite, in range, not `0,0`). Otherwise the existing
  `GRIDGO_STORE_LATITUDE` / `GRIDGO_STORE_LONGITUDE` value, used only as a
  routing start. Marketplace maps do **not** render that fallback as a
  GRIDGO shop pin.
- **Stop 1 (`kind=pickup`):** assigned supplier `latitude`/`longitude`.
- **Stop 2 (`kind=dropoff`):** order delivery destination coords.

The rider map always pins supplier + customer from the assignment payload.
Route polylines come only from persisted `legGeometry`. The current pending
stop’s leg is bold; the other leg is faded.

`persistPreparedPlan` writes the **prepared** origin (rider last GPS or
store fallback), not always `GRIDGO_STORE_*`. Beta plans still use the
store origin.

Beta plans keep one `kind=dropoff` stop per assignment and the store
origin. Mixing marketplace two-stop jobs and beta customer-only jobs in
the same plan is a `400`.

## Data model

### `supplier_profiles`

Add nullable:

- `latitude` `decimal(10,7)`
- `longitude` `decimal(10,7)`

Check: when either is non-null, both are non-null, lat ∈ [-90, 90], lng ∈
[-180, 180], and not `(0, 0)`.

Seed `Davao Print Co` (`supplier@gridgo.ph`) with a pin near the seeded
text address `Quimpo Blvd, Ecoland, Davao City`, **distinct** from
`MapHelpers.shopPoint` / `GRIDGO_STORE_*` (`7.064, 125.6079`). Use
`7.0505, 125.5889` (Ecoland / Quimpo area).

### `dispatch_plan_stops`

Add:

- `kind` enum `dispatch_stop_kind_enum`: `pickup` | `dropoff`
- default `dropoff` so existing beta rows stay valid

Replace unique `(plan_id, assignment_id)` with unique
`(plan_id, assignment_id, kind)`. Keep unique `(plan_id, sequence)`.

Existing rows backfill `kind = dropoff`.

Migration timestamp after current latest (`1786516452843-ChatSettings.ts`),
single migration for both schema changes.

### Rider assignment JSON

Marketplace assignments include supplier pickup even when unplanned:

```ts
supplierPickup: {
  supplierId: number;
  businessName: string;
  address: string | null;
  latitude: number;
  longitude: number;
} | null  // null on beta / no supplier
```

Plan attachment (each assignment appears **once** in rider lists, even
when it has two stops):

- `dispatchPlanStop`: current **pending** stop for this assignment (compat).
- `dispatchPlanStops`: all stops for this assignment, ordered by `sequence`,
  each including `kind`, destination coords, leg metrics, `legGeometry`.

`order.destination` remains the customer delivery snapshot.

Customer-facing queue fields (`deliveryQueuePosition`, `deliveryQueueSize`,
`canTrackDelivery`) count **`dropoff` stops only**. A marketplace job is
queue size 1. Pickup legs must not become a customer queue entry.
`canTrackDelivery` stays true only when that dropoff is the first remaining
customer stop **and** the assignment is `on_the_way` or `arrived`.

Beta: `supplierPickup` is `null`; `dispatchPlanStops` has at most one
`dropoff` row.

### Supplier profile API

`GET/PATCH /suppliers/me` and admin supplier update accept/return
`latitude` / `longitude` with the same numeric validation as addresses
(`CreateAddressDto` range rules). Clearing the pin sends both as `null`.

## Assignment and status flow

Marketplace order = has a current `supplier_assignments` row with
`decision = accepted`.

### `assignOrderToRider` (marketplace only)

After today’s ready-for-dispatch / availability checks, and **before**
commit:

1. Load the accepted supplier profile. If lat/lng are missing or invalid
   → `400` `{ code: 'supplier_location_required' }`.
2. If the customer destination is not routeable → `400` (same wording as
   dispatch planning: no routeable destination).
3. If the rider already has a current assignment whose status is in
   `assigned | accepted | picked_up | on_the_way | arrived`
   → `409` `{ code: 'rider_has_active_assignment' }`.

This gate does **not** apply when assigning a non-marketplace (beta)
order. Beta multi-customer dispatch stays on the existing assign +
`POST /admin/riders/:id/dispatch-plan` path.

After the assignment commits, auto-create a two-stop plan for that
assignment (`origin → pickup → dropoff`). No TSP: stop order is fixed.

If OSRM returns `routing_unavailable`, **keep the assignment**. Pins
still serialize from `supplierPickup` + `order.destination`.
`dispatchPlanState` stays `unplanned` until ops retries or a later
re-optimize succeeds. Do not fail the HTTP assign with 503.

### Stop advancement

`assertCurrentStop` / `advanceStop` must not `findOne({ assignmentId })`
once two rows share an assignment. Match the **current pending** stop
(lowest `sequence` with `status=pending`) and require its `assignmentId`.

| Rider status | Plan action |
| --- | --- |
| `picked_up` | `assertCurrentStop`; complete current stop (`kind=pickup`) |
| `arrived` / `delivered` | `assertCurrentStop` (current must be this assignment’s `dropoff`); `delivered` completes it |
| `declined` / `failed` | skip **all remaining pending** stops for this assignment |

`picked_up` must call `assertCurrentStop` (today it does not). Completing
pickup while a pickup stop is not current is `400`.

### Planning helpers

`loadPlanningAssignments` for marketplace assignments yields two
`PlanningAssignment` points (pickup then dropoff) bound to the same
`assignment`. Beta still yields one customer point.

`createPlan` / `reoptimizePlan`:

- All selected assignments marketplace → two-stop expansion, max **one**
  assignment (the one-job rule).
- All selected assignments beta → existing 1–5 customer stops from store
  origin.
- Mixed → `400`.

In-transit anchor after pickup: remaining pending stop is `dropoff`.
Re-optimize may emit a new plan version with only remaining pending
stops. **Pins still come from `supplierPickup` + destination**, so a
dropped completed pickup row must not remove the supplier pin.

## Rider UI

Surfaces: home cockpit (`RiderCockpitMap` / `RiderRouteMapTile`),
active delivery map (`RiderMapView`), stop rail, active stop card,
delivery detail.

### Pins

- Supplier: existing store marker (`MapHelpers.shopMarker`) at
  `supplierPickup` coords. Label: supplier `businessName`.
- Customer: existing numbered / destination marker at
  `order.destination`. Never substitute GRIDGO `shopPoint` when
  `supplierPickup` is present.

Both pins remain for `assigned` through `arrived`. They leave when the
assignment is terminal.

### Route

- Draw every stop in `dispatchPlanStops` that has geometry.
- Current pending stop: bold (existing “current” style).
- Other stops: faded (existing “completed” style for done pickup; same
  faded treatment for the not-yet-active dropoff before pickup).
- No client-side routing. Unplanned marketplace jobs: pins only, same
  empty-route copy as today plus supplier pin.

### Active stop card / copy

| Assignment status | Card title / primary address | Secondary |
| --- | --- | --- |
| `assigned`, `accepted` | Supplier business name | Supplier address; “Pickup” |
| `picked_up`, `on_the_way`, `arrived` | Customer name | Customer delivery address; “Delivery” |

Stop rail for a marketplace job: two nodes, “1” pickup and “2”
delivery. `currentStopIndex` follows the current pending stop’s
`sequence`.

### Supplier profile pin

Reuse `MapPinPicker` on:

- Mobile supplier profile edit
- Admin supplier portal profile (`admin/src/pages/supplier/profile.tsx`)

Saving without a pin leaves lat/lng null (new suppliers). Ops cannot
assign a rider until the shop is pinned. Helper copy: “Drop a pin on
your shop. Riders use this as the pickup stop.”

## Error handling

| Case | HTTP | Code | Client |
| --- | --- | --- | --- |
| Marketplace assign, supplier has no pin | 400 | `supplier_location_required` | Admin order assign shows “Supplier shop pin required” |
| Marketplace assign, rider busy | 409 | `rider_has_active_assignment` | Admin: “Rider already has an active job” |
| Marketplace assign, no customer dest | 400 | existing destination error | Unchanged |
| OSRM down at auto-plan | assign 200 | assignment `unplanned` | Rider pins show; “No route planned yet”; stale banner if a later re-optimize marks stale |
| Pickup while dropoff is current | 400 | existing current-stop error | Rider cannot skip pickup |
| Deliver while pickup still pending | 400 | current-stop error | Unchanged sequence |

Do not leak supplier coordinates on customer order payloads.

## Testing

### Server

- Migration: supplier lat/lng checks; stop unique `(plan, assignment, kind)`;
  existing plans backfill `kind=dropoff`.
- Supplier profile PATCH validates / clears coords.
- `assignOrderToRider` marketplace: requires pin; blocks second job;
  auto-creates two-stop plan origin → pickup → dropoff; beta assign still
  allows a second customer and does not auto-plan.
- Routing failure after assign: assignment persists, no plan.
- `picked_up` completes pickup stop; `delivered` completes dropoff;
  decline/fail skips remaining stops for that assignment.
- `assertCurrentStop` with two rows for one assignment.
- `createPlan` mixed marketplace+beta → 400.
- Queue privacy / `canTrackDelivery` still false until pickup +
  `on_the_way`/`arrived`. Customer enrichment has no `supplierPickup`.
  Marketplace `deliveryQueueSize` is 1 (dropoff only; pickup is not a
  customer queue stop).

### Mobile

- Parser: `supplierPickup` + `dispatchPlanStops` + `kind`.
- Map tile / map view: two pins; bold current leg; faded other leg;
  no GRIDGO shop pin when `supplierPickup` is set.
- Active stop card switches supplier → customer at `picked_up`.
- Unplanned marketplace: both pins, no polyline.
- Beta assignment without `supplierPickup`: today’s single-pin behavior.

### Admin

- Assign error copy for the two new codes.
- Supplier profile form saves lat/lng.

Do not run destructive beta e2e unless this branch is on an isolated
loopback stack. Non-mutating marketplace contract
(`e2e/mobile-web/tests/marketplace-workflow.spec.ts`) should mention
supplier pickup as the first rider-map stop after step 9.

## Out of scope

- Geocoding a text address into coords.
- Customer-facing supplier map pin or pickup ETA.
- Multi-stop marketplace (several supplier pickups in one plan).
- Changing live-tracking start (still confirmed pickup).
- Forcing a shop pin on supplier signup (only required at rider assign).
- Admin dispatch-plan panel UX redesign (auto-plan covers the happy path;
  mixed-plan 400 is enough).

## Implementation units

1. **Persistence:** supplier coords + stop `kind` + seed pin + tests.
2. **Planning:** two-stop expansion, `assert`/`advance`/`skip` by current
   pending stop, auto-plan after marketplace assign, assignment JSON.
3. **Supplier pin UI:** mobile + admin profile picker and API wiring.
4. **Rider map:** parse payload; two pins; active/faded legs; card/rail
   copy; tests.
5. **Admin assign errors** + marketplace contract note.
)
