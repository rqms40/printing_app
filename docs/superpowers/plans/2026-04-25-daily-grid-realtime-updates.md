# Daily Grid Real-Time Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin mutations to Daily Grid cards are reflected on all connected customer mobile carousels in real-time via WebSocket push.

**Architecture:** New `DailyGridGateway` (Socket.IO, `/ws/daily-grid`, no auth) is injected into `DailyGridService`, which calls `notifyUpdated()` after create/update/remove/reorder. Mobile `DailyGridSection` connects on mount, listens for `dailyGridUpdated`, and calls `ref.invalidate(dailyGridProvider)` to trigger a fresh HTTP fetch.

**Tech Stack:** NestJS + Socket.IO (server) · Flutter + Riverpod + socket_io_client (mobile)

---

## File Structure

**Create:**
- `server/src/daily-grid/daily-grid.gateway.ts` — WebSocket gateway, emits `dailyGridUpdated`
- `server/src/daily-grid/daily-grid.gateway.spec.ts` — unit test for gateway
- `server/src/daily-grid/daily-grid.service.spec.ts` — unit tests verifying gateway called after mutations

**Modify:**
- `server/src/daily-grid/daily-grid.service.ts` — inject gateway, call `notifyUpdated()` after mutations
- `server/src/daily-grid/daily-grid.module.ts` — add `DailyGridGateway` to providers
- `apps/mobile/lib/shared/services/websocket_service.dart` — add `_dailyGridSocket`, `connectDailyGrid`, `disconnectDailyGrid`
- `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart` — connect WS on mount, invalidate provider on event

---

## Task 1: DailyGridGateway

**Files:**
- Create: `server/src/daily-grid/daily-grid.gateway.ts`
- Create: `server/src/daily-grid/daily-grid.gateway.spec.ts`
- Modify: `server/src/daily-grid/daily-grid.module.ts`

- [ ] **Step 1: Write the failing gateway test**

Create `server/src/daily-grid/daily-grid.gateway.spec.ts`:

```typescript
import { DailyGridGateway } from './daily-grid.gateway';

describe('DailyGridGateway', () => {
  let gateway: DailyGridGateway;

  beforeEach(() => {
    gateway = new DailyGridGateway();
    gateway.server = { emit: jest.fn() } as any;
  });

  it('notifyUpdated emits dailyGridUpdated with empty payload', () => {
    gateway.notifyUpdated();
    expect(gateway.server.emit).toHaveBeenCalledWith('dailyGridUpdated', {});
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /home/jd/projects/printing_app/server
npx jest daily-grid.gateway.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './daily-grid.gateway'`

- [ ] **Step 3: Create the gateway**

Create `server/src/daily-grid/daily-grid.gateway.ts`:

```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/daily-grid', cors: { origin: '*' } })
export class DailyGridGateway {
  @WebSocketServer()
  server: Server;

  notifyUpdated(): void {
    this.server.emit('dailyGridUpdated', {});
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd /home/jd/projects/printing_app/server
npx jest daily-grid.gateway.spec.ts --no-coverage
```

Expected: PASS — `1 test passed`

- [ ] **Step 5: Register the gateway in the module**

Replace `server/src/daily-grid/daily-grid.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyGridCard } from './entities/daily-grid-card.entity';
import { DailyGridService } from './daily-grid.service';
import { DailyGridController } from './daily-grid.controller';
import { DailyGridGateway } from './daily-grid.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([DailyGridCard])],
  controllers: [DailyGridController],
  providers: [DailyGridService, DailyGridGateway],
  exports: [DailyGridGateway],
})
export class DailyGridModule {}
```

- [ ] **Step 6: Verify the full server test suite still passes**

```bash
cd /home/jd/projects/printing_app/server
npm test -- --passWithNoTests
```

Expected: all suites pass

- [ ] **Step 7: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/daily-grid/daily-grid.gateway.ts \
        server/src/daily-grid/daily-grid.gateway.spec.ts \
        server/src/daily-grid/daily-grid.module.ts
git commit -m "feat: add DailyGridGateway for real-time card update broadcasts"
```

---

## Task 2: Service Gateway Integration

**Files:**
- Modify: `server/src/daily-grid/daily-grid.service.ts`
- Create: `server/src/daily-grid/daily-grid.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Create `server/src/daily-grid/daily-grid.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyGridService } from './daily-grid.service';
import { DailyGridCard } from './entities/daily-grid-card.entity';
import { DailyGridGateway } from './daily-grid.gateway';

const mockCard = {
  id: 1,
  title: 'Bond Paper A4',
  category: 'paper',
  isActive: true,
  sortOrder: 0,
  paperSpecs: null,
  threeDSpecs: null,
} as DailyGridCard;

describe('DailyGridService — gateway notifications', () => {
  let service: DailyGridService;
  let gateway: { notifyUpdated: jest.Mock };
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    gateway = { notifyUpdated: jest.fn() };
    repo = {
      find: jest.fn().mockResolvedValue([mockCard]),
      findOne: jest.fn().mockResolvedValue(mockCard),
      create: jest.fn().mockReturnValue(mockCard),
      save: jest.fn().mockResolvedValue(mockCard),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        DailyGridService,
        { provide: getRepositoryToken(DailyGridCard), useValue: repo },
        { provide: DailyGridGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(DailyGridService);
  });

  it('create calls notifyUpdated', async () => {
    await service.create({ title: 'Test', category: 'paper' } as any);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('update calls notifyUpdated', async () => {
    await service.update(1, { title: 'Updated' } as any);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('remove calls notifyUpdated', async () => {
    await service.remove(1);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('reorder calls notifyUpdated', async () => {
    await service.reorder([1, 2, 3]);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /home/jd/projects/printing_app/server
npx jest daily-grid.service.spec.ts --no-coverage
```

Expected: FAIL — service constructor error (DailyGridGateway not yet injected)

- [ ] **Step 3: Update the service to inject the gateway and call notifyUpdated**

Replace `server/src/daily-grid/daily-grid.service.ts` with:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyGridCard } from './entities/daily-grid-card.entity';
import { DailyGridGateway } from './daily-grid.gateway';

@Injectable()
export class DailyGridService {
  constructor(
    @InjectRepository(DailyGridCard)
    private readonly repo: Repository<DailyGridCard>,
    private readonly gateway: DailyGridGateway,
  ) {}

  findActive(): Promise<DailyGridCard[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  findAll(): Promise<DailyGridCard[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async findOne(id: number): Promise<DailyGridCard> {
    const card = await this.repo.findOne({ where: { id } });
    if (!card) throw new NotFoundException(`Daily grid card ${id} not found`);
    return card;
  }

  async create(dto: Partial<DailyGridCard>): Promise<DailyGridCard> {
    const card = this.repo.create(dto);
    const saved = await this.repo.save(card);
    this.gateway.notifyUpdated();
    return saved;
  }

  async update(
    id: number,
    dto: Partial<DailyGridCard>,
  ): Promise<DailyGridCard> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    const updated = await this.findOne(id);
    this.gateway.notifyUpdated();
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
    this.gateway.notifyUpdated();
  }

  async reorder(ids: number[]): Promise<void> {
    await Promise.all(
      ids.map((id, index) => this.repo.update(id, { sortOrder: index })),
    );
    this.gateway.notifyUpdated();
  }
}
```

- [ ] **Step 4: Run the service tests to confirm they pass**

```bash
cd /home/jd/projects/printing_app/server
npx jest daily-grid.service.spec.ts --no-coverage
```

Expected: PASS — `4 tests passed`

- [ ] **Step 5: Run the full server test suite**

```bash
cd /home/jd/projects/printing_app/server
npm test -- --passWithNoTests
```

Expected: all suites pass

- [ ] **Step 6: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/daily-grid/daily-grid.service.ts \
        server/src/daily-grid/daily-grid.service.spec.ts
git commit -m "feat: notify DailyGridGateway after every admin mutation"
```

---

## Task 3: Mobile WebSocketService — connectDailyGrid / disconnectDailyGrid

**Files:**
- Modify: `apps/mobile/lib/shared/services/websocket_service.dart`

- [ ] **Step 1: Add `_dailyGridSocket` field and the two new methods**

Open `apps/mobile/lib/shared/services/websocket_service.dart`.

After the line `io.Socket? _notificationsSocket;` add the new field:

```dart
  io.Socket? _dailyGridSocket;
```

After the `listenForNewNotifications` method (near the end of the class, before `disconnect()`), add the two new methods:

```dart
  Future<void> connectDailyGrid({required VoidCallback onUpdated}) async {
    if (_dailyGridSocket?.connected == true) return;
    if (_dailyGridSocket != null) {
      _dailyGridSocket!.connect();
      return;
    }
    _dailyGridSocket = io.io(
      '$_baseUrl/ws/daily-grid',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );
    _dailyGridSocket!.on('dailyGridUpdated', (_) => onUpdated());
    _dailyGridSocket!.on(
      'connect',
      (_) => debugPrint('WS DailyGrid connected'),
    );
    _dailyGridSocket!.on(
      'connect_error',
      (e) => debugPrint('WS DailyGrid error: $e'),
    );
    _dailyGridSocket!.connect();
  }

  void disconnectDailyGrid() {
    _dailyGridSocket?.disconnect();
    _dailyGridSocket = null;
  }
```

- [ ] **Step 2: Add daily-grid cleanup to the global `disconnect()` method**

Find the existing `disconnect()` method (it currently disconnects `_ordersSocket`, `_locationSocket`, `_notificationsSocket`). Add the daily-grid socket alongside the others:

```dart
  void disconnect() {
    _ordersSocket?.disconnect();
    _locationSocket?.disconnect();
    _notificationsSocket?.disconnect();
    _dailyGridSocket?.disconnect();
    // Null out so the next connection creates a fresh socket
    // with a new JWT — prevents stale-token room membership after logout.
    _notificationsSocket = null;
    _ordersSocket = null;
    _dailyGridSocket = null;
  }
```

- [ ] **Step 3: Run flutter analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze
```

Expected: `No issues found!`

- [ ] **Step 4: Run Flutter tests**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: all tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/lib/shared/services/websocket_service.dart
git commit -m "feat: add connectDailyGrid/disconnectDailyGrid to WebSocketService"
```

---

## Task 4: DailyGridSection — WebSocket Lifecycle + Test

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart`
- Create: `apps/mobile/test/features/customer/home/widgets/daily_grid_section_ws_test.dart`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/test/features/customer/home/widgets/daily_grid_section_ws_test.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/providers/daily_grid_provider.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';

void main() {
  test('invalidating dailyGridProvider causes it to rebuild', () async {
    final container = ProviderContainer(
      overrides: [
        dailyGridProvider.overrideWith(
          (ref) async => <DailyGridItem>[],
        ),
      ],
    );
    addTearDown(container.dispose);

    // Build the provider
    await container.read(dailyGridProvider.future);
    expect(
      container.read(dailyGridProvider).value,
      isA<List<DailyGridItem>>(),
    );

    // Simulate _onDailyGridUpdated
    container.invalidate(dailyGridProvider);

    // Provider is now in loading state
    expect(container.read(dailyGridProvider), isA<AsyncLoading>());
  });
}
```

- [ ] **Step 2: Run the test to confirm it passes already (Riverpod behavior)**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/home/widgets/daily_grid_section_ws_test.dart
```

Expected: PASS — this test verifies the Riverpod invalidation mechanism that `_onDailyGridUpdated` depends on.

- [ ] **Step 3: Add `_onDailyGridUpdated` and wire up initState / dispose**

Open `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart`.

Add the `_onDailyGridUpdated` method inside `_DailyGridSectionState`, after `_onCardTap`:

```dart
  void _onDailyGridUpdated() {
    if (mounted) ref.invalidate(dailyGridProvider);
  }
```

Update `initState` to call `connectDailyGrid` after the existing timer setup:

```dart
  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: _kInitialPage,
      viewportFraction: 0.47,
    );
    _autoScrollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (_pageController.hasClients) {
        _pageController.nextPage(
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      }
    });
    WebSocketService.instance.connectDailyGrid(onUpdated: _onDailyGridUpdated);
  }
```

Update `dispose` to call `disconnectDailyGrid` before `super.dispose()`:

```dart
  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _pageController.dispose();
    WebSocketService.instance.disconnectDailyGrid();
    super.dispose();
  }
```

Add the import for `WebSocketService` at the top of the file, alongside the other imports:

```dart
import 'package:printing_app/shared/services/websocket_service.dart';
```

- [ ] **Step 4: Run flutter analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze
```

Expected: `No issues found!`

- [ ] **Step 5: Run all Flutter tests**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: all tests pass

- [ ] **Step 6: Build Flutter web**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
```

Expected: `✓ Built build/web`

- [ ] **Step 7: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart \
        apps/mobile/test/features/customer/home/widgets/daily_grid_section_ws_test.dart
git commit -m "feat: connect DailyGrid WebSocket in DailyGridSection for real-time updates"
```
