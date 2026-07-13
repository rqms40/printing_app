# Beta Workflow Release 1.6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and visibly verify the complete admin, Mark, Ven, and Juan beta workflow on a fresh migrated stack, then release GRIDGO `1.6.0+17` as tag `v1.6.0` only after every release gate passes.

**Architecture:** PostgreSQL migrations and transactional server services own enrollment, credits, order history, assignment, proof, surveys, and a persisted road-time dispatch plan. Mobile and admin render those contracts without mock fallback in real-flow mode. Playwright drives four isolated Chromium contexts, simulates Juan's movement through shop, Ven, and Mark coordinates, and captures screenshot plus API/WebSocket evidence for all 29 steps.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 15, MinIO, Socket.IO, Flutter 3.41.6, Riverpod, `flutter_map`, React/Vite/Ant Design, Playwright, Docker Compose, GitHub Actions.

## Global Constraints

- Production and CI start from an empty PostgreSQL database using a complete, ordered TypeORM migration chain.
- Beta enrollment grants exactly 100 GRIDGO Credits once and records a credit-ledger transaction.
- Mark registers and orders before Ven; Mark's home is farther from the store than Ven's.
- The server persists one road-time dispatch plan; mobile and admin never independently reorder stops.
- Later stops receive queue position but no assignment identifier, coordinates, route geometry, room membership, or map affordance.
- Proof files must exist, belong to Juan, use the proof-of-delivery purpose, and have an accepted image MIME type.
- Both customers complete the 14-question survey, testimonial flow, held login, and beta-off login restoration.
- Real-flow Playwright projects may not use mock orders, addresses, assignments, or the fixed demo GPS path.
- Screenshots require matching visible-state and API/WebSocket assertions.
- Preserve Trello markers, user changes, and unrelated tracker state; never print secrets or signed URLs.
- Version and tag changes occur only after every local and GitHub gate passes for the exact commit.

---

### Task 1: Make empty-database migrations and fresh seeding executable

**Files:**
- Create: `server/src/database/data-source.ts`
- Create: `server/src/database/migration-config.spec.ts`
- Create: `server/migrations/1700000000000-current-schema-baseline.ts`
- Modify: `server/src/database/typeorm.config.ts`
- Modify: `server/package.json`
- Modify: `server/scripts/seed-if-empty.mjs`
- Modify: `docker-compose.dev.yml`
- Modify: `docker/server-dev.Dockerfile`
- Modify: `server/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing database environment keys.
- Produces: `AppDataSource: DataSource`; migration scripts; a one-shot Compose `migrate` service required before seed.

- [ ] **Step 1: Write failing production migration tests**

```ts
it('registers migrations and disables production synchronization', () => {
  const config = new ConfigService({ NODE_ENV: 'production' });
  const options = createTypeOrmOptions(config);
  expect(options.synchronize).toBe(false);
  expect(options.migrations).toEqual([
    expect.stringContaining('migrations/*{.ts,.js}'),
  ]);
});
```

Run: `cd server && npm test -- migration-config.spec.ts --runInBand`

Expected: FAIL because migrations and a CLI data source are not registered.

- [ ] **Step 2: Add one shared data-source builder**

Create `server/src/database/data-source.ts`:

```ts
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { join } from 'node:path';

export function databaseOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST ?? 'localhost',
    port: Number(env.DATABASE_PORT ?? 5432),
    username: env.DATABASE_USER ?? 'postgres',
    password: env.DATABASE_PASSWORD ?? 'postgres',
    database: env.DATABASE_NAME ?? 'grid_print',
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, '..', '..', 'migrations', '*{.ts,.js}')],
    synchronize: false,
  };
}

export const AppDataSource = new DataSource(databaseOptionsFromEnv());
```

Make `createTypeOrmOptions` reuse this builder and enable synchronization only for explicit `DATABASE_SYNCHRONIZE=true`.

- [ ] **Step 3: Generate and normalize the baseline**

Generate a baseline with timestamp `1700000000000`, then make the existing incremental migrations idempotent with `hasTable`, `hasColumn`, and catalog guards so the chain works on empty and previously synchronized databases without deleting published migrations.

Run:

```bash
cd server
npx typeorm-ts-node-commonjs migration:generate migrations/current-schema-baseline -d src/database/data-source.ts --timestamp 1700000000000
npm run migration:run
npm run migration:run
npm run migration:revert
npm run migration:run
```

Expected: first run applies pending migrations, second reports none pending, revert removes the latest change, and the final run reapplies it successfully.

- [ ] **Step 4: Add exact package scripts**

```json
"migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts",
"migration:run": "typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts",
"migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts",
"schema:fresh-check": "npm run migration:run && npm run seed:if-empty"
```

Make seed fail with `Run npm run migration:run before seeding` if `users` is absent.

- [ ] **Step 5: Put migration before seed in Compose**

Add `migrate` running `npm run migration:run`; make seed depend on successful migration, and API depend on successful seed. Set `DATABASE_SYNCHRONIZE=false`.

Run: `docker compose -f docker-compose.dev.yml config --quiet`

Expected: exit 0.

- [ ] **Step 6: Prove empty migration and seed, then verify and commit**

```bash
GRIDGO_PUBLIC_HOST=127.0.0.1 GRIDGO_BIND_ADDR=127.0.0.1 docker compose -f docker-compose.dev.yml down -v
GRIDGO_PUBLIC_HOST=127.0.0.1 GRIDGO_BIND_ADDR=127.0.0.1 docker compose -f docker-compose.dev.yml up --build -d postgres minio migrate seed api
cd server && npm run lint:check && npm run build && npm test -- --runInBand && npm run test:e2e -- --runInBand
git add server docker docker-compose.dev.yml README.md
git commit -m "build: add production database migration path"
```

Expected: migrate/seed exit 0, API is healthy, beta starts disabled, and all server checks pass.

---

### Task 2: Make beta rank and credit accounting deterministic

**Files:**
- Modify: `server/src/beta-mode/beta-mode.service.ts`
- Modify: `server/src/beta-mode/beta-mode.service.spec.ts`
- Modify: `server/src/credits/credits.service.ts`
- Modify: `server/src/credits/credits.service.spec.ts`
- Modify: `server/src/credits/entities/credit-transaction.entity.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Create: `server/migrations/1777853400000-beta-credit-ledger-and-rank-index.ts`

**Interfaces:**
- Produces: idempotent `CreditsService.grantBetaEnrollmentCredits(userId, 100)`; rank ordered by `(betaEnrolledAt, id)`; one charge-total helper shared by debit/refund.

- [ ] **Step 1: Write failing ledger and rank tests**

```ts
it('records one enrollment grant under concurrent calls', async () => {
  await Promise.all([service.enrollUser(9), service.enrollUser(9)]);
  expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledTimes(1);
  expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(9, 100);
});

it('breaks equal enrollment timestamps by user id', async () => {
  await service.getBetaStatus(9);
  expect(rankQuery.andWhere).toHaveBeenCalledWith(
    '(u.beta_enrolled_at < :at OR (u.beta_enrolled_at = :at AND u.id <= :id))',
    { at: sharedTimestamp, id: 9 },
  );
});
```

Run: `cd server && npm test -- beta-mode.service.spec.ts credits.service.spec.ts --runInBand`

Expected: FAIL because enrollment increments directly and rank lacks an ID tie-breaker.

- [ ] **Step 2: Implement one transactional ledger grant**

```ts
async grantBetaEnrollmentCredits(userId: number, amount = 100): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    const reference = `BETA-ENROLLMENT:${userId}`;
    if (await manager.getRepository(CreditTransaction).findOne({ where: { reference } })) return;
    await manager.increment(User, { id: userId }, 'credits', amount);
    await manager.getRepository(CreditTransaction).insert({
      userId,
      amount,
      type: CreditTransactionType.CREDIT,
      reason: 'beta_enrollment',
      reference,
    });
    await manager.update(User, userId, { betaCreditsGranted: true });
  });
}
```

Add the unique ledger reference migration and secondary ID ordering for every beta list/rank query.

- [ ] **Step 3: Write a failing complete-refund test**

```ts
it('refunds every charged component', async () => {
  ordersRepo.findOneOrFail.mockResolvedValue({
    ...creditOrder,
    totalPrice: 40,
    deliveryFee: 20,
    priorityFee: 15,
    extraDestinationFee: 10,
  });
  await service.cancelOrder(1, creditOrder.userId);
  expect(creditsService.refundCredits).toHaveBeenCalledWith(
    creditOrder.userId,
    85,
    creditOrder.orderId,
  );
});
```

Run: `cd server && npm test -- orders.service.spec.ts -t "refunds every" --runInBand`

Expected: FAIL with an under-refund.

- [ ] **Step 4: Share one full charge calculation, verify, and commit**

Use one pure helper for creation, debit, and refund; include subtotal, delivery, priority, and extra-destination fees.

```bash
cd server
npm test -- beta-mode.service.spec.ts credits.service.spec.ts orders.service.spec.ts --runInBand
git add src migrations
git commit -m "fix: make beta credit accounting deterministic"
```

---

### Task 3: Enforce order transitions, history, and unique assignment

**Files:**
- Create: `server/src/orders/order-status-transition.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `server/src/orders/entities/order-status-history.entity.ts`
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/admin/admin.controller.spec.ts`
- Modify: `server/src/riders/entities/delivery-assignment.entity.ts`
- Modify: `server/src/riders/riders.service.ts`
- Modify: `server/src/riders/riders.service.spec.ts`
- Create: `server/migrations/1777853500000-order-history-and-assignment-integrity.ts`
- Test: `server/test/rider-workflow.e2e-spec.ts`

**Interfaces:**
- Produces: validated `OrdersService.updateStatus`; complete status history; unique `delivery_assignments.order_id`; transactional `assignOrderToRider`.

- [ ] **Step 1: Write failing transition and history tests**

```ts
it('rejects a skipped production transition', async () => {
  ordersRepo.findOneOrFail.mockResolvedValue({ id: 1, orderStatus: OrderStatus.ORDER_PLACED });
  await expect(service.updateStatus(1, OrderStatus.READY_FOR_DISPATCH))
    .rejects.toThrow('Cannot transition from order_placed to ready_for_dispatch');
});

it('writes actor-aware status history', async () => {
  await service.updateStatus(1, OrderStatus.FILE_VERIFIED, {}, {
    actorUserId: 7,
    reason: 'Admin production update',
  });
  expect(historyRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
    orderId: 1,
    fromStatus: OrderStatus.ORDER_PLACED,
    toStatus: OrderStatus.FILE_VERIFIED,
    changedByUserId: 7,
  }));
});
```

Run: `cd server && npm test -- orders.service.spec.ts -t "transition|history" --runInBand`

Expected: FAIL because transitions are unrestricted and history is unwritten.

- [ ] **Step 2: Implement transition validation and history transaction**

Export the declared transition map from `order-status-transition.ts`; validate before mutation; update order and insert history through one transaction manager; publish notifications only after commit.

- [ ] **Step 3: Write failing assignment eligibility/concurrency tests**

```ts
it('rejects assignment before ready for dispatch', async () => {
  orderRepo.findOneOrFail.mockResolvedValue({ id: 1, orderStatus: OrderStatus.PRINTING_IN_PROGRESS });
  await expect(service.assignOrderToRider(1, 3, 7))
    .rejects.toThrow('Order is not ready for dispatch');
});

it('creates one assignment under concurrent requests', async () => {
  const results = await Promise.allSettled([
    service.assignOrderToRider(orderId, riderId, adminId),
    service.assignOrderToRider(orderId, riderId, adminId),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(await assignmentRepo.countBy({ orderId })).toBe(1);
});
```

Run: `cd server && npm test -- admin.controller.spec.ts riders.service.spec.ts --runInBand`

Expected: FAIL because assignment is not status-gated, unique, or transactional.

- [ ] **Step 4: Add unique assignment and transactional service**

Add `@Index('uq_delivery_assignments_order', ['orderId'], { unique: true })`. Lock the order row; verify readiness and rider availability; insert assignment, update order, and write history in one transaction. Convert unique violations to `ConflictException('Order already has an assignment')`.

- [ ] **Step 5: Verify and commit**

```bash
cd server
npm test -- orders.service.spec.ts admin.controller.spec.ts riders.service.spec.ts --runInBand
npm run test:e2e -- rider-workflow.e2e-spec.ts --runInBand
git add src test migrations
git commit -m "fix: enforce order and rider assignment integrity"
```

---

### Task 4: Validate proof ownership and make delivery-survey completion reliable

**Files:**
- Modify: `server/src/files/entities/file-metadata.entity.ts`
- Modify: `server/src/files/files.service.ts`
- Modify: `server/src/files/files.service.spec.ts`
- Modify: `server/src/riders/dto/update-delivery-status.dto.ts`
- Modify: `server/src/riders/riders.service.ts`
- Modify: `server/src/riders/riders.service.spec.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `server/src/tam-surveys/tam-surveys.service.ts`
- Modify: `server/src/tam-surveys/tam-surveys.service.spec.ts`
- Modify: `server/src/beta-mode/beta-mode.service.ts`
- Modify: `server/src/beta-mode/beta-mode.service.spec.ts`
- Create: `server/migrations/1777853600000-file-purpose-and-delivery-completion.ts`
- Test: `server/test/concurrent-route-proof.e2e-spec.ts`

**Interfaces:**
- Produces: persisted file purpose; owned proof validation; one delivery/order/history/survey transaction; authenticated location E2E.

- [ ] **Step 1: Write failing proof validation tests**

```ts
it('rejects photo proof owned by another user', async () => {
  fileRepo.findOne.mockResolvedValue({
    id: 44,
    uploadedBy: 999,
    purpose: 'proof_of_delivery',
    mimeType: 'image/png',
  });
  await expect(completeWithPhoto(44)).rejects.toThrow(
    'Proof file does not belong to this rider',
  );
});

it('rejects an oversized signature', async () => {
  await expect(completeWithSignature('x'.repeat(65_537)))
    .rejects.toThrow('Signature proof is too large');
});
```

Run: `cd server && npm test -- riders.service.spec.ts -t "proof" --runInBand`

Expected: FAIL because proof metadata is not resolved/owned and signatures are unbounded.

- [ ] **Step 2: Persist and validate file purpose**

Store normalized `purpose` in `FileMetadata`. For photo proof accept only files owned by Juan, purpose `proof_of_delivery`, and MIME `image/png`, `image/jpeg`, or `image/webp`. Resolve object key server-side. Bound signature payloads at 65,536 bytes. Apply the same accepted image MIME check to beta testimonial files in `BetaModeService.submitTestimonial`.

- [ ] **Step 3: Write a failing survey rollback test**

```ts
it('rolls back delivery when survey creation fails', async () => {
  tamSurveysService.createPostDeliveryRequirementIfNeeded
    .mockRejectedValue(new Error('survey insert failed'));
  await expect(completeCurrentStop()).rejects.toThrow('survey insert failed');
  expect(await assignmentRepo.findOneByOrFail({ id: assignment.id }))
    .toMatchObject({ status: DeliveryStatus.ARRIVED });
  expect(await orderRepo.findOneByOrFail({ id: order.id }))
    .toMatchObject({ orderStatus: OrderStatus.ARRIVED_AT_DESTINATION });
});
```

Run: `cd server && npm test -- riders.service.spec.ts orders.service.spec.ts -t "rolls back delivery" --runInBand`

Expected: FAIL because survey errors are suppressed outside the delivery transaction.

- [ ] **Step 4: Implement transactional completion and post-commit events**

Add `OrdersService.completeDelivery(manager, orderId, actorUserId)` to update order, write history, stamp expiry, and create the survey requirement with the supplied manager. Save assignment proof in the same transaction. Emit order, survey, notification, and plan-progress events after commit.

- [ ] **Step 5: Authenticate and synchronize the location E2E client**

Pass the near customer's JWT via Socket.IO `auth`, wait for the subscribe acknowledgement, then send the rider REST location update. Repeat the focused E2E three times to remove timing uncertainty.

- [ ] **Step 6: Verify and commit**

```bash
cd server
for run in 1 2 3; do npm run test:e2e -- concurrent-route-proof.e2e-spec.ts --runInBand || exit 1; done
npm test -- files.service.spec.ts riders.service.spec.ts orders.service.spec.ts tam-surveys.service.spec.ts --runInBand
git add src test migrations
git commit -m "fix: validate delivery proof and survey completion"
```

---

### Task 5: Persist an OSRM-backed road-time dispatch plan

**Files:**
- Create: `server/src/riders/entities/dispatch-plan.entity.ts`
- Create: `server/src/riders/entities/dispatch-plan-stop.entity.ts`
- Create: `server/src/riders/routing/routing-provider.ts`
- Create: `server/src/riders/routing/osrm-routing.provider.ts`
- Create: `server/src/riders/routing/osrm-routing.provider.spec.ts`
- Create: `server/src/riders/routing/small-route-solver.ts`
- Create: `server/src/riders/routing/small-route-solver.spec.ts`
- Create: `server/src/riders/dispatch-plan.service.ts`
- Create: `server/src/riders/dispatch-plan.service.spec.ts`
- Create: `server/migrations/1777853700000-persisted-dispatch-plans.ts`
- Modify: `server/src/riders/riders.module.ts`
- Modify: `server/src/riders/riders.service.ts`
- Modify: `server/src/riders/riders.controller.ts`
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `docker-compose.dev.yml`

**Interfaces:**
- Consumes: ready assignment destinations plus `ROUTING_BASE_URL`, `ROUTING_PROFILE`, and `ROUTING_TIMEOUT_MS`.
- Produces: `RoutingProvider`, `solveOpenRoute`, and `DispatchPlanService` with create/read/advance/re-optimize methods.

- [ ] **Step 1: Write failing OSRM provider tests**

```ts
await expect(provider.getMatrix([
  { latitude: 7.064, longitude: 125.6079 },
  { latitude: 7.0641, longitude: 125.6079 },
])).resolves.toEqual({
  durationsSeconds: [[0, 20], [22, 0]],
  distancesMeters: [[0, 110], [115, 0]],
});
```

Also assert longitude/latitude request ordering, timeout handling, malformed matrices, unreachable cells, and GeoJSON geometry.

Run: `cd server && npm test -- osrm-routing.provider.spec.ts --runInBand`

Expected: FAIL because no provider exists.

- [ ] **Step 2: Implement the provider contract**

```ts
export type GeoPoint = { latitude: number; longitude: number };
export type RouteMatrix = {
  durationsSeconds: Array<Array<number | null>>;
  distancesMeters: Array<Array<number | null>>;
};
export type RouteLeg = {
  fromIndex: number;
  toIndex: number;
  durationSeconds: number;
  distanceMeters: number;
  geometry: { type: 'LineString'; coordinates: number[][] };
};
export interface RoutingProvider {
  readonly name: string;
  getMatrix(points: GeoPoint[]): Promise<RouteMatrix>;
  getRoute(points: GeoPoint[]): Promise<RouteLeg[]>;
}
```

OSRM table requests use `annotations=duration,distance`; route requests use `geometries=geojson&overview=full&steps=false`.

- [ ] **Step 3: Write failing exact-solver tests**

```ts
it('chooses Ven before farther Mark by road duration', () => {
  const result = solveOpenRoute([
    [0, 900, 240],
    [900, 0, 500],
    [240, 500, 0],
  ]);
  expect(result.indices).toEqual([0, 2, 1]);
  expect(result.totalDurationSeconds).toBe(740);
});

it('breaks equal cost by assignment id', () => {
  expect(solveOpenRoute(equalMatrix, [0, 42, 17]).indices).toEqual([0, 2, 1]);
});
```

Run: `cd server && npm test -- small-route-solver.spec.ts --runInBand`

Expected: FAIL because the solver does not exist.

- [ ] **Step 4: Implement a five-stop open-route solver**

Use bitmask dynamic programming. Index 0 is the store, every delivery is visited once, the route does not return to store, and equal totals use assignment ID ordering. Reject null matrix cells before solving.

- [ ] **Step 5: Write failing persistence/stability tests**

```ts
it('persists Ven then Mark in one stable plan', async () => {
  const plan = await service.createPlan(riderProfile.id, [mark.id, ven.id]);
  expect(plan.version).toBe(1);
  expect(plan.stops.map((stop) => stop.assignmentId)).toEqual([ven.id, mark.id]);
  expect(plan.provider).toBe('osrm');
});

it('does not reorder after rider movement', async () => {
  await service.createPlan(riderProfile.id, [mark.id, ven.id]);
  riderProfile.lastLatitude = markLatitude;
  riderProfile.lastLongitude = markLongitude;
  const plan = await service.getActivePlanForRider(riderProfile.id);
  expect(plan.stops.map((stop) => stop.assignmentId)).toEqual([ven.id, mark.id]);
});
```

Run: `cd server && npm test -- dispatch-plan.service.spec.ts --runInBand`

Expected: FAIL because no persisted plan exists.

- [ ] **Step 6: Implement plan creation, progress, and explicit re-optimization**

Persist rider, version, store origin, provider, profile, totals, ordered stops, legs, status, and timestamps. Create a plan only after eligible assignments exist. Make rider/customer reads join the active plan. Completing/declining advances the plan; only the admin re-optimize endpoint creates another version.

- [ ] **Step 7: Fail clearly when routing is unavailable**

Return `503 routing_unavailable` before first dispatch. Retain an active plan and mark ETA/geometry stale if later provider refresh fails. Never call Haversine ordering as an optimized fallback.

- [ ] **Step 8: Verify and commit**

```bash
cd server
npm test -- osrm-routing.provider.spec.ts small-route-solver.spec.ts dispatch-plan.service.spec.ts riders.service.spec.ts orders.service.spec.ts --runInBand
npm run build
git add src migrations ../docker-compose.dev.yml
git commit -m "feat: persist road-time rider dispatch plans"
```

---

### Task 6: Emit queue promotion and harden socket authorization

**Files:**
- Modify: `server/src/orders/orders.gateway.ts`
- Modify: `server/src/orders/orders.gateway.spec.ts`
- Modify: `server/src/riders/location.gateway.ts`
- Modify: `server/src/riders/location.gateway.spec.ts`
- Modify: `server/src/riders/riders.service.ts`
- Modify: `server/src/riders/riders.service.spec.ts`
- Modify: `server/src/users/users.service.ts`
- Test: `server/test/orders-websocket.e2e-spec.ts`
- Test: `server/test/concurrent-route-proof.e2e-spec.ts`

**Interfaces:**
- Produces: `deliveryQueueUpdated` event; plan-aware location payload; active-account socket authorization.

- [ ] **Step 1: Write failing promotion and inactive-user tests**

```ts
it('notifies Mark when Ven completes', async () => {
  await service.completeCurrentStopWithProof(juan.id, venAssignment.id, proof);
  expect(ordersGateway.notifyDeliveryQueueUpdated).toHaveBeenCalledWith(
    mark.id,
    expect.objectContaining({
      orderId: markOrder.id,
      queuePosition: 1,
      canTrackDelivery: true,
      assignmentId: markAssignment.id,
      planVersion: 1,
    }),
  );
});

it('disconnects an inactive signed user', async () => {
  usersService.findById.mockResolvedValue({ id: 8, isActive: false });
  await gateway.handleConnection(clientWithToken);
  expect(clientWithToken.disconnect).toHaveBeenCalled();
});
```

Run: `cd server && npm test -- orders.gateway.spec.ts location.gateway.spec.ts riders.service.spec.ts --runInBand`

Expected: FAIL because promotion requires refetch and gateways trust token claims.

- [ ] **Step 2: Implement account rechecks and plan-aware rooms**

Load the user after JWT verification; reject missing, inactive, or role-mismatched accounts. Resolve current-stop authorization from the active dispatch plan, not recalculated Haversine order. Target promotion only to `user_<id>`.

- [ ] **Step 3: Include plan identity in location updates**

```ts
{
  assignmentId: String(currentStop.assignmentId),
  planVersion: currentPlan.version,
  latitude: dto.latitude,
  longitude: dto.longitude,
  timestamp: saved.lastLocationUpdate.toISOString(),
}
```

- [ ] **Step 4: Verify socket behavior and commit**

```bash
cd server
npm test -- orders.gateway.spec.ts location.gateway.spec.ts riders.service.spec.ts --runInBand
npm run test:e2e -- orders-websocket.e2e-spec.ts concurrent-route-proof.e2e-spec.ts --runInBand
git add src test
git commit -m "fix: promote delivery queues in real time"
```

---

### Task 7: Render persisted routes and real-data-only live states in mobile

**Files:**
- Modify: `apps/mobile/lib/shared/models/order.dart`
- Modify: `apps/mobile/lib/shared/models/location_update.dart`
- Modify: `apps/mobile/lib/shared/services/websocket_service.dart`
- Modify: `apps/mobile/lib/shared/services/routing_service.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/customer/home/providers/live_delivery_map_provider.dart`
- Modify: `apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart`
- Modify: `apps/mobile/lib/features/customer/tracking/widgets/delivery_map.dart`
- Modify: `apps/mobile/lib/features/customer/order/sheets/address_picker_sheet.dart`
- Modify: `apps/mobile/lib/features/rider/shared/models/rider_order_context.dart`
- Modify: `apps/mobile/lib/features/rider/shared/rider_assignment_parser.dart`
- Modify: `apps/mobile/lib/features/rider/shared/providers/rider_location_tracker_provider.dart`
- Modify: `apps/mobile/lib/features/rider/deliveries/providers/deliveries_provider.dart`
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_panel.dart`
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart`
- Test: `apps/mobile/test/features/customer/home/providers/live_delivery_map_provider_test.dart`
- Test: `apps/mobile/test/features/customer/home/widgets/map_tracking_tile_test.dart`
- Test: `apps/mobile/test/features/customer/order/sheets/address_picker_sheet_test.dart`
- Test: `apps/mobile/test/features/rider/deliveries/providers/deliveries_provider_test.dart`
- Create: `apps/mobile/test/features/rider/home/widgets/rider_route_map_panel_test.dart`
- Create: `apps/mobile/test/shared/services/websocket_delivery_queue_test.dart`

**Interfaces:**
- Consumes: plan version/stops/legs, promotion event, and REST location endpoint.
- Produces: one route model shared across rider surfaces; customer live/stale/offline/degraded states; `GRIDGO_REAL_FLOW=true` fail-closed mode.

- [ ] **Step 1: Write failing plan and multi-leg tests**

```dart
test('parses one stable route plan', () {
  final views = parseAssignmentViews(routePlanFixture);
  expect(views.map((view) => view.id), ['ven-assignment', 'mark-assignment']);
  expect(views.map((view) => view.routePosition), [1, 2]);
  expect(views.first.planVersion, 1);
});

testWidgets('renders both planned legs', (tester) async {
  await tester.pumpWidget(buildRoutePanel(routePlanFixture));
  await tester.pumpAndSettle();
  expect(find.byKey(const Key('route-leg-0')), findsOneWidget);
  expect(find.byKey(const Key('route-leg-1')), findsOneWidget);
});
```

Run: `cd apps/mobile && fvm flutter test test/features/rider/home/widgets/rider_route_map_panel_test.dart`

Expected: FAIL because the client has no plan/leg contract.

- [ ] **Step 2: Parse and render the server-owned plan**

Add immutable plan/version/leg fields to rider models. Remove client OSRM calls from live dispatch screens and decode server geometry. Keep local routing only for non-dispatch preview and label interpolation degraded.

- [ ] **Step 3: Write failing real-data-only and promotion tests**

```dart
test('real-flow mode never substitutes mock assignments', () async {
  final notifier = DeliveriesNotifier(bootstrap: false, realFlow: true);
  await notifier.refreshAssignments();
  expect(notifier.state.views, isEmpty);
  expect(notifier.state.errorMessage, 'Unable to load live assignments');
});

testWidgets('promotion replaces queue privacy with current map', (tester) async {
  await tester.pumpWidget(buildMarkQueuedHome());
  dispatchDeliveryQueueUpdated(markPromotionFixture);
  await tester.pumpAndSettle();
  expect(find.text('1st in queue'), findsOneWidget);
  expect(find.byKey(const Key('delivery-map-panel')), findsOneWidget);
});
```

Run: `cd apps/mobile && fvm flutter test test/features/customer/home/widgets/map_tracking_tile_test.dart test/features/rider/deliveries/providers/deliveries_provider_test.dart`

Expected: FAIL because errors load mock data and promotion needs refetch/reopen.

- [ ] **Step 4: Implement fail-closed live mode and GPS posting**

Compile Compose with `--dart-define=GRIDGO_REAL_FLOW=true`; in that mode surface errors without `MockData`. Remove unsupported socket location publishing. Post `/riders/location`, wait for acknowledgement, and throttle by time/distance. Permission/service failure must show an error, not start the fixed path.

- [ ] **Step 5: Implement map health states**

Treat the latest position as live for 15 seconds, stale through 60 seconds, and offline afterward. Preserve last marker with explicit copy. Distinguish degraded geometry from location health.

- [ ] **Step 6: Preserve truthful address-save fallback**

Add a widget test where `/addresses` persistence fails after a valid pin. The selected address may continue only as a clearly labeled one-time delivery address after explicit confirmation; the UI must not add it to saved/recent addresses or claim it was saved.

- [ ] **Step 7: Verify and commit**

```bash
cd apps/mobile
fvm flutter analyze lib/
fvm flutter test
fvm flutter build web --release --no-tree-shake-icons --dart-define=GRIDGO_REAL_FLOW=true
git add lib test pubspec.yaml pubspec.lock
git commit -m "feat: render persisted multi-stop delivery routes"
```

---

### Task 8: Align admin production and dispatch UI with server rules

**Files:**
- Modify: `admin/src/pages/beta-mode/index.tsx`
- Modify: `admin/src/pages/orders/show.tsx`
- Modify: `admin/src/pages/orders/list.tsx`
- Modify: `admin/src/pages/riders/list.tsx`
- Create: `admin/src/services/dispatchPlansApi.ts`
- Modify: `admin/src/types/index.ts`
- Modify: `admin/src/types/enums.ts`
- Test: `admin/src/pages/beta-mode/index.test.tsx`
- Test: `admin/src/pages/orders/show.test.tsx`
- Test: `admin/src/pages/riders/list.test.tsx`
- Create: `admin/src/services/dispatchPlansApi.test.ts`

**Interfaces:**
- Consumes: allowed next statuses, available riders, plan creation/retry, ordered stops, provider state, and plan metrics.
- Produces: non-skippable production UI, filtered assignment, and truthful plan state.

- [ ] **Step 1: Write failing admin behavior tests**

```tsx
it('offers only server-allowed next statuses', async () => {
  renderOrder({ order_status: 'order_placed', allowed_next_statuses: ['file_verified'] });
  await user.click(screen.getByRole('button', { name: /update status/i }));
  expect(screen.getByRole('option', { name: 'File Verified' })).toBeVisible();
  expect(screen.queryByRole('option', { name: 'Ready for Dispatch' })).toBeNull();
});

it('hides unavailable riders', () => {
  renderAssignmentModal([
    { id: 1, full_name: 'Juan', is_available: true },
    { id: 2, full_name: 'Unavailable Rider', is_available: false },
  ]);
  expect(screen.getByText('Juan')).toBeVisible();
  expect(screen.queryByText('Unavailable Rider')).toBeNull();
});
```

Run: `cd admin && npm test -- --runInBand`

Expected: FAIL on skipped status or unavailable rider behavior.

- [ ] **Step 2: Render transitions, history, and dispatch plan**

Use server `allowed_next_statuses`; render actor/time/reason history. Implement `createDispatchPlan(riderId, assignmentIds)` and show ordered stops, duration, distance, provider, version, and state. On `routing_unavailable`, disable dispatch and show Retry; never say optimized without a plan.

- [ ] **Step 3: Clarify beta consequences**

State auto-enrollment, 100 credits, credits-only checkout, mandatory feedback, and held-account behavior in the beta toggle confirmation/page.

- [ ] **Step 4: Verify and commit**

```bash
cd admin
npx tsc --noEmit
npm test
npm run build
git add src
git commit -m "feat: align admin dispatch with beta release rules"
```

---

### Task 9: Record real share intent and beta-off restoration

**Files:**
- Modify: `apps/mobile/lib/features/customer/beta/screens/beta_success_wall_screen.dart`
- Modify: `apps/mobile/lib/features/customer/beta/screens/beta_locked_screen.dart`
- Modify: `apps/mobile/lib/features/customer/beta/providers/beta_testimonial_provider.dart`
- Modify: `apps/mobile/lib/features/customer/beta/widgets/beta_share_row.dart`
- Modify: `apps/mobile/lib/features/auth/providers/auth_provider.dart`
- Test: `apps/mobile/test/features/customer/beta/screens/beta_success_wall_screen_test.dart`
- Test: `apps/mobile/test/features/customer/beta/models/beta_locked_info_test.dart`
- Create: `apps/mobile/test/features/customer/beta/beta_share_completion_test.dart`

**Interfaces:**
- Consumes: share-launch result and `beta_held`/normal login responses.
- Produces: `sharedOnSocial=false` until a target opens; tested held and restored login.

- [ ] **Step 1: Write failing successful/cancelled share tests**

```dart
testWidgets('records sharing only after target opens', (tester) async {
  final launcher = FakeShareLauncher(result: ShareLaunchResult.opened);
  await tester.pumpWidget(buildSuccessWall(shareLauncher: launcher));
  await tester.tap(find.bySemanticsLabel('Share to WhatsApp'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Upload photo & complete beta'));
  expect(fakeProvider.lastSharedOnSocial, isTrue);
});
```

Repeat with `ShareLaunchResult.cancelled` and expect false.

Run: `cd apps/mobile && fvm flutter test test/features/customer/beta/beta_share_completion_test.dart`

Expected: FAIL because both screens hard-code true.

- [ ] **Step 2: Inject share launcher and record confirmed intent**

Track completion after the launcher reports opened/success. Keep testimonial photo independently required. Returning to held state must not change the share flag.

- [ ] **Step 3: Test restored login after beta is disabled**

Add an auth-provider test where credentials first return `beta_held`, then return normal auth after beta is disabled. Assert routing leaves `/customer/beta/locked` for customer home.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/mobile
fvm flutter test test/features/customer/beta test/features/auth
fvm flutter analyze lib/
git add lib test
git commit -m "fix: record verified beta share completion"
```

---

### Task 10: Build the four-context screenshot-backed Playwright workflow

**Files:**
- Create: `e2e/mobile-web/tests/beta-workflow-visual.spec.ts`
- Create: `e2e/mobile-web/fixtures/beta-actors.ts`
- Create: `e2e/mobile-web/fixtures/beta-evidence.ts`
- Create: `e2e/mobile-web/fixtures/beta-api.ts`
- Create: `e2e/mobile-web/fixtures/beta-locations.ts`
- Create: `e2e/mobile-web/fixtures/beta-upload.png`
- Modify: `e2e/mobile-web/playwright.config.ts`
- Modify: `e2e/mobile-web/package.json`
- Modify: `e2e/mobile-web/package-lock.json`
- Modify: `e2e/mobile-web/README.md`
- Modify: `e2e/mobile-web/tests/beta-workflow-destructive.spec.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: loopback URLs, ignored credentials, migrated/seeded data, four contexts, and deterministic coordinates.
- Produces: `npm run test:beta:visual`; screenshots `01`-`29`, variants, trace, video, console/network logs, and JSON manifest outside committed source.

- [ ] **Step 1: Add a failing harness contract**

```ts
test('defines four actors and all evidence steps', () => {
  expect(Object.keys(betaActors).sort()).toEqual(['admin', 'juan', 'mark', 'ven']);
  expect(betaEvidenceSteps.map((step) => step.id)).toEqual(
    Array.from({ length: 29 }, (_, index) => index + 1),
  );
});
```

Run: `cd e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow-visual.spec.ts`

Expected: FAIL because fixtures are absent.

- [ ] **Step 2: Create actor and evidence fixtures**

Use one browser with independent admin, Mark, Ven, and Juan contexts. Admin viewport is `1440x900`; mobile viewports are `393x852`. Grant Juan geolocation permission. Enable Flutter semantics.

Install `@axe-core/playwright` as a development dependency. `captureStep` must assert URL/title, nonblank content, no overlay, console health, no horizontal viewport overflow, and step-specific state before saving `NN-slug.png`. Run Axe WCAG 2A/2AA checks on login, checkout, queue, proof, survey, and held screens. Verify PNG dimensions/nonzero bytes and append actor, URL, durable IDs, accessibility result, and assertion summary to the manifest.

- [ ] **Step 3: Drive steps 1-17 through real UI**

Perform admin login/toggle, Mark registration/profile/tutorial/paper/upload/address/payment/order, full admin production transitions, assignment to Juan, and Juan assignment visibility. Assert API IDs/reference text match the UI.

- [ ] **Step 4: Drive Ven and dispatch steps 18-24**

Register Ven only after Mark's order. Repeat the customer flow, status, and assignment. Create the plan and assert Ven then Mark. Capture Juan's route, Ven's current map, and Mark's no-map queue state. Attempt a direct Mark location subscription and assert no coordinates/room access.

- [ ] **Step 5: Drive movement, proof, surveys, and locks**

Set Juan geolocation at store, road-to-Ven, Ven, road-to-Mark, and Mark. At each point wait for REST acknowledgement and current-customer marker update. Submit Ven signature; assert Mark promotion without reload; repeat for Mark. Complete both surveys/photos/share intents, prove both held logins, disable beta, and prove both restored logins.

- [ ] **Step 6: Tighten the API workflow**

Register/order Mark before Ven, upload one real photo proof as well as signature proof, verify beta-off reopening, and restore beta disabled in `finally`. Record created IDs for cleanup or destroy isolated volumes.

- [ ] **Step 7: Run and inspect the visual flow**

```bash
cd e2e/mobile-web
GRIDGO_RUN_BETA_FLOW_VISUAL=1 \
MOBILE_WEB_E2E_NO_SERVER=1 \
MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
GRIDGO_ADMIN_URL=http://127.0.0.1:8189 \
GRIDGO_API_URL=http://127.0.0.1:3000/api \
npm run test:beta:visual
```

Expected: 29 canonical steps plus role variants, zero relevant console errors, zero required-request failures, and no offline demo data.

- [ ] **Step 8: Commit reusable automation, excluding evidence**

```bash
git add e2e/mobile-web AGENTS.md
git commit -m "test: automate visual beta release workflow"
```

---

### Task 11: Gate all surfaces and release automation in GitHub Actions

**Files:**
- Create: `.github/workflows/ci-landing.yml`
- Create: `.github/workflows/ci-fresh-stack.yml`
- Modify: `.github/workflows/ci-server.yml`
- Modify: `.github/workflows/ci-mobile.yml`
- Modify: `.github/workflows/ci-admin.yml`
- Modify: `.github/workflows/ci-mobile-web-e2e.yml`
- Modify: `.github/workflows/release-apk.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: surface scripts, migration/seed commands, protected visual evidence, final main SHA.
- Produces: required Server, Admin, Mobile, Landing, Mobile Web E2E, Migration, and Fresh Stack checks; release refuses an unverified SHA.

- [ ] **Step 1: Add landing and migration CI**

Landing runs `npm ci`, lint, the three content suites, and build. Server CI migrates/seeds an empty database with synchronization false before E2E.

Validate YAML:

```bash
ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |f| YAML.load_file(f, aliases: true); puts f }'
```

Expected: every workflow parses.

- [ ] **Step 2: Add loopback fresh-stack CI**

Build the loopback stack, wait for migrate/seed/API, run live preflight and destructive API flow with repository test secrets, upload logs on failure, and always remove volumes.

- [ ] **Step 3: Broaden E2E triggers and evidence retention**

Trigger on mobile/admin/server/compose/E2E/workflow changes. Upload failure artifacts. A protected visual run uploads accepted evidence and manifest for release review.

- [ ] **Step 4: Gate tagged release on exact-main checks**

Before building:

```bash
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
gh api repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/check-runs \
  --jq '.check_runs[] | [.name,.conclusion] | @tsv'
```

Require every named check and protected visual evidence for the SHA. Then run Flutter analyze, tests, signed APK build, and release asset upload.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/Landing-page && npm run lint && npm run test:community-cta && npm run test:video && npm run test:support-copy && npm run build
cd ../../e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
git add .github README.md
git commit -m "ci: gate release on full beta workflow"
```

Do not bump the mobile version yet.

---

### Task 12: Audit the release candidate and publish 1.6 only on green

**Files:**
- Modify only after all pre-version gates pass: `apps/mobile/pubspec.yaml`
- Update through GitHub CLI only with evidence: issues proven regressed or resolved.
- Generate outside source: screenshots, manifest, traces, videos, and command logs.

**Interfaces:**
- Consumes: Tasks 1-11, clean fresh stack, accepted screenshots, final SHA, GitHub checks, signing secrets.
- Produces: audit report; if green, `1.6.0+17`, main push, tag `v1.6.0`, signed APK release.

- [ ] **Step 1: Confirm repository state**

```bash
git status --short --branch
git diff --check
git log --oneline --decorate -12
```

Expected: only intentional changes and reviewable commits.

- [ ] **Step 2: Recreate the complete stack**

```bash
GRIDGO_PUBLIC_HOST=127.0.0.1 GRIDGO_BIND_ADDR=127.0.0.1 docker compose -f docker-compose.dev.yml down -v
GRIDGO_PUBLIC_HOST=127.0.0.1 GRIDGO_BIND_ADDR=127.0.0.1 docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml ps --all
```

Expected: data services healthy; migrate/seed exit 0; API healthy; all web surfaces running; beta disabled.

- [ ] **Step 3: Run every local gate**

```bash
cd server && npm run lint:check && npm run build && npm test -- --runInBand && npm run test:e2e -- --runInBand
cd ../admin && npx tsc --noEmit && npm test && npm run build
cd ../apps/mobile && fvm flutter analyze lib/ && fvm flutter test && fvm flutter build web --release --no-tree-shake-icons --dart-define=GRIDGO_REAL_FLOW=true
cd ../Landing-page && npm run lint && npm run test:community-cta && npm run test:video && npm run test:support-copy && npm run build
cd ../../e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
```

Expected: all exit 0.

- [ ] **Step 4: Run and inspect API plus visual workflows**

Run live preflight, destructive API flow, and visual flow. Open every accepted screenshot and compare manifest to all 29 requirements. Any missing/rejected step blocks release.

- [ ] **Step 5: Update tracker evidence and review integrated diff**

Comment with commands, counts, artifact location, and SHA. Reopen only proven regressions. Inspect:

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Fix each finding through a failing test and focused commit.

- [ ] **Step 6: Bump version after all gates pass**

Change:

```yaml
version: 1.6.0+17
```

Run and commit:

```bash
cd apps/mobile
fvm flutter pub get
fvm flutter analyze lib/
fvm flutter test
fvm flutter build apk --debug
git add pubspec.yaml pubspec.lock
git commit -m "release: prepare GRIDGO 1.6.0"
```

- [ ] **Step 7: Push main and monitor exact-commit CI**

```bash
git push origin main
gh run list --commit "$(git rev-parse HEAD)" --json databaseId,name,status,conclusion,url
```

Every required run must succeed for the exact SHA. Diagnose failures test-first, repeat affected local gates, push the focused fix, and monitor the new SHA.

- [ ] **Step 8: Tag only after green CI**

```bash
git tag -a v1.6.0 -m "GRIDGO 1.6.0"
git push origin v1.6.0
gh run list --workflow release-apk.yml --branch v1.6.0 --json databaseId,status,conclusion,url
```

Expected: signed release succeeds and publishes versioned plus latest APK assets from the tagged SHA.

- [ ] **Step 9: Deliver the evidence-backed audit**

Report 29-step health, screenshot gallery, environment/viewports, console/network/socket evidence, changed files, commands/counts, SHA/tag/release URL, CI URLs, accessibility limits, and remaining risk. If a gate failed, report the blocker and do not tag or claim release.

---

## Plan Self-Review Checklist

- [x] Tasks 1-12 cover every approved design requirement.
- [x] Migration, seed, rollback, and synchronization behavior are explicit.
- [x] Rank, ledger, debit, and complete refund are explicit.
- [x] History, assignment, proof, and survey changes are transactional.
- [x] Routing uses a road-time matrix and one persisted plan.
- [x] Privacy and automatic Mark promotion are checked at API, socket, and UI layers.
- [x] Juan movement uses deterministic geolocation and acknowledged REST updates.
- [x] Four actors use isolated contexts and real data only.
- [x] Every canonical step requires a screenshot plus state assertion.
- [x] All surfaces, fresh stack, exact-main CI, and release are gated.
- [x] Version and tag are final actions after verification.
