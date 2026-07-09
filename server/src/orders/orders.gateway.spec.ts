import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OrdersGateway } from './orders.gateway';

const makeClient = (
  token?: string,
): jest.Mocked<Pick<Socket, 'join' | 'disconnect'>> & {
  handshake: { auth: Record<string, unknown> };
} => ({
  handshake: { auth: token ? { token } : {} },
  join: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
});

describe('OrdersGateway', () => {
  let gateway: OrdersGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersGateway, { provide: JwtService, useValue: jwtService }],
    }).compile();

    gateway = module.get<OrdersGateway>(OrdersGateway);
  });

  // ── handleConnection ──────────────────────────────────────────────

  describe('handleConnection', () => {
    it('joins admin_orders room when JWT has role=admin', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 1,
        role: 'admin',
      });
      const client = makeClient('valid-admin-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-admin-token');
      expect(client.join).toHaveBeenCalledWith('admin_orders');
      expect(client.disconnect).not.toHaveBeenCalled();
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
});
