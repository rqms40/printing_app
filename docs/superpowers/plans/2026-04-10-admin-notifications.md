# Admin Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent real-time notification system to the GRIDGO admin dashboard — bell icon, sidebar live badges, full notifications page, delivered via WebSocket and stored per-admin in the DB.

**Architecture:** Extend the existing `notifications` table with a `metadata jsonb` column; add `NotificationsGateway` (`/ws/notifications`) for real-time push; add `createForAllAdmins()` to `NotificationsService`; wire it into order/credit/auth events. On the admin frontend, a `notification-ws` singleton mirrors `live-provider`, a React context holds state, and `GridSider` replaces `ThemedSiderV2` to render live badge pills.

**Tech Stack:** NestJS 11 / TypeORM / Socket.IO (server) · React 18 / Refine 4 / Ant Design 5 / Vitest (admin)

**DO NOT COMMIT** — run all tasks, then await user approval before any git commit.

---

## File Map

### Server — 11 files

| File | Action |
|------|--------|
| `server/src/notifications/entities/notification.entity.ts` | Add `metadata jsonb` column |
| `server/src/users/users.service.ts` | Add `findAllByRole()` |
| `server/src/users/users.service.spec.ts` | Add `findAllByRole` tests |
| `server/src/notifications/notifications.gateway.ts` | **NEW** — `/ws/notifications` gateway |
| `server/src/notifications/notifications.gateway.spec.ts` | **NEW** — gateway tests |
| `server/src/notifications/notifications.service.ts` | Add `createForAllAdmins()` |
| `server/src/notifications/notifications.service.spec.ts` | Add tests + update mocks |
| `server/src/notifications/notifications.module.ts` | Add gateway, JwtModule, UsersModule |
| `server/src/admin/admin.controller.ts` | Add `GET /admin/badge-counts` |
| `server/src/admin/admin.controller.spec.ts` | Add badge-counts tests |
| `server/src/admin/admin.module.ts` | Import CreditsModule |
| `server/src/orders/orders.service.ts` | Wire `createForAllAdmins` on create/cancel/decline |
| `server/src/orders/orders.service.spec.ts` | Add NotificationsService mock + new tests |
| `server/src/orders/orders.module.ts` | Import NotificationsModule |
| `server/src/credits/credits.service.ts` | Wire `topup_request` + fix `rejectTopUp` gap |
| `server/src/credits/credits.service.spec.ts` | **NEW** — credits service tests |
| `server/src/auth/auth.service.ts` | Wire `new_user` on register |
| `server/src/auth/auth.service.spec.ts` | Add NotificationsService mock + register test |
| `server/src/auth/auth.module.ts` | Import NotificationsModule |

### Admin — 9 files

| File | Action |
|------|--------|
| `admin/src/types/notification.ts` | **NEW** — Notification interface + NotificationType |
| `admin/src/providers/notification-ws.ts` | **NEW** — socket.io singleton `/ws/notifications` |
| `admin/src/providers/notification-ws.test.ts` | **NEW** — WS provider tests |
| `admin/src/context/notifications-context.tsx` | **NEW** — state, REST+WS integration, actions |
| `admin/src/context/notifications-context.test.tsx` | **NEW** — context tests |
| `admin/src/components/notification-bell.tsx` | **NEW** — bell + badge + dropdown |
| `admin/src/components/notification-bell.test.tsx` | **NEW** — bell component tests |
| `admin/src/components/grid-sider.tsx` | **NEW** — custom sider with live badge pills |
| `admin/src/components/grid-sider.test.tsx` | **NEW** — sider badge tests |
| `admin/src/pages/notifications/index.tsx` | **NEW** — full notifications page |
| `admin/src/components/header.tsx` | Add `NotificationBell` left of avatar |
| `admin/src/providers/auth-provider.ts` | Call `disconnectNotifications()` on logout |
| `admin/src/App.tsx` | Wrap with `NotificationsProvider`, use `GridSider`, add route |

---

## Phase 1 — Server

---

### Task 1: Add `metadata` column to Notification entity

**Files:**
- Modify: `server/src/notifications/entities/notification.entity.ts`

- [ ] **Step 1: Add the column**

Open `server/src/notifications/entities/notification.entity.ts` and add the `metadata` column after `isRead`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
@Index('idx_notifications_user_id', ['userId'])
@Index('idx_notifications_created', ['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'order_ref', nullable: true, length: 20 })
  orderRef: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ length: 30 })
  type: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run from `server/`:
```bash
npm run test -- --testPathPattern=notifications.service
```
Expected: all existing tests pass (no schema validation in unit tests).

---

### Task 2: Add `UsersService.findAllByRole` (TDD)

**Files:**
- Modify: `server/src/users/users.service.spec.ts`
- Modify: `server/src/users/users.service.ts`

- [ ] **Step 1: Write the failing test**

In `server/src/users/users.service.spec.ts`, add the `find: jest.fn()` to the `repo` mock object and add a new `describe` block at the end of the existing tests:

```typescript
// In the repo mock object, add:
repo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),            // ADD THIS LINE
};
```

```typescript
// Add this describe block at the end of the file, inside describe('UsersService', ...)
describe('findAllByRole', () => {
  it('returns all users with the given role', async () => {
    const admins = [
      { id: 1, email: 'admin@gridgo.ph', role: 'admin' } as User,
    ];
    repo.find.mockResolvedValue(admins);

    const result = await service.findAllByRole('admin');

    expect(repo.find).toHaveBeenCalledWith({ where: { role: 'admin' } });
    expect(result).toEqual(admins);
  });

  it('returns empty array when no users with that role exist', async () => {
    repo.find.mockResolvedValue([]);

    const result = await service.findAllByRole('admin');

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm run test -- --testPathPattern=users.service
```
Expected: FAIL — `service.findAllByRole is not a function`

- [ ] **Step 3: Implement `findAllByRole`**

In `server/src/users/users.service.ts`, add this method after `updateProfile`:

```typescript
async findAllByRole(role: string): Promise<User[]> {
  return this.usersRepo.find({ where: { role: role as any } });
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npm run test -- --testPathPattern=users.service
```
Expected: all tests PASS

---

### Task 3: `NotificationsGateway` (TDD)

**Files:**
- Create: `server/src/notifications/notifications.gateway.spec.ts`
- Create: `server/src/notifications/notifications.gateway.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/notifications/notifications.gateway.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { NotificationsGateway } from './notifications.gateway';

const makeClient = (
  token?: string,
): jest.Mocked<Pick<Socket, 'join' | 'disconnect'>> & {
  handshake: { auth: Record<string, unknown> };
} => ({
  handshake: { auth: token ? { token } : {} },
  join: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
});

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  describe('handleConnection', () => {
    it('joins admin_notifications when JWT has role=admin', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 1,
        role: 'admin',
      });
      const client = makeClient('valid-admin-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-admin-token');
      expect(client.join).toHaveBeenCalledWith('admin_notifications');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('does NOT join admin_notifications for a non-admin JWT', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 2,
        role: 'customer',
      });
      const client = makeClient('customer-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects immediately when token is missing', async () => {
      const client = makeClient();

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('disconnects when JWT verification throws', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('jwt expired'),
      );
      const client = makeClient('expired-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('broadcastToAdmins', () => {
    it('emits newNotification to admin_notifications room', () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      gateway.server = { to: toMock } as unknown as Server;

      const notif = { id: 1, title: 'New Order', type: 'order_placed' } as any;
      gateway.broadcastToAdmins(notif);

      expect(toMock).toHaveBeenCalledWith('admin_notifications');
      expect(emitMock).toHaveBeenCalledWith('newNotification', notif);
    });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm run test -- --testPathPattern=notifications.gateway
```
Expected: FAIL — `Cannot find module './notifications.gateway'`

- [ ] **Step 3: Implement the gateway**

Create `server/src/notifications/notifications.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ role?: string }>(
        token,
      );
      if (payload.role === 'admin') {
        void client.join('admin_notifications');
      }
    } catch {
      client.disconnect();
    }
  }

  broadcastToAdmins(notif: Notification): void {
    this.server.to('admin_notifications').emit('newNotification', notif);
  }
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npm run test -- --testPathPattern=notifications.gateway
```
Expected: 5 tests PASS

---

### Task 4: `NotificationsService.createForAllAdmins` (TDD)

**Files:**
- Modify: `server/src/notifications/notifications.service.spec.ts`
- Modify: `server/src/notifications/notifications.service.ts`

- [ ] **Step 1: Update spec — add mocks + failing tests**

Replace the entire `server/src/notifications/notifications.service.spec.ts` with the following (keeps all existing tests, adds new mocks and `createForAllAdmins` tests):

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './entities/notification.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<Partial<Repository<Notification>>>;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let gateway: jest.Mocked<Partial<NotificationsGateway>>;

  const mockNotification = {
    id: 1,
    userId: 1,
    title: 'Order Update',
    message: 'Your order is ready',
    type: 'order',
    isRead: false,
    metadata: null,
    createdAt: new Date(),
  } as Notification;

  const mockAdmin = { id: 10, email: 'admin@gridgo.ph', role: 'admin' } as User;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    usersService = { findAllByRole: jest.fn() };
    gateway = { broadcastToAdmins: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('getByUser', () => {
    it('should return user notifications sorted by createdAt DESC', async () => {
      const notifications = [mockNotification];
      repo.find.mockResolvedValue(notifications);

      const result = await service.getByUser(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(notifications);
    });
  });

  describe('create', () => {
    it('should save notification', async () => {
      repo.create.mockReturnValue(mockNotification);
      repo.save.mockResolvedValue(mockNotification);

      const data = {
        userId: 1,
        title: 'Order Update',
        message: 'Your order is ready',
        type: 'order',
      };
      const result = await service.create(data);

      expect(repo.create).toHaveBeenCalledWith(data);
      expect(repo.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markAsRead', () => {
    it('should set isRead to true', async () => {
      const unreadNotif = { ...mockNotification, isRead: false } as Notification;
      repo.findOne.mockResolvedValue(unreadNotif);
      repo.save.mockImplementation(async (n) => n as Notification);

      const result = await service.markAsRead(1, 1);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1, userId: 1 } });
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if notification not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should update all user unread notifications', async () => {
      repo.update.mockResolvedValue(undefined as any);

      await service.markAllAsRead(1);

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 1, isRead: false },
        { isRead: true },
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      repo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(1);

      expect(repo.count).toHaveBeenCalledWith({
        where: { userId: 1, isRead: false },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      repo.count.mockResolvedValue(0);

      expect(await service.getUnreadCount(1)).toBe(0);
    });
  });

  describe('createForAllAdmins', () => {
    it('batch-inserts one row per admin and broadcasts', async () => {
      const admins = [mockAdmin, { id: 11, email: 'admin2@gridgo.ph', role: 'admin' } as User];
      usersService.findAllByRole.mockResolvedValue(admins);

      const row1 = { ...mockNotification, userId: 10 } as Notification;
      const row2 = { ...mockNotification, userId: 11, id: 2 } as Notification;
      repo.create
        .mockReturnValueOnce(row1)
        .mockReturnValueOnce(row2);
      repo.save.mockResolvedValue([row1, row2] as any);

      await service.createForAllAdmins({
        title: 'New Order',
        message: 'ORD-10042 placed',
        type: 'order_placed',
        orderRef: 'ORD-10042',
        metadata: { orderId: 42, amount: 450 },
      });

      expect(usersService.findAllByRole).toHaveBeenCalledWith('admin');
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenCalledWith([row1, row2]);
      expect(gateway.broadcastToAdmins).toHaveBeenCalledWith(row1);
    });

    it('calls broadcastToAdmins after insert with the first saved row', async () => {
      usersService.findAllByRole.mockResolvedValue([mockAdmin]);
      const saved = { ...mockNotification, userId: 10 } as Notification;
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue([saved] as any);

      await service.createForAllAdmins({
        title: 'Test',
        message: 'Test msg',
        type: 'test',
      });

      expect(gateway.broadcastToAdmins).toHaveBeenCalledWith(saved);
    });

    it('no-ops silently when no admin users exist', async () => {
      usersService.findAllByRole.mockResolvedValue([]);

      await service.createForAllAdmins({
        title: 'Test',
        message: 'Test msg',
        type: 'test',
      });

      expect(repo.save).not.toHaveBeenCalled();
      expect(gateway.broadcastToAdmins).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm run test -- --testPathPattern=notifications.service
```
Expected: `createForAllAdmins` tests FAIL — method does not exist yet. Existing tests also fail (missing providers in DI). This is expected.

- [ ] **Step 3: Implement `createForAllAdmins`**

Replace `server/src/notifications/notifications.service.ts` with:

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private usersService: UsersService,
    private gateway: NotificationsGateway,
  ) {}

  async getByUser(userId: number): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    return this.notifRepo.save(notif);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async create(data: {
    userId: number;
    title: string;
    message: string;
    type: string;
    orderRef?: string;
  }): Promise<Notification> {
    const notif = this.notifRepo.create(data);
    return this.notifRepo.save(notif);
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }

  async createForAllAdmins(data: {
    title: string;
    message: string;
    type: string;
    orderRef?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const admins = await this.usersService.findAllByRole('admin');
    if (admins.length === 0) return;

    const rows = admins.map((admin) =>
      this.notifRepo.create({ userId: admin.id, ...data }),
    );

    const saved = await this.notifRepo.save(rows);
    this.gateway.broadcastToAdmins(saved[0]);
  }
}
```

- [ ] **Step 4: Run to confirm all tests pass**

```bash
npm run test -- --testPathPattern=notifications.service
```
Expected: all tests PASS

---

### Task 5: Update `NotificationsModule`

**Files:**
- Modify: `server/src/notifications/notifications.module.ts`

- [ ] **Step 1: Update the module**

Replace `server/src/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 2: Verify gateway + service tests still pass**

```bash
npm run test -- --testPathPattern=notifications
```
Expected: all gateway and service tests PASS

---

### Task 6: `GET /admin/badge-counts` (TDD)

**Files:**
- Modify: `server/src/admin/admin.controller.spec.ts`
- Modify: `server/src/admin/admin.controller.ts`

- [ ] **Step 1: Write failing tests**

In `server/src/admin/admin.controller.spec.ts`, make these changes:

**a)** Add import at the top:
```typescript
import { CreditsService } from '../credits/credits.service';
import { In } from 'typeorm';
```

**b)** Update `mockRepo()` to include `count`:
```typescript
const mockRepo = () => ({
  find: jest.fn(),
  findOneOrFail: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
});
```

**c)** Add `creditsService` variable and mock in the `beforeEach`:
```typescript
let creditsService: jest.Mocked<Partial<CreditsService>>;

// inside beforeEach, before module setup:
creditsService = { getPendingRequests: jest.fn() };
```

**d)** Add `CreditsService` provider to the test module providers:
```typescript
{ provide: CreditsService, useValue: creditsService },
```

**e)** Add at the end of the file (before the closing `}`):
```typescript
describe('getBadgeCounts', () => {
  it('returns correct newOrders and pendingTopUps counts', async () => {
    ordersRepo.count.mockResolvedValue(3);
    creditsService.getPendingRequests.mockResolvedValue([{}, {}] as any);

    const result = await controller.getBadgeCounts();

    expect(ordersRepo.count).toHaveBeenCalledWith({
      where: { orderStatus: In([OrderStatus.ORDER_PLACED, OrderStatus.FILE_VERIFIED]) },
    });
    expect(result).toEqual({ newOrders: 3, pendingTopUps: 2 });
  });

  it('returns 0 for both when nothing is pending', async () => {
    ordersRepo.count.mockResolvedValue(0);
    creditsService.getPendingRequests.mockResolvedValue([]);

    const result = await controller.getBadgeCounts();

    expect(result).toEqual({ newOrders: 0, pendingTopUps: 0 });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm run test -- --testPathPattern=admin.controller
```
Expected: FAIL — `controller.getBadgeCounts is not a function`

- [ ] **Step 3: Implement badge-counts endpoint**

In `server/src/admin/admin.controller.ts`, add the following:

**a)** Add imports at top:
```typescript
import { In } from 'typeorm';
import { CreditsService } from '../credits/credits.service';
```

**b)** Add `private creditsService: CreditsService` to the constructor:
```typescript
constructor(
  private ordersService: OrdersService,
  private ridersService: RidersService,
  private creditsService: CreditsService,        // ADD
  @InjectRepository(Order)
  private ordersRepo: Repository<Order>,
  @InjectRepository(User)
  private usersRepo: Repository<User>,
) {}
```

**c)** Add the endpoint after `getDashboard()`:
```typescript
@Get('badge-counts')
async getBadgeCounts() {
  const newOrders = await this.ordersRepo.count({
    where: { orderStatus: In([OrderStatus.ORDER_PLACED, OrderStatus.FILE_VERIFIED]) },
  });
  const pendingRequests = await this.creditsService.getPendingRequests();
  return { newOrders, pendingTopUps: pendingRequests.length };
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npm run test -- --testPathPattern=admin.controller
```
Expected: all tests PASS

---

### Task 7: Update `AdminModule`

**Files:**
- Modify: `server/src/admin/admin.module.ts`

- [ ] **Step 1: Add CreditsModule import**

Replace `server/src/admin/admin.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { PaperSpec } from '../orders/entities/paper-specs.entity';
import { ThreeDSpec } from '../orders/entities/three-d-specs.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      User,
      PaperSpec,
      ThreeDSpec,
      OrderStatusHistory,
    ]),
    OrdersModule,
    RidersModule,
    CreditsModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
```

- [ ] **Step 2: Verify no regressions**

```bash
npm run test -- --testPathPattern=admin.controller
```
Expected: PASS

---

### Task 8: Wire notifications into `OrdersService` (TDD)

**Files:**
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.module.ts`

- [ ] **Step 1: Write failing tests**

In `server/src/orders/orders.service.spec.ts`, add:

**a)** Add import at top:
```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

**b)** Add variable:
```typescript
let notificationsService: Partial<NotificationsService>;
```

**c)** In `beforeEach`, initialise the mock:
```typescript
notificationsService = {
  createForAllAdmins: jest.fn().mockResolvedValue(undefined),
};
```

**d)** Add to the test module providers:
```typescript
{ provide: NotificationsService, useValue: notificationsService },
```

**e)** Add these new test cases inside `describe('create', ...)`:
```typescript
it('fires createForAllAdmins with order_placed type after saving', async () => {
  repo.count.mockResolvedValue(0);
  repo.create.mockReturnValue(mockOrder);
  repo.save.mockResolvedValue(mockOrder);

  await service.create({ userId: 1 } as Partial<Order>);

  expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'order_placed', orderRef: mockOrder.orderId }),
  );
});
```

**f)** Add new describe block for updateStatus notifications:
```typescript
describe('updateStatus notifications', () => {
  it('notifies admins when status becomes cancelled', async () => {
    repo.update.mockResolvedValue(undefined as any);
    repo.findOneOrFail.mockResolvedValue(mockOrder);

    await service.updateStatus(1, 'cancelled');

    expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order_cancelled', orderRef: mockOrder.orderId }),
    );
  });

  it('notifies admins when status becomes file_declined', async () => {
    repo.update.mockResolvedValue(undefined as any);
    repo.findOneOrFail.mockResolvedValue(mockOrder);

    await service.updateStatus(1, 'file_declined');

    expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order_declined', orderRef: mockOrder.orderId }),
    );
  });

  it('does NOT call createForAllAdmins for non-admin statuses', async () => {
    repo.update.mockResolvedValue(undefined as any);
    repo.findOneOrFail.mockResolvedValue(mockOrder);

    await service.updateStatus(1, 'printing_in_progress');

    expect(notificationsService.createForAllAdmins).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm run test -- --testPathPattern=orders.service
```
Expected: new notification tests FAIL, existing tests FAIL (missing DI provider)

- [ ] **Step 3: Wire `NotificationsService` into `OrdersService`**

In `server/src/orders/orders.service.ts`:

**a)** Add import:
```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

**b)** Add `private notificationsService: NotificationsService` to the constructor after `creditsService`:
```typescript
constructor(
  @InjectRepository(Order) private ordersRepo: Repository<Order>,
  @InjectRepository(PaperSpec) private paperSpecsRepo: Repository<PaperSpec>,
  @InjectRepository(ThreeDSpec) private threeDSpecsRepo: Repository<ThreeDSpec>,
  private ordersGateway: OrdersGateway,
  private firebaseService: FirebaseService,
  private usersService: UsersService,
  private creditsService: CreditsService,
  private notificationsService: NotificationsService,
) {}
```

**c)** In `create()`, after `void this.ordersGateway.notifyOrderUpdate(...)`:
```typescript
// Notify admins of new order
try {
  await this.notificationsService.createForAllAdmins({
    title: 'New Order Placed',
    message: `Order ${savedOrder.orderId} has been placed.`,
    type: 'order_placed',
    orderRef: savedOrder.orderId,
    metadata: {
      orderId: savedOrder.id,
      amount: Number(savedOrder.totalPrice ?? 0),
      category: savedOrder.category ?? null,
    },
  });
} catch (err) {
  this.logger.warn(`Admin notification failed for order ${savedOrder.orderId}: ${err}`);
}
```

**d)** In `updateStatus()`, after `void this.ordersGateway.notifyOrderUpdate(order.orderId, order)` and before `return order`:
```typescript
// Notify admins of cancellation / decline
if (
  status === OrderStatus.CANCELLED ||
  status === OrderStatus.FILE_DECLINED
) {
  const type =
    status === OrderStatus.CANCELLED ? 'order_cancelled' : 'order_declined';
  try {
    await this.notificationsService.createForAllAdmins({
      title: status === OrderStatus.CANCELLED ? 'Order Cancelled' : 'Order Declined',
      message: `Order ${order.orderId} was ${status === OrderStatus.CANCELLED ? 'cancelled' : 'declined'}.`,
      type,
      orderRef: order.orderId,
      metadata: { orderId: order.id, toStatus: status },
    });
  } catch (err) {
    this.logger.warn(`Admin notification failed for status ${status}: ${err}`);
  }
}
```

- [ ] **Step 4: Add `NotificationsModule` to `OrdersModule`**

In `server/src/orders/orders.module.ts`, add import:
```typescript
import { NotificationsModule } from '../notifications/notifications.module';
```

And add `NotificationsModule` to the imports array:
```typescript
imports: [
  TypeOrmModule.forFeature([Order, PaperSpec, ThreeDSpec, OrderStatusHistory]),
  JwtModule.registerAsync({ ... }),
  UsersModule,
  CreditsModule,
  NotificationsModule,   // ADD
],
```

- [ ] **Step 5: Run to confirm all pass**

```bash
npm run test -- --testPathPattern=orders.service
```
Expected: all tests PASS

---

### Task 9: Wire notifications into `CreditsService` (TDD)

**Files:**
- Create: `server/src/credits/credits.service.spec.ts`
- Modify: `server/src/credits/credits.service.ts`

(Note: `CreditsModule` already imports `NotificationsModule` — no module change needed.)

- [ ] **Step 1: Write the failing tests**

Create `server/src/credits/credits.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import {
  CreditTransaction,
  CreditTransactionStatus,
  CreditTransactionType,
} from './entities/credit-transaction.entity';
import { CreditSettings } from './entities/credit-settings.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';

describe('CreditsService', () => {
  let service: CreditsService;
  let txRepo: jest.Mocked<Partial<Repository<CreditTransaction>>>;
  let settingsRepo: jest.Mocked<Partial<Repository<CreditSettings>>>;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let notificationsService: jest.Mocked<Partial<NotificationsService>>;

  const mockUser = { id: 1, email: 'user@gridgo.ph', credits: 1000 } as User;
  const mockSettings = { id: 1, conversionRate: 1.0 } as CreditSettings;
  const mockTx = {
    id: 5,
    userId: 1,
    type: CreditTransactionType.TOP_UP,
    amountPhp: 500,
    amountCredits: 500,
    status: CreditTransactionStatus.PENDING,
  } as CreditTransaction;

  beforeEach(async () => {
    txRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    settingsRepo = {
      find: jest.fn().mockResolvedValue([mockSettings]),
      create: jest.fn(),
      save: jest.fn(),
    };
    usersService = {
      findById: jest.fn().mockResolvedValue(mockUser),
      updateProfile: jest.fn().mockResolvedValue(mockUser),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: getRepositoryToken(CreditTransaction), useValue: txRepo },
        { provide: getRepositoryToken(CreditSettings), useValue: settingsRepo },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(CreditsService);
  });

  describe('requestTopUp', () => {
    it('saves the transaction and notifies all admins', async () => {
      txRepo.create.mockReturnValue(mockTx);
      txRepo.save.mockResolvedValue(mockTx);

      const result = await service.requestTopUp(1, {
        amountPhp: 500,
        proofOfPaymentUrl: 'https://example.com/proof.jpg',
      });

      expect(txRepo.save).toHaveBeenCalled();
      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'topup_request' }),
      );
      expect(result).toEqual(mockTx);
    });
  });

  describe('rejectTopUp', () => {
    it('rejects the transaction AND notifies the customer', async () => {
      txRepo.findOne.mockResolvedValue({ ...mockTx });
      txRepo.save.mockResolvedValue({
        ...mockTx,
        status: CreditTransactionStatus.REJECTED,
      });

      await service.rejectTopUp(5);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTx.userId,
          type: 'topup_rejected',
        }),
      );
    });

    it('throws NotFoundException when transaction does not exist', async () => {
      txRepo.findOne.mockResolvedValue(null);

      await expect(service.rejectTopUp(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveTopUp', () => {
    it('approves and notifies the customer', async () => {
      txRepo.findOne.mockResolvedValue({ ...mockTx });
      txRepo.save.mockResolvedValue({
        ...mockTx,
        status: CreditTransactionStatus.APPROVED,
      });

      await service.approveTopUp(5);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockTx.userId, type: 'credit' }),
      );
    });

    it('throws BadRequestException when transaction is not pending', async () => {
      txRepo.findOne.mockResolvedValue({
        ...mockTx,
        status: CreditTransactionStatus.APPROVED,
      });

      await expect(service.approveTopUp(5)).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm run test -- --testPathPattern=credits.service
```
Expected: FAIL — `requestTopUp` test fails (no admin notify), `rejectTopUp` test fails (no customer notify)

- [ ] **Step 3: Wire notifications into `CreditsService`**

In `server/src/credits/credits.service.ts`:

**a)** In `requestTopUp()`, after `return this.transactionRepo.save(tx)`, add admin notification. Replace the method with:

```typescript
async requestTopUp(
  userId: number,
  dto: RequestTopUpDto,
): Promise<CreditTransaction> {
  const settings = await this.getSettings();
  const amountCredits = dto.amountPhp * settings.conversionRate;

  const tx = this.transactionRepo.create({
    userId,
    type: CreditTransactionType.TOP_UP,
    amountPhp: dto.amountPhp,
    amountCredits,
    status: CreditTransactionStatus.PENDING,
    proofOfPaymentUrl: dto.proofOfPaymentUrl,
  });

  const saved = await this.transactionRepo.save(tx);

  try {
    const user = await this.usersService.findById(userId);
    await this.notificationsService.createForAllAdmins({
      title: 'Top-Up Request Received',
      message: `${user?.email ?? 'A user'} requested ₱${dto.amountPhp} top-up.`,
      type: 'topup_request',
      metadata: {
        transactionId: saved.id,
        amountPhp: dto.amountPhp,
        userEmail: user?.email ?? null,
      },
    });
  } catch {
    // notification failure must not break the request flow
  }

  return saved;
}
```

**b)** In `rejectTopUp()`, after `return this.transactionRepo.save(tx)`, add customer notification. Replace the method with:

```typescript
async rejectTopUp(transactionId: number): Promise<CreditTransaction> {
  const tx = await this.transactionRepo.findOne({
    where: { id: transactionId },
  });
  if (!tx) throw new NotFoundException('Transaction not found');

  tx.status = CreditTransactionStatus.REJECTED;
  const saved = await this.transactionRepo.save(tx);

  try {
    await this.notificationsService.create({
      userId: tx.userId,
      title: 'Top-Up Rejected',
      message: `Your top-up request of ${tx.amountCredits} Credits was rejected.`,
      type: 'topup_rejected',
    });
  } catch {
    // notification failure must not break the reject flow
  }

  return saved;
}
```

- [ ] **Step 4: Run to confirm all pass**

```bash
npm run test -- --testPathPattern=credits.service
```
Expected: all tests PASS

---

### Task 10: Wire notifications into `AuthService` (TDD)

**Files:**
- Modify: `server/src/auth/auth.service.spec.ts`
- Modify: `server/src/auth/auth.service.ts`
- Modify: `server/src/auth/auth.module.ts`

- [ ] **Step 1: Write failing test**

In `server/src/auth/auth.service.spec.ts`:

**a)** Add import:
```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

**b)** Add variable and mock:
```typescript
let notificationsService: Partial<NotificationsService>;

// in beforeEach, before module setup:
notificationsService = {
  createForAllAdmins: jest.fn().mockResolvedValue(undefined),
};
```

**c)** Add to test module providers:
```typescript
{ provide: NotificationsService, useValue: notificationsService },
```

**d)** Add test case inside `describe('register', ...)`:
```typescript
it('fires createForAllAdmins with new_user type after registering', async () => {
  (usersService.create as jest.Mock).mockResolvedValue(mockUser);

  await authService.register('test@example.com', 'password123');

  expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'new_user',
      metadata: expect.objectContaining({ userId: mockUser.id, email: mockUser.email }),
    }),
  );
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm run test -- --testPathPattern=auth.service
```
Expected: new test FAIL, existing tests FAIL (missing DI provider)

- [ ] **Step 3: Wire into `AuthService`**

In `server/src/auth/auth.service.ts`, replace the file:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  async register(email: string, password: string) {
    const user = await this.usersService.create(email, password);

    try {
      await this.notificationsService.createForAllAdmins({
        title: 'New User Registered',
        message: `${email} just signed up.`,
        type: 'new_user',
        metadata: { userId: user.id, email: user.email },
      });
    } catch {
      // notification failure must not break registration
    }

    const { passwordHash: _ph1, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _ph2, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
```

**Step 4: Add `NotificationsModule` to `AuthModule`**

In `server/src/auth/auth.module.ts`, add:
```typescript
import { NotificationsModule } from '../notifications/notifications.module';

// in imports array:
imports: [UsersModule, PassportModule, JwtModule.registerAsync({...}), NotificationsModule],
```

- [ ] **Step 5: Run to confirm all pass**

```bash
npm run test -- --testPathPattern=auth.service
```
Expected: all tests PASS

- [ ] **Step 6: Run the full server test suite**

```bash
cd server && npm run test
```
Expected: all existing tests plus all new tests pass. Note: pre-existing TypeORM mock typing warnings in some spec files are expected and unrelated to this feature.

---

## Phase 2 — Admin Frontend

---

### Task 11: Install admin testing dependencies

**Files:** (no source files — dev deps only)

- [ ] **Step 1: Install packages**

```bash
cd admin
npm install --save-dev happy-dom @testing-library/react @testing-library/user-event
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
npm test
```
Expected: all existing tests PASS

---

### Task 12: `types/notification.ts`

**Files:**
- Create: `admin/src/types/notification.ts`

- [ ] **Step 1: Create the types file**

Create `admin/src/types/notification.ts`:

```typescript
export type NotificationType =
  | 'order_placed'
  | 'order_cancelled'
  | 'order_declined'
  | 'topup_request'
  | 'topup_approved'
  | 'topup_rejected'
  | 'new_user'
  | 'status_change';

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  orderRef: string | null;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface BadgeCounts {
  newOrders: number;
  pendingTopUps: number;
}
```

---

### Task 13: `providers/notification-ws.ts` (TDD)

**Files:**
- Create: `admin/src/providers/notification-ws.test.ts`
- Create: `admin/src/providers/notification-ws.ts`

- [ ] **Step 1: Write failing tests**

Create `admin/src/providers/notification-ws.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Socket.IO mock ─────────────────────────────────────────────────
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
const mockSocket = {
  connected: false,
  on: mockOn,
  disconnect: mockDisconnect,
};
const mockIo = vi.fn(() => mockSocket);

vi.mock("socket.io-client", () => ({ io: mockIo }));

// ── localStorage mock ──────────────────────────────────────────────
vi.stubGlobal("localStorage", {
  getItem: vi.fn().mockReturnValue("test-jwt-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

// ── Helper ─────────────────────────────────────────────────────────
function fireSocketEvent(event: string, data: unknown) {
  const call = mockOn.mock.calls.find(([e]) => e === event);
  if (!call) throw new Error(`No listener registered for "${event}"`);
  call[1](data);
}

// ── Tests ──────────────────────────────────────────────────────────
describe("notification-ws", () => {
  beforeEach(() => {
    vi.resetModules();
    mockIo.mockClear();
    mockOn.mockClear();
    mockDisconnect.mockClear();
    mockSocket.connected = false;
  });

  it("connects to /ws/notifications with JWT in auth", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    subscribeToNotifications(() => {});

    expect(mockIo).toHaveBeenCalledOnce();
    const [url, opts] = mockIo.mock.calls[0];
    expect(url).toContain("/ws/notifications");
    expect(opts).toMatchObject({ auth: { token: "test-jwt-token" } });

    disconnectNotifications();
  });

  it("does not connect when localStorage has no token", async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    subscribeToNotifications(() => {});

    expect(mockIo).not.toHaveBeenCalled();
    disconnectNotifications();
  });

  it("callback fires when newNotification event is received", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    const cb = vi.fn();
    subscribeToNotifications(cb);

    const notif = { id: 1, title: "New Order", type: "order_placed" };
    fireSocketEvent("newNotification", notif);

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(notif);

    disconnectNotifications();
  });

  it("unsubscribe removes callback so it no longer fires", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    const cb = vi.fn();
    const unsubscribe = subscribeToNotifications(cb);
    unsubscribe();

    fireSocketEvent("newNotification", { id: 1 });

    expect(cb).not.toHaveBeenCalled();
    disconnectNotifications();
  });

  it("disconnect calls socket.disconnect and clears listeners", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    const cb = vi.fn();
    subscribeToNotifications(cb);
    disconnectNotifications();

    expect(mockDisconnect).toHaveBeenCalledOnce();
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not create duplicate sockets when already connected", async () => {
    mockSocket.connected = true;
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    subscribeToNotifications(() => {});
    subscribeToNotifications(() => {});

    expect(mockIo).toHaveBeenCalledOnce();
    disconnectNotifications();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- notification-ws
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement the WS provider**

Create `admin/src/providers/notification-ws.ts`:

```typescript
import { io, Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";
import type { Notification } from "@/types/notification";

type NotificationCallback = (notif: Notification) => void;

let socket: Socket | null = null;
const listeners = new Set<NotificationCallback>();

function connectNotifications(): void {
  if (socket?.connected) return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  socket = io(`${WS_URL}/ws/notifications`, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("newNotification", (notif: Notification) => {
    listeners.forEach((cb) => cb(notif));
  });

  socket.on("disconnect", () => {
    // auto-reconnects via reconnection: true
  });
}

export function disconnectNotifications(): void {
  socket?.disconnect();
  socket = null;
  listeners.clear();
}

export function subscribeToNotifications(
  cb: NotificationCallback,
): () => void {
  connectNotifications();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
```

- [ ] **Step 4: Run to confirm all pass**

```bash
npm test -- notification-ws
```
Expected: 6 tests PASS

---

### Task 14: `context/notifications-context.tsx` (TDD)

**Files:**
- Create: `admin/src/context/notifications-context.test.tsx`
- Create: `admin/src/context/notifications-context.tsx`

- [ ] **Step 1: Write failing tests**

Create `admin/src/context/notifications-context.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import {
  NotificationsProvider,
  useNotificationsContext,
} from "@/context/notifications-context";
import type { Notification, BadgeCounts } from "@/types/notification";

// ── Mocks ──────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockPatch = vi.fn();
vi.mock("@/providers/api-client", () => ({
  apiClient: { get: mockGet, patch: mockPatch },
}));

let notifCallback: ((n: Notification) => void) | null = null;
const mockUnsubscribe = vi.fn();
vi.mock("@/providers/notification-ws", () => ({
  subscribeToNotifications: vi.fn((cb) => {
    notifCallback = cb;
    return mockUnsubscribe;
  }),
}));

// ── Fixtures ───────────────────────────────────────────────────────
const notif1: Notification = {
  id: 1,
  userId: 10,
  title: "New Order",
  message: "ORD-10042 placed",
  type: "order_placed",
  orderRef: "ORD-10042",
  isRead: false,
  metadata: null,
  createdAt: new Date().toISOString(),
};

const badgeCounts: BadgeCounts = { newOrders: 2, pendingTopUps: 1 };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

// ── Tests ──────────────────────────────────────────────────────────
describe("NotificationsContext", () => {
  beforeEach(() => {
    notifCallback = null;
    mockGet.mockReset();
    mockPatch.mockReset();
    mockUnsubscribe.mockReset();

    mockGet.mockImplementation((url: string) => {
      if (url === "/notifications") return Promise.resolve({ data: [notif1] });
      if (url === "/notifications/unread-count") return Promise.resolve({ data: 1 });
      if (url === "/admin/badge-counts") return Promise.resolve({ data: badgeCounts });
      return Promise.resolve({ data: null });
    });
    mockPatch.mockResolvedValue({ data: { ...notif1, isRead: true } });
  });

  it("loads notifications, unreadCount and badgeCounts on mount", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    expect(result.current.notifications[0].id).toBe(1);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.badgeCounts.newOrders).toBe(2);
  });

  it("prepends new WS notification and increments unreadCount", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    const newNotif: Notification = {
      ...notif1,
      id: 99,
      title: "Another Order",
    };

    act(() => {
      notifCallback!(newNotif);
    });

    expect(result.current.notifications[0].id).toBe(99);
    expect(result.current.unreadCount).toBe(2);
  });

  it("refreshes badgeCounts when a WS notification arrives", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    const updatedBadges: BadgeCounts = { newOrders: 5, pendingTopUps: 3 };
    mockGet.mockImplementation((url: string) => {
      if (url === "/admin/badge-counts")
        return Promise.resolve({ data: updatedBadges });
      return Promise.resolve({ data: [] });
    });

    act(() => {
      notifCallback!(notif1);
    });

    await waitFor(() => {
      expect(result.current.badgeCounts.newOrders).toBe(5);
    });
  });

  it("markRead patches the endpoint and updates local state", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.markRead(1);
    });

    expect(mockPatch).toHaveBeenCalledWith("/notifications/1/read");
    expect(result.current.notifications[0].isRead).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("markAllRead patches the endpoint and sets unreadCount to 0", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockPatch).toHaveBeenCalledWith("/notifications/read-all");
    expect(result.current.unreadCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- notifications-context
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement the context**

Create `admin/src/context/notifications-context.tsx`:

```typescript
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { apiClient } from "@/providers/api-client";
import { subscribeToNotifications } from "@/providers/notification-ws";
import type { Notification, BadgeCounts } from "@/types/notification";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  badgeCounts: BadgeCounts;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshBadges: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
    newOrders: 0,
    pendingTopUps: 0,
  });

  const refreshBadges = useCallback(async () => {
    const res = await apiClient.get<BadgeCounts>("/admin/badge-counts");
    setBadgeCounts(res.data);
  }, []);

  // Initial fetch
  useEffect(() => {
    apiClient
      .get<Notification[]>("/notifications")
      .then((res) => setNotifications(res.data));

    apiClient
      .get<number>("/notifications/unread-count")
      .then((res) => setUnreadCount(res.data));

    refreshBadges();
  }, [refreshBadges]);

  // WS subscription
  useEffect(() => {
    const unsub = subscribeToNotifications((notif) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
      setUnreadCount((n) => n + 1);
      refreshBadges();
    });
    return unsub;
  }, [refreshBadges]);

  const markRead = useCallback(async (id: number) => {
    await apiClient.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((n) => Math.max(0, n - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiClient.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        badgeCounts,
        markRead,
        markAllRead,
        refreshBadges,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx)
    throw new Error(
      "useNotificationsContext must be used within NotificationsProvider",
    );
  return ctx;
}
```

- [ ] **Step 4: Run to confirm all pass**

```bash
npm test -- notifications-context
```
Expected: 5 tests PASS

---

### Task 15: `components/notification-bell.tsx` (TDD)

**Files:**
- Create: `admin/src/components/notification-bell.test.tsx`
- Create: `admin/src/components/notification-bell.tsx`

- [ ] **Step 1: Write failing tests**

Create `admin/src/components/notification-bell.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { NotificationBell } from "@/components/notification-bell";
import type { Notification } from "@/types/notification";

// ── Mock context ───────────────────────────────────────────────────
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/context/notifications-context", () => ({
  useNotificationsContext: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { useNotificationsContext } from "@/context/notifications-context";

const makeNotif = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  userId: 10,
  title: "New Order Placed",
  message: "ORD-10042 received",
  type: "order_placed",
  orderRef: "ORD-10042",
  isRead: false,
  metadata: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

function setupContext(overrides: object = {}) {
  (useNotificationsContext as ReturnType<typeof vi.fn>).mockReturnValue({
    notifications: [makeNotif()],
    unreadCount: 1,
    badgeCounts: { newOrders: 0, pendingTopUps: 0 },
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
    refreshBadges: vi.fn(),
    ...overrides,
  });
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mockMarkRead.mockReset();
    mockMarkAllRead.mockReset();
    mockNavigate.mockReset();
    setupContext();
  });

  it("shows unreadCount as badge on the bell", () => {
    render(<NotificationBell />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows dot (overflow) badge when unreadCount > 99", () => {
    setupContext({ unreadCount: 100 });
    render(<NotificationBell />);
    // Ant Design renders overflow as "99+" text or dot — check for the overflow indicator
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });

  it("shows empty state when no notifications", () => {
    setupContext({ notifications: [], unreadCount: 0 });
    const { container } = render(<NotificationBell />);
    // Open dropdown by clicking bell
    const bell = container.querySelector("[data-testid='notification-bell']")!;
    fireEvent.click(bell);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("calls markRead when a notification row is clicked", async () => {
    const { container } = render(<NotificationBell />);
    const bell = container.querySelector("[data-testid='notification-bell']")!;
    fireEvent.click(bell);

    const notifRow = await screen.findByText("New Order Placed");
    fireEvent.click(notifRow);

    expect(mockMarkRead).toHaveBeenCalledWith(1);
  });

  it("calls markAllRead when Mark all is clicked", async () => {
    const { container } = render(<NotificationBell />);
    const bell = container.querySelector("[data-testid='notification-bell']")!;
    fireEvent.click(bell);

    const markAll = await screen.findByText(/mark all/i);
    fireEvent.click(markAll);

    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it("navigates to /notifications when View all is clicked", async () => {
    const { container } = render(<NotificationBell />);
    const bell = container.querySelector("[data-testid='notification-bell']")!;
    fireEvent.click(bell);

    const viewAll = await screen.findByText(/view all/i);
    fireEvent.click(viewAll);

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- notification-bell
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement the bell component**

Create `admin/src/components/notification-bell.tsx`:

```typescript
import { Badge, Button, Dropdown, Typography, theme } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useNotificationsContext } from "@/context/notifications-context";
import type { Notification } from "@/types/notification";

const { Text } = Typography;

const TYPE_ICON: Record<string, string> = {
  order_placed: "🛒",
  order_cancelled: "🛒",
  order_declined: "🛒",
  topup_request: "💳",
  topup_approved: "💳",
  topup_rejected: "💳",
  new_user: "👤",
  status_change: "🔄",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function NotificationBell() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationsContext();

  const latest = notifications.slice(0, 10);

  const dropdownContent = (
    <div
      style={{
        width: 340,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
        }}
      >
        <Text strong>Notifications</Text>
        <Button type="link" size="small" onClick={() => markAllRead()}>
          Mark all ✓
        </Button>
      </div>

      {/* Items */}
      {latest.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: token.colorTextSecondary,
          }}
        >
          <BellOutlined style={{ fontSize: 24, marginBottom: 8, display: "block" }} />
          You're all caught up
        </div>
      ) : (
        latest.map((n: Notification) => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              borderLeft: n.isRead ? "none" : `3px solid ${token.colorPrimary}`,
              background: n.isRead ? "transparent" : token.colorFillAlter,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span>{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: n.isRead ? 400 : 600,
                    display: "block",
                  }}
                >
                  {n.title}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: token.colorTextSecondary,
                  }}
                >
                  {n.orderRef ? `${n.orderRef} · ` : ""}
                  {timeAgo(n.createdAt)}
                </Text>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Footer */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: `1px solid ${token.colorBorder}`,
          textAlign: "center",
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={() => navigate("/notifications")}
        >
          View all notifications →
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      trigger={["click"]}
      placement="bottomRight"
    >
      <Badge
        count={unreadCount}
        overflowCount={99}
        style={{ cursor: "pointer" }}
      >
        <BellOutlined
          data-testid="notification-bell"
          style={{ fontSize: 18, cursor: "pointer" }}
        />
      </Badge>
    </Dropdown>
  );
}
```

- [ ] **Step 4: Run to confirm all pass**

```bash
npm test -- notification-bell
```
Expected: 6 tests PASS

---

### Task 16: `components/grid-sider.tsx` (TDD)

**Files:**
- Create: `admin/src/components/grid-sider.test.tsx`
- Create: `admin/src/components/grid-sider.tsx`

- [ ] **Step 1: Write failing tests**

Create `admin/src/components/grid-sider.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { GridSider } from "@/components/grid-sider";

// ── Mocks ──────────────────────────────────────────────────────────
vi.mock("@refinedev/core", () => ({
  useMenu: vi.fn(),
  useNavigation: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

vi.mock("@refinedev/antd", () => ({
  ThemedTitleV2: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock("@/context/notifications-context", () => ({
  useNotificationsContext: vi.fn(),
}));

vi.mock("@/components/grid-logo", () => ({
  GridLogo: () => <svg />,
}));

import { useMenu } from "@refinedev/core";
import { useNotificationsContext } from "@/context/notifications-context";

const menuItems = [
  { key: "/orders", name: "admin/orders", label: "Orders", icon: null, list: "/orders" },
  {
    key: "/credit-requests",
    name: "credit-requests",
    label: "Top-Up Requests",
    icon: null,
    list: "/credit-requests",
  },
  { key: "/riders", name: "riders", label: "Riders", icon: null, list: "/riders" },
];

function setupMocks(
  badgeCounts = { newOrders: 3, pendingTopUps: 1 },
  collapsed = false,
) {
  (useMenu as ReturnType<typeof vi.fn>).mockReturnValue({
    menuItems,
    selectedKey: "/orders",
  });
  (useNotificationsContext as ReturnType<typeof vi.fn>).mockReturnValue({
    badgeCounts,
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    refreshBadges: vi.fn(),
  });
}

describe("GridSider", () => {
  beforeEach(() => {
    setupMocks();
  });

  it("shows Orders badge when newOrders > 0", () => {
    render(<GridSider />);
    // Badge pill renders the count
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does NOT show Orders badge when newOrders = 0", () => {
    setupMocks({ newOrders: 0, pendingTopUps: 0 });
    render(<GridSider />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows Top-Up Requests badge with correct count", () => {
    render(<GridSider />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("hides badge pills when sidebar is collapsed", () => {
    render(<GridSider initialCollapsed={true} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- grid-sider
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement GridSider**

Create `admin/src/components/grid-sider.tsx`:

```typescript
import { useState } from "react";
import { useMenu, useNavigation } from "@refinedev/core";
import { ThemedTitleV2 } from "@refinedev/antd";
import { Layout, Menu, Tag, theme } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useNotificationsContext } from "@/context/notifications-context";
import { GridLogo } from "@/components/grid-logo";
import type { BadgeCounts } from "@/types/notification";

const BADGE_MAP: Partial<Record<string, keyof BadgeCounts>> = {
  "admin/orders": "newOrders",
  "credit-requests": "pendingTopUps",
};

interface GridSiderProps {
  initialCollapsed?: boolean;
}

export function GridSider({ initialCollapsed = false }: GridSiderProps) {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const { menuItems, selectedKey } = useMenu();
  const { push } = useNavigation();
  const { badgeCounts } = useNotificationsContext();

  const items = menuItems.map((item) => {
    const badgeKey = BADGE_MAP[item.name];
    const count = badgeKey ? badgeCounts[badgeKey] : 0;

    return {
      key: item.key,
      icon: item.icon,
      label:
        !collapsed && count > 0 ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{item.label}</span>
            <Tag
              style={{
                backgroundColor: "#FFDE58",
                color: "#141414",
                border: "none",
                marginLeft: 8,
                fontSize: 11,
                padding: "0 6px",
                lineHeight: "18px",
                minWidth: 22,
                textAlign: "center",
                borderRadius: 9,
              }}
            >
              {count}
            </Tag>
          </span>
        ) : (
          item.label
        ),
      onClick: () => push(item.list ?? "/"),
    };
  });

  return (
    <Layout.Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      collapsedWidth={80}
      trigger={
        collapsed ? (
          <MenuUnfoldOutlined />
        ) : (
          <MenuFoldOutlined />
        )
      }
      style={{
        background: token.colorBgElevated,
        borderRight: `1px solid ${token.colorBorder}`,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "auto",
      }}
    >
      <div style={{ padding: collapsed ? "16px 8px" : "16px" }}>
        <ThemedTitleV2
          collapsed={collapsed}
          text="GRIDGO Admin"
          icon={<GridLogo size={collapsed ? 28 : 24} />}
        />
      </div>
      <Menu
        selectedKeys={[selectedKey]}
        mode="inline"
        items={items}
        style={{
          background: "transparent",
          border: "none",
        }}
      />
    </Layout.Sider>
  );
}
```

- [ ] **Step 4: Run to confirm all pass**

```bash
npm test -- grid-sider
```
Expected: 4 tests PASS

---

### Task 17: `pages/notifications/index.tsx`

**Files:**
- Create: `admin/src/pages/notifications/index.tsx`

- [ ] **Step 1: Create the notifications page**

```bash
mkdir -p admin/src/pages/notifications
```

Create `admin/src/pages/notifications/index.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Button,
  Tabs,
  List,
  Tag,
  theme,
  Empty,
  App,
} from "antd";
import { useNotificationsContext } from "@/context/notifications-context";
import type { Notification, NotificationType } from "@/types/notification";

const { Title, Text } = Typography;

const TYPE_ICON: Record<string, string> = {
  order_placed: "🛒",
  order_cancelled: "🛒",
  order_declined: "🛒",
  topup_request: "💳",
  topup_approved: "💳",
  topup_rejected: "💳",
  new_user: "👤",
  status_change: "🔄",
};

const CATEGORY_TYPES: Record<string, NotificationType[]> = {
  orders: ["order_placed", "order_cancelled", "order_declined", "status_change"],
  credits: ["topup_request", "topup_approved", "topup_rejected"],
  users: ["new_user"],
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function NotificationsPage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationsContext();
  const [activeTab, setActiveTab] = useState("all");

  // Mark all read after 1s on page visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (unreadCount > 0) markAllRead();
    }, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered =
    activeTab === "all"
      ? notifications
      : activeTab === "unread"
        ? notifications.filter((n) => !n.isRead)
        : notifications.filter((n) =>
            CATEGORY_TYPES[activeTab]?.includes(n.type),
          );

  const handleClick = (n: Notification) => {
    markRead(n.id);
    if (n.orderRef) {
      // Navigate to order — look up id via orderRef
      // The order show page is /orders/show/:id but we only have orderId string.
      // Navigate to orders list as fallback; deepen when order lookup API is available.
      navigate("/orders");
    } else if (
      n.type === "topup_request" ||
      n.type === "topup_approved" ||
      n.type === "topup_rejected"
    ) {
      navigate("/credit-requests");
    }
  };

  const tabItems = [
    { key: "all", label: "All" },
    { key: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { key: "orders", label: "Orders" },
    { key: "credits", label: "Credits" },
    { key: "users", label: "Users" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Notifications
        </Title>
        <Button onClick={() => markAllRead()}>Mark all as read</Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginBottom: 0 }}
      />

      {filtered.length === 0 ? (
        <Empty description="No notifications" style={{ marginTop: 48 }} />
      ) : (
        <List
          dataSource={filtered}
          renderItem={(n) => (
            <List.Item
              onClick={() => handleClick(n)}
              style={{
                cursor: "pointer",
                padding: "12px 16px",
                borderLeft: n.isRead
                  ? "none"
                  : `3px solid ${token.colorPrimary}`,
                background: n.isRead ? "transparent" : token.colorFillAlter,
                marginBottom: 1,
              }}
            >
              <List.Item.Meta
                avatar={
                  <span style={{ fontSize: 20 }}>
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                }
                title={
                  <Text strong={!n.isRead} style={{ fontSize: 14 }}>
                    {n.title}
                  </Text>
                }
                description={
                  <Text style={{ fontSize: 13, color: token.colorTextSecondary }}>
                    {n.message}
                  </Text>
                }
              />
              <Text
                style={{
                  fontSize: 12,
                  color: token.colorTextTertiary,
                  whiteSpace: "nowrap",
                  marginLeft: 12,
                }}
              >
                {timeAgo(n.createdAt)}
              </Text>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
```

---

### Task 18: Update `components/header.tsx`

**Files:**
- Modify: `admin/src/components/header.tsx`

- [ ] **Step 1: Add `NotificationBell` left of the avatar**

Replace `admin/src/components/header.tsx`:

```typescript
import { useGetIdentity, useLogout } from "@refinedev/core";
import {
  Layout,
  Avatar,
  Dropdown,
  Typography,
  Space,
  App,
  theme,
} from "antd";
import { LogoutOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { NotificationBell } from "@/components/notification-bell";

const { Text } = Typography;

export function CustomHeader() {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const { data: identity } = useGetIdentity<{ name: string; email: string }>();
  const { mutate: logout } = useLogout();

  const handleLogout = () => {
    modal.confirm({
      title: "Sign Out",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to sign out?",
      okText: "Sign Out",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => logout(),
    });
  };

  const menuItems = [
    {
      key: "info",
      label: (
        <div style={{ padding: "4px 0" }}>
          <Text strong style={{ color: token.colorText, display: "block" }}>
            {identity?.name ?? "Admin"}
          </Text>
          <Text style={{ color: token.colorTextSecondary, fontSize: 12 }}>
            {identity?.email ?? ""}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" as const },
    {
      key: "logout",
      label: "Sign Out",
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout.Header
      style={{
        backgroundColor: token.colorBgElevated,
        borderBottom: `1px solid ${token.colorBorder}`,
        padding: "0px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 20,
        height: "64px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <NotificationBell />

      <Dropdown
        menu={{ items: menuItems }}
        trigger={["click"]}
        placement="bottomRight"
      >
        <Space style={{ cursor: "pointer" }}>
          <Avatar
            size={32}
            style={{
              background: "#FFDE58",
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {identity?.name?.charAt(0)?.toUpperCase() ?? "A"}
          </Avatar>
          <Text style={{ color: token.colorText, fontSize: 13 }}>
            {identity?.name ?? "Admin"}
          </Text>
        </Space>
      </Dropdown>
    </Layout.Header>
  );
}
```

---

### Task 19: Update `providers/auth-provider.ts`

**Files:**
- Modify: `admin/src/providers/auth-provider.ts`

- [ ] **Step 1: Add `disconnectNotifications()` to logout**

In `admin/src/providers/auth-provider.ts`, find the `logout` function and add `disconnectNotifications()` alongside `disconnectLive()`. First add the import:

```typescript
import { disconnectNotifications } from "@/providers/notification-ws";
```

Then in the `logout` function body, add:
```typescript
disconnectNotifications();
```

The `logout` section should look like:
```typescript
logout: async () => {
  localStorage.removeItem(TOKEN_KEY);
  disconnectLive();
  disconnectNotifications();    // ADD
  return { success: true, redirectTo: "/login" };
},
```

- [ ] **Step 2: Run existing tests to confirm no regression**

```bash
npm test
```
Expected: all existing tests PASS

---

### Task 20: Update `App.tsx`

**Files:**
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Wire NotificationsProvider, GridSider, and the new route**

Replace `admin/src/App.tsx`:

```typescript
import { Refine, Authenticated } from "@refinedev/core";
import {
  ThemedLayoutV2,
  useNotificationProvider,
  ErrorComponent,
} from "@refinedev/antd";
import routerProvider, {
  CatchAllNavigate,
  NavigateToResource,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router-v6";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import {
  ShoppingCartOutlined,
  DashboardOutlined,
  CarOutlined,
  TeamOutlined,
  ShoppingOutlined,
  WalletOutlined,
  BellOutlined,
} from "@ant-design/icons";

import { gridTheme } from "@/config/theme";
import { authProvider } from "@/providers/auth-provider";
import { gridDataProvider } from "@/providers/data-provider";
import { GridLogo } from "@/components/grid-logo";
import { CustomHeader } from "@/components/header";
import { GridSider } from "@/components/grid-sider";
import { NotificationsProvider } from "@/context/notifications-context";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { OrderList } from "@/pages/orders/list";
import { OrderShow } from "@/pages/orders/show";
import { RiderList } from "@/pages/riders/list";
import { UserList } from "@/pages/users/list";
import { ProductList } from "@/pages/products/list";
import { ProductOptionsPage } from "@/pages/products/options";
import { AddonList } from "@/pages/products-addons/list";
import { CreditRequestsPage } from "@/pages/credit-requests";
import { NotificationsPage } from "@/pages/notifications";

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={gridTheme}>
        <AntdApp>
          <Refine
            dataProvider={gridDataProvider}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              {
                name: "dashboard",
                list: "/",
                meta: { label: "Dashboard", icon: <DashboardOutlined /> },
              },
              {
                name: "admin/orders",
                list: "/orders",
                show: "/orders/show/:id",
                meta: { label: "Orders", icon: <ShoppingCartOutlined /> },
              },
              {
                name: "riders",
                list: "/riders",
                meta: { label: "Riders", icon: <CarOutlined /> },
              },
              {
                name: "users",
                list: "/users",
                meta: { label: "Users", icon: <TeamOutlined /> },
              },
              {
                name: "credit-requests",
                list: "/credit-requests",
                meta: { label: "Top-Up Requests", icon: <WalletOutlined /> },
              },
              {
                name: "products",
                meta: { label: "Products", icon: <ShoppingOutlined /> },
              },
              {
                name: "products-categories",
                list: "/products",
                meta: { label: "Categories", parent: "products" },
              },
              {
                name: "products-addons",
                list: "/products-addons",
                meta: { label: "Addons", parent: "products" },
              },
              {
                name: "notifications",
                list: "/notifications",
                meta: { label: "Notifications", icon: <BellOutlined /> },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              title: {
                text: "GRIDGO Admin",
                icon: <GridLogo size={24} />,
              },
            }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated
                    key="auth-layout"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <NotificationsProvider>
                      <ThemedLayoutV2
                        Header={() => <CustomHeader />}
                        Sider={() => <GridSider />}
                      >
                        <Outlet />
                      </ThemedLayoutV2>
                    </NotificationsProvider>
                  </Authenticated>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/orders">
                  <Route index element={<OrderList />} />
                  <Route path="show/:id" element={<OrderShow />} />
                </Route>
                <Route path="/riders" element={<RiderList />} />
                <Route path="/users" element={<UserList />} />
                <Route path="/products">
                  <Route index element={<ProductList />} />
                  <Route path=":id/options" element={<ProductOptionsPage />} />
                </Route>
                <Route path="/products-addons" element={<AddonList />} />
                <Route path="/credit-requests" element={<CreditRequestsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>

              <Route
                element={
                  <Authenticated
                    key="auth-login"
                    fallback={<Outlet />}
                  >
                    <NavigateToResource resource="dashboard" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route path="*" element={<ErrorComponent />} />
            </Routes>

            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 2: Run the full admin test suite**

```bash
cd admin && npm test
```
Expected: all tests PASS (notification-ws, notifications-context, notification-bell, grid-sider, plus all pre-existing tests)

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Bell icon in header left of avatar | Task 18 |
| Unread badge + dropdown (last 10) | Task 15 |
| "Mark all ✓" in dropdown | Task 15 |
| "View all notifications →" footer | Task 15 |
| Full `/notifications` page with filter tabs | Task 17 |
| Mark-as-read on click | Tasks 14, 17 |
| Mark all read on page visit (1s delay) | Task 17 |
| Sidebar live count pills for Orders | Task 16 |
| Sidebar live count pills for Top-Up Requests | Task 16 |
| Badges hidden when count = 0 or collapsed | Task 16 |
| `NotificationsGateway` `/ws/notifications` | Task 3 |
| JWT auth, admin_notifications room | Task 3 |
| `createForAllAdmins()` batch insert | Task 4 |
| `broadcastToAdmins()` WS emit | Task 3, 4 |
| `metadata` jsonb column | Task 1 |
| `GET /admin/badge-counts` | Task 6 |
| `order_placed` admin notification | Task 8 |
| `order_cancelled` admin notification | Task 8 |
| `order_declined` admin notification | Task 8 |
| `topup_request` admin notification | Task 9 |
| `rejectTopUp` customer notification fix | Task 9 |
| `new_user` admin notification | Task 10 |
| `notification-ws` singleton | Task 13 |
| `NotificationsContext` REST+WS state | Task 14 |
| `disconnectNotifications()` on logout | Task 19 |
| `NotificationsProvider` in auth layout | Task 20 |
| `GridSider` replaces ThemedSiderV2 | Task 20 |
| Notifications resource + route | Task 20 |
| Error safety: try/catch on all callers | Tasks 8, 9, 10 |
