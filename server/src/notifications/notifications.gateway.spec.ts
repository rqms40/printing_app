import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { NotificationsGateway } from './notifications.gateway';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';

const makeClient = (
  token?: string,
): jest.Mocked<Pick<Socket, 'join' | 'disconnect'>> & {
  handshake: { auth: Record<string, unknown> };
  data: Record<string, unknown>;
} => ({
  handshake: { auth: token ? { token } : {} },
  data: {},
  join: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
});

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let usersService: { findSocketIdentity: jest.Mock };
  let realtimeSessions: { register: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    usersService = {
      findSocketIdentity: jest.fn(async (id: number) => ({
        id,
        role: id === 1 ? UserRole.ADMIN : UserRole.CUSTOMER,
        isActive: true,
      })),
    };
    realtimeSessions = { register: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
        { provide: RealtimeSessionRegistry, useValue: realtimeSessions },
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
      expect(realtimeSessions.register).toHaveBeenCalledWith(1, client);
    });

    it('does NOT join admin_notifications for a non-admin JWT', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 2,
        role: 'customer',
      });
      const client = makeClient('customer-token');

      await gateway.handleConnection(client as unknown as Socket);

      // Non-admins join their personal room but NOT the admin room
      expect(client.join).toHaveBeenCalledWith('user_2');
      expect(client.join).not.toHaveBeenCalledWith('admin_notifications');
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

    it('disconnects an inactive database identity without joining rooms', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 2,
        role: UserRole.CUSTOMER,
      });
      usersService.findSocketIdentity.mockResolvedValue({
        id: 2,
        role: UserRole.CUSTOMER,
        isActive: false,
      });
      const client = makeClient('held-token');

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
      expect(realtimeSessions.register).not.toHaveBeenCalled();
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
