import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController — storage settings', () => {
  let controller: UsersController;
  const mockService = {
    findById: jest.fn(),
    updateFcmToken: jest.fn(),
    updateProfile: jest.fn(),
    getStorageSettings: jest.fn(),
    updateStorageSettings: jest.fn(),
  };
  const mockReq = { user: { sub: 42 } } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();
    controller = module.get<UsersController>(UsersController);
  });

  it('GET /users/me/storage-settings returns settings', async () => {
    mockService.getStorageSettings.mockResolvedValue({ fileRetentionDays: 7 });
    const result = await controller.getStorageSettings(mockReq);
    expect(result).toEqual({ fileRetentionDays: 7 });
    expect(mockService.getStorageSettings).toHaveBeenCalledWith(42);
  });

  it('PATCH /users/me/storage-settings updates settings', async () => {
    mockService.updateStorageSettings.mockResolvedValue({
      fileRetentionDays: 30,
    });
    const result = await controller.updateStorageSettings(mockReq, {
      fileRetentionDays: 30,
    });
    expect(result).toEqual({ fileRetentionDays: 30 });
    expect(mockService.updateStorageSettings).toHaveBeenCalledWith(42, 30);
  });
});
