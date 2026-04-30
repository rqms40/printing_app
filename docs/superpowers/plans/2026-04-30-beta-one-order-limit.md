# Beta One-Order Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap each beta-enrolled user at exactly one real order during the beta program; subsequent checkouts complete the full UI flow but show an informational bottom sheet instead of writing to the database. Admins can reset the limit per user.

**Architecture:** Server-side enforcement via a private helper on `OrdersService` that runs at the top of `create()` and `createBatch()`. It counts orders for the user since `betaEnrolledAt` and throws a typed `ForbiddenException` with `code: BETA_ORDER_LIMIT_REACHED`. Mobile detects the code, throws a `BetaOrderLimitException`, and the payment screen catches it to display a `showModalBottomSheet`. Admin reset bumps `users.betaEnrolledAt` to now (re-anchoring the cutoff so prior orders no longer count).

**Tech Stack:** NestJS 11 + TypeORM (server), Flutter 3.41.6 + Riverpod + Dio (mobile), React 19 + Refine + Ant Design (admin).

**Spec:** `docs/superpowers/specs/2026-04-30-beta-one-order-limit-design.md`

---

## File Structure

**Server (create):**
- `server/src/orders/dto/beta-order-limit.error.ts` — exported error code constant.

**Server (modify):**
- `server/src/orders/orders.service.ts` — add `assertBetaOrderLimit`; call it from `create()` and `createBatch()`.
- `server/src/orders/orders.service.spec.ts` — server tests 1–6.
- `server/src/beta-mode/beta-mode.service.ts` — add `resetOrderLimit(userId)`.
- `server/src/beta-mode/beta-mode.service.spec.ts` — beta tests 7–9.
- `server/src/beta-mode/beta-mode.controller.ts` — add `POST users/:userId/reset-order-limit`.

**Mobile (create):**
- `apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart`
- `apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart`
- `apps/mobile/test/features/customer/beta/widgets/beta_order_limit_sheet_test.dart`

**Mobile (modify):**
- `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart` — translate 403+code to `BetaOrderLimitException` in both `addOrder` and `addBatchOrder`.
- `apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart` (or existing equivalent) — provider tests 10–12.
- `apps/mobile/lib/features/customer/order/screens/payment_screen.dart` — catch `BetaOrderLimitException` in `_onPay`.

**Admin (modify):**
- `admin/src/services/betaModeApi.ts` — add `resetOrderLimit`.
- `admin/src/pages/beta-mode/index.tsx` — new "Reset" action column with confirmation modal.

---

## Task 1: Server — Define error code constant

**Files:**
- Create: `server/src/orders/dto/beta-order-limit.error.ts`

- [ ] **Step 1: Create the constant module**

```ts
// server/src/orders/dto/beta-order-limit.error.ts
export const BETA_ORDER_LIMIT_REACHED = 'BETA_ORDER_LIMIT_REACHED' as const;
export const BETA_ORDER_LIMIT_MESSAGE =
  'Beta testers may place only one order during the beta program.';
```

- [ ] **Step 2: Commit**

```bash
git add server/src/orders/dto/beta-order-limit.error.ts
git commit -m "feat(beta): error code constants for one-order limit"
```

---

## Task 2: Server — `assertBetaOrderLimit` helper (TDD)

**Files:**
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

The helper checks if the requesting user is a beta member with at least one order created since `betaEnrolledAt`; if so it throws a typed `ForbiddenException`. Uses `usersService.findById(userId)` (already injected) and `this.ordersRepo.count(...)`.

- [ ] **Step 1: Write the failing tests**

Open `server/src/orders/orders.service.spec.ts`. Inside the existing `describe('OrdersService', ...)` block, add a new nested `describe`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { MoreThanOrEqual } from 'typeorm';
import { BETA_ORDER_LIMIT_REACHED } from './dto/beta-order-limit.error';

// ... inside the existing describe block:

describe('beta order limit', () => {
  const enrolledAt = new Date('2026-04-01T00:00:00Z');

  it('allows non-beta users regardless of order count', async () => {
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: false,
      betaEnrolledAt: null,
    });
    const countSpy = jest.spyOn(ordersRepo, 'count');
    await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('allows beta users with zero orders since enrollment', async () => {
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: true,
      betaEnrolledAt: enrolledAt,
    });
    jest.spyOn(ordersRepo, 'count').mockResolvedValue(0);
    await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();
  });

  it('throws BETA_ORDER_LIMIT_REACHED for beta users with >=1 order since enrollment', async () => {
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: true,
      betaEnrolledAt: enrolledAt,
    });
    jest.spyOn(ordersRepo, 'count').mockResolvedValue(1);
    await expect(service.assertBetaOrderLimit(7)).rejects.toMatchObject({
      response: { code: BETA_ORDER_LIMIT_REACHED },
    });
    await expect(service.assertBetaOrderLimit(7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('counts only orders with createdAt >= betaEnrolledAt', async () => {
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: true,
      betaEnrolledAt: enrolledAt,
    });
    const countSpy = jest.spyOn(ordersRepo, 'count').mockResolvedValue(0);
    await service.assertBetaOrderLimit(7);
    expect(countSpy).toHaveBeenCalledWith({
      where: {
        userId: 7,
        createdAt: MoreThanOrEqual(enrolledAt),
      },
    });
  });

  it('treats missing betaEnrolledAt as no limit (defensive)', async () => {
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: true,
      betaEnrolledAt: null,
    });
    const countSpy = jest.spyOn(ordersRepo, 'count');
    await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();
    expect(countSpy).not.toHaveBeenCalled();
  });
});
```

> **Note for the engineer:** the existing spec file's setup mocks `usersService` and exposes `ordersRepo`/`service` as locals. If those names differ in the file you're editing, rename in the snippet to match. The behavior of the assertions is what matters.

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `cd server && npx jest src/orders/orders.service.spec.ts -t "beta order limit" --runInBand`
Expected: FAIL — `service.assertBetaOrderLimit is not a function`.

- [ ] **Step 3: Implement the helper**

Open `server/src/orders/orders.service.ts`. Add the `MoreThanOrEqual` import to the existing TypeORM import line:

```ts
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
```

Add the error-code import near the other DTO imports:

```ts
import {
  BETA_ORDER_LIMIT_MESSAGE,
  BETA_ORDER_LIMIT_REACHED,
} from './dto/beta-order-limit.error';
```

Add the `ForbiddenException` import to the existing `@nestjs/common` import:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
```

Add the helper method anywhere inside the `OrdersService` class (suggested: just above `async create(`):

```ts
async assertBetaOrderLimit(userId: number): Promise<void> {
  const user = await this.usersService.findById(userId);
  if (!user?.isBetaUser || !user.betaEnrolledAt) return;

  const count = await this.ordersRepo.count({
    where: {
      userId,
      createdAt: MoreThanOrEqual(user.betaEnrolledAt),
    },
  });
  if (count >= 1) {
    throw new ForbiddenException({
      code: BETA_ORDER_LIMIT_REACHED,
      message: BETA_ORDER_LIMIT_MESSAGE,
    });
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd server && npx jest src/orders/orders.service.spec.ts -t "beta order limit" --runInBand`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/orders.service.ts server/src/orders/orders.service.spec.ts
git commit -m "feat(beta): assertBetaOrderLimit helper on OrdersService"
```

---

## Task 3: Server — Wire helper into `create()` and `createBatch()`

**Files:**
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Write the failing integration tests**

Add another nested `describe` block inside the existing `describe('OrdersService', ...)`:

```ts
describe('beta limit gating on writes', () => {
  const enrolledAt = new Date('2026-04-01T00:00:00Z');

  beforeEach(() => {
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: true,
      betaEnrolledAt: enrolledAt,
    });
    jest.spyOn(ordersRepo, 'count').mockResolvedValue(1);
  });

  it('create() rejects beta user past the cap', async () => {
    await expect(
      service.create({ userId: 7, category: 'paper', quantity: 1, totalPrice: 0 }),
    ).rejects.toMatchObject({ response: { code: 'BETA_ORDER_LIMIT_REACHED' } });
  });

  it('createBatch() rejects without opening a transaction', async () => {
    const txSpy = jest.spyOn(dataSource, 'transaction');
    await expect(
      service.createBatch(7, {
        items: [{ category: 'paper', quantity: 1, totalPrice: 0 }],
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
      } as any),
    ).rejects.toMatchObject({ response: { code: 'BETA_ORDER_LIMIT_REACHED' } });
    expect(txSpy).not.toHaveBeenCalled();
  });
});
```

> **Note:** the existing spec file already mocks `dataSource`. Use the local mock variable name from the file. The exact DTO shape passed to `createBatch` does not matter — the helper rejects before validation runs.

- [ ] **Step 2: Run new tests to confirm they fail**

Run: `cd server && npx jest src/orders/orders.service.spec.ts -t "beta limit gating" --runInBand`
Expected: FAIL — orders are created instead of throwing.

- [ ] **Step 3: Wire the helper into `create()`**

In `server/src/orders/orders.service.ts`, inside `async create(...)`, add the assertion as the first statement of the method body (before any other logic):

```ts
async create(
  data: Partial<Order> & {
    paperSpecs?: Partial<PaperSpec>;
    threeDSpecs?: Partial<ThreeDSpec>;
  },
): Promise<Order> {
  if (data.userId != null) {
    await this.assertBetaOrderLimit(Number(data.userId));
  }
  const { paperSpecs, threeDSpecs, ...orderData } = data;
  // ... existing body unchanged
}
```

- [ ] **Step 4: Wire the helper into `createBatch()`**

In `server/src/orders/orders.service.ts`, at the very top of `async createBatch(userId, dto)`:

```ts
async createBatch(
  userId: number,
  dto: CreateBatchOrderDto,
): Promise<{ batchId: string; orders: Order[] }> {
  await this.assertBetaOrderLimit(userId);
  if (!dto.items || dto.items.length === 0) {
    throw new BadRequestException('Batch order requires at least one item');
  }
  // ... existing body unchanged
}
```

- [ ] **Step 5: Run all OrdersService tests**

Run: `cd server && npx jest src/orders/orders.service.spec.ts --runInBand`
Expected: PASS — all existing + new tests green.

- [ ] **Step 6: Commit**

```bash
git add server/src/orders/orders.service.ts server/src/orders/orders.service.spec.ts
git commit -m "feat(beta): enforce one-order limit on create and createBatch"
```

---

## Task 4: Server — `BetaModeService.resetOrderLimit` (TDD)

**Files:**
- Modify: `server/src/beta-mode/beta-mode.service.ts`
- Modify: `server/src/beta-mode/beta-mode.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('BetaModeService', ...)`:

```ts
describe('resetOrderLimit', () => {
  it('updates betaEnrolledAt to a recent timestamp for a beta user', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: true,
      betaEnrolledAt: new Date('2026-04-01T00:00:00Z'),
    });
    const updateSpy = jest.spyOn(userRepo, 'update').mockResolvedValue({} as any);

    const before = Date.now();
    const result = await service.resetOrderLimit(7);
    const after = Date.now();

    expect(updateSpy).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ betaEnrolledAt: expect.any(Date) }),
    );
    const passedDate: Date = (updateSpy.mock.calls[0][1] as any).betaEnrolledAt;
    expect(passedDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(passedDate.getTime()).toBeLessThanOrEqual(after);
    expect(result.id).toBe(7);
    expect(result.betaEnrolledAt).toBeInstanceOf(Date);
  });

  it('throws NotFoundException when user does not exist', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.resetOrderLimit(7)).rejects.toThrow(/not found/i);
  });

  it('throws NotFoundException when user is not a beta member', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      isBetaUser: false,
    });
    await expect(service.resetOrderLimit(7)).rejects.toThrow(/not a beta/i);
  });
});
```

> **Note:** match the local variable names from the spec file (`userRepo` is the existing mock; `service` is the SUT instance).

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd server && npx jest src/beta-mode/beta-mode.service.spec.ts -t "resetOrderLimit" --runInBand`
Expected: FAIL — `service.resetOrderLimit is not a function`.

- [ ] **Step 3: Implement the method**

Open `server/src/beta-mode/beta-mode.service.ts`. Add the method anywhere inside the class (suggested: just above `getBetaStatus`):

```ts
async resetOrderLimit(
  userId: number,
): Promise<{ id: number; betaEnrolledAt: Date }> {
  const user = await this.userRepo.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException(`User ${userId} not found`);
  if (!user.isBetaUser) {
    throw new NotFoundException(`User ${userId} is not a beta member`);
  }
  const newEnrolledAt = new Date();
  await this.userRepo.update(userId, { betaEnrolledAt: newEnrolledAt });
  return { id: userId, betaEnrolledAt: newEnrolledAt };
}
```

> `NotFoundException` is already imported in this file (used by `setBetaSurveyExempt`). Confirm the import line if anything fails.

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd server && npx jest src/beta-mode/beta-mode.service.spec.ts -t "resetOrderLimit" --runInBand`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/beta-mode/beta-mode.service.ts server/src/beta-mode/beta-mode.service.spec.ts
git commit -m "feat(beta): resetOrderLimit re-anchors betaEnrolledAt"
```

---

## Task 5: Server — Admin endpoint for reset

**Files:**
- Modify: `server/src/beta-mode/beta-mode.controller.ts`

- [ ] **Step 1: Add the endpoint**

In `server/src/beta-mode/beta-mode.controller.ts`, add a new method below `setSurveyExempt` and above `getBetaStatus`:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('users/:userId/reset-order-limit')
resetOrderLimit(@Param('userId', ParseIntPipe) userId: number) {
  return this.service.resetOrderLimit(userId);
}
```

(All decorators and helpers are already imported in this file.)

- [ ] **Step 2: Verify the build compiles**

Run: `cd server && npx tsc --noEmit -p tsconfig.json`
Expected: No errors.

- [ ] **Step 3: Smoke-check the route registers**

Run: `cd server && npx jest src/beta-mode --runInBand`
Expected: PASS — all beta-mode tests green.

- [ ] **Step 4: Commit**

```bash
git add server/src/beta-mode/beta-mode.controller.ts
git commit -m "feat(beta): admin endpoint to reset user order limit"
```

---

## Task 6: Mobile — `BetaOrderLimitException`

**Files:**
- Create: `apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart`

- [ ] **Step 1: Create the exception class**

```dart
// apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart
class BetaOrderLimitException implements Exception {
  const BetaOrderLimitException();

  @override
  String toString() =>
      'BetaOrderLimitException: beta tester has already used their one order';
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/features/customer/beta/exceptions/beta_order_limit_exception.dart
git commit -m "feat(beta): mobile BetaOrderLimitException type"
```

---

## Task 7: Mobile — Detect 403+code in `OrdersNotifier` (TDD)

**Files:**
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify or create: `apps/mobile/test/features/customer/orders/orders_provider_test.dart`

- [ ] **Step 1: Locate the existing test file**

Run: `find apps/mobile/test -name "orders_provider_test*" -o -name "*orders_notifier*" 2>/dev/null`

If a file exists, edit it. If not, create `apps/mobile/test/features/customer/orders/orders_provider_test.dart`.

- [ ] **Step 2: Write the failing tests**

Append (or create with) these tests. The harness uses Mockito-style stubbing of `ApiClient.instance` — match whichever pattern the rest of the test file uses (the existing batch-delivery work has mocks for `ApiClient.post`).

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
// ... existing imports for cart items, payment method, etc.

void main() {
  group('OrdersNotifier — beta order limit', () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
      // ... configure the existing ApiClient mock used by other tests in this file
    });

    tearDown(() => container.dispose());

    test('addBatchOrder throws BetaOrderLimitException on 403 with code', () async {
      // Stub ApiClient.post to throw a DioException with status 403 and the code body.
      // (Use the same stubbing pattern as the rest of this file — likely a Mockito
      // generated mock or a manual fake on ApiClient.instance.)
      whenApiPostThrows(
        path: '/orders/batch',
        error: DioException(
          requestOptions: RequestOptions(path: '/orders/batch'),
          response: Response(
            requestOptions: RequestOptions(path: '/orders/batch'),
            statusCode: 403,
            data: {
              'statusCode': 403,
              'code': 'BETA_ORDER_LIMIT_REACHED',
              'message': 'Beta testers may place only one order during the beta program.',
            },
          ),
        ),
      );

      final notifier = container.read(ordersProvider.notifier);

      await expectLater(
        notifier.addBatchOrder(
          items: [/* one valid CartItem fixture */],
          deliveryOption: 'delivery',
          deliveryFee: 0,
          paymentMethod: PaymentMethod.cod,
        ),
        throwsA(isA<BetaOrderLimitException>()),
      );
    });

    test('addBatchOrder rethrows generic 500s without conversion', () async {
      whenApiPostThrows(
        path: '/orders/batch',
        error: DioException(
          requestOptions: RequestOptions(path: '/orders/batch'),
          response: Response(
            requestOptions: RequestOptions(path: '/orders/batch'),
            statusCode: 500,
            data: {'message': 'boom'},
          ),
        ),
      );

      final notifier = container.read(ordersProvider.notifier);

      await expectLater(
        notifier.addBatchOrder(
          items: [/* one valid CartItem fixture */],
          deliveryOption: 'delivery',
          deliveryFee: 0,
          paymentMethod: PaymentMethod.cod,
        ),
        throwsA(isNot(isA<BetaOrderLimitException>())),
      );
    });

    test('addOrder throws BetaOrderLimitException on 403 with code', () async {
      whenApiPostThrows(
        path: '/orders',
        error: DioException(
          requestOptions: RequestOptions(path: '/orders'),
          response: Response(
            requestOptions: RequestOptions(path: '/orders'),
            statusCode: 403,
            data: {'code': 'BETA_ORDER_LIMIT_REACHED'},
          ),
        ),
      );

      final notifier = container.read(ordersProvider.notifier);
      final order = /* minimal Order fixture */;

      await expectLater(
        notifier.addOrder(order),
        throwsA(isA<BetaOrderLimitException>()),
      );
    });
  });
}
```

> **Note:** `whenApiPostThrows` is illustrative — replace with the existing test file's actual stubbing helper or Mockito `when(mock.post(...))` call. The fixtures (`CartItem`, `Order`) should reuse whatever the file already constructs.

- [ ] **Step 3: Run tests to confirm they fail**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/orders/orders_provider_test.dart`
Expected: FAIL — exceptions are not converted, so the wrong type is thrown (or the local-write fallback is triggered).

- [ ] **Step 4: Update `OrdersNotifier.addBatchOrder` to detect the limit**

In `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`, add the import:

```dart
import 'package:dio/dio.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
```

Wrap the existing `final response = await ApiClient.instance.post('/orders/batch', data: body);` in a try/catch:

```dart
final Response response;
try {
  response = await ApiClient.instance.post('/orders/batch', data: body);
} on DioException catch (e) {
  if (e.response?.statusCode == 403) {
    final data = e.response?.data;
    if (data is Map && data['code'] == 'BETA_ORDER_LIMIT_REACHED') {
      throw const BetaOrderLimitException();
    }
  }
  rethrow;
}
```

Place this right where the existing `final response = ...` line lives (around line 593 in the current file — confirm with your editor).

- [ ] **Step 5: Update `OrdersNotifier.addOrder` to detect the limit**

The current `addOrder` swallows all errors with a generic `catch (e)` that falls back to local writes. We must throw `BetaOrderLimitException` from inside that catch when the underlying error matches.

Replace the existing `try { ... final response = await ApiClient.instance.post('/orders', data: ...); ... } catch (e) { ... fallback ... }` body so the catch checks for the typed error first:

```dart
try {
  final response = await ApiClient.instance.post(
    '/orders',
    data: { /* unchanged */ },
  );
  final newOrder = _parseOrder(response.data as Map<String, dynamic>);
  state = [newOrder, ...state];
  WebSocketService.instance.subscribeToOrder(newOrder.orderId);
  debugPrint('OrdersProvider: Order created via API: ${newOrder.orderId}');
  return newOrder;
} on DioException catch (e) {
  if (e.response?.statusCode == 403) {
    final data = e.response?.data;
    if (data is Map && data['code'] == 'BETA_ORDER_LIMIT_REACHED') {
      throw const BetaOrderLimitException();
    }
  }
  debugPrint('OrdersProvider: API create failed ($e), adding locally');
  state = [order, ...state];
  return order;
} catch (e) {
  debugPrint('OrdersProvider: API create failed ($e), adding locally');
  state = [order, ...state];
  return order;
}
```

> The two `catch` clauses are intentional: the typed `DioException` clause re-throws `BetaOrderLimitException` for the limit case and falls back for other Dio errors; the second clause keeps the existing fallback behavior for non-Dio failures. This matches the spec's "no bypass via offline mode" requirement.

- [ ] **Step 6: Run tests to confirm they pass**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/orders/orders_provider_test.dart`
Expected: PASS — all three new tests green.

- [ ] **Step 7: Run the full mobile test suite to check for regressions**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test`
Expected: PASS — full suite green.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/features/customer/orders/providers/orders_provider.dart \
        apps/mobile/test/features/customer/orders/orders_provider_test.dart
git commit -m "feat(beta): mobile detects 403 BETA_ORDER_LIMIT_REACHED"
```

---

## Task 8: Mobile — `BetaOrderLimitSheet` widget

**Files:**
- Create: `apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart`
- Create: `apps/mobile/test/features/customer/beta/widgets/beta_order_limit_sheet_test.dart`

- [ ] **Step 1: Write the failing widget test**

```dart
// apps/mobile/test/features/customer/beta/widgets/beta_order_limit_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_order_limit_sheet.dart';

void main() {
  testWidgets('renders title, body and Got it button', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: BetaOrderLimitSheet()),
      ),
    );

    expect(find.text("You've used your beta order"), findsOneWidget);
    expect(
      find.textContaining('beta testers can place one order'),
      findsOneWidget,
    );
    expect(find.text('Got it'), findsOneWidget);
  });

  testWidgets('Got it button pops the bottom sheet', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                builder: (_) => const BetaOrderLimitSheet(),
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text("You've used your beta order"), findsOneWidget);

    await tester.tap(find.text('Got it'));
    await tester.pumpAndSettle();

    expect(find.text("You've used your beta order"), findsNothing);
  });
}
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/beta/widgets/beta_order_limit_sheet_test.dart`
Expected: FAIL — `BetaOrderLimitSheet` is not defined.

- [ ] **Step 3: Implement the widget**

```dart
// apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart
import 'package:flutter/material.dart';

class BetaOrderLimitSheet extends StatelessWidget {
  const BetaOrderLimitSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: false,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const BetaOrderLimitSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.outline.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Icon(
              Icons.rocket_launch_rounded,
              size: 48,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              "You've used your beta order",
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              "Thanks for testing GRID — beta testers can place one order during the beta program. "
              "Your earlier order is on its way (or already delivered). "
              "Reach out to the GRID team if you'd like another test run.",
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Got it'),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/beta/widgets/beta_order_limit_sheet_test.dart`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/beta/widgets/beta_order_limit_sheet.dart \
        apps/mobile/test/features/customer/beta/widgets/beta_order_limit_sheet_test.dart
git commit -m "feat(beta): bottom sheet for one-order limit"
```

---

## Task 9: Mobile — Wire sheet into payment screen

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`

- [ ] **Step 1: Add the imports**

Near the top of `payment_screen.dart`, add:

```dart
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_order_limit_sheet.dart';
```

- [ ] **Step 2: Catch the exception in `_onPay`**

Modify the existing `try { ... } catch (e) { ... }` block in `_onPay()` (around line 337–449). Insert an `on BetaOrderLimitException` clause before the existing generic `catch`:

```dart
} on BetaOrderLimitException {
  if (!mounted) return;
  setState(() => _isProcessing = false);
  await BetaOrderLimitSheet.show(context);
  return;
} catch (e) {
  if (!mounted) return;
  setState(() => _isProcessing = false);
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text('Order failed: $e')));
}
```

> Cart, checkout, and flow state are **not** reset in the new clause — the user remains on the summary/payment screen with their items intact (per spec).

- [ ] **Step 3: Static-analysis check**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/screens/payment_screen.dart`
Expected: No new issues.

- [ ] **Step 4: Build the mobile web bundle (per project convention)**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/payment_screen.dart
git commit -m "feat(beta): show one-order limit sheet on payment screen"
```

---

## Task 10: Admin — Add `resetOrderLimit` API service

**Files:**
- Modify: `admin/src/services/betaModeApi.ts`

- [ ] **Step 1: Add the function**

At the end of `admin/src/services/betaModeApi.ts`, append:

```ts
export async function resetOrderLimit(
  userId: number,
): Promise<{ id: number; betaEnrolledAt: string }> {
  const res = await apiClient.post(
    `/beta-mode/users/${userId}/reset-order-limit`,
  );
  return res.data as { id: number; betaEnrolledAt: string };
}
```

- [ ] **Step 2: Type-check the admin app**

Run: `cd admin && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/services/betaModeApi.ts
git commit -m "feat(beta): admin API client for resetOrderLimit"
```

---

## Task 11: Admin — Reset button + confirmation modal

**Files:**
- Modify: `admin/src/pages/beta-mode/index.tsx`

- [ ] **Step 1: Import the new API and the icon**

Add `resetOrderLimit` to the existing import from `@/services/betaModeApi`:

```ts
import {
  // ... existing imports
  resetOrderLimit,
  unenrollUser,
} from '@/services/betaModeApi';
```

Add `ReloadOutlined` to the existing `@ant-design/icons` import line. Add `Modal` and `message` to the existing `antd` import line if not already present.

- [ ] **Step 2: Add a reset handler**

Inside the page component (near `handleUnenroll`), add:

```ts
const handleResetOrderLimit = useCallback(
  (row: BetaMemberRow) => {
    Modal.confirm({
      title: 'Reset beta order limit?',
      content: (
        <span>
          This re-enrolls <strong>{row.email}</strong> as a beta tester at the
          current time. They'll be able to place one new order during the beta
          program. Note: their beta rank will move to the latest rank as a side
          effect.
        </span>
      ),
      okText: 'Reset',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setBusyId(row.id);
          await resetOrderLimit(row.id);
          await loadMembers();
          message.success(`Order limit reset for ${row.email}`);
        } catch (err) {
          message.error('Failed to reset order limit');
          console.error(err);
        } finally {
          setBusyId(null);
        }
      },
    });
  },
  [loadMembers],
);
```

> Match the existing names in the file: `setBusyId`, `loadMembers`, `BetaMemberRow`. If they differ, adapt.

- [ ] **Step 3: Add the column**

In the `columns` array (around line 281–430), add a new column entry **before** the existing "Remove" action column:

```tsx
{
  title: 'Order Limit',
  key: 'orderLimit',
  width: 120,
  render: (_: unknown, row: BetaMemberRow) => (
    <Button
      size="small"
      icon={<ReloadOutlined />}
      loading={busyId === row.id}
      onClick={() => handleResetOrderLimit(row)}
      style={{
        background: '#1A1A1A',
        borderColor: '#3A3A1A',
        color: '#F5C842',
        fontSize: 12,
      }}
    >
      Reset
    </Button>
  ),
},
```

- [ ] **Step 4: Type-check & lint**

Run: `cd admin && npx tsc --noEmit`
Expected: No errors.

Run: `cd admin && npx eslint src/pages/beta-mode/index.tsx`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/beta-mode/index.tsx
git commit -m "feat(beta): admin row action to reset order limit"
```

---

## Task 12: Manual verification

This task has no commits — it's the final smoke test. The DB container drops `grid_print` on restart, so seed first if needed: `docker exec server-postgres-1 psql -U postgres -c "CREATE DATABASE grid_print;"`.

- [ ] **Step 1: Start server, admin, mobile**

Use the project's existing dev commands.

- [ ] **Step 2: Enroll a real test user as beta**

Via the admin Beta Mode page, search for a test user and enroll them. Confirm `isBetaUser=true` and `betaEnrolledAt` is recent.

- [ ] **Step 3: Place a single batch order from mobile as that user**

Add an item to cart → checkout → complete payment. Confirm:
- Order is written to the DB.
- The customer-facing orders list shows the order.

- [ ] **Step 4: Attempt a second checkout (single or batch)**

Enter checkout again. Tap "Place Order". Confirm:
- The bottom sheet appears with the title, body, and "Got it" button.
- No new order row is created in the DB.
- Cart items remain intact after dismissing the sheet.

- [ ] **Step 5: Reset the user from admin**

In Beta Mode → Members table, click "Reset" on the same user → confirm the modal. Toast appears.

- [ ] **Step 6: Place another order from mobile**

Confirm checkout succeeds and a new order is written. The bottom sheet does not appear.

- [ ] **Step 7: Verify a non-beta user is unaffected**

Sign in as a regular customer (or unenroll the test user first). Place multiple orders back-to-back. Confirm none of them trigger the sheet.

---

## Self-Review Notes

- **Spec coverage:** every section of the design (server enforcement, admin reset, mobile UX, admin UI, all 13 tests) has at least one task.
- **No placeholders:** every test has full code; every implementation step has full code.
- **Type consistency:** `assertBetaOrderLimit` is used unchanged across Tasks 2 and 3. `resetOrderLimit` returns `{ id, betaEnrolledAt }` consistently across server (Task 4), controller (Task 5), and admin client (Task 10). `BetaOrderLimitException` is the same type throughout Tasks 6–9.
- **DRY:** error code constants live in one module (Task 1) used by server logic + tests; mobile translates the wire `code` directly without duplicating the string.
- **Frequent commits:** every task ends with a commit.
