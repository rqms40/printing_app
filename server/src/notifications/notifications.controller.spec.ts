import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MarketingSchedulerService } from './marketing-scheduler.service';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';

describe('NotificationsController', () => {
  const notificationsService = {
    getMarketingNotifications: jest.fn(),
    createMarketingNotification: jest.fn(),
    updateMarketingNotification: jest.fn(),
    deleteMarketingNotification: jest.fn(),
  } as unknown as NotificationsService;
  const sendNotificationById = jest.fn();
  const scheduler = {
    sendNotificationById,
  } as unknown as MarketingSchedulerService;

  const controller = new NotificationsController(
    notificationsService,
    scheduler,
  );

  const handlerFor = (name: string): object =>
    Object.getOwnPropertyDescriptor(NotificationsController.prototype, name)!
      .value as object;

  it('restricts every marketing endpoint to admins', () => {
    for (const name of [
      'getMarketingNotifications',
      'createMarketingNotification',
      'updateMarketingNotification',
      'deleteMarketingNotification',
      'sendMarketingNotification',
    ]) {
      const handler = handlerFor(name);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ops_admin', 'super_admin']);
      const guards = Reflect.getMetadata('__guards__', handler) as unknown[];
      expect(guards).toContain(RolesGuard);
    }
  });

  it('leaves customer notification endpoints without role metadata', () => {
    for (const name of [
      'getNotifications',
      'getUnreadCount',
      'markAsRead',
      'markAllAsRead',
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, handlerFor(name))).toBeUndefined();
    }
  });

  it('delegates immediate sends to the scheduler by id', async () => {
    const result = { sentTo: 2, failed: 0, fcmAvailable: true, tokens: 2 };
    sendNotificationById.mockResolvedValue(result);

    await expect(controller.sendMarketingNotification('7')).resolves.toEqual(
      result,
    );
    expect(sendNotificationById).toHaveBeenCalledWith(7);
  });

  it('propagates not-found from the scheduler', async () => {
    sendNotificationById.mockRejectedValue(new NotFoundException());
    await expect(controller.sendMarketingNotification('99')).rejects.toThrow(
      NotFoundException,
    );
  });
});
