import { DeliverySlotsGateway } from './delivery-slots.gateway';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../users/entities/user.entity';
import { WsException } from '@nestjs/websockets';

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

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(gateway.server.to).toHaveBeenCalledWith('slots:2026-04-30');
    expect(emit).toHaveBeenCalledWith('slot-updated', {
      templateId: 1,
      date: '2026-04-30',
      bookedCount: 9,
    });
  });

  it('disconnects a held user before an actionable slot subscription', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 10,
        role: UserRole.CUSTOMER,
      }),
    };
    const usersService = {
      findSocketIdentity: jest.fn().mockResolvedValue({
        id: 10,
        role: UserRole.CUSTOMER,
        isActive: false,
      }),
    };
    const gateway = new (DeliverySlotsGateway as any)(
      jwtService,
      usersService,
      { register: jest.fn() },
    );
    const client = {
      handshake: { auth: { token: 'signed-token' } },
      data: { userId: 10, role: UserRole.CUSTOMER },
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await expect(
      gateway.handleSubscribe({ date: '2026-07-10' }, client),
    ).rejects.toBeInstanceOf(WsException);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });
});
