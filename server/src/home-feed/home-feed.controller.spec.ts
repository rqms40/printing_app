import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { HomeFeedController } from './home-feed.controller';

describe('HomeFeedController', () => {
  const handlerFor = (name: keyof HomeFeedController): object =>
    Object.getOwnPropertyDescriptor(HomeFeedController.prototype, name)!
      .value as object;

  it('allows any authenticated role to read the resolved feed', () => {
    const handler = handlerFor('getHomeFeed');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
    expect(Reflect.getMetadata('__guards__', handler)).toEqual([JwtAuthGuard]);
  });

  it.each([
    'getSettings',
    'updateSettings',
    'getPromoCards',
    'createPromoCard',
    'reorderPromoCards',
    'uploadImage',
    'updatePromoCard',
    'removePromoCard',
  ] as const)('restricts %s to admins', (method) => {
    const handler = handlerFor(method);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN]);
    expect(Reflect.getMetadata('__guards__', handler)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('uploads an image through StorageService', async () => {
    const storageService = {
      upload: jest.fn().mockResolvedValue('https://cdn.example.com/card.webp'),
    };
    const controller = new HomeFeedController(
      {} as never,
      storageService as never,
    );
    const file = {
      buffer: Buffer.from('image'),
      mimetype: 'image/webp',
    } as Express.Multer.File;

    await expect(controller.uploadImage(file)).resolves.toEqual({
      url: 'https://cdn.example.com/card.webp',
    });
    expect(storageService.upload).toHaveBeenCalledWith(
      file.buffer,
      expect.stringMatching(/^home-feed\/[0-9a-f-]+\.webp$/),
      'image/webp',
    );
  });

  it('rejects an upload without a file', async () => {
    const controller = new HomeFeedController({} as never, {} as never);
    await expect(controller.uploadImage(undefined as never)).rejects.toThrow(
      BadRequestException,
    );
  });
});
