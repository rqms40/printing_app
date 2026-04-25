# Queue Cart UX Design

Date: 2026-04-25

## Goal

Make the customer cart feel like one batch order containing multiple print jobs, with an intuitive path back from Home, swipe-to-remove, undo, and working quantity controls.

## Context

Milestone 1 added a batch cart and batch checkout. The current UI still feels rough because each row has a static delete strip, the quantity pill is not interactive, and Home has no clear way to return to a saved queue. Users can add multiple print jobs, but the interface does not yet communicate that the queue is a single checkout.

## Research Notes

- Flutter's built-in `Dismissible` is the preferred implementation for swipe-to-remove in this app because it needs no new dependency, works on mobile and web, and can be covered by widget tests.
- Flutter `Scaffold` and Material patterns support a clear primary action at the bottom of a task screen. The cart will keep one obvious checkout action rather than competing floating actions.
- Baymard checkout UX research recommends buttons or buttons plus an input for cart quantity updates. The app will not use a passive quantity pill or a raw text-only quantity field on mobile.
- Ecommerce cart access needs to be visible when the user has saved items. The app will show a contextual Home card only when the queue has items, so the UI stays clean when there is nothing to resume.

## Scope

Included:

- Redesign the cart screen as "The Queue", a batch-order review screen.
- Replace static row delete UI with swipe-left remove.
- Show a red delete background during swipe.
- Show an undo snackbar after removal.
- Make quantity `+` and `-` controls update item quantity and totals.
- Disable decrement at quantity `1`; do not silently delete from the minus button.
- Add a conditional Home "Resume your queue" card when cart has items.
- Keep checkout flow as queue -> delivery -> payment.
- Keep "Add another print job" explicit from the queue screen.

Not included:

- Multi-destination split delivery UI.
- Third-party delivery integration.
- Backend batch-order changes beyond what Milestone 1 already added.
- A bottom-right floating cart button.
- Editing file/spec details from the queue row.

## User Experience

The queue screen represents one batch checkout. Each row represents one print job inside that batch. The copy will avoid "cart" as the primary identity and use queue/batch language.

### Queue Screen Mockup

```text
┌────────────────────────────────────┐
│ ←  The Queue                 Clear │
├────────────────────────────────────┤
│ Batch order                        │
│ 3 print jobs • 1 delivery checkout │
│ Swipe left on a job to remove      │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [PDF] proposal.pdf             │ │
│ │ A4 • Full Color • 10 pages     │ │
│ │                                │ │
│ │ ₱175.00              [-] 2 [+] │ │
│ └────────────────────────────────┘ │
│        swipe left reveals:          │
│ ┌──────────────────────────┬─────┐ │
│ │ proposal.pdf ...         │ 🗑  │ │
│ └──────────────────────────┴─────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [PDF] poster-a3.pdf            │ │
│ │ A3 • Matte • 3 pages           │ │
│ │ ₱240.00              [-] 1 [+] │ │
│ └────────────────────────────────┘ │
│                                    │
│ + Add another print job            │
│                                    │
│ ─────────────────────────────────  │
│ Print subtotal              ₱415.00│
│ Delivery fee        Calculated next│
│ Total before delivery       ₱415.00│
│                                    │
│ [ Continue to Delivery ]           │
└────────────────────────────────────┘
```

### Home Resume Queue Mockup

```text
┌────────────────────────────────────┐
│ SATURDAY, APRIL 25                 │
│ Good evening, JD        [🔔] [₱]   │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Resume your queue        [cart]│ │
│ │ 3 print jobs                  │ │
│ │ ₱415.00 subtotal              │ │
│ │ View queue →                  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Continue your order            │ │
│ │ You have an unfinished order   │ │
│ └────────────────────────────────┘ │
│                                    │
│ [ Paper Printing ] [ 3D Printing ] │
└────────────────────────────────────┘
```

If both a queue and a draft order exist, show the queue card first. The queue is closer to checkout and more likely to contain intentional saved work.

## Interaction Details

- App bar title: `The Queue`.
- Empty state: keep `Start Printing` and `Back to Home`.
- Queue header: show `Batch order`, item count, and `1 delivery checkout`.
- Swipe hint: show a small caption, `Swipe left on a job to remove`.
- Swipe remove: use `Dismissible` with `DismissDirection.endToStart`.
- Delete background: red surface aligned to the trailing edge with a HugeIcons trash/delete icon and `Remove`.
- Undo: after dismissing, show snackbar text `Removed <filename>` with action `Undo`. Undo restores the exact item at its previous index.
- Quantity increment: tapping `+` increases quantity by one and recalculates that row subtotal and the queue subtotal.
- Quantity decrement: tapping `-` decreases quantity by one only when quantity is greater than one.
- Quantity at one: the decrement button is visually disabled and has no destructive behavior.
- Add another print job: route to `/customer/order/new`.
- Continue to Delivery: route to `/customer/order/delivery`.
- Home resume card: route to `/customer/cart`.

## Data Model

`CartItem.printSubtotal` currently stores the total price for the quantity selected when the item was added. Quantity editing requires a stable unit price.

Add `unitPrice` to `CartItem`.

Rules:

- New cart items set `unitPrice = flow.totalPrice / flow.quantity`.
- `printSubtotal` becomes a derived value: `unitPrice * quantity`.
- Restored carts without `unitPrice` migrate with `unitPrice = printSubtotal / quantity`.
- Quantity must stay at or above `1`.
- If malformed persisted data has quantity below `1`, restore it as `1`.

This keeps cart totals predictable and avoids repeated rounding drift when quantity changes multiple times.

## Components and Boundaries

- `CartItem`: owns cart-item serialization and unit-price subtotal behavior.
- `CartNotifier`: owns cart mutations, including remove, restore, increment, decrement, and persisted saves.
- `CartScreen`: owns queue layout, swipe gestures, snackbar undo, and action routing.
- `HomeScreen`: reads `cartProvider` and shows the Home resume card only when the cart is not empty.
- Private widgets in `cart_screen.dart`: `_QueueHeader`, `_QueueItemTile`, `_QuantityStepper`, `_QueueTotals`, `_QueueActionBar`, `_EmptyQueue`.
- Private widget in `home_screen.dart`: `_ResumeQueueCard`.

## Testing

Use TDD. Each behavior must have a failing test before implementation.

Provider tests:

- Increasing quantity updates the item quantity and subtotal.
- Decreasing quantity updates the item quantity and subtotal.
- Decreasing at quantity `1` keeps the item and quantity unchanged.
- Removing an item can be undone by restoring it at its previous index.
- Restoring old persisted cart data derives `unitPrice` from `printSubtotal / quantity`.

Widget tests:

- Queue rows show interactive `-` and `+` controls.
- Tapping `+` updates the visible quantity and total.
- Tapping `-` updates the visible quantity and total.
- Swiping left removes the row and shows an undo snackbar.
- Tapping undo restores the row.
- Home hides the resume queue card when the cart is empty.
- Home shows the resume queue card with item count and subtotal when the cart has items.
- Tapping the Home resume queue card navigates to `/customer/cart`.

Regression tests:

- Existing Add to Cart from Summary still adds one item, resets the current order flow, and opens The Queue.
- Existing batch checkout payload still sends all cart items with their current quantities.

## Acceptance Criteria

- Cart screen reads as a batch-order queue, not a single-product order.
- Users can remove a queued job by swiping left.
- Users can undo an accidental swipe removal.
- Users can change quantity in the queue and see row and subtotal changes immediately.
- Users cannot delete an item by decrementing below one.
- Users can return to their saved queue from Home when the queue has items.
- No Home queue card appears when the queue is empty.
- Existing delivery/payment flow remains intact.
- `flutter test` for cart, home, and orders provider tests passes.
- `flutter analyze` passes.
- `flutter build web --release --no-tree-shake-icons` succeeds.

## Implementation Sequence

1. Add cart model/provider tests for unit price, quantity mutation, and undo restore.
2. Implement `CartItem.unitPrice` and `CartNotifier` quantity/restore mutations.
3. Add cart screen widget tests for quantity controls and swipe undo.
4. Implement queue screen layout and interactions.
5. Add Home widget tests for the resume queue card.
6. Implement Home resume queue card.
7. Run focused tests, full mobile tests, analyzer, and web release build.
