# Batch Delivery System Design

**Date:** 2026-04-29
**Status:** Approved — ready for implementation plan
**Scope:** Phase 1 — slot-booked batch delivery with multi-destination, priority fee, and outside-Davao manual handoff

---

## Goal

Replace the current "submit one order at a time, single delivery fee" model with a slot-booked batch delivery system. The single-rider operation runs three fixed delivery time windows per day with strict per-slot capacity. Customers can queue multiple print jobs in their cart (existing feature) and check them out as one batch order pinned to one slot. Multi-destination orders ship one batch to multiple addresses for one base delivery fee plus a per-extra-destination surcharge. Customers can pay a flat priority fee for first-drop within a slot. Out-of-Davao addresses skip the slot system entirely and route through admin-managed third-party delivery.

---

## Architecture Summary

The mobile customer flow becomes:

```
Cart (existing "The Queue")
  → Destination Groups (new)
  → Address picker (existing, repeated per group)
  → Slot Picker (new, local) OR External Delivery Confirm (new, out-of-radius)
  → Order Summary (existing, augmented)
  → Payment (existing)
```

Admin gets new screens for slot-template editing, today's bookings dashboard, and an out-of-area delivery queue.

Backend gets new entities for slot templates and bookings, multi-destination groups, plus a WebSocket gateway pushing live capacity updates.

Concurrency safety on slot booking is enforced server-side with `SELECT … FOR UPDATE` inside the batch-create transaction.

---

## Data Model

### New entities

**`DeliverySlotTemplate`** — admin-configurable recurring weekly schedule.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `dayOfWeek` | int 0–6 | Sunday = 0 |
| `startTime` | time | "09:30" |
| `endTime` | time | "11:30" |
| `capacity` | int | Default 10 |
| `isActive` | bool | Default true |

Three templates per weekday seeded matching the current schedule:
- 09:30 – 11:30 (10 stops)
- 14:00 – 16:00 (10 stops)
- 21:00 – 23:00 (10 stops)

**`DeliverySlotBooking`** — actual booked slot for a specific date.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `slotTemplateId` | FK | references `DeliverySlotTemplate.id` |
| `date` | date | YYYY-MM-DD |
| `batchOrderId` | FK unique | references `BatchOrder.id` |
| `bookedAt` | timestamp | |
| `priority` | bool | Default false |
| `priorityRank` | int nullable | Admin-managed drop order within slot |

Capacity check counts active rows where `slotTemplateId + date` matches AND the linked batch order's `orderStatus` is not `cancelled` / `file_declined`. One batch order = one stop, regardless of destination count (per Q3 = A).

**`DeliveryDestination`** — multi-destination groups inside a batch.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `batchOrderId` | FK | references `BatchOrder.id` |
| `addressId` | FK | references `Address.id` |
| `label` | varchar(100) nullable | "Office", "Home" |
| `sortOrder` | int | |

A batch has 1..N destinations. Single-destination batches still create one `DeliveryDestination` row for uniformity.

### Modified entities

**`BatchOrder`** adds:

| Column | Type | Notes |
|---|---|---|
| `deliveryType` | varchar | `'local'` or `'external'`, default `'local'` |
| `slotBookingId` | FK nullable | null when `external` |
| `priorityFee` | decimal(10,2) | Default 0 |
| `extraDestinationFee` | decimal(10,2) | `(destinationCount - 1) * surcharge` frozen at create |
| `externalDeliveryStatus` | varchar nullable | `'pending_admin'`, `'booked'`, `'delivered'` (only when `external`) |

**`Order` (per cart item)** adds `destinationId` FK to `DeliveryDestination`.

### New admin settings (in existing `app_settings` or a new `delivery_settings` row)

- `serviceCenterLat`, `serviceCenterLng` — anchor point for radius check
- `serviceRadiusKm` — local-vs-external threshold
- `priorityFeeAmount` — flat priority fee (default ₱50)
- `extraDestinationSurcharge` — flat per-extra-destination fee (default ₱30)

---

## Backend API (NestJS)

### Customer endpoints

**`GET /delivery-slots?date=YYYY-MM-DD`**
Returns the active slot templates for that date with live booked counts.
Response: `[{ templateId, startTime, endTime, capacity, bookedCount, isFull }]`.

**`POST /batch-orders`** (extends existing endpoint)
Adds fields: `slotTemplateId?`, `slotDate?`, `priority`, `destinations[]`, `deliveryType`. Inside one transaction:

1. Determine `deliveryType` server-side from destination addresses (override anything client says).
2. If `local`: `SELECT … FOR UPDATE` count of `DeliverySlotBooking` for `(slotTemplateId, date)` excluding cancelled/declined; reject 409 `slot_full` if `>= capacity`.
3. Create `BatchOrder` with frozen `priorityFee`, `extraDestinationFee`.
4. If `local`: create `DeliverySlotBooking` row.
5. Create `DeliveryDestination[]` rows from request payload.
6. Create per-item `Order` rows, each pointing to its `destinationId`.
7. Run existing payment / credit-deduction / notification flow.
8. Emit `slot-updated` over `/ws/delivery-slots` (only for `local`).

**`PATCH /batch-orders/:id/cancel`**
If batch is `local` and current time is before slot start: cancellation succeeds, slot is freed, `slot-updated` is emitted. Past cutoff: returns 409 `cancellation_closed`.

### Admin endpoints

- `GET /admin/delivery-slot-templates`, `PATCH /admin/delivery-slot-templates/:id`, `POST /admin/delivery-slot-templates`, `DELETE /:id`
- `GET /admin/delivery-slots/today` — three slot cards with bookings + priority order
- `PATCH /admin/slot-bookings/:id/order` — drag-to-reorder priority drop sequence
- `GET /admin/external-deliveries?status=pending_admin|booked|delivered`
- `PATCH /admin/external-deliveries/:id/status`
- `GET /admin/settings/delivery`, `PATCH /admin/settings/delivery`

### WebSocket gateway `/ws/delivery-slots`

Authenticated like chat (JWT in handshake).
Customer slot picker subscribes via `subscribe-slots {date}`.
Server emits `slot-updated { templateId, date, bookedCount }` on every booking and cancellation.

### Concurrency

Booking uses `SELECT … FOR UPDATE` on the active-bookings count, all inside the create-batch transaction. Two simultaneous requests on the last seat: first commits, second rolls back with 409.

---

## Mobile (Customer) Flow

### New screens

**`DestinationGroupsScreen`**
Lists cart items. Default state is one group containing all items. Customer taps "+ New Destination", drags items in, names the group ("Office"). Each group resolves to one `DeliveryDestination`. Single-destination users effectively skip past this with one tap.

**`SlotPickerScreen`**
Three slot cards in a vertical list. Each card shows:
- Time window ("9:30 AM – 11:30 AM")
- Live capacity bar with text "8/10 booked"; color shifts to red as it nears full
- "Full" overlay and disabled tap when `bookedCount >= capacity`

Below the cards: priority toggle "Priority drop +₱50" (label uses live admin-configured amount). WebSocket subscription on mount; counter updates live. Picker re-renders Full state immediately on incoming `slot-updated` events.

**`ExternalDeliveryConfirmScreen`**
Replaces slot picker when any destination is outside the service radius (per Q13 = A: whole-batch external):
- "We deliver this address through a partner courier"
- Estimated fee: "TBD — admin will confirm within 30 min"
- Confirm button → creates batch with `deliveryType: external`, `externalDeliveryStatus: pending_admin`

### State management

New `OrderCheckoutNotifier` (Riverpod) holds destination groups, slot selection, priority toggle across the new screens. Cart provider stays unchanged. New `DeliverySlotProvider` exposes slot availability and applies WS updates.

### Updated screens

- `OrderSummaryScreen` — destination count, slot time (or "External courier"), priority badge, full fee breakdown
- `OrderDetailScreen` — slot info, per-destination tracking

---

## Admin (React) Surface

### New pages

**`/delivery-slots` — Slot Schedule editor**
Table of slot templates by day-of-week. Click a row → drawer with editable Start, End, Capacity, Active toggle. Save calls `PATCH /admin/delivery-slot-templates/:id`. "Add slot" creates a new template.

**`/delivery-slots/today` — Today's bookings dashboard**
Three cards (one per slot template instance for today). Each card shows capacity bar, list of bookings (customer, destination count, priority flag, status), and drag-to-reorder priority sequence persisted via `PATCH /admin/slot-bookings/:id/order`. Subscribes to `/ws/delivery-slots` for live updates.

**`/external-deliveries` — Out-of-area queue**
New tab in admin nav. Filters: `pending_admin` (default), `booked`, `delivered`. Each row: customer, address, items, "Mark as Booked" button (records the 3PL choice via PATCH). No 3PL API integration in Phase 1 — admin books courier externally and records the result.

**`/admin/settings/delivery`**
Service center lat/lng (with embedded map picker), service radius (km), priority fee amount, extra-destination surcharge.

### Updated pages

- **Orders list** — new "Slot" column, "External" tag for non-local, priority badge
- **Order detail** — slot info, list of destinations, priority indicator, admin override to release a slot booking

---

## Edge Cases

**Booking conflicts on the last seat**
Customer A and B both tap the last slot at the same instant. `SELECT … FOR UPDATE` serializes them. First commits → second rolls back with 409 `slot_full`. Mobile shows: "This slot just filled up — please pick another." Picker auto-refreshes from the WS event the first booking emitted.

**Stale picker**
Customer sits on the slot picker; slot fills via WS. Card re-renders to "Full" with greyed-out tap target. Late tap that beat the WS event still hits the server-side capacity check and returns 409.

**Cancellation past cutoff**
Returns 409 `cancellation_closed`. Slot count is NOT released. UI: "This slot is in progress. Contact support to cancel."

**Address has no lat/lng**
Treat as `external` to be safe. UI tells customer: "Address location uncertain — admin will confirm fee."

**Address sits exactly on the radius boundary**
Use `<=` (inclusive) so the boundary is local.

**Multi-destination, one address out-of-radius (per Q13 = A)**
Whole batch becomes `external`. Slot picker is hidden. UI: "One of your destinations is outside our zone — this whole order will go via partner courier."

**Priority on a full slot (per Q4 = A)**
Priority does NOT bypass capacity. Full slot = no booking, priority or not.

**Admin disables a slot template while bookings exist**
Disabling does not cancel existing bookings. Future dates won't show the disabled slot, but already-booked occurrences remain. Admin can override individual bookings if needed.

**Network failure mid-booking**
Mobile uses idempotency key (existing pattern). Retry returns the same batch order; no duplicate booking, no double-charge.

**Fee recomputation**
Fees are computed server-side at batch-create time and frozen on the row. Changing the priority-fee setting later does not retroactively re-bill existing batches.

---

## Testing Strategy

### Backend (Jest + NestJS testing module)

**Unit:**
- `DeliverySlotService.getAvailability(date)` — returns correct `bookedCount` excluding cancelled/declined batches.
- `DeliverySlotService.bookSlot()` — happy path; over-capacity throws `SlotFullException`; cancellation past cutoff throws `CancellationClosedException`.
- `GeoRadiusService.isInsideServiceArea(lat, lng)` — boundary cases (exactly on radius = inside, no coords = external).
- `BatchOrderService.createBatch()` — fee math: `subtotal + baseFee + (destinations-1)*surcharge + (priority ? priorityFee : 0)`. External orders get no slot row, no slot fee.

**Integration (real DB, supertest):**
- Two parallel `POST /batch-orders` racing the last seat — exactly one succeeds.
- Cancel-before-cutoff frees capacity (next booking succeeds where it would have failed).
- Cancel-after-cutoff returns 409 and slot stays consumed.
- External flow: out-of-radius address → batch created with `deliveryType: external`, no `slotBookingId`, listed in admin external queue.

**WebSocket:**
- Two clients on `/ws/delivery-slots`; one books, the other receives `slot-updated` with correct `bookedCount`.

### Mobile (Flutter)

**Provider tests** (Riverpod + mocked Dio + mocked WebSocketService):
- `OrderCheckoutNotifier` — destination groups, slot selection, priority toggle update fee preview correctly.
- `DeliverySlotProvider` — fetches slots, applies WS `slot-updated` event, marks full slots locked.
- Out-of-radius address selection switches the flow to external confirm screen.

**Widget tests:**
- `SlotPickerScreen` renders three cards with correct capacity bars; full slots are disabled.
- Priority toggle updates the displayed fee.
- `DestinationGroupsScreen` add/remove group, drag item between groups.
- `ExternalDeliveryConfirmScreen` shown when any destination is out-of-radius.

### Admin (React + Vitest/RTL)

- `DeliverySlotsTodayPage` correctly groups bookings by template; drag-reorder fires PATCH.
- `ExternalDeliveriesPage` filters by status; marking booked updates the row.

### E2E smoke (manual after deploy)

- Book slot from mobile A → counter ticks live on mobile B's slot picker → admin sees booking on `today` dashboard.
- Out-of-area address → external batch appears in admin external queue.
- Cancel before slot start → slot count drops; new booking can take that seat.

---

## Decisions Recap

| Decision | Choice |
|---|---|
| Slot config | DB-stored, admin-editable (Q2 = B) |
| Stop counting | 1 batch = 1 stop, multi-destination doesn't multiply (Q3 = A) |
| Priority benefit | First-drop within same slot, no capacity bypass (Q4 = A) |
| 3PL approach | Manual admin handoff, no API integration in Phase 1 (Q5 = B) |
| Outside-Davao detection | Geo-radius from service center (Q6 = B) |
| Live counter | WebSocket push (Q7 = A) |
| Slot release | Cancel before cutoff only (Q8 = recommended) |
| Multi-destination fee | Base + per-extra-destination surcharge (Q9 = B) |
| Cart persistence | Already exists (Hive local-only) |
| Multi-destination granularity | Destination groups (Q11 = B) |
| Priority fee model | Flat amount, admin-configurable (Q12 = A) |
| Outside-Davao UI | Hide slot picker, show external confirm (Q13 = A) |
| Slot picker location | Dedicated screen (Q14 = A) |

---

## Out of Scope (Phase 2)

- Lalamove / Grab API integration (replaces manual admin handoff)
- Per-day slot overrides for holidays
- Server-side cart sync across devices
- Distance-based delivery fee (vs. flat per-extra-destination)
- Stop-aware capacity (multi-destination eats N stops)
- Hybrid local + external batches in one order
