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
    it('joins the per-order room and returns subscribed ack', () => {
      const client = makeClient('any-token');

      const result = gateway.handleSubscribe('99', client as unknown as Socket);

      expect(client.join).toHaveBeenCalledWith('order_99');
      expect(result).toEqual({ event: 'subscribed', data: { orderId: '99' } });
    });
  });

  // ── notifyOrderUpdate ─────────────────────────────────────────────

  describe('notifyOrderUpdate', () => {
    it('broadcasts to per-order, customer, and admin rooms', () => {
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

      expect(toMock).toHaveBeenCalledWith('order_ORD-10007');
      expect(toMock).toHaveBeenCalledWith('user_11');
      expect(toMock).toHaveBeenCalledWith('admin_orders');
      expect(emitMock).toHaveBeenCalledTimes(3);
      expect(emitMock).toHaveBeenCalledWith('orderUpdate', order);
    });

    it('emits to the correct per-order room for different order IDs', () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      gateway.server = { to: toMock } as unknown as Server;

      gateway.notifyOrderUpdate('ORD-10042', { id: 42 });

      expect(toMock).toHaveBeenCalledWith('order_ORD-10042');
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
