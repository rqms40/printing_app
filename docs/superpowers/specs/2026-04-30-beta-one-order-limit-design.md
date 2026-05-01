# Beta One-Order Limit — Design

**Date:** 2026-04-30
**Branch:** `feat/2026-04-29-batch-delivery`
**Status:** Approved (pending plan)

## Goal

During the beta testing program, a beta user (`isBetaUser = true`) may place exactly **one real order** for the lifetime of their beta enrollment. The cap covers both single orders (`POST /orders`) and batch orders (`POST /orders/batch`) — items count is irrelevant; one batch with ten items still consumes the single allowed order.

The user experiences the full checkout pipeline (cart → summary → payment → tap "Place Order"). On final submission past their first order, the server rejects the request and the mobile client surfaces an informational bottom sheet instead of writing to the database.

## Non-Goals

- Limiting non-beta users (admins, regular customers) — they remain unrestricted.
- A global "disable order limit" toggle — admins reset per-user instead.
- A daily / time-based reset — strictly lifetime-per-enrollment.
- Counting orders placed before beta enrollment — those don't count against the cap.

## User Stories

- **As a beta tester**, I can place exactly one real order during the beta and try the full checkout flow as many times as I like; subsequent attempts show me a friendly explanation rather than an error.
- **As an admin**, I can reset a beta tester's order limit from the Beta Mode page so they can place another test order if needed.
- **As a regular customer**, my ordering experience is unchanged.

## Architecture

### Server Enforcement

A new private helper on `OrdersService` is invoked at the top of both `create()` and `createBatch()`:

```ts
// server/src/orders/orders.service.ts
private async assertBetaOrderLimit(userId: number): Promise<void> {
  const user = await this.userRepo.findOne({
    where: { id: userId },
    select: ['id', 'isBetaUser', 'betaEnrolledAt'],
  });
  if (!user?.isBetaUser || !user.betaEnrolledAt) return;

  const count = await this.orderRepo.count({
    where: {
      userId,
      createdAt: MoreThanOrEqual(user.betaEnrolledAt),
    },
  });
  if (count >= 1) {
    throw new ForbiddenException({
      code: 'BETA_ORDER_LIMIT_REACHED',
      message: 'Beta testers may place only one order during the beta program.',
    });
  }
}
```

Called before any DB writes — for `createBatch()` this means before the transaction opens, so a rejection is fast and leaves no rollback artifacts.

**Why count instead of a flag column.** The `orders` table is the single source of truth. The count query is keyed on `userId` (already indexed) plus `createdAt` and is negligible. No schema change is needed, and admin reset becomes a non-destructive cutoff bump rather than data deletion.

### Admin Reset

A new endpoint on the existing `BetaModeController`:

```
POST /beta-mode/users/:id/reset-order-limit
```

- Auth: `JwtAuthGuard` + `RolesGuard` with `Roles('admin')`.
- Implementation: `userRepo.update(id, { betaEnrolledAt: new Date() })`.
- Response body: `{ id: number, betaEnrolledAt: string }`.
- 404 if the user does not exist or is not a beta user.

Bumping `betaEnrolledAt` to "now" re-anchors the cutoff so all prior orders fall outside the beta window and stop counting against the cap. The user can place one fresh beta order.

**Side effect:** the user's beta rank changes (since `getBetaStatus` computes rank as `COUNT WHERE isBetaUser AND betaEnrolledAt <= user.betaEnrolledAt`). This is acceptable — a reset is conceptually a re-enrollment moment — and the admin UI confirmation surfaces this explicitly.

### Mobile UX

**Typed exception:**

```dart
// apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart
class BetaOrderLimitException implements Exception {
  const BetaOrderLimitException();
}
```

**Detection:** in `OrdersNotifier.addOrder()` and `addBatchOrder()` (`apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`), a `DioException` with status 403 and body `code: 'BETA_ORDER_LIMIT_REACHED'` is converted to `BetaOrderLimitException` and re-thrown — bypassing the existing offline-fallback branches that would otherwise write a phantom order locally.

**Bottom sheet:** `apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart`. Triggered via `showModalBottomSheet` from the screen catching `BetaOrderLimitException` (likely the payment screen's "Place Order" handler).

Content:

- Title: **"You've used your beta order"**
- Body: "Thanks for testing GRID — beta testers can place one order during the beta program. Your earlier order is still on its way / has been delivered. Reach out to the GRID team if you'd like another test run."
- Single primary button: **"Got it"** → dismisses sheet.

**Cart preservation:** the cart is not cleared. The user remains on the summary/payment screen with all items intact and may continue exploring the flow.

### Admin UI

**Location:** `admin/src/pages/beta-mode/index.tsx` — existing beta user table.

**New row action:** "Reset order limit" button (`ReloadOutlined`, small, non-danger styling) in the actions column for each beta user.

**Confirmation modal** (`Modal.confirm`):

- Title: "Reset beta order limit?"
- Body: "This re-enrolls **{user.email}** as a beta tester at the current time. They'll be able to place one new order during the beta program. Note: their beta rank will move to the latest rank as a side effect."
- OK: "Reset" / Cancel: "Cancel"

**API service** (`admin/src/services/betaModeApi.ts`):

```ts
resetOrderLimit: (userId: number) =>
  apiClient.post<{ id: number; betaEnrolledAt: string }>(
    `/beta-mode/users/${userId}/reset-order-limit`,
  ),
```

**On success:** `message.success` toast + table refresh.

## Data Flow

```
Beta user taps "Place Order"
  → mobile: OrdersNotifier.addBatchOrder() POSTs /orders/batch
  → server: OrdersController.createBatchOrder()
    → OrdersService.createBatch()
      → assertBetaOrderLimit(userId)
        → user.isBetaUser? && betaEnrolledAt set?
        → count(orders where userId AND createdAt >= betaEnrolledAt) >= 1?
        → YES → throw ForbiddenException { code: BETA_ORDER_LIMIT_REACHED }
  → mobile: catch DioException 403 with code → throw BetaOrderLimitException
  → screen: catch BetaOrderLimitException → showModalBottomSheet(BetaOrderLimitSheet)
  → user dismisses → stays on summary/payment, cart preserved
```

Admin reset:

```
Admin clicks "Reset order limit" → confirms modal
  → admin API: POST /beta-mode/users/:id/reset-order-limit
  → server: userRepo.update(id, { betaEnrolledAt: NOW() })
  → response: { id, betaEnrolledAt }
  → admin UI: success toast + table refresh
  → next order from that user succeeds (count from new cutoff = 0)
```

## Error Handling

- **Non-beta user reaches the helper:** early return; no count query, no exception.
- **Beta user with `betaEnrolledAt = null`** (defensive — shouldn't happen): early return.
- **Generic 5xx from server during checkout:** mobile falls through to existing local-write fallback (regression guard test required).
- **Admin reset on non-existent or non-beta user:** server returns 404; admin UI shows generic error toast.
- **Concurrent submissions** (rare — user double-taps): the second request loses the count race. The first one writes the order; the second sees count=1 and is rejected. Acceptable — only one real order persists.

## Testing

### Server (`orders.service.spec.ts`)

1. Beta user, 0 orders since `betaEnrolledAt` → `create()` succeeds.
2. Beta user, 1 order since `betaEnrolledAt` → `create()` throws `ForbiddenException` with `code: BETA_ORDER_LIMIT_REACHED`.
3. Same as (2) but `createBatch()` throws — confirm no `BatchOrder` or `Order` rows are written.
4. Non-beta user with 5 prior orders → `create()` succeeds.
5. Beta user whose only prior order was created before `betaEnrolledAt` → `create()` succeeds.
6. Beta user with `betaEnrolledAt = null` → `create()` succeeds (defensive).

### Beta module (`beta-mode.service.spec.ts`)

7. `resetOrderLimit(userId)` updates `betaEnrolledAt` to a recent timestamp.
8. After reset, the next checkout for that user passes the cap.
9. `resetOrderLimit` on a non-beta user throws.

### Controller / e2e

10. `POST /orders/batch` with a beta user past the cap returns 403 with the expected JSON shape including `code: 'BETA_ORDER_LIMIT_REACHED'`.

### Mobile

11. `OrdersNotifier.addBatchOrder` translates a 403 + matching `code` into `BetaOrderLimitException` and does **not** trigger local-write fallback.
12. `OrdersNotifier.addBatchOrder` with a generic 500 still falls back to local write (regression guard).
13. `BetaOrderLimitSheet` widget renders title, body, and "Got it" button; tapping the button calls the dismiss callback.

### Manual

- Enroll a real test user as beta → place batch order successfully.
- Re-enter checkout → bottom sheet appears, no DB write.
- Admin clicks "Reset order limit" → next checkout succeeds.

## Files to Create / Modify

**New:**

- `apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart`
- `apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart`
- `server/src/beta-mode/dto/reset-order-limit.dto.ts` (if validation is needed; otherwise skip)

**Modified:**

- `server/src/orders/orders.service.ts` — add `assertBetaOrderLimit`, call from `create()` and `createBatch()`.
- `server/src/orders/orders.module.ts` — ensure `User` repository is imported (likely already is).
- `server/src/beta-mode/beta-mode.controller.ts` — add `POST /users/:id/reset-order-limit` endpoint.
- `server/src/beta-mode/beta-mode.service.ts` — add `resetOrderLimit(userId)` method.
- `server/src/orders/orders.service.spec.ts` — tests 1–6.
- `server/src/beta-mode/beta-mode.service.spec.ts` — tests 7–9.
- `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart` — detect 403+code, throw typed exception.
- `apps/mobile/lib/features/customer/order/screens/payment_screen.dart` — wrap "Place Order" handler with try/catch for `BetaOrderLimitException`, show bottom sheet.
- `admin/src/services/betaModeApi.ts` — add `resetOrderLimit`.
- `admin/src/pages/beta-mode/index.tsx` — row action button + confirmation modal.

## Out of Scope

- Replacing the existing per-user un-enroll flow (admins can still un-enroll fully, which removes the cap entirely along with beta status).
- Showing the user a count or "X of 1 orders used" indicator anywhere — kept implicit.
- Caching the limit check on the client; correctness over micro-optimization.
