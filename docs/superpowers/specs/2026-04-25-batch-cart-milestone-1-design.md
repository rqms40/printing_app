# Batch Cart Milestone 1 Design

## Goal

Milestone 1 adds a cart-style multi-order checkout for customers who want to submit several print jobs in one session with one shared delivery option, one address, one payment method, and one delivery fee. It must not change the existing lifecycle for a normal single order.

## Scope

Included:
- Customer can add multiple configured print jobs to a cart.
- Each cart item has its own category, specs, file metadata, quantity, page count, and print subtotal.
- Checkout applies one delivery option, one optional delivery address, one payment method, and one delivery fee to all cart items.
- Server creates one normal `Order` row per cart item so admin queue, order status, WebSocket order updates, cancellation, file expiry, and driver assignment keep working.
- GRID Credits are charged for the whole batch total and remain refundable through the existing per-order cancellation path.
- Cart survives app restart until submitted or cleared.

Excluded from Milestone 1:
- Multi-destination checkout.
- Route optimization or grouped stop sequencing.
- Rider-facing batch delivery UI.
- Third-party delivery provider integration.
- One external payment transaction covering multiple child orders. Non-credit external payment can still use current per-order behavior until the payment module is upgraded.

## Current System Constraints

The mobile order flow is single-draft and single-file. `OrderFlowState` stores one configured job and `PaymentScreen` submits one `Order` through `OrdersNotifier.addOrder`.

The server `Order` entity is already the correct child fulfillment unit. It contains the file, specs, delivery fields, payment fields, status, admin notes, tracking link, and cancellation behavior. Delivery assignment is also one assignment per order.

The recent GRID credit fix must be preserved:
- Credit payment methods may arrive as `credits`, `gridCredits`, `grid_credits`, or `grid-credits`.
- Cancelling a cancellable GRID-credit order refunds credits.
- A credit refund emits `creditsUpdate` over notifications WebSocket.
- Mobile also refreshes profile after cancellation as a fallback.

## UX Design

The existing create-order wizard remains familiar.

At the summary step:
- `Checkout Now` keeps the existing single-order path.
- `Add to Cart` validates that the current job has category, specs, uploaded file metadata, quantity, and price.
- After adding, the current order flow resets and the user can configure another print job.
- A cart badge or cart entry point lets the user review pending items.

Cart review screen:
- Lists each item with file name, category, specs summary, quantity, and print subtotal.
- Shows cart subtotal, delivery fee, and grand total.
- Allows removing an item.
- Allows clearing the cart.
- Allows proceeding to the existing delivery/payment steps for the shared checkout fields.

Checkout behavior:
- If cart is empty, current single-order checkout still creates one order.
- If cart has items, payment/submit uses batch checkout.
- On success, the cart and current draft are cleared, orders are refreshed, and the user sees the created child order references.

## Mobile Architecture

Create a focused cart layer instead of overloading `OrderFlowState`.

New model:
- `CartItem`
  - `localId`
  - `category`
  - `paperSpecs`
  - `threeDSpecs`
  - `fileName`
  - `fileUrl`
  - `fileMetadataId`
  - `quantity`
  - `pageCount`
  - `printSubtotal`
  - `createdAt`

New provider:
- `CartNotifier extends StateNotifier<CartState>`
- `CartState`
  - `items`
  - `subtotal`
  - `isEmpty`
  - `itemCount`

Persistence:
- Extend `DraftStorageService` with a separate cart key, for example `cart_items`.
- Do not replace the existing `current_draft` key.

API integration:
- Add `OrdersNotifier.addBatchOrder(...)` for the batch checkout call.
- Keep `OrdersNotifier.addOrder(...)` behavior unchanged for single order checkout.

Riverpod pattern:
- Keep immutable state updates.
- Keep side effects in notifier/API methods.
- Test with `ProviderContainer` and provider overrides.

## Server Architecture

Add a batch checkout API without changing existing `POST /orders`.

Endpoint:
- `POST /orders/batch`

Request shape:

```json
{
  "deliveryOption": "delivery",
  "deliveryAddressId": 123,
  "paymentMethod": "gridCredits",
  "deliveryFee": 50,
  "items": [
    {
      "category": "paper",
      "quantity": 1,
      "totalPrice": 25,
      "fileName": "a4.pdf",
      "fileUrl": "https://...",
      "fileMetadataId": 101,
      "paperSpecs": {
        "paperSize": "a4",
        "colorMode": "blackAndWhite",
        "mediaType": "glossy",
        "printSides": "frontOnly",
        "binding": "none"
      }
    }
  ]
}
```

Response shape:

```json
{
  "batchId": "BATCH-10001",
  "orders": []
}
```

Milestone 1 persistence:
- Add `BatchOrder` entity.
- Add nullable `batchOrderId` to `Order`.
- Generate `BATCH-*` references.
- Store `userId`, `batchRef`, `subtotal`, `deliveryFee`, `totalPrice`, `paymentMethod`, `deliveryOption`, `deliveryAddressId`, and timestamps.

Creation rules:
- Validate at least one item.
- Validate each item has a positive quantity and non-negative total price.
- Apply the shared delivery fee only to the first child order. All other child orders have `deliveryFee = 0`.
- Use the batch total for GRID credit deduction.
- Create the batch row, child orders, child specs, and GRID credit balance update in one TypeORM transaction.
- If any child order/spec/credit update fails, the transaction rolls back so no child order is persisted and no credits are deducted.

Credit handling:
- Batch checkout should deduct credits once for `subtotal + deliveryFee`.
- Child orders should retain `paymentMethod = gridCredits`.
- Child order `totalPrice` remains that child print subtotal.
- `deliveryFee` is stored separately on the first child order.
- Credit deduction and credit cancellation refund use `totalPrice + deliveryFee`.
- Existing orders with `deliveryFee = 0` keep the same refund amount as before.

## Compatibility Rules

Existing single-order behavior must remain green:
- `POST /orders` still creates one order.
- Existing mobile checkout still works when cart is empty.
- Existing admin queue still receives normal order records.
- Existing order WebSocket rooms still receive child order updates.
- Existing cancellation statuses remain unchanged.
- Existing GRID credit cancellation/refund tests must keep passing.

## Testing Strategy

Server:
- DTO validation rejects empty batch and invalid items.
- Batch checkout creates a batch and child orders with shared checkout fields.
- Batch checkout stores specs for paper and 3D child orders.
- GRID Credits batch checkout deducts once for the batch total.
- Failure during child creation rolls back child orders and credit deduction in the same transaction.
- Existing credit cancellation refund tests still pass.
- Existing single-order create/cancel tests still pass.

Mobile:
- Cart provider adds the current order flow state as a valid cart item.
- Cart provider rejects incomplete flow state.
- Cart totals are correct.
- Remove and clear work.
- Cart persistence round-trips.
- Summary screen exposes `Add to Cart`.
- Cart review screen renders items and totals.
- Batch checkout calls `/orders/batch` and clears cart on success.
- Empty cart checkout keeps the existing single-order path.

Full verification:
- `npm test -- --runInBand` in `server`.
- `npm run build` in `server`.
- `flutter test` in `apps/mobile`.
- `flutter analyze` in `apps/mobile`.

## Decisions

Implementation: create the `BatchOrder` table now. This is the safer foundation for later rider batching and third-party delivery.

Delivery fee refund: credit cancellation refunds `totalPrice + deliveryFee`. Batch checkout allocates the shared delivery fee to the first child order only.

External payments: keep non-credit batch checkout simple in Milestone 1. The server creates child orders with pending payment status. Full aggregate external payment is a later payment milestone because the current payment module is one transaction to one order.
