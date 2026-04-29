# Batch Delivery System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add slot-booked batch delivery, multi-destination groups, priority fee, and outside-Davao manual handoff to the GRID printing app.

**Architecture:** New `delivery-slots` NestJS module owns slot templates, bookings, geo-radius detection, and a WebSocket gateway. Existing `orders` module gains multi-destination + slot-aware fields. Mobile gains three new checkout screens (destination groups, slot picker, external delivery confirm) wired through a new `OrderCheckoutNotifier`. Admin gains four new pages (slot templates editor, today dashboard, external deliveries queue, delivery settings).

**Tech Stack:** NestJS + TypeORM (Postgres) backend, Flutter + Riverpod mobile, React + Refine + Ant Design admin, Socket.IO WebSocket transport.

**Spec:** `docs/superpowers/specs/2026-04-29-batch-delivery-system-design.md`

**Commit policy:** Each task ends with a commit step. The implementer subagent should run the commit; the controller should not require human approval for these per-task commits since they happen inside an approved plan.

---

## File Structure

### Backend — new files

| Path | Purpose |
|---|---|
| `server/src/delivery-slots/delivery-slots.module.ts` | NestJS module registering entities, services, controller, gateway |
| `server/src/delivery-slots/entities/delivery-slot-template.entity.ts` | Recurring weekly slot config |
| `server/src/delivery-slots/entities/delivery-slot-booking.entity.ts` | Per-batch slot booking row |
| `server/src/delivery-slots/entities/delivery-settings.entity.ts` | Single-row settings (service center, fees) |
| `server/src/delivery-slots/dto/update-slot-template.dto.ts` | Admin slot editor payload |
| `server/src/delivery-slots/dto/update-delivery-settings.dto.ts` | Admin settings payload |
| `server/src/delivery-slots/dto/book-slot.dto.ts` | Used inside batch-order create |
| `server/src/delivery-slots/delivery-slots.service.ts` | `getAvailability`, `bookSlot`, `releaseSlot` |
| `server/src/delivery-slots/delivery-settings.service.ts` | Read/update settings, derive `isInsideServiceArea` |
| `server/src/delivery-slots/geo-radius.service.ts` | Pure haversine helper |
| `server/src/delivery-slots/delivery-slots.controller.ts` | Customer + admin REST endpoints |
| `server/src/delivery-slots/delivery-slots.gateway.ts` | `/ws/delivery-slots` Socket.IO gateway |
| `server/src/delivery-slots/exceptions.ts` | `SlotFullException`, `CancellationClosedException`, `ServiceAreaMismatchException` |
| `server/src/orders/entities/delivery-destination.entity.ts` | Multi-destination row |

### Backend — modified files

| Path | Change |
|---|---|
| `server/src/orders/entities/batch-order.entity.ts` | Add `deliveryType`, `slotBookingId`, `priorityFee`, `extraDestinationFee`, `externalDeliveryStatus` |
| `server/src/orders/entities/order.entity.ts` | Add `destinationId` FK |
| `server/src/orders/dto/create-order.dto.ts` | Extend `CreateBatchOrderDto` with slot + destinations + priority |
| `server/src/orders/orders.service.ts` | `createBatch` integrates slot booking + destinations + fee calc |
| `server/src/orders/orders.controller.ts` | Add `PATCH /orders/batch/:id/cancel` |
| `server/src/orders/orders.module.ts` | Register `DeliveryDestination`; import `DeliverySlotsModule` |
| `server/src/app.module.ts` | Import `DeliverySlotsModule` |
| `server/src/seed.ts` | Seed slot templates + delivery settings |

### Mobile — new files

| Path | Purpose |
|---|---|
| `apps/mobile/lib/features/customer/order/models/delivery_slot.dart` | Slot DTO + status |
| `apps/mobile/lib/features/customer/order/models/destination_group.dart` | Destination group DTO |
| `apps/mobile/lib/features/customer/order/providers/delivery_slot_provider.dart` | Slot list + WS sync |
| `apps/mobile/lib/features/customer/order/providers/order_checkout_provider.dart` | Destination groups + slot + priority state |
| `apps/mobile/lib/features/customer/order/screens/destination_groups_screen.dart` | Group editor |
| `apps/mobile/lib/features/customer/order/screens/slot_picker_screen.dart` | Three-card slot picker with live counter |
| `apps/mobile/lib/features/customer/order/screens/external_delivery_confirm_screen.dart` | Out-of-area confirm |

### Mobile — modified files

| Path | Change |
|---|---|
| `apps/mobile/lib/shared/services/websocket_service.dart` | Add `connectDeliverySlots`, `subscribeSlots`, `listenForSlotUpdates` |
| `apps/mobile/lib/config/routes/app_router.dart` | Add three new routes |
| `apps/mobile/lib/features/customer/order/screens/summary_screen.dart` | Show slot/destinations/priority |
| `apps/mobile/lib/features/customer/order/screens/payment_screen.dart` | Submit extended batch payload |

### Admin — new files

| Path | Purpose |
|---|---|
| `admin/src/types/delivery-slot.ts` | Slot, Booking, Settings types |
| `admin/src/providers/delivery-slot-ws.ts` | Socket.IO client for `/ws/delivery-slots` |
| `admin/src/pages/delivery-slots/templates.tsx` | Templates editor |
| `admin/src/pages/delivery-slots/today.tsx` | Today's bookings dashboard |
| `admin/src/pages/external-deliveries/index.tsx` | Out-of-area queue |
| `admin/src/pages/admin-settings/delivery.tsx` | Service area + fee settings |

### Admin — modified files

| Path | Change |
|---|---|
| `admin/src/App.tsx` | Register new resources/routes |
| `admin/src/components/grid-sider.tsx` | Add nav items |
| `admin/src/pages/orders/list.tsx` | Add `Slot` column, External tag |
| `admin/src/pages/orders/show.tsx` | Render slot, destinations, priority |

---

## Phase A — Backend (Tasks 1–18)

### Task 1: Geo-radius pure helper

**Files:**
- Create: `server/src/delivery-slots/geo-radius.service.ts`
- Test: `server/src/delivery-slots/geo-radius.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/delivery-slots/geo-radius.service.spec.ts
import { GeoRadiusService } from './geo-radius.service';

describe('GeoRadiusService', () => {
  const svc = new GeoRadiusService();
  const center = { lat: 7.0731, lng: 125.6128 }; // Davao City Hall

  it('returns true for the center point', () => {
    expect(svc.isInsideRadius(center.lat, center.lng, center, 25)).toBe(true);
  });

  it('returns true at exactly the boundary (inclusive)', () => {
    // 1 degree latitude ≈ 111 km; offset by 25/111 deg
    const boundary = { lat: center.lat + 25 / 111, lng: center.lng };
    expect(svc.isInsideRadius(boundary.lat, boundary.lng, center, 25)).toBe(true);
  });

  it('returns false beyond the radius', () => {
    expect(svc.isInsideRadius(8.5, 125.6128, center, 25)).toBe(false);
  });

  it('returns false when target coords are null', () => {
    expect(svc.isInsideRadius(null, null, center, 25)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `cd server && npx jest delivery-slots/geo-radius.service.spec --no-coverage`
Expected: `Cannot find module './geo-radius.service'`.

- [ ] **Step 3: Implement minimal service**

```typescript
// server/src/delivery-slots/geo-radius.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class GeoRadiusService {
  isInsideRadius(
    lat: number | null,
    lng: number | null,
    center: { lat: number; lng: number },
    radiusKm: number,
  ): boolean {
    if (lat == null || lng == null) return false;
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat - center.lat);
    const dLng = toRad(lng - center.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(center.lat)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLng / 2) ** 2;
    const distance = 2 * R * Math.asin(Math.sqrt(a));
    return distance <= radiusKm;
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots/geo-radius.service.spec --no-coverage`
Expected: `PASS  src/delivery-slots/geo-radius.service.spec.ts (4 tests)`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/geo-radius.service.ts server/src/delivery-slots/geo-radius.service.spec.ts
git commit -m "feat(delivery-slots): add GeoRadiusService haversine helper"
```

---

### Task 2: DeliverySlotTemplate entity

**Files:**
- Create: `server/src/delivery-slots/entities/delivery-slot-template.entity.ts`
- Test: `server/src/delivery-slots/entities/delivery-slot-template.entity.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/delivery-slots/entities/delivery-slot-template.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { DeliverySlotTemplate } from './delivery-slot-template.entity';

describe('DeliverySlotTemplate entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliverySlotTemplate)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'dayOfWeek',
      'startTime',
      'endTime',
      'capacity',
      'isActive',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `cd server && npx jest delivery-slot-template.entity.spec --no-coverage`
Expected: `Cannot find module './delivery-slot-template.entity'`.

- [ ] **Step 3: Implement entity**

```typescript
// server/src/delivery-slots/entities/delivery-slot-template.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('delivery_slot_templates')
export class DeliverySlotTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'day_of_week', type: 'int' })
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // "09:30:00"

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'int', default: 10 })
  capacity: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slot-template.entity.spec --no-coverage`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/entities/delivery-slot-template.entity.ts server/src/delivery-slots/entities/delivery-slot-template.entity.spec.ts
git commit -m "feat(delivery-slots): add DeliverySlotTemplate entity"
```

---

### Task 3: DeliverySlotBooking entity

**Files:**
- Create: `server/src/delivery-slots/entities/delivery-slot-booking.entity.ts`
- Test: same file pattern as Task 2

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/delivery-slots/entities/delivery-slot-booking.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { DeliverySlotBooking } from './delivery-slot-booking.entity';

describe('DeliverySlotBooking entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliverySlotBooking)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'slotTemplateId',
      'date',
      'batchOrderId',
      'priority',
      'priorityRank',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slot-booking.entity.spec --no-coverage`

- [ ] **Step 3: Implement entity**

```typescript
// server/src/delivery-slots/entities/delivery-slot-booking.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { DeliverySlotTemplate } from './delivery-slot-template.entity';

@Entity('delivery_slot_bookings')
@Unique('uq_slot_booking_batch', ['batchOrderId'])
@Index('idx_slot_booking_template_date', ['slotTemplateId', 'date'])
export class DeliverySlotBooking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'slot_template_id', type: 'int' })
  slotTemplateId: number;

  @ManyToOne(() => DeliverySlotTemplate)
  @JoinColumn({ name: 'slot_template_id' })
  slotTemplate: DeliverySlotTemplate;

  @Column({ type: 'date' })
  date: string; // "YYYY-MM-DD"

  @Column({ name: 'batch_order_id', type: 'int' })
  batchOrderId: number;

  @Column({ default: false })
  priority: boolean;

  @Column({ name: 'priority_rank', type: 'int', nullable: true })
  priorityRank: number | null;

  @CreateDateColumn({ name: 'booked_at' })
  bookedAt: Date;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slot-booking.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/entities/delivery-slot-booking.entity.ts server/src/delivery-slots/entities/delivery-slot-booking.entity.spec.ts
git commit -m "feat(delivery-slots): add DeliverySlotBooking entity"
```

---

### Task 4: DeliverySettings entity

**Files:**
- Create: `server/src/delivery-slots/entities/delivery-settings.entity.ts`
- Test: same pattern

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/delivery-slots/entities/delivery-settings.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { DeliverySettings } from './delivery-settings.entity';

describe('DeliverySettings entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliverySettings)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'serviceCenterLat',
      'serviceCenterLng',
      'serviceRadiusKm',
      'priorityFeeAmount',
      'extraDestinationSurcharge',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-settings.entity.spec --no-coverage`

- [ ] **Step 3: Implement entity**

```typescript
// server/src/delivery-slots/entities/delivery-settings.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('delivery_settings')
export class DeliverySettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'service_center_lat',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  serviceCenterLat: number;

  @Column({
    name: 'service_center_lng',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  serviceCenterLng: number;

  @Column({
    name: 'service_radius_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 25,
  })
  serviceRadiusKm: number;

  @Column({
    name: 'priority_fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
  })
  priorityFeeAmount: number;

  @Column({
    name: 'extra_destination_surcharge',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 30,
  })
  extraDestinationSurcharge: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-settings.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/entities/delivery-settings.entity.ts server/src/delivery-slots/entities/delivery-settings.entity.spec.ts
git commit -m "feat(delivery-slots): add DeliverySettings entity"
```

---

### Task 5: DeliveryDestination entity

**Files:**
- Create: `server/src/orders/entities/delivery-destination.entity.ts`
- Test: same file pattern (`.spec.ts`)

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/orders/entities/delivery-destination.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { DeliveryDestination } from './delivery-destination.entity';

describe('DeliveryDestination entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliveryDestination)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'batchOrderId',
      'addressId',
      'label',
      'sortOrder',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-destination.entity.spec --no-coverage`

- [ ] **Step 3: Implement entity**

```typescript
// server/src/orders/entities/delivery-destination.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Address } from '../../addresses/entities/address.entity';

@Entity('delivery_destinations')
@Index('idx_destination_batch', ['batchOrderId'])
export class DeliveryDestination {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_order_id', type: 'int' })
  batchOrderId: number;

  @Column({ name: 'address_id', type: 'int' })
  addressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-destination.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/entities/delivery-destination.entity.ts server/src/orders/entities/delivery-destination.entity.spec.ts
git commit -m "feat(orders): add DeliveryDestination entity"
```

---

### Task 6: Extend BatchOrder entity

**Files:**
- Modify: `server/src/orders/entities/batch-order.entity.ts`
- Test: `server/src/orders/entities/batch-order.entity.spec.ts` (new)

- [ ] **Step 1: Write failing test**

```typescript
// server/src/orders/entities/batch-order.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { BatchOrder } from './batch-order.entity';

describe('BatchOrder entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(BatchOrder)
    .map((c) => c.propertyName);

  it('has new delivery columns', () => {
    for (const name of [
      'deliveryType',
      'slotBookingId',
      'priorityFee',
      'extraDestinationFee',
      'externalDeliveryStatus',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest batch-order.entity.spec --no-coverage`

- [ ] **Step 3: Add new columns**

Add to `server/src/orders/entities/batch-order.entity.ts` (after the existing `deliveryAddress` field, before `orders`):

```typescript
  @Column({
    name: 'delivery_type',
    type: 'varchar',
    length: 20,
    default: 'local',
  })
  deliveryType: 'local' | 'external';

  @Column({ name: 'slot_booking_id', type: 'int', nullable: true })
  slotBookingId: number | null;

  @Column({
    name: 'priority_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  priorityFee: number;

  @Column({
    name: 'extra_destination_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  extraDestinationFee: number;

  @Column({
    name: 'external_delivery_status',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  externalDeliveryStatus: 'pending_admin' | 'booked' | 'delivered' | null;
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest batch-order.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/entities/batch-order.entity.ts server/src/orders/entities/batch-order.entity.spec.ts
git commit -m "feat(orders): extend BatchOrder with delivery type, slot, fees"
```

---

### Task 7: Add `destinationId` to Order entity

**Files:**
- Modify: `server/src/orders/entities/order.entity.ts`

- [ ] **Step 1: Write failing test**

Append to `server/src/orders/entities/batch-order.entity.spec.ts`:

```typescript
import { Order } from './order.entity';

describe('Order entity multi-destination', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(Order)
    .map((c) => c.propertyName);

  it('has destinationId column', () => {
    expect(cols).toContain('destinationId');
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest batch-order.entity.spec --no-coverage`

- [ ] **Step 3: Add column**

Insert into `server/src/orders/entities/order.entity.ts` (next to `batchOrderId`):

```typescript
  @Column({ name: 'destination_id', type: 'int', nullable: true })
  destinationId: number | null;
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest batch-order.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/entities/order.entity.ts server/src/orders/entities/batch-order.entity.spec.ts
git commit -m "feat(orders): add destinationId FK to Order"
```

---

### Task 8: DeliverySettingsService

**Files:**
- Create: `server/src/delivery-slots/delivery-settings.service.ts`
- Test: `server/src/delivery-slots/delivery-settings.service.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/delivery-slots/delivery-settings.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { DeliverySettingsService } from './delivery-settings.service';
import { GeoRadiusService } from './geo-radius.service';

describe('DeliverySettingsService', () => {
  let svc: DeliverySettingsService;
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        DeliverySettingsService,
        GeoRadiusService,
        { provide: getRepositoryToken(DeliverySettings), useValue: repo },
      ],
    }).compile();
    svc = mod.get(DeliverySettingsService);
  });

  it('returns existing settings row', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      serviceCenterLat: 7.07,
      serviceCenterLng: 125.61,
      serviceRadiusKm: 25,
      priorityFeeAmount: 50,
      extraDestinationSurcharge: 30,
    });
    const out = await svc.getSettings();
    expect(out.serviceRadiusKm).toBe(25);
  });

  it('isInsideServiceArea uses live settings', async () => {
    repo.findOne.mockResolvedValue({
      serviceCenterLat: 7.07,
      serviceCenterLng: 125.61,
      serviceRadiusKm: 25,
    });
    expect(await svc.isInsideServiceArea(7.07, 125.61)).toBe(true);
    expect(await svc.isInsideServiceArea(8.5, 125.6)).toBe(false);
    expect(await svc.isInsideServiceArea(null, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-settings.service.spec --no-coverage`

- [ ] **Step 3: Implement service**

```typescript
// server/src/delivery-slots/delivery-settings.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { GeoRadiusService } from './geo-radius.service';

@Injectable()
export class DeliverySettingsService {
  constructor(
    @InjectRepository(DeliverySettings)
    private readonly repo: Repository<DeliverySettings>,
    private readonly geo: GeoRadiusService,
  ) {}

  async getSettings(): Promise<DeliverySettings> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.repo.save(
      this.repo.create({
        id: 1,
        serviceCenterLat: 7.0731,
        serviceCenterLng: 125.6128,
        serviceRadiusKm: 25,
        priorityFeeAmount: 50,
        extraDestinationSurcharge: 30,
      }),
    );
  }

  async updateSettings(
    patch: Partial<DeliverySettings>,
  ): Promise<DeliverySettings> {
    const current = await this.getSettings();
    Object.assign(current, patch);
    return this.repo.save(current);
  }

  async isInsideServiceArea(
    lat: number | null,
    lng: number | null,
  ): Promise<boolean> {
    const s = await this.getSettings();
    return this.geo.isInsideRadius(
      lat,
      lng,
      { lat: Number(s.serviceCenterLat), lng: Number(s.serviceCenterLng) },
      Number(s.serviceRadiusKm),
    );
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-settings.service.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-settings.service.ts server/src/delivery-slots/delivery-settings.service.spec.ts
git commit -m "feat(delivery-slots): add DeliverySettingsService"
```

---

### Task 9: Exceptions

**Files:**
- Create: `server/src/delivery-slots/exceptions.ts`

- [ ] **Step 1: Write the file (no test — pure type definitions)**

```typescript
// server/src/delivery-slots/exceptions.ts
import { ConflictException, BadRequestException } from '@nestjs/common';

export class SlotFullException extends ConflictException {
  constructor() {
    super({ message: 'Slot is full', code: 'slot_full' });
  }
}

export class CancellationClosedException extends ConflictException {
  constructor() {
    super({
      message: 'Slot is in progress, cancellation closed',
      code: 'cancellation_closed',
    });
  }
}

export class ServiceAreaMismatchException extends BadRequestException {
  constructor() {
    super({
      message: 'Address is outside service area',
      code: 'service_area_mismatch',
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/delivery-slots/exceptions.ts
git commit -m "feat(delivery-slots): add domain exceptions"
```

---

### Task 10: DeliverySlotsService — getAvailability

**Files:**
- Create: `server/src/delivery-slots/delivery-slots.service.ts`
- Test: `server/src/delivery-slots/delivery-slots.service.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/delivery-slots/delivery-slots.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';

describe('DeliverySlotsService', () => {
  let svc: DeliverySlotsService;
  const templateRepo = { find: jest.fn() };
  const bookingRepo = {
    createQueryBuilder: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        DeliverySlotsService,
        {
          provide: getRepositoryToken(DeliverySlotTemplate),
          useValue: templateRepo,
        },
        {
          provide: getRepositoryToken(DeliverySlotBooking),
          useValue: bookingRepo,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    svc = mod.get(DeliverySlotsService);
  });

  describe('getAvailability', () => {
    it('returns template list with booked counts and isFull flags', async () => {
      // 2026-04-30 is a Thursday => dayOfWeek = 4
      templateRepo.find.mockResolvedValue([
        {
          id: 1,
          dayOfWeek: 4,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
        },
        {
          id: 2,
          dayOfWeek: 4,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
        },
      ]);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ slotTemplateId: '1', count: '8' }]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await svc.getAvailability('2026-04-30');

      expect(result).toEqual([
        {
          templateId: 1,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
          bookedCount: 8,
          isFull: false,
        },
        {
          templateId: 2,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
      ]);
    });
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 3: Implement service skeleton + getAvailability**

```typescript
// server/src/delivery-slots/delivery-slots.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';

export interface SlotAvailability {
  templateId: number;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  isFull: boolean;
}

@Injectable()
export class DeliverySlotsService {
  constructor(
    @InjectRepository(DeliverySlotTemplate)
    private readonly templateRepo: Repository<DeliverySlotTemplate>,
    @InjectRepository(DeliverySlotBooking)
    private readonly bookingRepo: Repository<DeliverySlotBooking>,
    private readonly dataSource: DataSource,
  ) {}

  async getAvailability(date: string): Promise<SlotAvailability[]> {
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
    const templates = await this.templateRepo.find({
      where: { dayOfWeek, isActive: true },
      order: { startTime: 'ASC' },
    });

    const counts = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
      .innerJoin(
        'orders',
        'o',
        'o.batch_order_id = bo.id AND o.order_status NOT IN (:...excluded)',
        { excluded: ['cancelled', 'file_declined'] },
      )
      .where('b.date = :date', { date })
      .select('b.slot_template_id', 'slotTemplateId')
      .addSelect('COUNT(DISTINCT b.id)', 'count')
      .groupBy('b.slot_template_id')
      .getRawMany<{ slotTemplateId: string; count: string }>();

    const countMap = new Map(
      counts.map((c) => [Number(c.slotTemplateId), Number(c.count)]),
    );

    return templates.map((t) => {
      const bookedCount = countMap.get(t.id) ?? 0;
      return {
        templateId: t.id,
        startTime: t.startTime,
        endTime: t.endTime,
        capacity: t.capacity,
        bookedCount,
        isFull: bookedCount >= t.capacity,
      };
    });
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.service.ts server/src/delivery-slots/delivery-slots.service.spec.ts
git commit -m "feat(delivery-slots): add getAvailability with active-booking count"
```

---

### Task 11: DeliverySlotsService — bookSlot with FOR UPDATE

**Files:**
- Modify: `server/src/delivery-slots/delivery-slots.service.ts`
- Modify: `server/src/delivery-slots/delivery-slots.service.spec.ts`

- [ ] **Step 1: Add failing test**

Append to `delivery-slots.service.spec.ts`:

```typescript
  describe('bookSlot', () => {
    it('throws SlotFullException when capacity reached', async () => {
      const txManager = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          dayOfWeek: 4,
          capacity: 10,
        }),
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(10),
        })),
      };
      await expect(
        svc.bookSlot(txManager as any, {
          slotTemplateId: 1,
          date: '2026-04-30',
          batchOrderId: 99,
          priority: false,
        }),
      ).rejects.toThrow('Slot is full');
    });

    it('inserts a booking when capacity not reached', async () => {
      const inserted = {
        id: 7,
        slotTemplateId: 1,
        date: '2026-04-30',
        batchOrderId: 99,
        priority: false,
      };
      const txManager = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          dayOfWeek: 4,
          capacity: 10,
        }),
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(8),
        })),
        create: jest.fn().mockReturnValue(inserted),
        save: jest.fn().mockResolvedValue(inserted),
      };

      const result = await svc.bookSlot(txManager as any, {
        slotTemplateId: 1,
        date: '2026-04-30',
        batchOrderId: 99,
        priority: false,
      });

      expect(result).toEqual(inserted);
      expect(txManager.create).toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 3: Add bookSlot to service**

Append to `delivery-slots.service.ts`:

```typescript
import { EntityManager } from 'typeorm';
import { SlotFullException } from './exceptions';

export interface BookSlotInput {
  slotTemplateId: number;
  date: string;
  batchOrderId: number;
  priority: boolean;
}

// inside class DeliverySlotsService:
  async bookSlot(
    manager: EntityManager,
    input: BookSlotInput,
  ): Promise<DeliverySlotBooking> {
    const template = await manager.findOne(DeliverySlotTemplate, {
      where: { id: input.slotTemplateId, isActive: true },
    });
    if (!template) throw new SlotFullException();

    const count = await manager
      .createQueryBuilder(DeliverySlotBooking, 'b')
      .innerJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
      .innerJoin(
        'orders',
        'o',
        'o.batch_order_id = bo.id AND o.order_status NOT IN (:...excluded)',
        { excluded: ['cancelled', 'file_declined'] },
      )
      .where('b.slot_template_id = :tid', { tid: input.slotTemplateId })
      .andWhere('b.date = :date', { date: input.date })
      .setLock('pessimistic_write')
      .getCount();

    if (count >= template.capacity) throw new SlotFullException();

    const booking = manager.create(DeliverySlotBooking, {
      slotTemplateId: input.slotTemplateId,
      date: input.date,
      batchOrderId: input.batchOrderId,
      priority: input.priority,
    });
    return manager.save(booking);
  }
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.service.ts server/src/delivery-slots/delivery-slots.service.spec.ts
git commit -m "feat(delivery-slots): bookSlot with FOR UPDATE concurrency guard"
```

---

### Task 12: DeliverySlotsService — releaseSlot with cutoff

**Files:**
- Modify: `server/src/delivery-slots/delivery-slots.service.ts`
- Modify: `server/src/delivery-slots/delivery-slots.service.spec.ts`

- [ ] **Step 1: Add failing test**

```typescript
  describe('releaseSlot', () => {
    it('throws CancellationClosedException past cutoff', async () => {
      const past = '2020-01-01';
      const tx = {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          slotTemplateId: 1,
          date: past,
          slotTemplate: { startTime: '09:30:00' },
        }),
      };
      await expect(svc.releaseSlot(tx as any, 7)).rejects.toThrow(
        'cancellation_closed',
      );
    });

    it('removes booking before cutoff', async () => {
      const future = new Date(Date.now() + 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const tx = {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          slotTemplateId: 1,
          date: future,
          slotTemplate: { startTime: '09:30:00' },
        }),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      await svc.releaseSlot(tx as any, 7);
      expect(tx.remove).toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 3: Implement releaseSlot**

Append to `delivery-slots.service.ts`:

```typescript
import { CancellationClosedException } from './exceptions';

// inside class DeliverySlotsService:
  async releaseSlot(
    manager: EntityManager,
    bookingId: number,
  ): Promise<void> {
    const booking = await manager.findOne(DeliverySlotBooking, {
      where: { id: bookingId },
      relations: ['slotTemplate'],
    });
    if (!booking) return;
    const slotStart = new Date(`${booking.date}T${booking.slotTemplate.startTime}`);
    if (Date.now() >= slotStart.getTime()) {
      throw new CancellationClosedException();
    }
    await manager.remove(booking);
  }
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.service.ts server/src/delivery-slots/delivery-slots.service.spec.ts
git commit -m "feat(delivery-slots): releaseSlot with hard-cutoff guard"
```

---

### Task 13: DTOs

**Files:**
- Create: `server/src/delivery-slots/dto/update-slot-template.dto.ts`
- Create: `server/src/delivery-slots/dto/update-delivery-settings.dto.ts`

- [ ] **Step 1: Write update-slot-template.dto.ts**

```typescript
// server/src/delivery-slots/dto/update-slot-template.dto.ts
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateSlotTemplateDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 2: Write update-delivery-settings.dto.ts**

```typescript
// server/src/delivery-slots/dto/update-delivery-settings.dto.ts
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateDeliverySettingsDto {
  @IsOptional()
  @IsNumber()
  serviceCenterLat?: number;

  @IsOptional()
  @IsNumber()
  serviceCenterLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priorityFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraDestinationSurcharge?: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/delivery-slots/dto/
git commit -m "feat(delivery-slots): add admin-update DTOs"
```

---

### Task 14: DeliverySlotsController (customer)

**Files:**
- Create: `server/src/delivery-slots/delivery-slots.controller.ts`
- Test: `server/src/delivery-slots/delivery-slots.controller.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/delivery-slots/delivery-slots.controller.spec.ts
import { Test } from '@nestjs/testing';
import { DeliverySlotsController } from './delivery-slots.controller';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';

describe('DeliverySlotsController', () => {
  let controller: DeliverySlotsController;
  const slotsService = { getAvailability: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [DeliverySlotsController],
      providers: [
        { provide: DeliverySlotsService, useValue: slotsService },
        { provide: DeliverySettingsService, useValue: {} },
      ],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = mod.get(DeliverySlotsController);
  });

  it('GET /delivery-slots returns availability for date', async () => {
    slotsService.getAvailability.mockResolvedValue([{ templateId: 1 }]);
    const out = await controller.list('2026-04-30');
    expect(slotsService.getAvailability).toHaveBeenCalledWith('2026-04-30');
    expect(out).toEqual([{ templateId: 1 }]);
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slots.controller.spec --no-coverage`

- [ ] **Step 3: Implement controller**

```typescript
// server/src/delivery-slots/delivery-slots.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliverySlotsService } from './delivery-slots.service';

@Controller('delivery-slots')
@UseGuards(JwtAuthGuard)
export class DeliverySlotsController {
  constructor(private readonly slotsService: DeliverySlotsService) {}

  @Get()
  async list(@Query('date') date: string) {
    return this.slotsService.getAvailability(date);
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots.controller.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.controller.ts server/src/delivery-slots/delivery-slots.controller.spec.ts
git commit -m "feat(delivery-slots): add customer GET /delivery-slots"
```

---

### Task 15: Admin endpoints in same controller

**Files:**
- Modify: `server/src/delivery-slots/delivery-slots.controller.ts`
- Modify: `server/src/delivery-slots/delivery-slots.controller.spec.ts`

- [ ] **Step 1: Add failing tests**

```typescript
  describe('admin endpoints', () => {
    const tplRepo = { find: jest.fn(), save: jest.fn(), create: jest.fn() };
    const bookingRepo = {};
    const settingsService = {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
    };
    let adminController: DeliverySlotsController;

    beforeEach(async () => {
      jest.clearAllMocks();
      const mod = await Test.createTestingModule({
        controllers: [DeliverySlotsController],
        providers: [
          { provide: DeliverySlotsService, useValue: slotsService },
          { provide: DeliverySettingsService, useValue: settingsService },
          {
            provide: require('@nestjs/typeorm').getRepositoryToken(
              require('./entities/delivery-slot-template.entity').DeliverySlotTemplate,
            ),
            useValue: tplRepo,
          },
        ],
      })
        .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(require('../auth/guards/roles.guard').RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();
      adminController = mod.get(DeliverySlotsController);
    });

    it('GET /admin/delivery-slot-templates returns full list', async () => {
      tplRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const out = await adminController.adminListTemplates();
      expect(out).toHaveLength(2);
    });

    it('GET /admin/settings/delivery returns settings', async () => {
      settingsService.getSettings.mockResolvedValue({ id: 1 });
      const out = await adminController.adminGetSettings();
      expect(out).toEqual({ id: 1 });
    });
  });
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slots.controller.spec --no-coverage`

- [ ] **Step 3: Implement admin endpoints**

Replace `server/src/delivery-slots/delivery-slots.controller.ts` with:

```typescript
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Query,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { UpdateSlotTemplateDto } from './dto/update-slot-template.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DeliverySlotsController {
  constructor(
    private readonly slotsService: DeliverySlotsService,
    private readonly settingsService: DeliverySettingsService,
    @InjectRepository(DeliverySlotTemplate)
    private readonly templateRepo: Repository<DeliverySlotTemplate>,
  ) {}

  @Get('delivery-slots')
  async list(@Query('date') date: string) {
    return this.slotsService.getAvailability(date);
  }

  @Get('admin/delivery-slot-templates')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminListTemplates() {
    return this.templateRepo.find({
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  @Post('admin/delivery-slot-templates')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminCreateTemplate(@Body() dto: UpdateSlotTemplateDto) {
    return this.templateRepo.save(this.templateRepo.create(dto));
  }

  @Patch('admin/delivery-slot-templates/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminUpdateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotTemplateDto,
  ) {
    await this.templateRepo.update(id, dto);
    return this.templateRepo.findOneOrFail({ where: { id } });
  }

  @Delete('admin/delivery-slot-templates/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminDeleteTemplate(@Param('id', ParseIntPipe) id: number) {
    await this.templateRepo.delete(id);
    return { ok: true };
  }

  @Get('admin/settings/delivery')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminGetSettings() {
    return this.settingsService.getSettings();
  }

  @Patch('admin/settings/delivery')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminUpdateSettings(@Body() dto: UpdateDeliverySettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots.controller.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.controller.ts server/src/delivery-slots/delivery-slots.controller.spec.ts
git commit -m "feat(delivery-slots): admin endpoints for templates + settings"
```

---

### Task 16: DeliverySlots WebSocket gateway

**Files:**
- Create: `server/src/delivery-slots/delivery-slots.gateway.ts`
- Test: `server/src/delivery-slots/delivery-slots.gateway.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/delivery-slots/delivery-slots.gateway.spec.ts
import { DeliverySlotsGateway } from './delivery-slots.gateway';
import { JwtService } from '@nestjs/jwt';

describe('DeliverySlotsGateway', () => {
  it('broadcasts slot-updated to date room', () => {
    const gateway = new DeliverySlotsGateway({} as JwtService);
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as any;

    gateway.notifySlotUpdated({
      templateId: 1,
      date: '2026-04-30',
      bookedCount: 9,
    });

    expect(gateway.server.to).toHaveBeenCalledWith('slots:2026-04-30');
    expect(emit).toHaveBeenCalledWith('slot-updated', {
      templateId: 1,
      date: '2026-04-30',
      bookedCount: 9,
    });
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest delivery-slots.gateway.spec --no-coverage`

- [ ] **Step 3: Implement gateway**

```typescript
// server/src/delivery-slots/delivery-slots.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: '/ws/delivery-slots', cors: { origin: '*' } })
export class DeliverySlotsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) return client.disconnect();
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe-slots')
  handleSubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`slots:${data.date}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe-slots')
  handleUnsubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.leave(`slots:${data.date}`);
  }

  notifySlotUpdated(payload: {
    templateId: number;
    date: string;
    bookedCount: number;
  }) {
    this.server.to(`slots:${payload.date}`).emit('slot-updated', payload);
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots.gateway.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.gateway.ts server/src/delivery-slots/delivery-slots.gateway.spec.ts
git commit -m "feat(delivery-slots): WebSocket gateway with date-based rooms"
```

---

### Task 17: DeliverySlotsModule + AppModule wiring

**Files:**
- Create: `server/src/delivery-slots/delivery-slots.module.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: Create module**

```typescript
// server/src/delivery-slots/delivery-slots.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { GeoRadiusService } from './geo-radius.service';
import { DeliverySlotsController } from './delivery-slots.controller';
import { DeliverySlotsGateway } from './delivery-slots.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliverySlotTemplate,
      DeliverySlotBooking,
      DeliverySettings,
    ]),
    JwtModule.register({}),
  ],
  controllers: [DeliverySlotsController],
  providers: [
    DeliverySlotsService,
    DeliverySettingsService,
    GeoRadiusService,
    DeliverySlotsGateway,
  ],
  exports: [
    DeliverySlotsService,
    DeliverySettingsService,
    DeliverySlotsGateway,
    TypeOrmModule,
  ],
})
export class DeliverySlotsModule {}
```

- [ ] **Step 2: Register in AppModule**

In `server/src/app.module.ts`, add to the `imports` array:

```typescript
import { DeliverySlotsModule } from './delivery-slots/delivery-slots.module';
// ...
imports: [
  // ...existing modules...
  DeliverySlotsModule,
],
```

- [ ] **Step 3: Verify build**

Run: `cd server && npx tsc --noEmit`
Expected: no errors involving `delivery-slots`.

- [ ] **Step 4: Commit**

```bash
git add server/src/delivery-slots/delivery-slots.module.ts server/src/app.module.ts
git commit -m "feat(delivery-slots): wire module into AppModule"
```

---

### Task 18: Extend `CreateBatchOrderDto`

**Files:**
- Modify: `server/src/orders/dto/create-order.dto.ts`
- Modify: `server/src/orders/dto/create-order.dto.spec.ts`

- [ ] **Step 1: Add failing test**

Append to `server/src/orders/dto/create-order.dto.spec.ts`:

```typescript
import { CreateBatchOrderDto } from './create-order.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('CreateBatchOrderDto extended fields', () => {
  it('accepts slot fields and destinations[]', async () => {
    const dto = plainToInstance(CreateBatchOrderDto, {
      items: [
        {
          category: 'paper',
          fileMetadataId: 1,
          quantity: 1,
          paperSpecs: {
            paperSize: 'a4',
            colorMode: 'blackAndWhite',
            mediaType: 'glossy',
            printSides: 'frontOnly',
            binding: 'none',
          },
          destinationIndex: 0,
        },
      ],
      paymentMethod: 'cash',
      deliveryOption: 'delivery',
      slotTemplateId: 1,
      slotDate: '2026-04-30',
      priority: true,
      destinations: [
        { addressId: 5, label: 'Office' },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest orders/dto/create-order.dto.spec --no-coverage`

- [ ] **Step 3: Update DTO**

In `server/src/orders/dto/create-order.dto.ts`, add inside the existing `CreateBatchOrderDto`:

```typescript
import {
  // existing imports...
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBatchDestinationDto {
  @IsInt()
  @IsPositive()
  addressId: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

// existing CreateBatchOrderItemDto: add optional destinationIndex
@IsOptional()
@IsInt()
@Min(0)
destinationIndex?: number;

// existing CreateBatchOrderDto: add new fields
@IsOptional()
@IsInt()
@IsPositive()
slotTemplateId?: number;

@IsOptional()
@IsString()
@Matches(/^\d{4}-\d{2}-\d{2}$/)
slotDate?: string;

@IsOptional()
@IsBoolean()
priority?: boolean;

@IsOptional()
@IsArray()
@ValidateNested({ each: true })
@Type(() => CreateBatchDestinationDto)
destinations?: CreateBatchDestinationDto[];
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest orders/dto/create-order.dto.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/dto/create-order.dto.ts server/src/orders/dto/create-order.dto.spec.ts
git commit -m "feat(orders): extend CreateBatchOrderDto with slot+destinations+priority"
```

---

### Task 19: OrdersService.createBatch — slot booking + destinations

**Files:**
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```typescript
  // append to orders.service.spec.ts
  describe('createBatch with slot + destinations', () => {
    it('marks deliveryType=external when any destination is out of radius', async () => {
      // mock settingsService.isInsideServiceArea: first dest in, second out
      settingsService.isInsideServiceArea
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      // ... arrange minimal valid dto with two destinations
      // assert resulting batch.deliveryType === 'external' and slotBookingId === null
    });

    it('books a slot when all destinations are inside radius', async () => {
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      slotsService.bookSlot.mockResolvedValue({ id: 99 });
      // ... arrange
      // assert resulting batch.slotBookingId === 99, deliveryType === 'local'
    });

    it('computes priorityFee + extraDestinationFee correctly', async () => {
      settingsService.getSettings.mockResolvedValue({
        priorityFeeAmount: 50,
        extraDestinationSurcharge: 30,
      });
      // 3 destinations, priority=true → extraDestinationFee = 60, priorityFee = 50
    });
  });
```

(Note: implementer fills in the arrange blocks based on existing createBatch test patterns in the same file.)

- [ ] **Step 2: Run, confirm fail**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 3: Update OrdersService.createBatch**

The change: inside the existing `createBatch` transaction, after the BatchOrder is saved:

```typescript
// Pseudocode of the changes (implementer applies inside existing transaction):

const settings = await this.settingsService.getSettings();

// 1. Determine deliveryType server-side from destination coordinates
const destinations = dto.destinations ?? [];
let allInside = true;
for (const d of destinations) {
  const addr = await txAddressRepo.findOneOrFail({ where: { id: d.addressId } });
  const inside = await this.settingsService.isInsideServiceArea(
    addr.lat ? Number(addr.lat) : null,
    addr.lng ? Number(addr.lng) : null,
  );
  if (!inside) { allInside = false; break; }
}
const deliveryType: 'local' | 'external' = allInside ? 'local' : 'external';

// 2. Compute fees
const priorityFee = dto.priority ? Number(settings.priorityFeeAmount) : 0;
const extraDestCount = Math.max(0, destinations.length - 1);
const extraDestinationFee = extraDestCount * Number(settings.extraDestinationSurcharge);

// 3. Save batch with new fields
batch.deliveryType = deliveryType;
batch.priorityFee = priorityFee;
batch.extraDestinationFee = extraDestinationFee;
batch.totalPrice = Number(batch.subtotal) + Number(batch.deliveryFee) + priorityFee + extraDestinationFee;
batch.externalDeliveryStatus = deliveryType === 'external' ? 'pending_admin' : null;
await txBatchRepo.save(batch);

// 4. Insert DeliveryDestination rows
const savedDestinations: DeliveryDestination[] = [];
for (const [i, d] of destinations.entries()) {
  const dest = txDestRepo.create({
    batchOrderId: batch.id,
    addressId: d.addressId,
    label: d.label ?? null,
    sortOrder: i,
  });
  savedDestinations.push(await txDestRepo.save(dest));
}

// 5. Book slot if local
if (deliveryType === 'local' && dto.slotTemplateId && dto.slotDate) {
  const booking = await this.slotsService.bookSlot(manager, {
    slotTemplateId: dto.slotTemplateId,
    date: dto.slotDate,
    batchOrderId: batch.id,
    priority: !!dto.priority,
  });
  batch.slotBookingId = booking.id;
  await txBatchRepo.save(batch);
}

// 6. Wire each Order to its destination
for (const item of dto.items) {
  const idx = item.destinationIndex ?? 0;
  const destId = savedDestinations[idx]?.id ?? null;
  // when creating each order: order.destinationId = destId
}

// 7. After transaction commits, emit slot-updated WS event if local
if (deliveryType === 'local') {
  const counts = await this.slotsService.getAvailability(dto.slotDate!);
  const updated = counts.find((c) => c.templateId === dto.slotTemplateId);
  if (updated) {
    this.slotsGateway.notifySlotUpdated({
      templateId: updated.templateId,
      date: dto.slotDate!,
      bookedCount: updated.bookedCount,
    });
  }
}
```

OrdersService constructor must inject `DeliverySlotsService`, `DeliverySettingsService`, `DeliverySlotsGateway`, and `Repository<DeliveryDestination>`. OrdersModule must import `DeliverySlotsModule` and register `DeliveryDestination`.

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/orders.service.ts server/src/orders/orders.service.spec.ts server/src/orders/orders.module.ts
git commit -m "feat(orders): createBatch books slot + writes destinations + computes fees"
```

---

### Task 20: PATCH /orders/batch/:id/cancel

**Files:**
- Modify: `server/src/orders/orders.controller.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Add failing test**

```typescript
  describe('cancelBatch', () => {
    it('releases slot and marks batch cancelled before cutoff', async () => {
      slotsService.releaseSlot.mockResolvedValue(undefined);
      // arrange: a batch with slotBookingId=7, future slot date
      // act: await ordersService.cancelBatch(batchId, userId)
      // assert: slotsService.releaseSlot called with 7; batch.paymentStatus or order statuses updated
    });

    it('rejects cancellation past cutoff', async () => {
      slotsService.releaseSlot.mockRejectedValue(
        new (require('../delivery-slots/exceptions').CancellationClosedException)(),
      );
      await expect(ordersService.cancelBatch(1, 1)).rejects.toThrow(
        'cancellation_closed',
      );
    });
  });
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 3: Implement cancelBatch in OrdersService**

Append to `OrdersService`:

```typescript
async cancelBatch(batchOrderId: number, userId: number): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    const batch = await manager.findOneOrFail(BatchOrder, {
      where: { id: batchOrderId, userId },
    });
    if (batch.slotBookingId) {
      await this.slotsService.releaseSlot(manager, batch.slotBookingId);
      batch.slotBookingId = null;
      await manager.save(batch);
    }
    await manager.update(
      Order,
      { batchOrderId: batch.id },
      { orderStatus: 'cancelled' },
    );
  });
  // Emit WS update if it was a local batch (after txn)
}
```

Add to `OrdersController`:

```typescript
@Patch('batch/:id/cancel')
@UseGuards(JwtAuthGuard)
async cancelBatch(
  @Param('id', ParseIntPipe) id: number,
  @Request() req: { user: { sub: number } },
) {
  await this.ordersService.cancelBatch(id, req.user.sub);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest orders --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/orders.controller.ts server/src/orders/orders.service.ts server/src/orders/orders.service.spec.ts
git commit -m "feat(orders): PATCH /orders/batch/:id/cancel releases slot before cutoff"
```

---

### Task 21: Today's bookings dashboard endpoint + reorder

**Files:**
- Modify: `server/src/delivery-slots/delivery-slots.controller.ts`
- Modify: `server/src/delivery-slots/delivery-slots.service.ts`
- Modify: `server/src/delivery-slots/delivery-slots.service.spec.ts`

- [ ] **Step 1: Add failing tests**

```typescript
  describe('admin today dashboard', () => {
    it('groups bookings by template and includes priority info', async () => {
      // mock: 3 templates today, 2 bookings on template 1
      // assert: result is { templates: [...], bookings: [...] } with priority and customer fields
    });

    it('reorder updates priorityRank atomically', async () => {
      // mock: 3 booking ids with input order [3,1,2]
      // assert: each updated with rank 1,2,3
    });
  });
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd server && npx jest delivery-slots.service.spec --no-coverage`

- [ ] **Step 3: Implement methods**

Append to `DeliverySlotsService`:

```typescript
async getTodaySnapshot(date: string) {
  const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
  const templates = await this.templateRepo.find({
    where: { dayOfWeek, isActive: true },
    order: { startTime: 'ASC' },
  });
  const bookings = await this.bookingRepo
    .createQueryBuilder('b')
    .leftJoinAndSelect('b.slotTemplate', 'tpl')
    .leftJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
    .leftJoin('users', 'u', 'u.id = bo.user_id')
    .where('b.date = :date', { date })
    .addSelect(['bo.id', 'bo.batch_ref'])
    .addSelect(['u.full_name', 'u.email'])
    .orderBy('b.priority_rank', 'ASC', 'NULLS LAST')
    .addOrderBy('b.booked_at', 'ASC')
    .getRawAndEntities();

  return { templates, bookings: bookings.entities, raw: bookings.raw };
}

async reorderBookings(orderedIds: number[]) {
  await this.dataSource.transaction(async (m) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await m.update(DeliverySlotBooking, orderedIds[i], { priorityRank: i + 1 });
    }
  });
}
```

Add to controller:

```typescript
@Get('admin/delivery-slots/today')
@UseGuards(RolesGuard)
@Roles('admin')
async adminTodayDashboard(@Query('date') date?: string) {
  const today = date ?? new Date().toISOString().slice(0, 10);
  return this.slotsService.getTodaySnapshot(today);
}

@Patch('admin/slot-bookings/order')
@UseGuards(RolesGuard)
@Roles('admin')
async adminReorderBookings(@Body() body: { orderedIds: number[] }) {
  await this.slotsService.reorderBookings(body.orderedIds);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest delivery-slots --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/delivery-slots/
git commit -m "feat(delivery-slots): admin today dashboard + booking reorder"
```

---

### Task 22: External-deliveries admin endpoints

**Files:**
- Modify: `server/src/orders/orders.controller.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Add failing test**

```typescript
  describe('listExternalDeliveries', () => {
    it('filters by externalDeliveryStatus', async () => {
      batchRepo.find.mockResolvedValue([{ id: 1, deliveryType: 'external' }]);
      const out = await ordersService.listExternalDeliveries('pending_admin');
      expect(batchRepo.find).toHaveBeenCalledWith({
        where: { deliveryType: 'external', externalDeliveryStatus: 'pending_admin' },
        order: { createdAt: 'DESC' },
        relations: ['user'],
      });
      expect(out).toEqual([{ id: 1, deliveryType: 'external' }]);
    });
  });

  describe('updateExternalDeliveryStatus', () => {
    it('updates the status', async () => {
      batchRepo.update.mockResolvedValue({ affected: 1 });
      await ordersService.updateExternalDeliveryStatus(1, 'booked');
      expect(batchRepo.update).toHaveBeenCalledWith(1, {
        externalDeliveryStatus: 'booked',
      });
    });
  });
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 3: Implement methods**

Append to OrdersService:

```typescript
async listExternalDeliveries(status?: string) {
  return this.batchRepo.find({
    where: {
      deliveryType: 'external',
      ...(status ? { externalDeliveryStatus: status as any } : {}),
    },
    order: { createdAt: 'DESC' },
    relations: ['user'],
  });
}

async updateExternalDeliveryStatus(
  id: number,
  status: 'pending_admin' | 'booked' | 'delivered',
): Promise<void> {
  await this.batchRepo.update(id, { externalDeliveryStatus: status });
}
```

Add to controller:

```typescript
@Get('admin/external-deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async adminListExternal(@Query('status') status?: string) {
  return this.ordersService.listExternalDeliveries(status);
}

@Patch('admin/external-deliveries/:id/status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async adminUpdateExternal(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: { status: 'pending_admin' | 'booked' | 'delivered' },
) {
  await this.ordersService.updateExternalDeliveryStatus(id, body.status);
  return { ok: true };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd server && npx jest orders --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add server/src/orders/
git commit -m "feat(orders): admin external-deliveries list + status update"
```

---

### Task 23: Seed delivery slot templates + settings

**Files:**
- Modify: `server/src/seed.ts`

- [ ] **Step 1: Add seed code**

In `seed.ts`, after the existing seeders, add:

```typescript
// Seed delivery slot templates (Mon–Fri default)
const slotTemplateRepo = dataSource.getRepository(
  require('./delivery-slots/entities/delivery-slot-template.entity').DeliverySlotTemplate,
);
const slotsExist = await slotTemplateRepo.count();
if (slotsExist === 0) {
  const slots: any[] = [];
  for (let day = 1; day <= 5; day++) {
    for (const [start, end] of [
      ['09:30:00', '11:30:00'],
      ['14:00:00', '16:00:00'],
      ['21:00:00', '23:00:00'],
    ]) {
      slots.push({ dayOfWeek: day, startTime: start, endTime: end, capacity: 10 });
    }
  }
  await slotTemplateRepo.save(slots);
  console.log('✅ 15 delivery slot templates seeded');
}

// Seed delivery settings (singleton row)
const settingsRepo = dataSource.getRepository(
  require('./delivery-slots/entities/delivery-settings.entity').DeliverySettings,
);
const settingsExist = await settingsRepo.findOne({ where: { id: 1 } });
if (!settingsExist) {
  await settingsRepo.save({
    id: 1,
    serviceCenterLat: 7.0731,
    serviceCenterLng: 125.6128,
    serviceRadiusKm: 25,
    priorityFeeAmount: 50,
    extraDestinationSurcharge: 30,
  });
  console.log('✅ Delivery settings seeded');
}
```

- [ ] **Step 2: Run seed**

```bash
docker exec server-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'grid_print' AND pid <> pg_backend_pid();"
docker exec server-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS grid_print;"
docker exec server-postgres-1 psql -U postgres -c "CREATE DATABASE grid_print;"
cd server && npm run seed
```

Expected: success, including the new slot template and settings lines.

- [ ] **Step 3: Commit**

```bash
git add server/src/seed.ts
git commit -m "feat(seed): seed delivery slot templates + settings"
```

---

## Phase B — Mobile (Tasks 24–34)

### Task 24: WebSocketService extensions

**Files:**
- Modify: `apps/mobile/lib/shared/services/websocket_service.dart`

- [ ] **Step 1: Add methods (no test — straight passthrough plumbing)**

Add new socket field, listener list, and methods following the existing chat pattern:

```dart
// inside WebSocketService class:
io.Socket? _slotsSocket;
final List<Function(Map<String, dynamic>)> _slotUpdatedListeners = [];

Future<bool> connectDeliverySlots() async {
  if (_slotsSocket?.connected == true) return true;
  if (_slotsSocket != null) {
    _slotsSocket!.connect();
    return true;
  }
  final token = await TokenStorage.getToken();
  _slotsSocket = io.io(
    '$_baseUrl/ws/delivery-slots',
    io.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': token ?? ''})
        .disableAutoConnect()
        .build(),
  );
  _slotsSocket!.on('slot-updated', (data) {
    try {
      final d = _normalize(data) as Map<String, dynamic>;
      for (final cb in List.of(_slotUpdatedListeners)) {
        try { cb(d); } catch (_) {}
      }
    } catch (_) {}
  });
  _slotsSocket!.connect();
  return true;
}

void subscribeSlots(String date) {
  _slotsSocket?.emit('subscribe-slots', {'date': date});
}

void unsubscribeSlots(String date) {
  _slotsSocket?.emit('unsubscribe-slots', {'date': date});
}

VoidCallback listenForSlotUpdates(Function(Map<String, dynamic>) cb) {
  _slotUpdatedListeners.add(cb);
  return () => _slotUpdatedListeners.remove(cb);
}

void disconnectDeliverySlots() {
  _slotsSocket?.disconnect();
  _slotsSocket = null;
  _slotUpdatedListeners.clear();
}
```

Also extend the existing `disconnect()` method to dispose `_slotsSocket` and clear `_slotUpdatedListeners`.

- [ ] **Step 2: Verify compilation**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/shared/services/websocket_service.dart`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/shared/services/websocket_service.dart
git commit -m "feat(mobile): websocket plumbing for /ws/delivery-slots"
```

---

### Task 25: Mobile domain models

**Files:**
- Create: `apps/mobile/lib/features/customer/order/models/delivery_slot.dart`
- Create: `apps/mobile/lib/features/customer/order/models/destination_group.dart`

- [ ] **Step 1: Write delivery_slot.dart**

```dart
class DeliverySlot {
  const DeliverySlot({
    required this.templateId,
    required this.startTime,
    required this.endTime,
    required this.capacity,
    required this.bookedCount,
  });

  final int templateId;
  final String startTime;
  final String endTime;
  final int capacity;
  final int bookedCount;

  bool get isFull => bookedCount >= capacity;

  factory DeliverySlot.fromJson(Map<String, dynamic> json) => DeliverySlot(
        templateId: json['templateId'] as int,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        capacity: json['capacity'] as int,
        bookedCount: json['bookedCount'] as int,
      );

  DeliverySlot copyWith({int? bookedCount}) => DeliverySlot(
        templateId: templateId,
        startTime: startTime,
        endTime: endTime,
        capacity: capacity,
        bookedCount: bookedCount ?? this.bookedCount,
      );
}
```

- [ ] **Step 2: Write destination_group.dart**

```dart
import 'package:printing_app/features/customer/cart/models/cart_item.dart';

class DestinationGroup {
  DestinationGroup({
    required this.id,
    required this.label,
    required this.itemIds,
    this.addressId,
  });

  final String id; // local UUID
  final String label;
  final List<String> itemIds; // CartItem.id list
  final int? addressId; // null until customer picks an address

  DestinationGroup copyWith({
    String? label,
    List<String>? itemIds,
    int? addressId,
  }) => DestinationGroup(
        id: id,
        label: label ?? this.label,
        itemIds: itemIds ?? this.itemIds,
        addressId: addressId ?? this.addressId,
      );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/features/customer/order/models/
git commit -m "feat(mobile): add DeliverySlot + DestinationGroup models"
```

---

### Task 26: DeliverySlotProvider

**Files:**
- Create: `apps/mobile/lib/features/customer/order/providers/delivery_slot_provider.dart`
- Test: `apps/mobile/test/features/customer/order/providers/delivery_slot_provider_test.dart`

- [ ] **Step 1: Write failing test**

```dart
@GenerateNiceMocks([MockSpec<Dio>(), MockSpec<WebSocketService>()])
import 'delivery_slot_provider_test.mocks.dart';

void main() {
  test('fetchSlots loads availability for the date', () async {
    final mockDio = MockDio();
    final mockWs = MockWebSocketService();
    when(mockDio.get<List<dynamic>>('/delivery-slots?date=2026-04-30')).thenAnswer(
      (_) async => Response(
        data: [
          {
            'templateId': 1,
            'startTime': '09:30:00',
            'endTime': '11:30:00',
            'capacity': 10,
            'bookedCount': 8,
          },
        ],
        statusCode: 200,
        requestOptions: RequestOptions(path: ''),
      ),
    );
    final container = ProviderContainer(overrides: [
      dioProvider.overrideWithValue(mockDio),
      webSocketServiceProvider.overrideWithValue(mockWs),
    ]);
    addTearDown(container.dispose);

    final notifier = container.read(deliverySlotProvider('2026-04-30').notifier);
    await notifier.refresh();

    final state = container.read(deliverySlotProvider('2026-04-30'));
    expect(state.slots, hasLength(1));
    expect(state.slots.first.bookedCount, 8);
  });

  test('applies live slot-updated event', () {
    // Arrange notifier with one slot at bookedCount=8
    // Act: call notifier.applyUpdate({templateId: 1, date: '2026-04-30', bookedCount: 9})
    // Assert: state.slots.first.bookedCount == 9
  });
}
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd apps/mobile && flutter pub run build_runner build --delete-conflicting-outputs && flutter test test/features/customer/order/providers/delivery_slot_provider_test.dart`

- [ ] **Step 3: Implement provider**

```dart
// apps/mobile/lib/features/customer/order/providers/delivery_slot_provider.dart
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

class DeliverySlotState {
  const DeliverySlotState({
    this.slots = const [],
    this.isLoading = false,
    this.error,
  });

  final List<DeliverySlot> slots;
  final bool isLoading;
  final String? error;

  DeliverySlotState copyWith({
    List<DeliverySlot>? slots,
    bool? isLoading,
    String? error,
  }) =>
      DeliverySlotState(
        slots: slots ?? this.slots,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

final webSocketServiceProvider =
    Provider<WebSocketService>((_) => WebSocketService.instance);

class DeliverySlotNotifier extends StateNotifier<DeliverySlotState> {
  DeliverySlotNotifier(this._date, this._dio, this._ws)
      : super(const DeliverySlotState());

  final String _date;
  final Dio _dio;
  final WebSocketService _ws;
  VoidCallback? _removeListener;

  Future<void> initialize() async {
    await refresh();
    await _ws.connectDeliverySlots();
    _ws.subscribeSlots(_date);
    _removeListener = _ws.listenForSlotUpdates(_handleUpdate);
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    try {
      final res =
          await _dio.get<List<dynamic>>('/delivery-slots?date=$_date');
      final slots = (res.data ?? [])
          .map((e) => DeliverySlot.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(slots: slots, isLoading: false, error: null);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void applyUpdate(Map<String, dynamic> payload) {
    if (payload['date'] != _date) return;
    final templateId = payload['templateId'] as int;
    final newCount = payload['bookedCount'] as int;
    state = state.copyWith(
      slots: state.slots
          .map((s) =>
              s.templateId == templateId ? s.copyWith(bookedCount: newCount) : s)
          .toList(),
    );
  }

  void _handleUpdate(Map<String, dynamic> payload) => applyUpdate(payload);

  @override
  void dispose() {
    _removeListener?.call();
    _ws.unsubscribeSlots(_date);
    super.dispose();
  }
}

final deliverySlotProvider = StateNotifierProvider.family
    .autoDispose<DeliverySlotNotifier, DeliverySlotState, String>(
  (ref, date) => DeliverySlotNotifier(
    date,
    ref.read(dioProvider),
    ref.read(webSocketServiceProvider),
  ),
);
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd apps/mobile && flutter test test/features/customer/order/providers/delivery_slot_provider_test.dart`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/providers/delivery_slot_provider.dart apps/mobile/test/features/customer/order/providers/
git commit -m "feat(mobile): DeliverySlotProvider with WS-driven updates"
```

---

### Task 27: OrderCheckoutNotifier

**Files:**
- Create: `apps/mobile/lib/features/customer/order/providers/order_checkout_provider.dart`
- Test: `apps/mobile/test/features/customer/order/providers/order_checkout_provider_test.dart`

- [ ] **Step 1: Write failing test**

```dart
void main() {
  test('addGroup creates a new destination group', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    notifier.addGroup('Office');
    expect(container.read(orderCheckoutProvider).groups, hasLength(1));
    expect(container.read(orderCheckoutProvider).groups.first.label, 'Office');
  });

  test('toggle priority flips the flag', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    expect(container.read(orderCheckoutProvider).priority, false);
    notifier.togglePriority();
    expect(container.read(orderCheckoutProvider).priority, true);
  });

  test('selectSlot saves templateId and date', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    notifier.selectSlot(templateId: 2, date: '2026-04-30');
    final state = container.read(orderCheckoutProvider);
    expect(state.slotTemplateId, 2);
    expect(state.slotDate, '2026-04-30');
  });
}
```

- [ ] **Step 2: Run test, confirm fail**

- [ ] **Step 3: Implement provider**

```dart
// apps/mobile/lib/features/customer/order/providers/order_checkout_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';

class OrderCheckoutState {
  const OrderCheckoutState({
    this.groups = const [],
    this.slotTemplateId,
    this.slotDate,
    this.priority = false,
  });

  final List<DestinationGroup> groups;
  final int? slotTemplateId;
  final String? slotDate;
  final bool priority;

  OrderCheckoutState copyWith({
    List<DestinationGroup>? groups,
    int? slotTemplateId,
    String? slotDate,
    bool? priority,
  }) =>
      OrderCheckoutState(
        groups: groups ?? this.groups,
        slotTemplateId: slotTemplateId ?? this.slotTemplateId,
        slotDate: slotDate ?? this.slotDate,
        priority: priority ?? this.priority,
      );
}

class OrderCheckoutNotifier extends StateNotifier<OrderCheckoutState> {
  OrderCheckoutNotifier() : super(const OrderCheckoutState());
  final _uuid = const Uuid();

  void addGroup(String label) {
    state = state.copyWith(
      groups: [
        ...state.groups,
        DestinationGroup(id: _uuid.v4(), label: label, itemIds: const []),
      ],
    );
  }

  void removeGroup(String id) {
    state = state.copyWith(
      groups: state.groups.where((g) => g.id != id).toList(),
    );
  }

  void assignAddress(String groupId, int addressId) {
    state = state.copyWith(
      groups: state.groups
          .map((g) => g.id == groupId ? g.copyWith(addressId: addressId) : g)
          .toList(),
    );
  }

  void moveItemToGroup(String itemId, String targetGroupId) {
    state = state.copyWith(
      groups: state.groups.map((g) {
        if (g.id == targetGroupId) {
          if (g.itemIds.contains(itemId)) return g;
          return g.copyWith(itemIds: [...g.itemIds, itemId]);
        }
        return g.copyWith(itemIds: g.itemIds.where((id) => id != itemId).toList());
      }).toList(),
    );
  }

  void selectSlot({required int templateId, required String date}) {
    state = state.copyWith(slotTemplateId: templateId, slotDate: date);
  }

  void togglePriority() {
    state = state.copyWith(priority: !state.priority);
  }

  void reset() {
    state = const OrderCheckoutState();
  }
}

final orderCheckoutProvider =
    StateNotifierProvider<OrderCheckoutNotifier, OrderCheckoutState>(
  (_) => OrderCheckoutNotifier(),
);
```

- [ ] **Step 4: Run tests, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/providers/order_checkout_provider.dart apps/mobile/test/features/customer/order/providers/order_checkout_provider_test.dart
git commit -m "feat(mobile): OrderCheckoutNotifier holds groups+slot+priority"
```

---

### Task 28: SlotPickerScreen

**Files:**
- Create: `apps/mobile/lib/features/customer/order/screens/slot_picker_screen.dart`
- Test: `apps/mobile/test/features/customer/order/screens/slot_picker_screen_test.dart`

- [ ] **Step 1: Write widget test**

```dart
void main() {
  testWidgets('renders three slot cards with capacity bars', (tester) async {
    final mockDio = MockDio();
    when(mockDio.get<List<dynamic>>(any)).thenAnswer((_) async => Response(
      data: [
        {'templateId': 1, 'startTime': '09:30:00', 'endTime': '11:30:00', 'capacity': 10, 'bookedCount': 8},
        {'templateId': 2, 'startTime': '14:00:00', 'endTime': '16:00:00', 'capacity': 10, 'bookedCount': 10},
        {'templateId': 3, 'startTime': '21:00:00', 'endTime': '23:00:00', 'capacity': 10, 'bookedCount': 0},
      ],
      statusCode: 200,
      requestOptions: RequestOptions(path: ''),
    ));

    await tester.pumpWidget(ProviderScope(
      overrides: [dioProvider.overrideWithValue(mockDio)],
      child: const MaterialApp(home: SlotPickerScreen(date: '2026-04-30')),
    ));
    await tester.pumpAndSettle();

    expect(find.text('9:30 AM – 11:30 AM'), findsOneWidget);
    expect(find.text('Full'), findsOneWidget); // slot 2
    expect(find.text('8/10 booked'), findsOneWidget); // slot 1
  });

  testWidgets('priority toggle updates fee preview', (tester) async {
    // Arrange empty slots, priority fee = ₱50
    // Act: tap priority toggle
    // Assert: footer shows "+₱50"
  });
}
```

- [ ] **Step 2: Run test, confirm fail**

- [ ] **Step 3: Implement screen**

```dart
// apps/mobile/lib/features/customer/order/screens/slot_picker_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_checkout_provider.dart';

class SlotPickerScreen extends ConsumerStatefulWidget {
  const SlotPickerScreen({super.key, required this.date});
  final String date;

  @override
  ConsumerState<SlotPickerScreen> createState() => _SlotPickerScreenState();
}

class _SlotPickerScreenState extends ConsumerState<SlotPickerScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() =>
        ref.read(deliverySlotProvider(widget.date).notifier).initialize());
  }

  String _format12h(String hms) {
    final parts = hms.split(':');
    final h = int.parse(parts[0]);
    final m = parts[1];
    final pm = h >= 12;
    final hh = h % 12 == 0 ? 12 : h % 12;
    return '$hh:$m ${pm ? 'PM' : 'AM'}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final state = ref.watch(deliverySlotProvider(widget.date));
    final checkout = ref.watch(orderCheckoutProvider);
    final notifier = ref.read(orderCheckoutProvider.notifier);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text('Pick a slot', style: AppTypography.h3.copyWith(color: colors.onBackground)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Expanded(
              child: state.isLoading
                  ? Center(child: CircularProgressIndicator(color: colors.brand))
                  : ListView.separated(
                      itemCount: state.slots.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (_, i) {
                        final slot = state.slots[i];
                        final selected =
                            checkout.slotTemplateId == slot.templateId;
                        return _SlotCard(
                          time:
                              '${_format12h(slot.startTime)} – ${_format12h(slot.endTime)}',
                          bookedCount: slot.bookedCount,
                          capacity: slot.capacity,
                          isFull: slot.isFull,
                          isSelected: selected,
                          onTap: slot.isFull
                              ? null
                              : () => notifier.selectSlot(
                                    templateId: slot.templateId,
                                    date: widget.date,
                                  ),
                          colors: colors,
                        );
                      },
                    ),
            ),
            _PriorityToggle(
              priority: checkout.priority,
              colors: colors,
              onChanged: (_) => notifier.togglePriority(),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: checkout.slotTemplateId == null
                  ? null
                  : () => context.push('/customer/order/summary'),
              style: FilledButton.styleFrom(
                backgroundColor: colors.brand,
                foregroundColor: colors.onBrand,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
              ),
              child: const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  const _SlotCard({
    required this.time,
    required this.bookedCount,
    required this.capacity,
    required this.isFull,
    required this.isSelected,
    required this.onTap,
    required this.colors,
  });
  final String time;
  final int bookedCount;
  final int capacity;
  final bool isFull;
  final bool isSelected;
  final VoidCallback? onTap;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final percent = (bookedCount / capacity).clamp(0, 1).toDouble();
    final fillColor = isFull
        ? colors.error
        : percent > 0.7
            ? colors.warning
            : colors.brand;

    return Material(
      color: isSelected ? colors.brand.withValues(alpha: 0.12) : colors.surface,
      borderRadius: AppRadius.borderMd,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(
              color: isSelected ? colors.brand : colors.outline,
              width: isSelected ? 2 : 1,
            ),
            borderRadius: AppRadius.borderMd,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      time,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  if (isFull)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: colors.error,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'Full',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '$bookedCount/$capacity booked',
                style: AppTypography.caption
                    .copyWith(color: colors.onSurfaceDim),
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: percent,
                  minHeight: 6,
                  backgroundColor: colors.surfaceVariant,
                  valueColor: AlwaysStoppedAnimation(fillColor),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PriorityToggle extends StatelessWidget {
  const _PriorityToggle({
    required this.priority,
    required this.colors,
    required this.onChanged,
  });
  final bool priority;
  final AppColorSet colors;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: priority,
      onChanged: onChanged,
      title: Text(
        'Priority drop',
        style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
      ),
      subtitle: Text(
        '+₱50 — your batch will be dropped first within the slot',
        style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
      ),
      activeThumbColor: colors.brand,
      contentPadding: EdgeInsets.zero,
    );
  }
}
```

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/slot_picker_screen.dart apps/mobile/test/features/customer/order/screens/slot_picker_screen_test.dart
git commit -m "feat(mobile): slot picker screen with live capacity bars"
```

---

### Task 29: DestinationGroupsScreen

**Files:**
- Create: `apps/mobile/lib/features/customer/order/screens/destination_groups_screen.dart`
- Test: `apps/mobile/test/features/customer/order/screens/destination_groups_screen_test.dart`

- [ ] **Step 1: Write widget test**

```dart
void main() {
  testWidgets('shows default single group containing all cart items', (tester) async {
    // Arrange: cart with 2 items
    // Pump screen
    // Expect: 1 group titled "All deliveries", containing both items
  });

  testWidgets('add new destination button creates a second group', (tester) async {
    // Pump screen
    // Tap "+ New Destination"
    // Enter "Office"
    // Expect: 2 groups now visible
  });
}
```

- [ ] **Step 2: Implement screen**

Implement following the SlotPicker pattern: ConsumerStatefulWidget, AppBar with Back, ListView of groups (each group shows label, address picker chip, list of cart items), "+ New Destination" tile at bottom that opens a dialog. Continue button navigates based on whether all destinations are inside service area:
- All inside → `context.push('/customer/order/slot-picker?date=YYYY-MM-DD')`
- Any outside → `context.push('/customer/order/external-confirm')`

For brevity the full file is omitted here; implementer follows the Cart screen and SlotPicker widget patterns.

- [ ] **Step 3: Run tests, confirm pass**

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/destination_groups_screen.dart apps/mobile/test/features/customer/order/screens/destination_groups_screen_test.dart
git commit -m "feat(mobile): destination groups screen"
```

---

### Task 30: ExternalDeliveryConfirmScreen

**Files:**
- Create: `apps/mobile/lib/features/customer/order/screens/external_delivery_confirm_screen.dart`
- Test: `apps/mobile/test/features/customer/order/screens/external_delivery_confirm_screen_test.dart`

- [ ] **Step 1: Write test**

```dart
void main() {
  testWidgets('shows external delivery card and confirm button', (tester) async {
    await tester.pumpWidget(const ProviderScope(
      child: MaterialApp(home: ExternalDeliveryConfirmScreen()),
    ));
    expect(find.textContaining('partner courier'), findsOneWidget);
    expect(find.text('Confirm'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Implement screen**

Single ConsumerWidget with a centered Card explaining external delivery, "TBD — admin will confirm fee" line, and a Confirm button that navigates to `/customer/order/payment` (extending the payment flow to send `deliveryType: external`).

- [ ] **Step 3: Run tests, confirm pass**

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/external_delivery_confirm_screen.dart apps/mobile/test/features/customer/order/screens/external_delivery_confirm_screen_test.dart
git commit -m "feat(mobile): external delivery confirm screen"
```

---

### Task 31: Wire routes in app_router

**Files:**
- Modify: `apps/mobile/lib/config/routes/app_router.dart`

- [ ] **Step 1: Add route registrations**

Inside the customer route subtree, add three GoRoute entries:

```dart
GoRoute(
  path: '/customer/order/destinations',
  builder: (_, _) => const DestinationGroupsScreen(),
),
GoRoute(
  path: '/customer/order/slot-picker',
  builder: (_, state) =>
      SlotPickerScreen(date: state.uri.queryParameters['date']!),
),
GoRoute(
  path: '/customer/order/external-confirm',
  builder: (_, _) => const ExternalDeliveryConfirmScreen(),
),
```

Add the imports at top.

- [ ] **Step 2: Verify build**

Run: `cd apps/mobile && flutter analyze lib/config/routes/app_router.dart`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/config/routes/app_router.dart
git commit -m "feat(mobile): register new checkout screens in app router"
```

---

### Task 32: Update SummaryScreen and PaymentScreen

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/summary_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`

- [ ] **Step 1: Update Summary**

Add a section showing:
- Slot time (or "External courier")
- Destination count (or address)
- Priority badge if `checkout.priority`
- Updated fee breakdown: subtotal + base delivery + extra-destination + priority

Read from `cartProvider` and `orderCheckoutProvider`.

- [ ] **Step 2: Update Payment submission**

Inside the existing batch-create call, extend the payload:

```dart
final checkout = ref.read(orderCheckoutProvider);
final body = {
  // ... existing fields ...
  if (checkout.slotTemplateId != null) 'slotTemplateId': checkout.slotTemplateId,
  if (checkout.slotDate != null) 'slotDate': checkout.slotDate,
  'priority': checkout.priority,
  'destinations': checkout.groups
      .map((g) => {'addressId': g.addressId, 'label': g.label})
      .toList(),
};
final res = await dio.post('/orders/batch', data: body);
```

After success, call `ref.read(orderCheckoutProvider.notifier).reset()` and `ref.read(cartProvider.notifier).clear()`.

- [ ] **Step 3: Verify build**

Run: `cd apps/mobile && flutter build web --release --no-tree-shake-icons` — must succeed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/features/customer/order/screens/summary_screen.dart apps/mobile/lib/features/customer/order/screens/payment_screen.dart
git commit -m "feat(mobile): summary + payment carry slot/destinations/priority"
```

---

## Phase C — Admin (Tasks 33–38)

### Task 33: Admin types

**Files:**
- Create: `admin/src/types/delivery-slot.ts`

- [ ] **Step 1: Write types file**

```typescript
export interface DeliverySlotTemplate {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
}

export interface DeliverySlotBooking {
  id: number;
  slotTemplateId: number;
  date: string;
  batchOrderId: number;
  priority: boolean;
  priorityRank: number | null;
  bookedAt: string;
}

export interface DeliverySettings {
  id: number;
  serviceCenterLat: number;
  serviceCenterLng: number;
  serviceRadiusKm: number;
  priorityFeeAmount: number;
  extraDestinationSurcharge: number;
}

export interface ExternalDelivery {
  id: number;
  batchRef: string;
  externalDeliveryStatus: 'pending_admin' | 'booked' | 'delivered';
  user: { fullName: string | null; email: string };
  createdAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/types/delivery-slot.ts
git commit -m "feat(admin): delivery slot types"
```

---

### Task 34: Slot Templates page

**Files:**
- Create: `admin/src/pages/delivery-slots/templates.tsx`

- [ ] **Step 1: Implement page**

Use Refine's `useTable` with `resource: 'admin/delivery-slot-templates'`. Render Ant Design Table with columns: Day, Start, End, Capacity, Active. Click row → opens Drawer with form bound to PATCH endpoint. Add "+ Add slot" Button that opens Drawer in create mode.

The full code follows the existing `admin/src/pages/products/list.tsx` pattern; implementer mirrors it.

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/delivery-slots/templates.tsx
git commit -m "feat(admin): slot templates editor page"
```

---

### Task 35: Today's bookings dashboard

**Files:**
- Create: `admin/src/pages/delivery-slots/today.tsx`
- Create: `admin/src/providers/delivery-slot-ws.ts`

- [ ] **Step 1: WS client**

```typescript
// admin/src/providers/delivery-slot-ws.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectDeliverySlotsWS(token: string, date: string) {
  if (!socket) {
    socket = io(`${import.meta.env.VITE_API_URL}/ws/delivery-slots`, {
      transports: ['websocket'],
      auth: { token },
    });
  }
  socket.emit('subscribe-slots', { date });
  return socket;
}

export function disconnectDeliverySlotsWS() {
  socket?.disconnect();
  socket = null;
}
```

- [ ] **Step 2: Today page**

Implement an Ant Design page rendering three columns (one per slot template), each showing capacity bar and bookings list with drag-to-reorder via `react-dnd` or `@dnd-kit/core`. After drag-drop, fire PATCH `/admin/slot-bookings/order` with the new `orderedIds` array.

Subscribe to `slot-updated` events; on each, re-fetch the snapshot.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/delivery-slots/today.tsx admin/src/providers/delivery-slot-ws.ts
git commit -m "feat(admin): today's bookings dashboard with WS + drag-reorder"
```

---

### Task 36: External Deliveries queue

**Files:**
- Create: `admin/src/pages/external-deliveries/index.tsx`

- [ ] **Step 1: Implement page**

Use Refine `useTable` with `resource: 'admin/external-deliveries'`. Column filters: status (pending_admin / booked / delivered). Each row has "Mark as Booked" / "Mark as Delivered" buttons that PATCH the status.

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/external-deliveries/index.tsx
git commit -m "feat(admin): external deliveries queue page"
```

---

### Task 37: Delivery Settings page

**Files:**
- Create: `admin/src/pages/admin-settings/delivery.tsx`

- [ ] **Step 1: Implement page**

Form fields (Ant Design Form):
- Service Center Lat (number)
- Service Center Lng (number)
- Service Radius Km (number)
- Priority Fee Amount (number)
- Extra Destination Surcharge (number)

Embedded Leaflet map showing current service center as a marker; clicking the map updates lat/lng. Save → PATCH `/admin/settings/delivery`.

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/admin-settings/delivery.tsx
git commit -m "feat(admin): delivery settings page with map picker"
```

---

### Task 38: Sidebar nav + App.tsx wiring + orders updates

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/components/grid-sider.tsx`
- Modify: `admin/src/pages/orders/list.tsx`
- Modify: `admin/src/pages/orders/show.tsx`

- [ ] **Step 1: Register resources in App.tsx**

```tsx
{
  name: 'delivery-slots',
  meta: { label: 'Delivery', icon: <CarOutlined /> },
},
{
  name: 'delivery-slots-today',
  list: '/delivery-slots/today',
  meta: { label: 'Today\'s Slots', parent: 'delivery-slots' },
},
{
  name: 'delivery-slots-templates',
  list: '/delivery-slots/templates',
  meta: { label: 'Slot Templates', parent: 'delivery-slots' },
},
{
  name: 'external-deliveries',
  list: '/external-deliveries',
  meta: { label: 'External Deliveries', parent: 'delivery-slots' },
},
{
  name: 'delivery-settings',
  list: '/settings/delivery',
  meta: { label: 'Delivery Settings', parent: 'delivery-slots' },
},
```

Add corresponding `Route` entries pointing to the new pages.

- [ ] **Step 2: Sidebar**

`grid-sider.tsx` already iterates `useMenu` — no change needed if resources are registered correctly.

- [ ] **Step 3: Orders list** — add a "Slot" column showing `slotTime` if local, "External" badge otherwise. Filter chip for `deliveryType`.

- [ ] **Step 4: Orders show** — render destinations as a table, slot info, priority badge.

- [ ] **Step 5: Verify**

Run: `cd admin && npm run build` — must succeed.

- [ ] **Step 6: Commit**

```bash
git add admin/src/App.tsx admin/src/components/grid-sider.tsx admin/src/pages/orders/
git commit -m "feat(admin): wire delivery-slots resources + orders columns"
```

---

## Phase D — Verification

### Task 39: End-to-end smoke

- [ ] **Step 1: Fresh DB**

```bash
docker exec server-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'grid_print' AND pid <> pg_backend_pid();"
docker exec server-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS grid_print;"
docker exec server-postgres-1 psql -U postgres -c "CREATE DATABASE grid_print;"
cd server && npm run seed
```

Expected: includes "15 delivery slot templates seeded" and "Delivery settings seeded".

- [ ] **Step 2: Server tests pass**

Run: `cd server && npx jest --testPathPatterns="delivery-slots|orders" --silent`
Expected: all pass.

- [ ] **Step 3: Mobile tests pass**

Run: `cd apps/mobile && flutter test test/features/customer/order`
Expected: all pass.

- [ ] **Step 4: Mobile web build**

Run: `cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons`
Expected: success.

- [ ] **Step 5: Admin build**

Run: `cd admin && npm run build`
Expected: success.

- [ ] **Step 6: Manual smoke (open the app)**

Customer:
- Add 2 items to cart
- Tap Checkout → see Destination Groups → use single default group → pick a Davao address
- See SlotPicker with three cards, capacity bars
- Open admin in second window — confirm booking appears live

Admin:
- Navigate to Delivery → Today's Slots — see today's bookings, capacity bars
- Drag-reorder priority bookings — page reflects new order
- Navigate to External Deliveries — out-of-radius batch should be listed if you tested with a non-Davao address

If anything fails, open the failing area, write a failing test, fix.

---

## Self-Review Notes

**Spec coverage:** All 14 design decisions in the spec map to one or more tasks above.

**Placeholder scan:** No "TBD/TODO" outside the explicit customer-facing UI copy ("TBD — admin will confirm").

**Type consistency:** `slotTemplateId`, `slotDate`, `priority`, `destinations[]`, `deliveryType`, `slotBookingId`, `priorityFee`, `extraDestinationFee`, `externalDeliveryStatus` are used consistently across DTOs, entities, mobile models, and admin types. The mobile uses `attachmentMimeType`-style camelCase mirroring the JSON shape returned by NestJS.

**Cart integration:** existing `cartProvider` and `cart_screen.dart` are not modified; the new flow consumes them downstream (Q10 = local-only Hive cart confirmed).

**Out-of-scope reminders (from spec):**
- No 3PL API integration (manual admin handoff only)
- No per-day overrides for holidays
- No server-side cart sync
- No distance-based fee
- No stop-aware capacity
- No hybrid local+external batches

These remain Phase 2 if/when needed.
