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

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(gateway.server.to).toHaveBeenCalledWith('slots:2026-04-30');
    expect(emit).toHaveBeenCalledWith('slot-updated', {
      templateId: 1,
      date: '2026-04-30',
      bookedCount: 9,
    });
  });
});
