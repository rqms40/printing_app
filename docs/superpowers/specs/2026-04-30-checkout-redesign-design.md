# Checkout Redesign — Cart-as-Checkout, Speed Tiers, Multi-drop

**Date:** 2026-04-30
**Status:** Approved design, ready for plan
**Branch:** `feat/2026-04-29-batch-delivery`

---

## Why

The current customer order flow chains 6 separate full-screen steps after Upload (`Summary → Cart? → Destinations → Slot Picker → Delivery → Payment`) with a confusing fork on the Summary screen. Users don't intuit when an order goes through the cart vs. straight to payment, and power features (multi-destination, slot scheduling) live behind multiple screen jumps.

Inspired by Grab and FoodPanda checkouts, this redesign collapses the post-upload flow into **one scrollable Checkout screen** ("the cart") with four bottom sheets for power features. Every order — single or multi-item — flows through the same path.

## Decisions locked during brainstorming

1. **Cart-as-Checkout** — there is no separate cart tab. After Specs+Upload, the user lands directly on the Checkout screen showing their item(s), with `+ Add Items` to bundle more print jobs.
2. **Speed tiers + Scheduled** — three inline tiers `Priority / Standard / Saver` plus a fourth `Scheduled` option that opens the existing slot picker as a bottom sheet.
3. **Default-inline payment + Change sheet** — Checkout shows the user's default payment method inline; tapping `Change` opens a bottom sheet with all methods. Default persists on the user record.
4. **Multi-destination as a Delivery mode tab** — the Delivery card has three tabs: `Delivery / Pickup / Multi-drop`. Single-address users never see destination grouping; multi-drop users get an inline grouper with drag-and-tap-to-move semantics.

---

## Architecture overview

### Single Checkout screen

One scrollable screen replaces six. Sections, top to bottom:

1. **App bar** — back button, "Checkout" title, "N print jobs · context line" subtitle
2. **Progress dots** — Specs · File · Checkout (3 dots, last one active)
3. **Your prints** card — line per cart item with `Edit` (opens spec sheet), `⊖ qty ⊕` stepper, swipe-to-remove. `+ Add Items` link in the card header.
4. **Delivery** card — three mode tabs (`Delivery / Pickup / Multi-drop`) with the body changing based on mode
5. **How fast?** card — three speed tiers + Scheduled option. Hidden in Pickup mode (replaced by simpler "When?" card).
6. **Payment** card — one row showing default method with `Change` link
7. **Summary** card — line items: subtotal, delivery, extra-drop fee, service fee
8. **Sticky footer** — `Total ₱X.XX` and `Place Order` button

### Bottom sheets (no full-screen detours)

| Sheet | Triggered by | Replaces |
|---|---|---|
| Address picker | Tapping any address row | `/customer/order/destinations` partial |
| Schedule picker | Tapping `📅 Scheduled` tier | `/customer/order/slot-picker` |
| Payment methods | Tapping `Change` on payment row | `/customer/order/payment` screen |
| Edit item | Tapping `Edit` on a cart row | full re-walk of specs flow |

### Routes after redesign

| Old route | New route |
|---|---|
| `/customer/order/new` → category | unchanged |
| `/customer/order/paper-specs` | unchanged |
| `/customer/order/3d-specs` | unchanged |
| `/customer/order/upload` | unchanged, but `Continue` goes straight to `/customer/order/checkout` |
| `/customer/order/summary` | **removed** |
| `/customer/cart` | **removed** (becomes the Checkout screen) |
| `/customer/order/destinations` | **removed** (folded into Checkout's Multi-drop tab) |
| `/customer/order/slot-picker` | **removed** (becomes a bottom sheet) |
| `/customer/order/external-confirm` | **removed** (becomes an inline banner) |
| `/customer/order/delivery` | **removed** (folded into Checkout) |
| `/customer/order/payment` | **removed** (becomes a bottom sheet) |
| — | **new:** `/customer/order/checkout` |

The Checkout route reads from a unified `checkoutProvider` (StateNotifier) that holds: items, mode (`delivery|pickup|multidrop`), single-address, drop groups, speedTier, scheduledSlot?, paymentMethod, leaveAtDoor, riderNote.

### Upload → Checkout transition

The Upload screen's `Continue` button now always:
1. Appends the just-uploaded item to `checkoutProvider.items`
2. Navigates to `/customer/order/checkout`

This single behavior covers both flows — the first item in a new order and additional items added via `+ Add Items`. The only difference is that in `mode=add` the navigation uses `pop` (back to existing Checkout) and in fresh flow it uses `push`.

### "+ Add Items" loop

`+ Add Items` pushes to `/customer/order/new?mode=add`. The `mode=add` query flag changes:

- App bar title: "Add to your order" with "N items already in checkout · ₱total" subtitle
- A `Skip — review checkout` button is always available on the Add screens
- Post-Upload navigation uses `pop` instead of `push` so the back stack stays clean

### Delivery mode tabs

- **Delivery**: shows one address row + rider note row. Speed tier card visible.
- **Pickup**: shows GRIDGO Print Shop card + simple "As soon as ready / Schedule pickup time" picker. Speed tier card replaced by "When?" card. "Schedule pickup time" reuses `SlotPickerSheet` filtered to pickup-eligible templates (a new `DeliverySlotTemplate.allowsPickup` boolean column, default true for back-compat).
- **Multi-drop**: shows N drop groups. Each group has its own address picker; user assigns items via tap-to-move action sheet (drag-and-drop is enhancement). Drop count drives `extraDestinationFee` (existing server logic).

### External delivery handling

When the chosen address (single-mode) or any drop address (multi-drop) is outside the 25 km service radius, the **How fast?** card is replaced by an **Out of service area** banner inline. The footer becomes `Place Order — fee confirmed later`. No separate confirm screen.

---

## Server impact

### Stays the same

- `BatchOrder`, `Order`, `OrderItem`, `DeliveryDestination`, `OrderStatusHistory` entities
- `POST /orders/batch` — every checkout now hits this endpoint even for single-item orders
- `extraDestinationFee` calculation (`(destinations.length - 1) × settings.extraDestinationSurcharge`)
- `DeliverySlotsService.bookSlot()` with pessimistic write lock (only invoked when `speedTier === 'scheduled'`)
- External delivery `pending_admin → booked → delivered` flow

### Retired

- `POST /orders` single-order endpoint — mobile no longer calls it. Server can keep it as a deprecated alias that internally wraps a 1-item batch, then remove in a follow-up cleanup.

### New

- **`User.defaultPaymentMethod`** column — nullable string enum: `'gcash' | 'maya' | 'cod' | 'credits'`. Saved when user toggles "Set as default for future orders" in the payment sheet. Read on Checkout init.
- **`DeliverySpeedTier`** enum: `'priority' | 'standard' | 'saver' | 'scheduled'`
- **`DeliverySettings`** gets three rows of tier config: `priorityFeeMultiplier` (default 1.83×), `standardFeeMultiplier` (default 1.0×), `saverFeeMultiplier` (default 0.58×), plus per-tier ETA fields. The legacy `priorityFeeAmount` column maps to `priority` tier and stays for back-compat.
- **`BatchOrder.speedTier`** column — replaces standalone `priority` boolean. `priority=true` migrates to `speedTier='priority'`.
- **`CreateBatchOrderDto.speedTier`** added; `priority` boolean kept temporarily for back-compat then removed.
- **`DeliverySlotTemplate.allowsPickup`** boolean column — controls whether a slot template appears in the Pickup mode's "Schedule pickup time" sheet.

### Migrations

1. Add `users.default_payment_method` (varchar, nullable).
2. Add `batch_orders.speed_tier` (varchar, default `'standard'`). Backfill: `priority=true → 'priority'`, else `'standard'`.
3. Add `delivery_settings` columns for tier multipliers + ETAs.
4. Drop `batch_orders.priority` after one-release deprecation window.

---

## Component design

### `CheckoutScreen` (new)

State source: `checkoutProvider` (StateNotifierProvider).

```dart
class CheckoutState {
  List<CartItem> items;
  DeliveryMode mode; // delivery | pickup | multidrop
  Address? singleAddress;
  List<DropGroup> drops; // multidrop only
  Address? pickupTime; // pickup mode timing
  DeliverySpeedTier speedTier;
  ScheduledSlot? scheduledSlot;
  PaymentMethod paymentMethod;
  bool leaveAtDoor;
  String riderNote;
  // computed:
  double subtotal;
  double deliveryFee;
  double extraDropFee;
  double serviceFee;
  double total;
}
```

### Bottom sheet components (new)

- `AddressPickerSheet` — saved + recent + add new + pick on map. Returns `Address`.
- `SlotPickerSheet` — refactored from existing `slot_picker_screen.dart`. Returns `ScheduledSlot { templateId, date, startTime, endTime }`.
- `PaymentMethodSheet` — radio list + "Set as default" checkbox. Returns `(PaymentMethod, bool setAsDefault)`.
- `EditItemSheet` — inline spec editor with `Replace file ›` and `Remove item` actions. Returns updated `CartItem`.

### Reused as-is

- `paper_specs_screen.dart`, `three_d_specs_screen.dart`, `upload_screen.dart`, `category_screen.dart` — content unchanged. Only difference: `mode=add` query param tweaks the app bar copy and the post-Upload navigation target.
- File inspection (`POST /files/upload`, `GET /files/:id/inspect`) unchanged.
- Server `OrdersService.createBatch()` — unchanged transaction, just new payload shape.

### Removed

- `summary_screen.dart`
- `cart_screen.dart`
- `destination_groups_screen.dart`
- `slot_picker_screen.dart` (becomes a sheet, not a screen)
- `external_delivery_confirm_screen.dart`
- `delivery_details_screen.dart`
- `payment_screen.dart`

The `cartProvider`, `orderCheckoutProvider`, and `orderFlowProvider` get consolidated into one `checkoutProvider`. The Hive draft schema migrates to the new unified shape.

---

## Data flow

```
HOME ─► /order/new ─► /paper-specs OR /3d-specs ─► /upload ─► /order/checkout
                                                                       ▲
                                                                       │
   ┌───────────────────────────────────────────────────────────────────┘
   │                          (loop adds items)
   │
   ├─ Tap "+ Add Items" ─► /order/new?mode=add ─► specs ─► /upload ─► back to /order/checkout
   ├─ Tap "Edit" on item ─► EditItemSheet ─► save back to checkoutProvider
   ├─ Tap address row ─► AddressPickerSheet ─► sets singleAddress / drop.address
   ├─ Tap "📅 Scheduled" ─► SlotPickerSheet ─► sets scheduledSlot, switches tier
   ├─ Tap "Change" payment ─► PaymentMethodSheet ─► sets paymentMethod (+ default)
   └─ Tap "Place Order" ─► POST /orders/batch ─► success screen
```

Every cart-mutation goes through `checkoutProvider`; the screen is purely a view of that state. The provider persists to Hive on every change so a backgrounded user resumes intact.

---

## Error handling

- **Insufficient credits** when `paymentMethod === 'credits'` — server returns 400, surface as a SnackBar on Checkout, offer "Top up" link in the snackbar action.
- **Slot full** during `Place Order` (race with another user) — server returns 409, surface as inline error on the speed tier card with "Pick another time" CTA opening SlotPickerSheet.
- **3D bounds exceeded** — server returns 400 with violating item IDs; surface as a per-item warning in the cart row + bail-out CTA "Chat with us" (opens GridBot conversation pre-seeded with item context).
- **Address geocoding failure** — show inline warning "We can't compute distance for this address. Standard fee applied."
- **Network failure on Place Order** — keep button enabled, retry on tap with idempotency key (UUID generated at button press, sent in header).

---

## Testing

- **Provider tests** for `checkoutProvider`: mode switching preserves items, `+ Add Items` appends, multi-drop reassign moves items between groups, fee recalculation correct on tier/drop changes.
- **Widget tests** for each bottom sheet: open/close, return value flows back to checkout, accessibility labels present.
- **Integration test** for the happy path: home → category → specs → upload → checkout → place order → success screen.
- **Integration test** for `+ Add Items` loop: add second item, confirm cart count = 2, confirm fee recalculation.
- **Integration test** for multi-drop: switch tab, assign items to two drops, confirm extra-drop fee appears in summary.
- **Server tests** for new `speedTier` enum: each tier maps to correct fee, `'scheduled'` requires `slotTemplateId+slotDate`, `'priority'` legacy boolean still accepted for one release.

---

## Migration plan

1. **Phase 1 — Server** — add `speedTier` column + tier config in `DeliverySettings` + `defaultPaymentMethod`. Keep legacy `priority` boolean accepted. Ship + soak.
2. **Phase 2 — Mobile** — implement new `CheckoutScreen` + 4 sheets behind a feature flag (`flags.checkoutV2`). Old screens stay reachable. Internal team tests via flag.
3. **Phase 3 — Flip flag** — turn on for all users. Old screens become dead routes (redirect → /order/checkout).
4. **Phase 4 — Cleanup** — remove old screen files, drop `batch_orders.priority` column, remove deprecated `POST /orders` route.

---

## Out of scope

- Cart icon / global cart access from non-order screens (Home Resume Queue card stays as the entry point).
- Multi-payment split (one method per order).
- Tip-your-rider feature shown in FoodPanda screenshot — not part of GRIDGO.
- Promo code / offers section — separate spec.
- Cart sync across devices — local Hive only.

---

## Open questions

None — all four design decisions confirmed during brainstorming.
