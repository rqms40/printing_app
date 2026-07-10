import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OrdersGateway } from './orders.gateway';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';

const makeClient = (
  token?: string,
): jest.Mocked<Pick<Socket, 'join' | 'disconnect'>> & {
  handshake: { auth: Record<string, unknown> };
} => ({
  handshake: { auth: token ? { token } : {} },
  data: {},
  join: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
});

describe('OrdersGateway', () => {
  let gateway: OrdersGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let usersService: { findSocketIdentity: jest.Mock };
  let realtimeSessions: { register: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    usersService = {
      findSocketIdentity: jest.fn().mockImplementation(async (id: number) => ({
        id,
        role: UserRole.CUSTOMER,
        isActive: true,
      })),
    };
    realtimeSessions = { register: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
        { provide: RealtimeSessionRegistry, useValue: realtimeSessions },
      ],
    }).compile();

    gateway = module.get<OrdersGateway>(OrdersGateway);
  });

  // ── handleConnection ──────────────────────────────────────────────

  describe('handleConnection', () => {
    it('joins admin_orders room when JWT has role=admin', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 1,
        role: UserRole.ADMIN,
        isActive: true,
      });
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 1,
        role: 'admin',
      });
      const client = makeClient('valid-admin-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-admin-token');
      expect(client.join).toHaveBeenCalledWith('admin_orders');
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(realtimeSessions.register).toHaveBeenCalledWith(1, client);
    });

    it('joins the authenticated user room for non-admin JWTs', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 2,
        role: 'customer',
      });
      const client = makeClient('customer-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).toHaveBeenCalledWith('user_2');
      expect(client.join).not.toHaveBeenCalledWith('admin_orders');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects immediately when token is missing', async () => {
      const client = makeClient(); // no token

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

    it.each([
      ['missing', null],
      ['inactive', { id: 8, role: UserRole.CUSTOMER, isActive: false }],
    ])('disconnects a %s database identity', async (_label, identity) => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 8,
        role: UserRole.CUSTOMER,
      });
      usersService.findSocketIdentity.mockResolvedValue(identity);
      const client = makeClient('signed-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('disconnects when the signed role differs from the database role', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 8,
        role: UserRole.ADMIN,
      });
      usersService.findSocketIdentity.mockResolvedValue({
        id: 8,
        role: UserRole.CUSTOMER,
        isActive: true,
      });
      const client = makeClient('role-confused-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it.each([undefined, null, 0, -1, 1.5, '8'])(
      'disconnects an invalid signed subject %p',
      async (sub) => {
        (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
          sub,
          role: UserRole.CUSTOMER,
        });
        const client = makeClient('invalid-subject-token');

        await gateway.handleConnection(client as unknown as Socket);

        expect(client.disconnect).toHaveBeenCalled();
        expect(usersService.findSocketIdentity).not.toHaveBeenCalled();
        expect(client.join).not.toHaveBeenCalled();
      },
    );

    it('awaits room membership before accepting the connection', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 2,
        role: UserRole.CUSTOMER,
      });
      let completeJoin!: () => void;
      const joinPending = new Promise<void>((resolve) => {
        completeJoin = resolve;
      });
      const client = makeClient('customer-token');
      client.join.mockReturnValue(joinPending as never);

      let connected = false;
      const connection = gateway
        .handleConnection(client as unknown as Socket)
        .then(() => {
          connected = true;
        });
      await new Promise((resolve) => setImmediate(resolve));
      expect(connected).toBe(false);

      completeJoin();
      await connection;
      expect(connected).toBe(true);
    });
  });

  // ── handleSubscribe ───────────────────────────────────────────────

  describe('handleSubscribe', () => {
    it('does not expose an enumerable per-order subscription handler', () => {
      expect((gateway as any).handleSubscribe).toBeUndefined();
    });
  });

  // ── notifyOrderUpdate ─────────────────────────────────────────────

  describe('notifyOrderUpdate', () => {
    it('broadcasts only to the owning customer and admin rooms', () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      gateway.server = { to: toMock } as unknown as Server;

      const order = {
        id: 7,
        orderId: 'ORD-10007',
        userId: 11,
        orderStatus: 'printing_in_progress',
      };
      gateway.notifyOrderUpdate('ORD-10007', order);

      expect(toMock).toHaveBeenCalledWith('user_11');
      expect(toMock).toHaveBeenCalledWith('admin_orders');
      expect(emitMock).toHaveBeenCalledTimes(2);
      expect(emitMock).toHaveBeenCalledWith('orderUpdate', order);
    });

    it('does not create an order room when the owner is unavailable', () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      gateway.server = { to: toMock } as unknown as Server;

      gateway.notifyOrderUpdate('ORD-10042', { id: 42 });

      expect(toMock).toHaveBeenCalledTimes(1);
      expect(toMock).toHaveBeenCalledWith('admin_orders');
    });
  });

  describe('notifyRiderAssignment', () => {
    it('emits riderAssignment to the assigned rider user room', () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      gateway.server = { to: toMock } as unknown as Server;

      const payload = {
        assignmentId: 99,
        orderId: 42,
        orderRef: 'ORD-10042',
      };
      gateway.notifyRiderAssignment(70, payload);

      expect(toMock).toHaveBeenCalledWith('user_70');
      expect(emitMock).toHaveBeenCalledWith('riderAssignment', payload);
    });
  });

  describe('notifyDeliveryQueueUpdated', () => {
    it('targets only the promoted customer user room', () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      gateway.server = { to: toMock } as unknown as Server;
      const payload = {
        orderId: 42,
        orderRef: 'ORD-10042',
        queuePosition: 1,
        queueSize: 1,
        canTrackDelivery: true,
        assignmentId: 99,
        planVersion: 3,
      };

      gateway.notifyDeliveryQueueUpdated(70, payload);

      expect(toMock).toHaveBeenCalledTimes(1);
      expect(toMock).toHaveBeenCalledWith('user_70');
      expect(emitMock).toHaveBeenCalledWith('deliveryQueueUpdated', payload);
    });
  });
});
