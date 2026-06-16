# Checkout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 6 chained customer-order screens (Summary, Cart, Destinations, Slot Picker, Delivery, Payment) with a single scrollable Checkout screen plus 4 bottom sheets, matching the Grab/FoodPanda pattern.

**Architecture:** Server adds `speedTier` enum + `defaultPaymentMethod` + `allowsPickup` columns and accepts the new `CreateBatchOrderDto.speedTier` field while keeping `priority` boolean for one release. Mobile builds a unified `checkoutProvider`, a new `CheckoutScreen`, four bottom-sheet widgets, and a `flags.checkoutV2` feature flag that swaps in the new flow without removing the old screens. After soak, old screens get deleted and `priority` boolean dropped.

**Tech Stack:** NestJS 11 + TypeORM 0.3.28, Flutter 3.41 + Riverpod 2.6, GoRouter, Hive (drafts), Jest (server), flutter_test (mobile). Database is PostgreSQL 15.

---

## File Structure

### Server (new files)

- `server/src/orders/enums/delivery-speed-tier.enum.ts` — exports `DeliverySpeedTier`
- `server/migrations/<timestamp>-add-speed-tier-and-payment-default.ts` — TypeORM migration (Phase 1 schema)
- `server/migrations/<timestamp>-drop-priority-boolean.ts` — Phase-4 cleanup migration (written now, run later)

### Server (modified files)

- `server/src/orders/entities/batch-order.entity.ts` — add `speedTier` column
- `server/src/orders/dto/create-order.dto.ts` — add `speedTier` field, keep `priority` deprecated
- `server/src/orders/orders.service.ts` — read `speedTier`, derive priorityFee from tier
- `server/src/orders/orders.service.spec.ts` — coverage for tier-based fee computation
- `server/src/users/entities/user.entity.ts` — add `defaultPaymentMethod` column
- `server/src/users/users.controller.ts` — add `PATCH /users/me/default-payment-method`
- `server/src/users/users.service.ts` — `setDefaultPaymentMethod()` method
- `server/src/delivery-slots/entities/delivery-slot-template.entity.ts` — add `allowsPickup` column
- `server/src/delivery-slots/delivery-slots.service.ts` — accept pickup filter on list
- `server/src/delivery-slots/delivery-slots.controller.ts` — pickup filter query param

### Mobile (new files)

- `apps/mobile/lib/config/feature_flags.dart` — checkoutV2 flag (env-driven)
- `apps/mobile/lib/features/customer/order/models/checkout_state.dart` — unified state model
- `apps/mobile/lib/features/customer/order/models/delivery_speed_tier.dart` — enum mirror
- `apps/mobile/lib/features/customer/order/providers/checkout_provider.dart` — single source of truth
- `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart` — the new screen
- `apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart`
- `apps/mobile/lib/features/customer/order/widgets/checkout_delivery_card.dart` — mode tabs
- `apps/mobile/lib/features/customer/order/widgets/checkout_speed_card.dart` — tiers
- `apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart`
- `apps/mobile/lib/features/customer/order/widgets/checkout_summary_card.dart`
- `apps/mobile/lib/features/customer/order/widgets/checkout_footer.dart` — sticky total + place
- `apps/mobile/lib/features/customer/order/widgets/multidrop_groups.dart`
- `apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart`
- `apps/mobile/lib/features/customer/order/sheets/slot_picker_sheet.dart`
- `apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart`
- `apps/mobile/lib/features/customer/order/sheets/edit_item_sheet.dart`

### Mobile (modified files)

- `apps/mobile/lib/config/routes/app_router.dart` — add `/customer/order/checkout`, gate v1 routes by flag
- `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` — Continue → checkout
- `apps/mobile/lib/features/customer/order/screens/category_screen.dart` — `mode=add` banner
- `apps/mobile/lib/features/customer/order/screens/paper_specs_screen.dart` — pop-back when `mode=add`
- `apps/mobile/lib/features/customer/order/screens/three_d_specs_screen.dart` — same
- `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart` — `placeBatchOrder()` always

### Mobile (deleted in Phase 4 only — after soak)

- `summary_screen.dart`, `cart_screen.dart`, `destination_groups_screen.dart`, `slot_picker_screen.dart`, `external_delivery_confirm_screen.dart`, `delivery_details_screen.dart`, `payment_screen.dart`

---

## Phase 1 — Server schema and API

### Task 1: Add `DeliverySpeedTier` enum

**Files:**
- Create: `server/src/orders/enums/delivery-speed-tier.enum.ts`
- Test: `server/src/orders/enums/delivery-speed-tier.enum.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/orders/enums/delivery-speed-tier.enum.spec.ts
import { DeliverySpeedTier, isValidSpeedTier } from './delivery-speed-tier.enum';

describe('DeliverySpeedTier', () => {
  it('exposes 4 canonical tiers', () => {
    expect(Object.values(DeliverySpeedTier).sort()).toEqual([
      'priority',
      'saver',
      'scheduled',
      'standard',
    ]);
  });

  it('isValidSpeedTier accepts known tiers', () => {
    expect(isValidSpeedTier('standard')).toBe(true);
    expect(isValidSpeedTier('priority')).toBe(true);
    expect(isValidSpeedTier('saver')).toBe(true);
    expect(isValidSpeedTier('scheduled')).toBe(true);
  });

  it('isValidSpeedTier rejects unknown values', () => {
    expect(isValidSpeedTier('express')).toBe(false);
    expect(isValidSpeedTier('')).toBe(false);
    expect(isValidSpeedTier(null as unknown as string)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/orders/enums/delivery-speed-tier.enum.spec.ts`
Expected: FAIL with `Cannot find module './delivery-speed-tier.enum'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// server/src/orders/enums/delivery-speed-tier.enum.ts
export enum DeliverySpeedTier {
  PRIORITY = 'priority',
  STANDARD = 'standard',
  SAVER = 'saver',
  SCHEDULED = 'scheduled',
}

export function isValidSpeedTier(value: string): value is DeliverySpeedTier {
  return (
    typeof value === 'string' &&
    (Object.values(DeliverySpeedTier) as string[]).includes(value)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/orders/enums/delivery-speed-tier.enum.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/enums/
git commit -m "feat(orders): add DeliverySpeedTier enum"
```

---

### Task 2: Migration — add `speed_tier` and `default_payment_method` columns

**Files:**
- Create: `server/migrations/1714435200000-add-speed-tier-and-payment-default.ts`

- [ ] **Step 1: Write the migration**

```typescript
// server/migrations/1714435200000-add-speed-tier-and-payment-default.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpeedTierAndPaymentDefault1714435200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE batch_orders
      ADD COLUMN IF NOT EXISTS speed_tier VARCHAR(20) NOT NULL DEFAULT 'standard'
    `);
    await queryRunner.query(`
      UPDATE batch_orders
      SET speed_tier = 'priority'
      WHERE priority_fee > 0
    `);
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS default_payment_method VARCHAR(20)
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_slot_templates
      ADD COLUMN IF NOT EXISTS allows_pickup BOOLEAN NOT NULL DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE delivery_slot_templates DROP COLUMN IF EXISTS allows_pickup
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS default_payment_method
    `);
    await queryRunner.query(`
      ALTER TABLE batch_orders DROP COLUMN IF EXISTS speed_tier
    `);
  }
}
```

- [ ] **Step 2: Run the migration**

Run: `cd server && npm run migration:run`
Expected: `Migration AddSpeedTierAndPaymentDefault1714435200000 has been executed successfully`

- [ ] **Step 3: Verify schema**

Run: `docker exec server-postgres-1 psql -U postgres -d grid_print -c "\d batch_orders" | grep speed_tier`
Expected: `speed_tier | character varying(20) | not null default 'standard'`

Run: `docker exec server-postgres-1 psql -U postgres -d grid_print -c "\d users" | grep default_payment_method`
Expected: `default_payment_method | character varying(20)`

Run: `docker exec server-postgres-1 psql -U postgres -d grid_print -c "\d delivery_slot_templates" | grep allows_pickup`
Expected: `allows_pickup | boolean | not null default true`

- [ ] **Step 4: Commit**

```bash
git add server/migrations/1714435200000-add-speed-tier-and-payment-default.ts
git commit -m "feat(db): add speed_tier, default_payment_method, allows_pickup columns"
```

---

### Task 3: Add `speedTier` column to `BatchOrder` entity

**Files:**
- Modify: `server/src/orders/entities/batch-order.entity.ts`

- [ ] **Step 1: Add the column to the entity**

In `server/src/orders/entities/batch-order.entity.ts`, add this import at the top:

```typescript
import { DeliverySpeedTier } from '../enums/delivery-speed-tier.enum';
```

Then add this column after the `priorityFee` field (around line 79):

```typescript
  @Column({
    name: 'speed_tier',
    type: 'varchar',
    length: 20,
    default: DeliverySpeedTier.STANDARD,
  })
  speedTier: DeliverySpeedTier;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/orders/entities/batch-order.entity.ts
git commit -m "feat(orders): add speedTier column to BatchOrder entity"
```

---

### Task 4: Add `defaultPaymentMethod` to User entity + endpoint

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/users/users.service.ts`
- Modify: `server/src/users/users.controller.ts`
- Test: `server/src/users/users.service.spec.ts`

- [ ] **Step 1: Write the failing service test**

Append this `describe` block to `server/src/users/users.service.spec.ts` (or create the file with the standard NestJS service test scaffolding if it doesn't exist):

```typescript
describe('setDefaultPaymentMethod', () => {
  it('saves the new default to the user record', async () => {
    const user = await usersService.create({
      email: 'test@example.com',
      password: 'pw12345',
      fullName: 'Test User',
    });

    await usersService.setDefaultPaymentMethod(user.id, 'gcash');
    const updated = await usersService.findById(user.id);

    expect(updated.defaultPaymentMethod).toBe('gcash');
  });

  it('rejects unknown methods', async () => {
    const user = await usersService.create({
      email: 'test2@example.com',
      password: 'pw12345',
      fullName: 'Test User',
    });

    await expect(
      usersService.setDefaultPaymentMethod(user.id, 'crypto' as never),
    ).rejects.toThrow(/invalid payment method/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest users.service.spec.ts -t setDefaultPaymentMethod`
Expected: FAIL — `setDefaultPaymentMethod is not a function`

- [ ] **Step 3: Add the column to the User entity**

In `server/src/users/entities/user.entity.ts`, add:

```typescript
  @Column({ name: 'default_payment_method', type: 'varchar', length: 20, nullable: true })
  defaultPaymentMethod: 'gcash' | 'maya' | 'cod' | 'credits' | null;
```

- [ ] **Step 4: Implement the service method**

In `server/src/users/users.service.ts`, add:

```typescript
  private static readonly VALID_PAYMENT_METHODS = ['gcash', 'maya', 'cod', 'credits'] as const;

  async setDefaultPaymentMethod(
    userId: number,
    method: 'gcash' | 'maya' | 'cod' | 'credits',
  ): Promise<void> {
    if (!UsersService.VALID_PAYMENT_METHODS.includes(method)) {
      throw new BadRequestException('invalid payment method');
    }
    await this.usersRepo.update(userId, { defaultPaymentMethod: method });
  }
```

Make sure `BadRequestException` is imported from `@nestjs/common`.

- [ ] **Step 5: Add the controller endpoint**

In `server/src/users/users.controller.ts`, add:

```typescript
  @Patch('me/default-payment-method')
  @UseGuards(JwtAuthGuard)
  async setDefaultPaymentMethod(
    @Request() req: RequestWithUser,
    @Body() body: { method: 'gcash' | 'maya' | 'cod' | 'credits' },
  ) {
    await this.usersService.setDefaultPaymentMethod(req.user.sub, body.method);
    return { ok: true };
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest users.service.spec.ts -t setDefaultPaymentMethod`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add server/src/users/
git commit -m "feat(users): add defaultPaymentMethod column and endpoint"
```

---

### Task 5: Accept `speedTier` in `CreateBatchOrderDto`

**Files:**
- Modify: `server/src/orders/dto/create-order.dto.ts`

- [ ] **Step 1: Add the field**

In `server/src/orders/dto/create-order.dto.ts`, locate `CreateBatchOrderDto` (around line 173). Add this import:

```typescript
import { DeliverySpeedTier } from '../enums/delivery-speed-tier.enum';
```

Add this field next to the existing `priority` field (around line 218):

```typescript
  @IsOptional()
  @IsEnum(DeliverySpeedTier)
  speedTier?: DeliverySpeedTier;
```

Add a comment above the existing `priority` field:

```typescript
  /** @deprecated Use speedTier='priority' instead. Removed in Phase 4. */
  @IsOptional()
  @IsBoolean()
  priority?: boolean;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/src/orders/dto/create-order.dto.ts
git commit -m "feat(orders): accept speedTier in CreateBatchOrderDto"
```

---

### Task 6: Update `OrdersService.createBatch` to honour `speedTier`

**Files:**
- Modify: `server/src/orders/orders.service.ts`
- Test: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/src/orders/orders.service.spec.ts`:

```typescript
describe('createBatch with speedTier', () => {
  it('treats speedTier="priority" the same as legacy priority=true', async () => {
    const dtoBase = {
      items: [{ category: 'paper', quantity: 1, totalPrice: 100 }],
      paymentMethod: 'cod',
      deliveryOption: 'pickup',
      deliveryFee: 0,
    };
    const legacy = await ordersService.createBatch(testUser.id, {
      ...dtoBase,
      priority: true,
    } as never);
    const tiered = await ordersService.createBatch(testUser.id, {
      ...dtoBase,
      speedTier: 'priority',
    } as never);
    expect(Number(legacy.priorityFee)).toBeGreaterThan(0);
    expect(Number(tiered.priorityFee)).toBe(Number(legacy.priorityFee));
    expect(tiered.speedTier).toBe('priority');
  });

  it('defaults speedTier to "standard" when neither flag is set', async () => {
    const batch = await ordersService.createBatch(testUser.id, {
      items: [{ category: 'paper', quantity: 1, totalPrice: 100 }],
      paymentMethod: 'cod',
      deliveryOption: 'pickup',
      deliveryFee: 0,
    } as never);
    expect(batch.speedTier).toBe('standard');
    expect(Number(batch.priorityFee)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest orders.service.spec.ts -t "createBatch with speedTier"`
Expected: FAIL — `tiered.speedTier` is undefined

- [ ] **Step 3: Update the service**

In `server/src/orders/orders.service.ts` `createBatch()`, after the line that reads `dto.priority`, derive an effective tier (around line 240):

```typescript
    const speedTier =
      (dto as { speedTier?: DeliverySpeedTier }).speedTier ??
      ((dto.priority ?? false) ? DeliverySpeedTier.PRIORITY : DeliverySpeedTier.STANDARD);

    const isPriority = speedTier === DeliverySpeedTier.PRIORITY;
    const priorityFee = isPriority ? settings.priorityFeeAmount : 0;
```

Replace the existing `const priorityFee = (dto.priority ?? false) ? settings.priorityFeeAmount : 0;` with the line above.

Then where the BatchOrder is constructed (around line 325), add:

```typescript
    savedBatch.speedTier = speedTier;
```

Make sure `DeliverySpeedTier` is imported at the top:

```typescript
import { DeliverySpeedTier } from './enums/delivery-speed-tier.enum';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest orders.service.spec.ts -t "createBatch with speedTier"`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full orders test suite to confirm no regression**

Run: `cd server && npx jest orders.service.spec.ts`
Expected: PASS (all existing tests still green)

- [ ] **Step 6: Commit**

```bash
git add server/src/orders/orders.service.ts server/src/orders/orders.service.spec.ts
git commit -m "feat(orders): honour speedTier when creating batch orders"
```

---

### Task 7: Add `allowsPickup` filter to delivery slots list

**Files:**
- Modify: `server/src/delivery-slots/entities/delivery-slot-template.entity.ts`
- Modify: `server/src/delivery-slots/delivery-slots.service.ts`
- Modify: `server/src/delivery-slots/delivery-slots.controller.ts`
- Test: `server/src/delivery-slots/delivery-slots.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/src/delivery-slots/delivery-slots.service.spec.ts`:

```typescript
describe('listForDate with pickup filter', () => {
  it('excludes templates where allowsPickup=false when pickup=true', async () => {
    await templatesRepo.save({
      dayOfWeek: new Date().getDay(),
      startTime: '09:00:00',
      endTime: '11:00:00',
      capacity: 5,
      isActive: true,
      allowsPickup: false,
    });
    await templatesRepo.save({
      dayOfWeek: new Date().getDay(),
      startTime: '13:00:00',
      endTime: '15:00:00',
      capacity: 5,
      isActive: true,
      allowsPickup: true,
    });

    const today = new Date().toISOString().slice(0, 10);
    const all = await slotsService.listForDate(today, { pickupOnly: false });
    const pickup = await slotsService.listForDate(today, { pickupOnly: true });

    expect(all.length).toBe(2);
    expect(pickup.length).toBe(1);
    expect(pickup[0].startTime).toBe('13:00:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest delivery-slots.service.spec.ts -t "listForDate with pickup filter"`
Expected: FAIL — `slotsService.listForDate` does not accept options object or property `allowsPickup` does not exist

- [ ] **Step 3: Add the column to the entity**

In `server/src/delivery-slots/entities/delivery-slot-template.entity.ts`, add this column above `createdAt`:

```typescript
  @Column({ name: 'allows_pickup', default: true })
  allowsPickup: boolean;
```

- [ ] **Step 4: Update the service**

In `server/src/delivery-slots/delivery-slots.service.ts`, change the `listForDate` signature and body:

```typescript
  async listForDate(
    date: string,
    opts: { pickupOnly?: boolean } = {},
  ): Promise<SlotAvailability[]> {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const where: FindOptionsWhere<DeliverySlotTemplate> = {
      dayOfWeek,
      isActive: true,
    };
    if (opts.pickupOnly) where.allowsPickup = true;
    const templates = await this.templatesRepo.find({ where, order: { startTime: 'ASC' } });
    // ... existing booking-count enrichment unchanged
  }
```

Make sure `FindOptionsWhere` is imported from `typeorm`. Keep the existing booking-count enrichment block as-is.

- [ ] **Step 5: Update the controller**

In `server/src/delivery-slots/delivery-slots.controller.ts`, change the GET endpoint to accept the query param:

```typescript
  @Get()
  async list(
    @Query('date') date: string,
    @Query('pickupOnly') pickupOnly?: string,
  ) {
    return this.slotsService.listForDate(date, { pickupOnly: pickupOnly === 'true' });
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest delivery-slots.service.spec.ts -t "listForDate with pickup filter"`
Expected: PASS (1 test)

- [ ] **Step 7: Run the full delivery-slots suite**

Run: `cd server && npx jest delivery-slots`
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add server/src/delivery-slots/
git commit -m "feat(slots): add allowsPickup filter to slot list endpoint"
```

---

## Phase 2 — Mobile foundation (provider, models, flag)

### Task 8: Add the `flags.checkoutV2` feature flag

**Files:**
- Create: `apps/mobile/lib/config/feature_flags.dart`
- Test: `apps/mobile/test/config/feature_flags_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/config/feature_flags_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/feature_flags.dart';

void main() {
  group('FeatureFlags', () {
    test('checkoutV2 defaults to false', () {
      const flags = FeatureFlags();
      expect(flags.checkoutV2, isFalse);
    });

    test('reads CHECKOUT_V2=true from env', () {
      const flags = FeatureFlags(env: {'CHECKOUT_V2': 'true'});
      expect(flags.checkoutV2, isTrue);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/config/feature_flags_test.dart`
Expected: FAIL — `Cannot find package 'printing_app/config/feature_flags.dart'`

- [ ] **Step 3: Implement the flag**

```dart
// apps/mobile/lib/config/feature_flags.dart
class FeatureFlags {
  const FeatureFlags({Map<String, String> env = const {}}) : _env = env;

  final Map<String, String> _env;

  bool get checkoutV2 =>
      const bool.fromEnvironment('CHECKOUT_V2', defaultValue: false) ||
      (_env['CHECKOUT_V2']?.toLowerCase() == 'true');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/config/feature_flags_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/config/feature_flags.dart apps/mobile/test/config/feature_flags_test.dart
git commit -m "feat(mobile): add FeatureFlags with checkoutV2 toggle"
```

---

### Task 9: Mirror `DeliverySpeedTier` enum on mobile

**Files:**
- Create: `apps/mobile/lib/features/customer/order/models/delivery_speed_tier.dart`
- Test: `apps/mobile/test/features/customer/order/models/delivery_speed_tier_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/models/delivery_speed_tier_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';

void main() {
  test('toApi returns the lowercase wire string', () {
    expect(DeliverySpeedTier.priority.toApi(), 'priority');
    expect(DeliverySpeedTier.standard.toApi(), 'standard');
    expect(DeliverySpeedTier.saver.toApi(), 'saver');
    expect(DeliverySpeedTier.scheduled.toApi(), 'scheduled');
  });

  test('fromApi parses known values, defaults to standard', () {
    expect(DeliverySpeedTier.fromApi('priority'), DeliverySpeedTier.priority);
    expect(DeliverySpeedTier.fromApi('garbage'), DeliverySpeedTier.standard);
    expect(DeliverySpeedTier.fromApi(null), DeliverySpeedTier.standard);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/models/delivery_speed_tier_test.dart`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the enum**

```dart
// apps/mobile/lib/features/customer/order/models/delivery_speed_tier.dart
enum DeliverySpeedTier {
  priority,
  standard,
  saver,
  scheduled;

  String toApi() => name;

  static DeliverySpeedTier fromApi(String? value) {
    for (final tier in DeliverySpeedTier.values) {
      if (tier.name == value) return tier;
    }
    return DeliverySpeedTier.standard;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/models/delivery_speed_tier_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/models/ apps/mobile/test/features/customer/order/models/
git commit -m "feat(mobile): add DeliverySpeedTier enum"
```

---

### Task 10: Define `CheckoutState` model

**Files:**
- Create: `apps/mobile/lib/features/customer/order/models/checkout_state.dart`
- Test: `apps/mobile/test/features/customer/order/models/checkout_state_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/models/checkout_state_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  group('CheckoutState', () {
    test('default state is empty delivery mode with standard tier', () {
      const state = CheckoutState();
      expect(state.items, isEmpty);
      expect(state.mode, DeliveryMode.delivery);
      expect(state.speedTier, DeliverySpeedTier.standard);
      expect(state.subtotal, 0);
    });

    test('subtotal sums item printSubtotal', () {
      final state = CheckoutState(items: [
        _item('a', 100),
        _item('b', 50),
      ]);
      expect(state.subtotal, 150);
    });

    test('itemCount returns number of items, not sum of quantities', () {
      final state = CheckoutState(items: [
        _item('a', 100, quantity: 5),
        _item('b', 50, quantity: 2),
      ]);
      expect(state.itemCount, 2);
    });
  });
}

CartItem _item(String id, double price, {int quantity = 1}) =>
    CartItem(
      id: id,
      category: 'paper',
      fileName: '$id.pdf',
      filePath: '/tmp/$id.pdf',
      fileSize: 1024,
      fileMetadataId: 1,
      quantity: quantity,
      pageCount: 1,
      printSubtotal: price,
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/models/checkout_state_test.dart`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the model**

```dart
// apps/mobile/lib/features/customer/order/models/checkout_state.dart
import 'package:printing_app/features/customer/address/models/address.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/shared/models/enums.dart';

enum DeliveryMode { delivery, pickup, multidrop }

class ScheduledSlot {
  const ScheduledSlot({
    required this.templateId,
    required this.date,
    required this.startTime,
    required this.endTime,
  });
  final int templateId;
  final String date;
  final String startTime;
  final String endTime;
}

class CheckoutState {
  const CheckoutState({
    this.items = const [],
    this.mode = DeliveryMode.delivery,
    this.singleAddress,
    this.drops = const [],
    this.speedTier = DeliverySpeedTier.standard,
    this.scheduledSlot,
    this.paymentMethod,
    this.leaveAtDoor = false,
    this.riderNote = '',
  });

  final List<CartItem> items;
  final DeliveryMode mode;
  final Address? singleAddress;
  final List<DestinationGroup> drops;
  final DeliverySpeedTier speedTier;
  final ScheduledSlot? scheduledSlot;
  final PaymentMethod? paymentMethod;
  final bool leaveAtDoor;
  final String riderNote;

  int get itemCount => items.length;
  double get subtotal => items.fold(0.0, (s, i) => s + i.printSubtotal);

  CheckoutState copyWith({
    List<CartItem>? items,
    DeliveryMode? mode,
    Address? singleAddress,
    List<DestinationGroup>? drops,
    DeliverySpeedTier? speedTier,
    ScheduledSlot? scheduledSlot,
    PaymentMethod? paymentMethod,
    bool? leaveAtDoor,
    String? riderNote,
  }) =>
      CheckoutState(
        items: items ?? this.items,
        mode: mode ?? this.mode,
        singleAddress: singleAddress ?? this.singleAddress,
        drops: drops ?? this.drops,
        speedTier: speedTier ?? this.speedTier,
        scheduledSlot: scheduledSlot ?? this.scheduledSlot,
        paymentMethod: paymentMethod ?? this.paymentMethod,
        leaveAtDoor: leaveAtDoor ?? this.leaveAtDoor,
        riderNote: riderNote ?? this.riderNote,
      );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/models/checkout_state_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/models/checkout_state.dart apps/mobile/test/features/customer/order/models/checkout_state_test.dart
git commit -m "feat(mobile): add CheckoutState model"
```

---

### Task 11: `CheckoutNotifier` — items, mode, tier, payment

**Files:**
- Create: `apps/mobile/lib/features/customer/order/providers/checkout_provider.dart`
- Test: `apps/mobile/test/features/customer/order/providers/checkout_provider_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
// apps/mobile/test/features/customer/order/providers/checkout_provider_test.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  group('CheckoutNotifier', () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
    });

    tearDown(() => container.dispose());

    test('addItem appends to items and recomputes subtotal', () {
      container.read(checkoutProvider.notifier).addItem(_item('a', 120));
      final state = container.read(checkoutProvider);
      expect(state.items.length, 1);
      expect(state.subtotal, 120);
    });

    test('removeItem deletes by id', () {
      final notifier = container.read(checkoutProvider.notifier);
      notifier.addItem(_item('a', 100));
      notifier.addItem(_item('b', 50));
      notifier.removeItem('a');
      expect(container.read(checkoutProvider).items.single.id, 'b');
    });

    test('setMode switches and clears mode-specific state', () {
      final notifier = container.read(checkoutProvider.notifier);
      notifier.setMode(DeliveryMode.multidrop);
      expect(container.read(checkoutProvider).mode, DeliveryMode.multidrop);
      expect(container.read(checkoutProvider).singleAddress, isNull);
    });

    test('setSpeedTier to scheduled keeps existing scheduledSlot', () {
      final notifier = container.read(checkoutProvider.notifier);
      notifier.setScheduledSlot(const ScheduledSlot(
        templateId: 1,
        date: '2026-05-01',
        startTime: '09:00:00',
        endTime: '11:00:00',
      ));
      notifier.setSpeedTier(DeliverySpeedTier.scheduled);
      expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.scheduled);
      expect(container.read(checkoutProvider).scheduledSlot, isNotNull);
    });

    test('setPaymentMethod updates state', () {
      container.read(checkoutProvider.notifier).setPaymentMethod(PaymentMethod.gridCredits);
      expect(container.read(checkoutProvider).paymentMethod, PaymentMethod.gridCredits);
    });
  });
}

CartItem _item(String id, double price) => CartItem(
      id: id,
      category: 'paper',
      fileName: '$id.pdf',
      filePath: '/tmp/$id.pdf',
      fileSize: 1024,
      fileMetadataId: 1,
      quantity: 1,
      pageCount: 1,
      printSubtotal: price,
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/providers/checkout_provider_test.dart`
Expected: FAIL — `checkout_provider.dart` not found

- [ ] **Step 3: Implement the notifier**

```dart
// apps/mobile/lib/features/customer/order/providers/checkout_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/address/models/address.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/shared/models/enums.dart';

class CheckoutNotifier extends StateNotifier<CheckoutState> {
  CheckoutNotifier() : super(const CheckoutState());

  void addItem(CartItem item) {
    state = state.copyWith(items: [...state.items, item]);
  }

  void removeItem(String id) {
    state = state.copyWith(items: state.items.where((i) => i.id != id).toList());
  }

  void setQuantity(String id, int quantity) {
    state = state.copyWith(
      items: state.items
          .map((i) => i.id == id ? i.copyWith(quantity: quantity) : i)
          .toList(),
    );
  }

  void replaceItem(CartItem replacement) {
    state = state.copyWith(
      items: state.items.map((i) => i.id == replacement.id ? replacement : i).toList(),
    );
  }

  void setMode(DeliveryMode mode) {
    state = state.copyWith(mode: mode);
  }

  void setSingleAddress(Address address) {
    state = state.copyWith(singleAddress: address);
  }

  void setDrops(List<DestinationGroup> drops) {
    state = state.copyWith(drops: drops);
  }

  void setSpeedTier(DeliverySpeedTier tier) {
    state = state.copyWith(speedTier: tier);
  }

  void setScheduledSlot(ScheduledSlot slot) {
    state = state.copyWith(scheduledSlot: slot, speedTier: DeliverySpeedTier.scheduled);
  }

  void setPaymentMethod(PaymentMethod method) {
    state = state.copyWith(paymentMethod: method);
  }

  void setLeaveAtDoor(bool value) {
    state = state.copyWith(leaveAtDoor: value);
  }

  void setRiderNote(String note) {
    state = state.copyWith(riderNote: note);
  }

  void reset() {
    state = const CheckoutState();
  }
}

final checkoutProvider =
    StateNotifierProvider<CheckoutNotifier, CheckoutState>((ref) => CheckoutNotifier());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/providers/checkout_provider_test.dart`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/providers/checkout_provider.dart apps/mobile/test/features/customer/order/providers/
git commit -m "feat(mobile): add CheckoutNotifier with items/mode/tier/payment"
```

---

### Task 12: Fee computation derived providers

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/providers/checkout_provider.dart`
- Test: `apps/mobile/test/features/customer/order/providers/checkout_fees_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/providers/checkout_fees_test.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';

void main() {
  group('checkoutFeesProvider', () {
    test('standard tier: base delivery fee, no priority surcharge', () {
      final container = ProviderContainer();
      container.read(checkoutProvider.notifier).addItem(_item('a', 200));
      final fees = container.read(checkoutFeesProvider);
      expect(fees.subtotal, 200);
      expect(fees.deliveryFee, 60);
      expect(fees.priorityFee, 0);
      expect(fees.extraDropFee, 0);
      expect(fees.serviceFee, 4);
      expect(fees.total, 264);
    });

    test('priority tier adds 50 surcharge', () {
      final container = ProviderContainer();
      final n = container.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      n.setSpeedTier(DeliverySpeedTier.priority);
      final fees = container.read(checkoutFeesProvider);
      expect(fees.priorityFee, 50);
      expect(fees.total, 314);
    });

    test('saver tier: 25 delivery fee, no priority', () {
      final container = ProviderContainer();
      final n = container.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      n.setSpeedTier(DeliverySpeedTier.saver);
      final fees = container.read(checkoutFeesProvider);
      expect(fees.deliveryFee, 35);
    });

    test('multidrop with 2 drops adds 30 extra-drop fee', () {
      final container = ProviderContainer();
      final n = container.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      n.setDrops([
        const DestinationGroup(id: '1', label: 'A', itemIds: []),
        const DestinationGroup(id: '2', label: 'B', itemIds: []),
      ]);
      final fees = container.read(checkoutFeesProvider);
      expect(fees.extraDropFee, 30);
    });
  });
}

CartItem _item(String id, double price) => CartItem(
      id: id,
      category: 'paper',
      fileName: '$id.pdf',
      filePath: '/tmp/$id.pdf',
      fileSize: 1,
      fileMetadataId: 1,
      quantity: 1,
      pageCount: 1,
      printSubtotal: price,
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/providers/checkout_fees_test.dart`
Expected: FAIL — `checkoutFeesProvider` not defined

- [ ] **Step 3: Add the derived provider**

Append to `apps/mobile/lib/features/customer/order/providers/checkout_provider.dart`:

```dart
class CheckoutFees {
  const CheckoutFees({
    required this.subtotal,
    required this.deliveryFee,
    required this.priorityFee,
    required this.extraDropFee,
    required this.serviceFee,
  });
  final double subtotal;
  final double deliveryFee;
  final double priorityFee;
  final double extraDropFee;
  final double serviceFee;
  double get total => subtotal + deliveryFee + priorityFee + extraDropFee + serviceFee;
}

const _kBaseDeliveryFee = 60.0;
const _kSaverDeliveryFee = 35.0;
const _kPriorityFee = 50.0;
const _kExtraDropFee = 30.0;
const _kServiceFee = 4.0;

double _deliveryFeeForTier(DeliverySpeedTier tier) {
  switch (tier) {
    case DeliverySpeedTier.saver:
      return _kSaverDeliveryFee;
    case DeliverySpeedTier.priority:
    case DeliverySpeedTier.standard:
    case DeliverySpeedTier.scheduled:
      return _kBaseDeliveryFee;
  }
}

final checkoutFeesProvider = Provider<CheckoutFees>((ref) {
  final state = ref.watch(checkoutProvider);
  final extraDrops = state.drops.length > 1 ? state.drops.length - 1 : 0;
  return CheckoutFees(
    subtotal: state.subtotal,
    deliveryFee: _deliveryFeeForTier(state.speedTier),
    priorityFee: state.speedTier == DeliverySpeedTier.priority ? _kPriorityFee : 0,
    extraDropFee: extraDrops * _kExtraDropFee,
    serviceFee: _kServiceFee,
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/providers/checkout_fees_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/providers/checkout_provider.dart apps/mobile/test/features/customer/order/providers/checkout_fees_test.dart
git commit -m "feat(mobile): add checkoutFeesProvider derived from state"
```

---

## Phase 3 — Mobile UI (Checkout screen + cards)

### Task 13: Checkout items card widget

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart`
- Test: `apps/mobile/test/features/customer/order/widgets/checkout_items_card_test.dart`

- [ ] **Step 1: Write the failing widget test**

```dart
// apps/mobile/test/features/customer/order/widgets/checkout_items_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_items_card.dart';

void main() {
  testWidgets('renders one row per item with name and quantity', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
          id: 'a',
          category: 'paper',
          fileName: 'thesis.pdf',
          filePath: '/tmp/a.pdf',
          fileSize: 1,
          fileMetadataId: 1,
          quantity: 3,
          pageCount: 10,
          printSubtotal: 150,
        ));

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutItemsCard())),
    ));

    expect(find.text('thesis.pdf'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('+ Add Items'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_items_card_test.dart`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the widget**

```dart
// apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutItemsCard extends ConsumerWidget {
  const CheckoutItemsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('Your prints', style: AppTypography.bodyBold),
              const Spacer(),
              TextButton(
                onPressed: () => context.push('/customer/order/new?mode=add'),
                child: Text('+ Add Items',
                    style: AppTypography.bodyBold.copyWith(color: colors.brand)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in state.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.fileName, style: AppTypography.bodyBold),
                        Text(formatCurrency(item.printSubtotal),
                            style: AppTypography.caption),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove),
                        onPressed: () => ref.read(checkoutProvider.notifier).setQuantity(
                              item.id,
                              (item.quantity - 1).clamp(1, 9999),
                            ),
                      ),
                      Text('${item.quantity}', style: AppTypography.bodyBold),
                      IconButton(
                        icon: const Icon(Icons.add),
                        onPressed: () => ref.read(checkoutProvider.notifier).setQuantity(
                              item.id,
                              item.quantity + 1,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_items_card_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart apps/mobile/test/features/customer/order/widgets/checkout_items_card_test.dart
git commit -m "feat(mobile): add CheckoutItemsCard widget"
```

---

### Task 14: Checkout speed-tier card widget

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/checkout_speed_card.dart`
- Test: `apps/mobile/test/features/customer/order/widgets/checkout_speed_card_test.dart`

- [ ] **Step 1: Write the failing widget test**

```dart
// apps/mobile/test/features/customer/order/widgets/checkout_speed_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';

void main() {
  testWidgets('renders 4 tier rows and selects standard by default', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    expect(find.text('Priority'), findsOneWidget);
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('Saver'), findsOneWidget);
    expect(find.text('Scheduled'), findsOneWidget);
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.standard);
  });

  testWidgets('tapping Saver updates state', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    await tester.tap(find.text('Saver'));
    await tester.pump();
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.saver);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_speed_card_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the widget**

```dart
// apps/mobile/lib/features/customer/order/widgets/checkout_speed_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/slot_picker_sheet.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutSpeedCard extends ConsumerWidget {
  const CheckoutSpeedCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final fees = ref.watch(checkoutFeesProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final tiers = <_TierSpec>[
      _TierSpec(DeliverySpeedTier.priority, 'Priority', '~15 min',
          fees.deliveryFee + 50),
      _TierSpec(DeliverySpeedTier.standard, 'Standard', '~30 min', fees.deliveryFee),
      _TierSpec(DeliverySpeedTier.saver, 'Saver', '~60 min', 35),
      _TierSpec(DeliverySpeedTier.scheduled, 'Scheduled',
          state.scheduledSlot == null
              ? 'Pick a slot'
              : '${state.scheduledSlot!.date} ${state.scheduledSlot!.startTime}',
          fees.deliveryFee),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('How fast?', style: AppTypography.bodyBold),
          const SizedBox(height: AppSpacing.sm),
          for (final t in tiers)
            InkWell(
              onTap: () async {
                if (t.tier == DeliverySpeedTier.scheduled) {
                  final slot = await SlotPickerSheet.show(context);
                  if (slot != null) {
                    ref.read(checkoutProvider.notifier).setScheduledSlot(slot);
                  }
                  return;
                }
                ref.read(checkoutProvider.notifier).setSpeedTier(t.tier);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Radio<DeliverySpeedTier>(
                      value: t.tier,
                      groupValue: state.speedTier,
                      onChanged: (_) {},
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t.label, style: AppTypography.bodyBold),
                          Text(t.subtitle, style: AppTypography.caption),
                        ],
                      ),
                    ),
                    Text(formatCurrency(t.fee), style: AppTypography.bodyBold),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TierSpec {
  const _TierSpec(this.tier, this.label, this.subtitle, this.fee);
  final DeliverySpeedTier tier;
  final String label;
  final String subtitle;
  final double fee;
}
```

- [ ] **Step 4: Stub the sheet**

The widget references `SlotPickerSheet.show`. Create the stub now (filled in later):

```dart
// apps/mobile/lib/features/customer/order/sheets/slot_picker_sheet.dart
import 'package:flutter/material.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';

class SlotPickerSheet {
  static Future<ScheduledSlot?> show(BuildContext context) async {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_speed_card_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/order/widgets/checkout_speed_card.dart apps/mobile/lib/features/customer/order/sheets/slot_picker_sheet.dart apps/mobile/test/features/customer/order/widgets/checkout_speed_card_test.dart
git commit -m "feat(mobile): add CheckoutSpeedCard with 4 tiers"
```

---

### Task 15: Checkout payment card widget

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart`
- Test: `apps/mobile/test/features/customer/order/widgets/checkout_payment_card_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/widgets/checkout_payment_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_payment_card.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('shows "Choose payment method" when none selected', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
    ));
    expect(find.text('Choose payment method'), findsOneWidget);
  });

  testWidgets('shows method label when selected', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).setPaymentMethod(PaymentMethod.gridCredits);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
    ));
    expect(find.textContaining('GRIDGO Credits'), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_payment_card_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the widget**

```dart
// apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/payment_method_sheet.dart';
import 'package:printing_app/shared/models/enums.dart';

String _labelFor(PaymentMethod m) {
  switch (m) {
    case PaymentMethod.gcash:
      return 'GCash';
    case PaymentMethod.maya:
      return 'Maya';
    case PaymentMethod.cod:
      return 'Cash on Delivery';
    case PaymentMethod.gridCredits:
      return 'GRIDGO Credits';
  }
}

class CheckoutPaymentCard extends ConsumerWidget {
  const CheckoutPaymentCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final method = state.paymentMethod;

    return InkWell(
      onTap: () async {
        final result = await PaymentMethodSheet.show(context, current: method);
        if (result != null) {
          ref.read(checkoutProvider.notifier).setPaymentMethod(result);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderXl,
          border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Text('Payment', style: AppTypography.bodyBold),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                method == null ? 'Choose payment method' : _labelFor(method),
                style: AppTypography.body,
                textAlign: TextAlign.right,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text('Change',
                style: AppTypography.bodyBold.copyWith(color: colors.brand)),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Stub the sheet**

```dart
// apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart
import 'package:flutter/material.dart';
import 'package:printing_app/shared/models/enums.dart';

class PaymentMethodSheet {
  static Future<PaymentMethod?> show(
    BuildContext context, {
    PaymentMethod? current,
  }) async {
    return current;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_payment_card_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart apps/mobile/test/features/customer/order/widgets/checkout_payment_card_test.dart
git commit -m "feat(mobile): add CheckoutPaymentCard with Change CTA"
```

---

### Task 16: Checkout summary card + sticky footer

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/checkout_summary_card.dart`
- Create: `apps/mobile/lib/features/customer/order/widgets/checkout_footer.dart`
- Test: `apps/mobile/test/features/customer/order/widgets/checkout_summary_card_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/widgets/checkout_summary_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_summary_card.dart';

void main() {
  testWidgets('renders subtotal, delivery, service fee rows', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
          id: 'a',
          category: 'paper',
          fileName: 'a.pdf',
          filePath: '/tmp/a.pdf',
          fileSize: 1,
          fileMetadataId: 1,
          quantity: 1,
          pageCount: 1,
          printSubtotal: 200,
        ));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSummaryCard())),
    ));
    expect(find.textContaining('Subtotal'), findsOneWidget);
    expect(find.textContaining('Delivery'), findsOneWidget);
    expect(find.textContaining('Service fee'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_summary_card_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement summary card**

```dart
// apps/mobile/lib/features/customer/order/widgets/checkout_summary_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutSummaryCard extends ConsumerWidget {
  const CheckoutSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fees = ref.watch(checkoutFeesProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        children: [
          _row('Subtotal', fees.subtotal),
          _row('Delivery', fees.deliveryFee),
          if (fees.priorityFee > 0) _row('Priority', fees.priorityFee),
          if (fees.extraDropFee > 0) _row('Extra drop', fees.extraDropFee),
          _row('Service fee', fees.serviceFee),
        ],
      ),
    );
  }

  Widget _row(String label, double value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Expanded(child: Text(label, style: AppTypography.body)),
            Text(formatCurrency(value), style: AppTypography.bodyBold),
          ],
        ),
      );
}
```

- [ ] **Step 4: Implement sticky footer**

```dart
// apps/mobile/lib/features/customer/order/widgets/checkout_footer.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutFooter extends ConsumerWidget {
  const CheckoutFooter({super.key, required this.onPlaceOrder});
  final VoidCallback onPlaceOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fees = ref.watch(checkoutFeesProvider);
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final canPlace = state.items.isNotEmpty &&
        state.paymentMethod != null &&
        (state.mode == DeliveryMode.pickup || state.singleAddress != null || state.drops.isNotEmpty);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outline)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text('Total', style: AppTypography.bodyBold),
              const Spacer(),
              Text(formatCurrency(fees.total),
                  style: AppTypography.h3.copyWith(color: colors.onBackground)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Place Order',
            variant: AppButtonVariant.brand,
            isFullWidth: true,
            onTap: canPlace ? onPlaceOrder : null,
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_summary_card_test.dart`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/order/widgets/ apps/mobile/test/features/customer/order/widgets/checkout_summary_card_test.dart
git commit -m "feat(mobile): add CheckoutSummaryCard and CheckoutFooter"
```

---

### Task 17: Delivery card with mode tabs (Delivery / Pickup / Multi-drop)

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/checkout_delivery_card.dart`
- Test: `apps/mobile/test/features/customer/order/widgets/checkout_delivery_card_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/widgets/checkout_delivery_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_delivery_card.dart';

void main() {
  testWidgets('renders three mode tabs', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutDeliveryCard())),
    ));
    expect(find.text('Delivery'), findsOneWidget);
    expect(find.text('Pickup'), findsOneWidget);
    expect(find.text('Multi-drop'), findsOneWidget);
  });

  testWidgets('tapping Pickup switches mode and shows shop card', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutDeliveryCard())),
    ));
    await tester.tap(find.text('Pickup'));
    await tester.pump();
    expect(container.read(checkoutProvider).mode, DeliveryMode.pickup);
    expect(find.textContaining('GRIDGO Print Shop'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_delivery_card_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the widget**

```dart
// apps/mobile/lib/features/customer/order/widgets/checkout_delivery_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/multidrop_groups.dart';

class CheckoutDeliveryCard extends ConsumerWidget {
  const CheckoutDeliveryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              for (final m in DeliveryMode.values)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: ChoiceChip(
                    label: Text(_labelForMode(m)),
                    selected: state.mode == m,
                    onSelected: (_) =>
                        ref.read(checkoutProvider.notifier).setMode(m),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (state.mode == DeliveryMode.delivery)
            _SingleAddressRow(state: state, ref: ref)
          else if (state.mode == DeliveryMode.pickup)
            const _PickupCard()
          else
            const MultidropGroups(),
        ],
      ),
    );
  }

  String _labelForMode(DeliveryMode m) {
    switch (m) {
      case DeliveryMode.delivery:
        return 'Delivery';
      case DeliveryMode.pickup:
        return 'Pickup';
      case DeliveryMode.multidrop:
        return 'Multi-drop';
    }
  }
}

class _SingleAddressRow extends StatelessWidget {
  const _SingleAddressRow({required this.state, required this.ref});
  final CheckoutState state;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final addr = await AddressPickerSheet.show(context);
        if (addr != null) ref.read(checkoutProvider.notifier).setSingleAddress(addr);
      },
      child: Row(
        children: [
          const Icon(Icons.location_on, color: Colors.red),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              state.singleAddress?.label ?? 'Pick a delivery address',
              style: AppTypography.body,
            ),
          ),
          const Icon(Icons.chevron_right),
        ],
      ),
    );
  }
}

class _PickupCard extends StatelessWidget {
  const _PickupCard();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Text('🏪 GRIDGO Print Shop · 123 Print St, Makati'),
    );
  }
}
```

- [ ] **Step 4: Stub the address sheet and multidrop widget**

```dart
// apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart
import 'package:flutter/material.dart';
import 'package:printing_app/features/customer/address/models/address.dart';

class AddressPickerSheet {
  static Future<Address?> show(BuildContext context) async => null;
}
```

```dart
// apps/mobile/lib/features/customer/order/widgets/multidrop_groups.dart
import 'package:flutter/material.dart';

class MultidropGroups extends StatelessWidget {
  const MultidropGroups({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(8),
      child: Text('Multi-drop groups coming next'),
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/checkout_delivery_card_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/order/widgets/checkout_delivery_card.dart apps/mobile/lib/features/customer/order/widgets/multidrop_groups.dart apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart apps/mobile/test/features/customer/order/widgets/checkout_delivery_card_test.dart
git commit -m "feat(mobile): add CheckoutDeliveryCard with mode tabs"
```

---

### Task 18: Multi-drop groups widget

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/widgets/multidrop_groups.dart`
- Test: `apps/mobile/test/features/customer/order/widgets/multidrop_groups_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/widgets/multidrop_groups_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/multidrop_groups.dart';

void main() {
  testWidgets('renders one row per drop and "Add another drop" link', (tester) async {
    final container = ProviderContainer();
    final n = container.read(checkoutProvider.notifier);
    n.addItem(CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1, printSubtotal: 100,
    ));
    n.setDrops([
      const DestinationGroup(id: '1', label: 'Drop 1', itemIds: ['a']),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
    ));
    expect(find.text('Drop 1'), findsOneWidget);
    expect(find.text('+ Add another drop'), findsOneWidget);
  });

  testWidgets('+ Add another drop appends an empty group', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).setDrops([
      const DestinationGroup(id: '1', label: 'Drop 1', itemIds: []),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
    ));
    await tester.tap(find.text('+ Add another drop'));
    await tester.pump();
    expect(container.read(checkoutProvider).drops.length, 2);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/multidrop_groups_test.dart`
Expected: FAIL

- [ ] **Step 3: Replace the stub**

```dart
// apps/mobile/lib/features/customer/order/widgets/multidrop_groups.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:uuid/uuid.dart';

class MultidropGroups extends ConsumerWidget {
  const MultidropGroups({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final drop in state.drops)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              border: Border.all(color: colors.outline),
              borderRadius: AppRadius.borderMd,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(drop.label, style: AppTypography.bodyBold),
                    const Spacer(),
                    TextButton(
                      onPressed: () async {
                        final addr = await AddressPickerSheet.show(context);
                        if (addr == null) return;
                        ref.read(checkoutProvider.notifier).setDrops([
                          for (final d in state.drops)
                            if (d.id == drop.id)
                              d.copyWith(addressId: addr.id, label: addr.label)
                            else
                              d,
                        ]);
                      },
                      child: const Text('Pick address'),
                    ),
                  ],
                ),
                if (drop.addressId == null)
                  Text('No address chosen', style: AppTypography.caption),
                for (final itemId in drop.itemIds)
                  Text('• ${state.items.firstWhere((i) => i.id == itemId).fileName}'),
              ],
            ),
          ),
        TextButton(
          onPressed: () {
            ref.read(checkoutProvider.notifier).setDrops([
              ...state.drops,
              DestinationGroup(id: const Uuid().v4(), label: 'Drop ${state.drops.length + 1}', itemIds: const []),
            ]);
          },
          child: const Text('+ Add another drop'),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/widgets/multidrop_groups_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/widgets/multidrop_groups.dart apps/mobile/test/features/customer/order/widgets/multidrop_groups_test.dart
git commit -m "feat(mobile): implement MultidropGroups with add/edit drops"
```

---

### Task 19: Address picker bottom sheet

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart`
- Test: `apps/mobile/test/features/customer/order/sheets/address_picker_sheet_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/sheets/address_picker_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/models/address.dart';
import 'package:printing_app/features/customer/address/providers/addresses_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';

void main() {
  testWidgets('shows saved addresses, returns the chosen one', (tester) async {
    final container = ProviderContainer(overrides: [
      addressesProvider.overrideWith((ref) => Future.value([
            const Address(id: 1, label: 'Home', fullAddress: '12 Sampaguita St'),
            const Address(id: 2, label: 'Office', fullAddress: 'Salcedo Tower'),
          ])),
    ]);

    Address? picked;
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Builder(builder: (ctx) => Scaffold(
          body: ElevatedButton(
            onPressed: () async {
              picked = await AddressPickerSheet.show(ctx);
            },
            child: const Text('Open'),
          ),
        )),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Office'), findsOneWidget);
    await tester.tap(find.text('Office'));
    await tester.pumpAndSettle();
    expect(picked?.id, 2);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/address_picker_sheet_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the sheet**

```dart
// apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/address/models/address.dart';
import 'package:printing_app/features/customer/address/providers/addresses_provider.dart';

class AddressPickerSheet {
  static Future<Address?> show(BuildContext context) {
    return showModalBottomSheet<Address>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddressPickerBody(),
    );
  }
}

class _AddressPickerBody extends ConsumerWidget {
  const _AddressPickerBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressesProvider);
    return SafeArea(
      child: addresses.when(
        loading: () => const SizedBox(
          height: 240,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (e, _) => SizedBox(
          height: 240,
          child: Center(child: Text('Error: $e')),
        ),
        data: (list) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Choose a delivery address',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            for (final a in list)
              ListTile(
                leading: const Icon(Icons.place),
                title: Text(a.label),
                subtitle: Text(a.fullAddress),
                onTap: () => Navigator.of(context).pop(a),
              ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/address_picker_sheet_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart apps/mobile/test/features/customer/order/sheets/address_picker_sheet_test.dart
git commit -m "feat(mobile): implement AddressPickerSheet"
```

---

### Task 20: Slot picker bottom sheet

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/sheets/slot_picker_sheet.dart`
- Test: `apps/mobile/test/features/customer/order/sheets/slot_picker_sheet_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/sheets/slot_picker_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/sheets/slot_picker_sheet.dart';
import 'package:printing_app/shared/models/delivery_slot.dart';

void main() {
  testWidgets('lists available slots and returns chosen ScheduledSlot', (tester) async {
    final container = ProviderContainer(overrides: [
      deliverySlotProvider('2026-05-01').overrideWith(
        (ref) => DeliverySlotNotifier()
          ..state = const [
            DeliverySlot(
              templateId: 7,
              startTime: '09:00:00',
              endTime: '11:00:00',
              capacity: 10,
              bookedCount: 4,
              isFull: false,
            ),
          ],
      ),
    ]);

    ScheduledSlot? picked;
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Builder(builder: (ctx) => Scaffold(
          body: ElevatedButton(
            onPressed: () async {
              picked = await SlotPickerSheet.show(ctx, initialDate: '2026-05-01');
            },
            child: const Text('Open'),
          ),
        )),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('09:00 – 11:00'), findsOneWidget);
    await tester.tap(find.text('09:00 – 11:00'));
    await tester.tap(find.textContaining('Confirm'));
    await tester.pumpAndSettle();
    expect(picked?.templateId, 7);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/slot_picker_sheet_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the sheet**

```dart
// apps/mobile/lib/features/customer/order/sheets/slot_picker_sheet.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';

class SlotPickerSheet {
  static Future<ScheduledSlot?> show(
    BuildContext context, {
    String? initialDate,
  }) {
    final date = initialDate ?? DateTime.now().toIso8601String().substring(0, 10);
    return showModalBottomSheet<ScheduledSlot>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _SlotPickerBody(date: date),
    );
  }
}

class _SlotPickerBody extends ConsumerStatefulWidget {
  const _SlotPickerBody({required this.date});
  final String date;

  @override
  ConsumerState<_SlotPickerBody> createState() => _SlotPickerBodyState();
}

class _SlotPickerBodyState extends ConsumerState<_SlotPickerBody> {
  int? _chosenTemplate;
  String? _start;
  String? _end;

  @override
  Widget build(BuildContext context) {
    final slots = ref.watch(deliverySlotProvider(widget.date));
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Schedule your delivery',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          for (final s in slots)
            RadioListTile<int>(
              value: s.templateId,
              groupValue: _chosenTemplate,
              onChanged: s.isFull
                  ? null
                  : (v) => setState(() {
                        _chosenTemplate = v;
                        _start = s.startTime;
                        _end = s.endTime;
                      }),
              title: Text(
                  '${s.startTime.substring(0, 5)} – ${s.endTime.substring(0, 5)}'),
              subtitle: Text('${s.bookedCount}/${s.capacity} booked'),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _chosenTemplate == null
                  ? null
                  : () => Navigator.of(context).pop(ScheduledSlot(
                        templateId: _chosenTemplate!,
                        date: widget.date,
                        startTime: _start!,
                        endTime: _end!,
                      )),
              child: Text('Confirm ${widget.date}'),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/slot_picker_sheet_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/sheets/slot_picker_sheet.dart apps/mobile/test/features/customer/order/sheets/slot_picker_sheet_test.dart
git commit -m "feat(mobile): implement SlotPickerSheet"
```

---

### Task 21: Payment method bottom sheet

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart`
- Test: `apps/mobile/test/features/customer/order/sheets/payment_method_sheet_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/sheets/payment_method_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/sheets/payment_method_sheet.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('lists 4 methods, returns chosen one', (tester) async {
    PaymentMethod? picked;
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Builder(builder: (ctx) => Scaffold(
          body: ElevatedButton(
            onPressed: () async {
              picked = await PaymentMethodSheet.show(ctx, current: null);
            },
            child: const Text('Open'),
          ),
        )),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('GCash'), findsOneWidget);
    expect(find.text('Maya'), findsOneWidget);
    expect(find.text('Cash on Delivery'), findsOneWidget);
    expect(find.text('GRIDGO Credits'), findsOneWidget);
    await tester.tap(find.text('Maya'));
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();
    expect(picked, PaymentMethod.maya);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/payment_method_sheet_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the sheet**

```dart
// apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';

class PaymentMethodSheet {
  static Future<PaymentMethod?> show(
    BuildContext context, {
    PaymentMethod? current,
  }) {
    return showModalBottomSheet<PaymentMethod>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PaymentSheetBody(initial: current),
    );
  }
}

class _PaymentSheetBody extends ConsumerStatefulWidget {
  const _PaymentSheetBody({required this.initial});
  final PaymentMethod? initial;

  @override
  ConsumerState<_PaymentSheetBody> createState() => _PaymentSheetBodyState();
}

class _PaymentSheetBodyState extends ConsumerState<_PaymentSheetBody> {
  PaymentMethod? _chosen;
  bool _setDefault = false;

  @override
  void initState() {
    super.initState();
    _chosen = widget.initial;
  }

  String _label(PaymentMethod m) {
    switch (m) {
      case PaymentMethod.gcash:
        return 'GCash';
      case PaymentMethod.maya:
        return 'Maya';
      case PaymentMethod.cod:
        return 'Cash on Delivery';
      case PaymentMethod.gridCredits:
        return 'GRIDGO Credits';
    }
  }

  String _wireValue(PaymentMethod m) {
    switch (m) {
      case PaymentMethod.gridCredits:
        return 'credits';
      default:
        return m.name;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Choose payment method',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          for (final m in PaymentMethod.values)
            RadioListTile<PaymentMethod>(
              value: m,
              groupValue: _chosen,
              onChanged: (v) => setState(() => _chosen = v),
              title: Text(_label(m)),
            ),
          CheckboxListTile(
            value: _setDefault,
            onChanged: (v) => setState(() => _setDefault = v ?? false),
            title: const Text('Set as default for future orders'),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _chosen == null
                  ? null
                  : () async {
                      if (_setDefault) {
                        try {
                          await ApiClient.instance.patch(
                            '/users/me/default-payment-method',
                            data: {'method': _wireValue(_chosen!)},
                          );
                          await ref.read(authProvider.notifier).refreshUser();
                        } catch (_) {
                          // non-fatal — selection still applied for this order
                        }
                      }
                      if (!context.mounted) return;
                      Navigator.of(context).pop(_chosen);
                    },
              child: const Text('Use this'),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/payment_method_sheet_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart apps/mobile/test/features/customer/order/sheets/payment_method_sheet_test.dart
git commit -m "feat(mobile): implement PaymentMethodSheet with set-default toggle"
```

---

### Task 22: Edit item bottom sheet

**Files:**
- Create: `apps/mobile/lib/features/customer/order/sheets/edit_item_sheet.dart`
- Test: `apps/mobile/test/features/customer/order/sheets/edit_item_sheet_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/sheets/edit_item_sheet_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/sheets/edit_item_sheet.dart';

void main() {
  testWidgets('returns updated CartItem with new quantity', (tester) async {
    final original = CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 10, printSubtotal: 100,
    );
    CartItem? updated;
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(home: Builder(builder: (ctx) => Scaffold(
        body: ElevatedButton(
          onPressed: () async {
            updated = await EditItemSheet.show(ctx, item: original);
          },
          child: const Text('Open'),
        ),
      ))),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('edit-pages')), '20');
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();
    expect(updated?.pageCount, 20);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/edit_item_sheet_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the sheet**

```dart
// apps/mobile/lib/features/customer/order/sheets/edit_item_sheet.dart
import 'package:flutter/material.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';

class EditItemSheet {
  static Future<CartItem?> show(BuildContext context, {required CartItem item}) {
    return showModalBottomSheet<CartItem>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EditItemBody(item: item),
    );
  }
}

class _EditItemBody extends StatefulWidget {
  const _EditItemBody({required this.item});
  final CartItem item;

  @override
  State<_EditItemBody> createState() => _EditItemBodyState();
}

class _EditItemBodyState extends State<_EditItemBody> {
  late TextEditingController _qty;
  late TextEditingController _pages;

  @override
  void initState() {
    super.initState();
    _qty = TextEditingController(text: widget.item.quantity.toString());
    _pages = TextEditingController(text: widget.item.pageCount.toString());
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Edit · ${widget.item.fileName}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            TextField(
              key: const Key('edit-qty'),
              controller: _qty,
              decoration: const InputDecoration(labelText: 'Quantity'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              key: const Key('edit-pages'),
              controller: _pages,
              decoration: const InputDecoration(labelText: 'Pages'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(widget.item.copyWith(
                quantity: int.tryParse(_qty.text) ?? widget.item.quantity,
                pageCount: int.tryParse(_pages.text) ?? widget.item.pageCount,
              )),
              child: const Text('Save changes'),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/sheets/edit_item_sheet_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/sheets/edit_item_sheet.dart apps/mobile/test/features/customer/order/sheets/edit_item_sheet_test.dart
git commit -m "feat(mobile): implement EditItemSheet"
```

---

### Task 23: Assemble the `CheckoutScreen`

**Files:**
- Create: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart`
- Test: `apps/mobile/test/features/customer/order/screens/checkout_screen_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/screens/checkout_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';

void main() {
  testWidgets('renders all 5 cards + footer', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1, printSubtotal: 100,
    ));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: CheckoutScreen()),
    ));
    expect(find.text('Your prints'), findsOneWidget);
    expect(find.text('Delivery'), findsOneWidget);
    expect(find.text('How fast?'), findsOneWidget);
    expect(find.text('Payment'), findsOneWidget);
    expect(find.text('Place Order'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/screens/checkout_screen_test.dart`
Expected: FAIL

- [ ] **Step 3: Implement the screen**

```dart
// apps/mobile/lib/features/customer/order/screens/checkout_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_delivery_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_footer.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_items_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_payment_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_summary_card.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';

class CheckoutScreen extends ConsumerWidget {
  const CheckoutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: const Text('Checkout'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              '${state.itemCount} print job${state.itemCount == 1 ? '' : 's'}',
              style: AppTypography.caption,
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: const [
            CheckoutItemsCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutDeliveryCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutSpeedCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutPaymentCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutSummaryCard(),
            SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
      bottomNavigationBar: CheckoutFooter(
        onPlaceOrder: () => _placeOrder(context, ref),
      ),
    );
  }

  Future<void> _placeOrder(BuildContext context, WidgetRef ref) async {
    final notifier = ref.read(ordersProvider.notifier);
    try {
      await notifier.placeCheckout(ref.read(checkoutProvider));
      ref.read(checkoutProvider.notifier).reset();
      if (context.mounted) Navigator.of(context).pushReplacementNamed('/customer/home');
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/screens/checkout_screen_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/checkout_screen.dart apps/mobile/test/features/customer/order/screens/checkout_screen_test.dart
git commit -m "feat(mobile): assemble CheckoutScreen from cards + footer"
```

---

### Task 24: `placeCheckout` in `OrdersNotifier`

**Files:**
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Test: `apps/mobile/test/features/customer/orders/orders_provider_place_checkout_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/orders/orders_provider_place_checkout_test.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:dio_test/dio_test.dart' as dt; // existing test helper

void main() {
  test('placeCheckout posts to /orders/batch with speedTier', () async {
    final dio = ApiClient.instance.dio;
    Map<String, dynamic>? capturedBody;
    dio.interceptors.add(InterceptorsWrapper(onRequest: (opts, handler) {
      if (opts.path == '/orders/batch') {
        capturedBody = opts.data as Map<String, dynamic>;
        handler.resolve(Response(
          requestOptions: opts,
          statusCode: 201,
          data: {'batchId': 'BATCH-1', 'orders': []},
        ));
        return;
      }
      handler.next(opts);
    }));

    final container = ProviderContainer();
    final state = CheckoutState(
      items: [_item('a', 100)],
      paymentMethod: PaymentMethod.cod,
      speedTier: DeliverySpeedTier.priority,
    );
    await container.read(ordersProvider.notifier).placeCheckout(state);

    expect(capturedBody?['speedTier'], 'priority');
    expect(capturedBody?['paymentMethod'], 'cod');
    expect((capturedBody?['items'] as List).length, 1);
  });
}

CartItem _item(String id, double price) => CartItem(
      id: id, category: 'paper', fileName: '$id.pdf', filePath: '/tmp/$id.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1, printSubtotal: price,
    );
```

If `dio_test` isn't already in the project, replace the interceptor approach with whatever HTTP-mock helper your tests already use (search the repo for `MockClient` or `Dio()` test patterns first).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/orders/orders_provider_place_checkout_test.dart`
Expected: FAIL

- [ ] **Step 3: Add the method**

In `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`, add inside `OrdersNotifier`:

```dart
  Future<void> placeCheckout(CheckoutState state) async {
    final body = {
      'items': state.items.map((i) => {
            'category': i.category,
            'quantity': i.quantity,
            'totalPrice': i.printSubtotal,
            'fileName': i.fileName,
            'fileMetadataId': i.fileMetadataId,
            'paperSpecs': i.paperSpecs?.toJson(),
            'threeDSpecs': i.threeDSpecs?.toJson(),
          }).toList(),
      'paymentMethod': _wirePayment(state.paymentMethod!),
      'deliveryOption': state.mode == DeliveryMode.pickup ? 'pickup' : 'delivery',
      'deliveryAddressId': state.singleAddress?.id,
      'speedTier': state.speedTier.toApi(),
      if (state.scheduledSlot != null) ...{
        'slotTemplateId': state.scheduledSlot!.templateId,
        'slotDate': state.scheduledSlot!.date,
      },
      if (state.drops.isNotEmpty)
        'destinations': state.drops
            .where((d) => d.addressId != null)
            .map((d) => {'addressId': d.addressId, 'label': d.label})
            .toList(),
    };
    await ApiClient.instance.post('/orders/batch', data: body);
    await refreshOrders();
  }

  String _wirePayment(PaymentMethod m) =>
      m == PaymentMethod.gridCredits ? 'credits' : m.name;
```

Add the necessary imports for `CheckoutState`, `DeliveryMode`, and `DeliverySpeedTier`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/orders/orders_provider_place_checkout_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/orders/providers/orders_provider.dart apps/mobile/test/features/customer/orders/
git commit -m "feat(mobile): add placeCheckout method that posts to /orders/batch"
```

---

## Phase 4 — Wire flow + flag

### Task 25: Route `/customer/order/checkout` and gate by `checkoutV2`

**Files:**
- Modify: `apps/mobile/lib/config/routes/app_router.dart`

- [ ] **Step 1: Add the route**

In `apps/mobile/lib/config/routes/app_router.dart`, near the other order routes (around line 350), add:

```dart
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/config/feature_flags.dart';
```

```dart
      GoRoute(
        path: '/customer/order/checkout',
        pageBuilder: (_, state) =>
            slideUpTransition(const CheckoutScreen(), state),
      ),
```

- [ ] **Step 2: Modify the upload screen's Continue handler**

In `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`, find the `Continue` button handler. Replace its navigation call with a flag-gated branch:

```dart
final flags = const FeatureFlags();
if (flags.checkoutV2) {
  // Append the just-uploaded item to checkoutProvider
  ref.read(checkoutProvider.notifier).addItem(_buildCartItemFromOrderFlow(
    ref.read(orderFlowProvider),
  ));
  if (state.isAddMode) {
    Navigator.of(context).pop(); // returns to existing CheckoutScreen
  } else {
    context.push('/customer/order/checkout');
  }
} else {
  context.push('/customer/order/summary'); // existing behavior
}
```

Where `_buildCartItemFromOrderFlow` is a small helper at the bottom of the file:

```dart
CartItem _buildCartItemFromOrderFlow(OrderFlowState s) {
  return CartItem(
    id: const Uuid().v4(),
    category: s.category,
    fileName: s.fileName!,
    filePath: s.filePath!,
    fileSize: s.fileSize ?? 0,
    fileMetadataId: s.fileMetadataId,
    quantity: s.quantity,
    pageCount: s.pageCount,
    printSubtotal: s.totalPrice,
    paperSpecs: s.paperSpecs,
    threeDSpecs: s.threeDSpecs,
  );
}
```

`state.isAddMode` reads the `mode=add` query param via `GoRouterState.uri.queryParameters['mode'] == 'add'`.

- [ ] **Step 3: Manual verification**

Run: `cd apps/mobile && CHECKOUT_V2=true /home/jd/fvm/versions/3.41.6/bin/flutter run -d chrome --dart-define=CHECKOUT_V2=true`
Walk through: Home → New Order → Paper Specs → A4 / Color / 1 page → Upload (any small PDF) → Continue. Confirm you land on the Checkout screen with the item visible.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/config/routes/app_router.dart apps/mobile/lib/features/customer/order/screens/upload_screen.dart
git commit -m "feat(mobile): route Upload → Checkout when checkoutV2 flag is on"
```

---

### Task 26: Add `mode=add` banner to category screen

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/category_screen.dart`
- Test: `apps/mobile/test/features/customer/order/screens/category_screen_add_mode_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/customer/order/screens/category_screen_add_mode_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/screens/category_screen.dart';

void main() {
  testWidgets('shows "Add to your order" banner when 1+ items in checkout', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1, printSubtotal: 100,
    ));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: CategoryScreen(addMode: true)),
    ));
    expect(find.textContaining('Add to your order'), findsOneWidget);
    expect(find.text('Skip — review checkout'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/screens/category_screen_add_mode_test.dart`
Expected: FAIL

- [ ] **Step 3: Update the screen**

In `apps/mobile/lib/features/customer/order/screens/category_screen.dart`, add a constructor parameter and conditional UI:

```dart
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, this.addMode = false});
  final bool addMode;
  // ...
}
```

In `build`, when `widget.addMode`, swap the app bar title to `'Add to your order'` and add a `Skip — review checkout` text button that pops the route.

In the router's `/customer/order/new` GoRoute, read the query param:

```dart
GoRoute(
  path: '/customer/order/new',
  pageBuilder: (_, state) => slideUpTransition(
    CategoryScreen(addMode: state.uri.queryParameters['mode'] == 'add'),
    state,
  ),
),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/screens/category_screen_add_mode_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/category_screen.dart apps/mobile/lib/config/routes/app_router.dart apps/mobile/test/features/customer/order/screens/category_screen_add_mode_test.dart
git commit -m "feat(mobile): add CategoryScreen addMode banner and Skip CTA"
```

---

### Task 27: Server build + smoke test the new flow end-to-end

- [ ] **Step 1: Build and start the server**

Run: `cd server && npm run build && npm run start:dev`
Expected: server starts on `:3000` with no errors

- [ ] **Step 2: Build the mobile app**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons --dart-define=CHECKOUT_V2=true`
Expected: build success

- [ ] **Step 3: Manual end-to-end smoke**

Open the built web app, log in as a test user, walk through:
1. Home → New Order
2. Paper category → A4 / Color / 1 page
3. Upload any small PDF → Continue
4. Land on Checkout — verify item visible
5. Tap `+ Add Items` → add a second item → return to Checkout
6. Tap `Multi-drop` tab → assign one item to a new drop, pick a different address
7. Tap `Saver` tier → confirm fee changes
8. Tap `Change` payment → pick GCash → tick "Set as default" → close
9. Tap `Place Order`
10. Open admin dashboard, verify the batch order arrived with `speedTier='saver'` and 2 destinations

Note any issues. If any test step fails, file an issue and fix before proceeding.

- [ ] **Step 4: Commit smoke-test notes**

If you found and fixed bugs above, the fixes are already committed. If everything worked, no commit needed.

---

## Phase 5 — Cleanup (run after one-week soak with flag flipped on)

### Task 28: Drop `priority` boolean column

**Files:**
- Create: `server/migrations/<timestamp>-drop-priority-boolean.ts`

- [ ] **Step 1: Write the migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPriorityBoolean1715040000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE batch_orders DROP COLUMN IF EXISTS priority
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE batch_orders ADD COLUMN priority BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      UPDATE batch_orders SET priority = TRUE WHERE speed_tier = 'priority'
    `);
  }
}
```

- [ ] **Step 2: Run migration**

Run: `cd server && npm run migration:run`

- [ ] **Step 3: Remove `priority` from DTO and service**

Delete the `priority` field from `CreateBatchOrderDto` in `server/src/orders/dto/create-order.dto.ts`. Delete the legacy fallback in `OrdersService.createBatch()` that reads `dto.priority`.

- [ ] **Step 4: Run server tests**

Run: `cd server && npm test`
Expected: all green

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "chore(orders): drop legacy priority boolean (use speedTier)"
```

---

### Task 29: Delete obsolete mobile screens and providers

**Files:**
- Delete: `apps/mobile/lib/features/customer/order/screens/summary_screen.dart`
- Delete: `apps/mobile/lib/features/customer/cart/screens/cart_screen.dart`
- Delete: `apps/mobile/lib/features/customer/order/screens/destination_groups_screen.dart`
- Delete: `apps/mobile/lib/features/customer/order/screens/slot_picker_screen.dart`
- Delete: `apps/mobile/lib/features/customer/order/screens/external_delivery_confirm_screen.dart`
- Delete: `apps/mobile/lib/features/customer/order/screens/delivery_details_screen.dart`
- Delete: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`
- Delete: `apps/mobile/lib/features/customer/order/providers/order_checkout_provider.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart` — remove old routes
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` — delete legacy branch
- Modify: `apps/mobile/lib/features/customer/cart/providers/cart_provider.dart` — keep CartItem model, delete CartNotifier (now superseded by checkoutProvider)

- [ ] **Step 1: Delete the screens and providers**

```bash
rm apps/mobile/lib/features/customer/order/screens/summary_screen.dart
rm apps/mobile/lib/features/customer/cart/screens/cart_screen.dart
rm apps/mobile/lib/features/customer/order/screens/destination_groups_screen.dart
rm apps/mobile/lib/features/customer/order/screens/slot_picker_screen.dart
rm apps/mobile/lib/features/customer/order/screens/external_delivery_confirm_screen.dart
rm apps/mobile/lib/features/customer/order/screens/delivery_details_screen.dart
rm apps/mobile/lib/features/customer/order/screens/payment_screen.dart
rm apps/mobile/lib/features/customer/order/providers/order_checkout_provider.dart
```

- [ ] **Step 2: Remove old routes from `app_router.dart`**

Delete these `GoRoute` entries (around lines 370-400):
- `/customer/order/summary`
- `/customer/cart` (CartScreen.routeName)
- `/customer/order/destinations`
- `/customer/order/slot-picker`
- `/customer/order/external-confirm`
- `/customer/order/delivery`
- `/customer/order/payment`

Remove the corresponding `import` lines at the top.

- [ ] **Step 3: Remove legacy branch from `upload_screen.dart`**

Replace the flag-gated branch with the unconditional behavior — always append item and navigate to `/customer/order/checkout` (or pop in addMode).

- [ ] **Step 4: Run all mobile tests**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test`
Expected: all green. If any tests reference deleted files, delete those tests too (they cover obsolete behavior).

- [ ] **Step 5: Build to confirm no broken imports**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons`
Expected: build success

- [ ] **Step 6: Commit**

```bash
git add -A apps/mobile/
git commit -m "chore(mobile): delete obsolete order screens replaced by Checkout"
```

---

### Task 30: Remove the `checkoutV2` feature flag

**Files:**
- Delete: `apps/mobile/lib/config/feature_flags.dart`
- Modify: anywhere `flags.checkoutV2` is read — remove the gating

- [ ] **Step 1: Find all flag references**

Run: `grep -rn "checkoutV2\|FeatureFlags()" apps/mobile/lib`
Expected: list of files. Should only be `upload_screen.dart` after Task 29 deleted the legacy branch.

- [ ] **Step 2: Remove the flag**

Delete `apps/mobile/lib/config/feature_flags.dart` and `apps/mobile/test/config/feature_flags_test.dart`.
Delete any `import 'package:printing_app/config/feature_flags.dart';` lines.
Delete any `if (flags.checkoutV2) ... else ...` branches that remain.

- [ ] **Step 3: Build to confirm**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons`
Expected: build success

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/
git commit -m "chore(mobile): remove checkoutV2 feature flag"
```

---

## Self-review notes

- **Spec coverage:** every section of the spec has at least one task. Items card → Task 13, Delivery card → Task 17, Speed card → Task 14, Payment card → Task 15, Summary card + footer → Task 16, Multi-drop → Task 18, Address sheet → Task 19, Slot sheet → Task 20, Payment sheet → Task 21, Edit sheet → Task 22, Checkout screen → Task 23, +Add Items loop → Task 26, route + flag → Task 25, smoke test → Task 27, Phase 4 cleanup → Tasks 28-30.
- **Server side:** Task 1 enum, Task 2 migration, Task 3 entity column, Task 4 user default payment, Task 5 DTO, Task 6 service logic, Task 7 pickup filter — covers every server impact in the spec.
- **External delivery banner** is mentioned in the spec but does not get its own task. It belongs inside `CheckoutSpeedCard` (Task 14) — a small follow-up to render the inline banner when the resolved address is outside the service area. Add a TODO note in the smoke-test step (Task 27) to verify or file a follow-up issue if missing.
- **Type consistency:** `DeliveryMode` is defined in `checkout_state.dart` (Task 10) and reused by `CheckoutNotifier.setMode` (Task 11), `CheckoutDeliveryCard` (Task 17), `CheckoutFooter` (Task 16). `DeliverySpeedTier` defined Task 9, used by Tasks 11, 12, 14. `ScheduledSlot` defined Task 10, used by Task 11, 14, 20. Names match across all tasks.
- **No placeholders:** every "Implement" step shows the actual code. Test code is concrete. Migration SQL is concrete.
