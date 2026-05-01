# Batch Cart Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cart-only, single-destination multi-order checkout while preserving existing single-order checkout and GRID credit cancellation refunds.

**Architecture:** Add a server-side `BatchOrder` aggregate that creates normal child `Order` rows in one transaction. Add a mobile cart provider/persistence layer that stores multiple configured print jobs and submits them through `POST /orders/batch`; existing single-order APIs remain unchanged.

**Tech Stack:** NestJS, TypeORM, Jest, Flutter, Riverpod `StateNotifierProvider`, Hive, Flutter widget/provider tests.

---

## File Structure

Server:
- Create `server/src/orders/entities/batch-order.entity.ts` for batch metadata.
- Modify `server/src/orders/entities/order.entity.ts` to add nullable `batchOrderId` relation.
- Modify `server/src/orders/dto/create-order.dto.ts` to add reusable batch DTOs and optional `deliveryAddressId`.
- Modify `server/src/orders/orders.module.ts` to register `BatchOrder`.
- Modify `server/src/orders/orders.controller.ts` to add `POST /orders/batch`.
- Modify `server/src/orders/orders.service.ts` to add transactional batch creation and update GRID-credit refund amount to `totalPrice + deliveryFee`.
- Modify `server/src/orders/orders.service.spec.ts` for TDD coverage.

Mobile:
- Create `apps/mobile/lib/features/customer/cart/models/cart_item.dart`.
- Create `apps/mobile/lib/features/customer/cart/providers/cart_provider.dart`.
- Create `apps/mobile/lib/features/customer/cart/screens/cart_screen.dart`.
- Modify `apps/mobile/lib/shared/services/draft_storage_service.dart` to persist cart data separately from current draft.
- Modify `apps/mobile/lib/features/customer/order/screens/summary_screen.dart` to add current job to cart.
- Modify `apps/mobile/lib/features/customer/order/screens/payment_screen.dart` to submit batch checkout when cart has items.
- Modify `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart` to add `addBatchOrder`.
- Modify `apps/mobile/lib/config/routes/app_router.dart` to register cart route.
- Add tests under `apps/mobile/test/features/customer/cart/...`.
- Extend `apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart` for batch API behavior.

## Task 1: Server Batch Checkout

**Files:**
- Create: `server/src/orders/entities/batch-order.entity.ts`
- Modify: `server/src/orders/entities/order.entity.ts`
- Modify: `server/src/orders/dto/create-order.dto.ts`
- Modify: `server/src/orders/orders.module.ts`
- Modify: `server/src/orders/orders.controller.ts`
- Modify: `server/src/orders/orders.service.ts`
- Test: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Write failing Jest tests**

Add tests covering:
- `createBatch` rejects empty item list.
- `createBatch` saves one `BatchOrder` and two child `Order` records.
- Shared `deliveryFee` is allocated to the first child only.
- GRID Credits are deducted once for `subtotal + deliveryFee`.
- Cancelling a GRID-credit order refunds `totalPrice + deliveryFee`.

Run:

```bash
cd /home/jd/projects/printing_app/server
npm test -- --runInBand orders.service.spec.ts
```

Expected: FAIL because `createBatch`, `BatchOrder`, and updated refund amount do not exist yet.

- [ ] **Step 2: Implement entities and DTOs**

Create `BatchOrder` with fields:
- `id`
- `batchRef`
- `userId`
- `subtotal`
- `deliveryFee`
- `totalPrice`
- `paymentMethod`
- `paymentStatus`
- `deliveryOption`
- `deliveryAddressId`
- timestamps
- `orders` relation

Add nullable `batchOrderId` and `batchOrder` relation to `Order`.

Add DTOs:
- `CreateBatchOrderItemDto`
- `CreateBatchOrderDto`

Include optional `deliveryAddressId` on both single-order and batch request paths.

- [ ] **Step 3: Implement service/controller**

Add `OrdersService.createBatch(userId, dto)`:
- Validate `items.length > 0`.
- Compute `subtotal = sum(item.totalPrice)`.
- Compute `batchTotal = subtotal + dto.deliveryFee`.
- Use `DataSource.transaction`.
- Deduct GRID credits once inside the transaction-compatible code path.
- Save `BatchOrder`.
- Save each child `Order`, with first child receiving `deliveryFee`, later children receiving `0`.
- Save specs for each child.
- Emit order websocket/admin notification for each created child order using existing semantics.
- Return `{ batchId: batch.batchRef, orders }`.

Add `OrdersController.createBatchOrder`.

Update cancellation refund amount to `Number(order.totalPrice) + Number(order.deliveryFee ?? 0)`.

- [ ] **Step 4: Verify server focused tests**

Run:

```bash
cd /home/jd/projects/printing_app/server
npm test -- --runInBand orders.service.spec.ts credits.service.spec.ts
```

Expected: PASS.

## Task 2: Mobile Cart State and Persistence

**Files:**
- Create: `apps/mobile/lib/features/customer/cart/models/cart_item.dart`
- Create: `apps/mobile/lib/features/customer/cart/providers/cart_provider.dart`
- Modify: `apps/mobile/lib/shared/services/draft_storage_service.dart`
- Test: `apps/mobile/test/features/customer/cart/providers/cart_provider_test.dart`

- [ ] **Step 1: Write failing Flutter provider tests**

Test:
- Empty cart has subtotal `0`, item count `0`, and `isEmpty == true`.
- Adding a complete `OrderFlowState` creates a `CartItem`.
- Incomplete flow state is rejected.
- Removing and clearing update totals.
- `toMap/fromMap` round-trips paper and 3D cart items.

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test test/features/customer/cart/providers/cart_provider_test.dart
```

Expected: FAIL because cart files do not exist.

- [ ] **Step 2: Implement model/provider**

Implement:
- `CartItem`
- `CartState`
- `CartNotifier`
- `cartProvider`

Rules:
- `CartNotifier.addFromOrderFlow(OrderFlowState flow)` validates category, specs, file metadata/name, quantity, and positive total.
- Cart item `printSubtotal` uses `flow.totalPrice`, not delivery fee.
- Cart state derives subtotal and item count.
- Cart persistence uses a separate Hive key in `DraftStorageService`.

- [ ] **Step 3: Verify cart focused tests**

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test test/features/customer/cart/providers/cart_provider_test.dart
```

Expected: PASS.

## Task 3: Mobile Batch API and Checkout Integration

**Files:**
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`
- Test: `apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart`
- Test: `apps/mobile/test/features/customer/cart/providers/cart_provider_test.dart`

- [ ] **Step 1: Write failing tests**

Test:
- `OrdersNotifier.addBatchOrder` posts to `/orders/batch` with shared delivery/payment fields and item payloads.
- Batch response orders are prepended/subscribed like single-order response.
- `PaymentScreen` total uses cart subtotal plus shared delivery fee when cart has items.

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test test/features/customer/orders/providers/orders_provider_test.dart
```

Expected: FAIL because `addBatchOrder` does not exist.

- [ ] **Step 2: Implement batch API call**

Add `OrdersNotifier.addBatchOrder` that accepts:
- cart items
- delivery option
- delivery address id
- delivery fee
- payment method

It posts to `/orders/batch`, parses returned child orders with existing parser, prepends them, and subscribes to each order websocket room.

- [ ] **Step 3: Integrate payment screen**

When `cartProvider` has items:
- total = cart subtotal + current shared delivery fee.
- selected payment method still writes to `orderFlowProvider`.
- submit calls `addBatchOrder`.
- success clears cart and current draft.

When cart is empty:
- existing single-order path remains unchanged.

- [ ] **Step 4: Verify focused mobile tests**

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test test/features/customer/orders/providers/orders_provider_test.dart
```

Expected: PASS.

## Task 4: Mobile Cart UI and Routing

**Files:**
- Create: `apps/mobile/lib/features/customer/cart/screens/cart_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/summary_screen.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`
- Test: `apps/mobile/test/features/customer/cart/screens/cart_screen_test.dart`

- [ ] **Step 1: Write failing widget tests**

Test:
- Cart screen shows empty state when cart is empty.
- Cart screen shows item file names and subtotal.
- Remove button removes item.
- Summary screen has an `Add to Cart` action.

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test test/features/customer/cart/screens/cart_screen_test.dart
```

Expected: FAIL because screen/route/actions do not exist.

- [ ] **Step 2: Implement UI**

Add:
- `/customer/cart` route.
- `CartScreen` with item list, subtotal, clear/remove, continue shopping, and checkout buttons.
- `SummaryScreen` secondary `Add to Cart` action that adds the current flow to cart, resets current flow, and navigates to `/customer/cart`.
- Keep `Continue to Delivery` as the single-order path.

- [ ] **Step 3: Verify focused UI tests**

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test test/features/customer/cart/screens/cart_screen_test.dart
```

Expected: PASS.

## Task 5: Final Verification

**Files:**
- No new feature files unless fixing failures.

- [ ] **Step 1: Format**

Run:

```bash
cd /home/jd/projects/printing_app/server
npm run format -- --write src/orders
cd /home/jd/projects/printing_app/apps/mobile
dart format lib test
```

- [ ] **Step 2: Server verification**

Run:

```bash
cd /home/jd/projects/printing_app/server
npm test -- --runInBand
npm run build
```

Expected: PASS.

- [ ] **Step 3: Mobile verification**

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
flutter test
flutter analyze
```

Expected: PASS.

- [ ] **Step 4: Regression checklist**

Confirm:
- Single-order checkout still posts to `/orders`.
- Batch checkout posts to `/orders/batch`.
- GRID-credit cancellation refunds `totalPrice + deliveryFee`.
- `creditsUpdate` WebSocket behavior remains unchanged.
- Cart clear/reset does not delete unrelated current draft unless checkout succeeds or user explicitly clears.
