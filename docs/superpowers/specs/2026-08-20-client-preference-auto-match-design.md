# Client preference auto-match (design)

Date: 2026-08-20
Status: approved for implementation
Surfaces: server, mobile client (onboarding, settings, catalog, checkout)
Related: `docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md`,
`server/src/matching/matching.ranking.ts`

## Problem

Clients pick a print category from the shared GRID catalog, but the shop that
will produce the job is chosen later by ops matching. Checkout delivery fee is
a flat ₱25 (or a geo-zone base) and does not use the supplier–customer
distance. Clients have print-type tags (`printingPreferences`) but no
Quality / Price / Speed shopping preference.

## Goal

1. During client onboarding (and later in Account details) the client picks
   **one** matching preference: Quality, Price, or Speed.
2. Start printing → choose a product category (existing catalog drill-down).
3. The API auto-selects the most compatible **verified** supplier for that
   category and preference. The app shows that shop while they browse.
4. Category listings, specs, and add-ons stay the shared GRID catalog.
5. Checkout delivery fee is computed from **shop pin → delivery address**
   road distance.

## Locked decisions

| Decision | Choice |
| --- | --- |
| When the shop is chosen | Immediately when an orderable category is selected |
| Price preference | Closest shop pin to the delivery address |
| Quality preference | Highest `ratingAverage`, then existing composite score |
| Speed preference | Lowest `leadTimeDays`, then closest pin |
| Listings | Shared GRID catalog for the chosen category (not per-shop SKUs) |
| Delivery fee | `max(₱25, ₱15 × road km)`; pickup ₱0; priority still +₱50 |
| Routing down at quote | Keep ₱25 and `feeIsEstimate: true` |
| Supplier-visible job | Still **after** artwork QA. Browse bind is a preview, not a job |
| Real `SupplierAssignment` | Created by **system** when the order reaches `approved_for_matching` |
| Client spoofing `supplierId` | Ignored. Server re-ranks at place-order and at QA auto-assign |
| Default preference | `quality` when unset |
| Existing print-type chips | Unchanged (`plotting_blueprints`, etc.) |
| Beta store→customer | Unchanged. This path is marketplace (supplier pin required) |
| Ops override | Ops may still reassign after auto-assign (decline / capacity) |

## Architecture

Server is authoritative. Clients never rank shops and never call OSRM.

```text
onboarding preference
        ↓
Start printing → category
        ↓
POST /matching/preview  →  top shop + distance + fee quote
        ↓
catalog listings / specs / add-ons  (shop badge only)
        ↓
checkout uses quoted fee; stores preferredSupplierId on the order
        ↓
ops QA artwork
        ↓
approved_for_matching → system auto-assign preferred shop (if still eligible)
        ↓
supplier accepts (existing job workspace)
```

Browse-time “assignment” is a **preview bind**. Suppliers must not see
unapproved artwork (marketplace workflow step 4).

## Ranking

Reuse hard filters from `rankSupplierCandidates`:

- profile active
- verification `verified`
- capability `productFamily` matches category (case-insensitive)
- zone fit > 0
- capacity not exhausted
- **plus:** shop pin present (`latitude`/`longitude` valid, not `0,0`)

Eligible candidates then sort by preference:

| Preference | Primary | Tie-break |
| --- | --- | --- |
| `quality` | `ratingAverage` desc | existing composite `score` desc, then `supplierId` asc |
| `price` | haversine meters to delivery pin asc | `supplierId` asc |
| `speed` | capability `leadTimeDays` asc | haversine meters asc, then `supplierId` asc |

Haversine is **only** for ranking many shops. The **winning** shop’s checkout
fee uses OSRM driving distance (same routing provider as dispatch). Clients
never see haversine km as the billed distance.

If the client has **no delivery coordinates** yet:

- `quality` / `speed` still rank (speed skips distance)
- `price` falls back to `quality` ranking
- fee is ₱25 with `feeIsEstimate: true` until an address is chosen

## Delivery fee

Quoted in PHP pesos on the client, stored as today (`deliveryFee` pesos +
`deliveryFeeMinor` centavos).

```text
km = osrmDistanceMeters / 1000
distanceFeePesos = max(25, 15 * km)
pickup → 0
priority → existing settings.priorityFeeAmount (₱50 default) on top
service fee ₱2 stays as today’s separate/lumped service line
```

Round pesos to 2 decimals; minor units are integer centavos
(`Math.round(pesos * 100)`). Extra-destination surcharge is unchanged.

If OSRM fails: `distanceFeePesos = 25`, `feeIsEstimate = true`.

## Persistence

### `users.matching_preference`

Enum: `quality` | `price` | `speed`. Nullable. Treat null as `quality`.
Not required for `isProfileComplete` (existing name/category/field rules).

### `orders.preferred_supplier_id`

Nullable int FK-style id of `supplier_profiles.id`. Set at place-order from
the server’s re-rank (not blindly from the client body). Used after QA to
create the real assignment.

## APIs

### `PUT /users/profile`

Add optional `matchingPreference`. Returned on `GET /users/profile`.

### `POST /matching/preview` (client JWT)

Body:

```json
{
  "category": "paper",
  "destinationId": 12,
  "latitude": 7.0731,
  "longitude": 125.6128
}
```

`destinationId` must belong to the caller. Lat/lng may be sent for a pin
that is not yet saved. If both are present, saved address wins.

Response:

```json
{
  "preference": "price",
  "supplier": {
    "supplierId": 1,
    "businessName": "Davao Print Co",
    "address": "…",
    "latitude": 7.0505,
    "longitude": 125.5889,
    "ratingAverage": 4.6,
    "leadTimeDays": 1
  },
  "distanceMeters": 4200,
  "deliveryFeePesos": 63,
  "deliveryFeeMinor": "6300",
  "feeIsEstimate": false
}
```

Errors:

- `400 no_eligible_suppliers` — no verified capable shop with a pin
- `400 invalid_category`
- `400 destination_not_found` — `destinationId` not owned

### Place order

Server re-ranks with the order category + delivery pin + user preference,
writes `preferredSupplierId` and the **server** delivery fee. Client-sent
`deliveryFee` / `supplierId` are display hints only.

### After QA `approved_for_matching`

System actor calls matching `autoMatchPreferred`:

1. If `preferredSupplierId` is still eligible, assign that shop.
2. Else re-rank and assign the new top shop; update `preferredSupplierId`.
3. If none eligible, leave the order in `approved_for_matching` for ops
   (`no_eligible_suppliers` is logged, not a 500).

Ops `/ops/matching/:id/assign` remains for override.

## Mobile

- Onboarding (`profile_setup_screen` / `profiling_form_section`): after
  print-type chips, clients (not supplier/rider) pick one of Quality, Price,
  Speed. Required to continue for client lanes.
- Account details: same control, saved via `PUT /users/profile`.
- Category screen: when the client selects an **orderable** node, call
  preview. Show a compact “Matched shop · {name}” chip. Empty state if
  `no_eligible_suppliers` (cannot proceed to specs).
- Specs / preview / add-ons: unchanged catalog.
- Checkout: delivery line uses preview `deliveryFeePesos`; refresh preview
  when the address or speed tier changes. Price/speed re-rank on address
  change; quality keeps the shop unless it becomes ineligible.

## Errors and empty states

| Case | Client |
| --- | --- |
| No preference stored | Treat as `quality` |
| No shops | “No verified print shop for this product yet” + stay on category |
| Shop has no pin | Excluded from ranking |
| Routing down | Fee ₱25, copy “Estimated delivery fee” |
| Preferred shop declined after QA | Expiry path already returns to `approved_for_matching`; system auto-match runs again without the declined shop |

## Testing

- Ranking unit tests: quality vs price vs speed order; pin-less excluded;
  price without coords falls back to quality.
- Preview API: 401 without JWT; 400 no eligible; happy path fee =
  `max(25, 15 * km)`.
- Place-order uses server fee, not a lower client `deliveryFee`.
- QA approve auto-assigns preferred shop; ineligible preferred falls through
  to next rank.
- Mobile: preference round-trip; category chip shows matched shop.

## Out of scope

- Per-supplier SKUs or price indexes
- Letting the client pick a different shop from a list
- Changing ops QA, beta credits, or rider two-stop pickup maps
- Billing OSRM km for ranking (haversine only)
