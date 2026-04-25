import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyGridService } from './daily-grid.service';
import { DailyGridCard } from './entities/daily-grid-card.entity';
import { DailyGridGateway } from './daily-grid.gateway';

const mockCard = {
  id: 1,
  title: 'Bond Paper A4',
  category: 'paper',
  isActive: true,
  sortOrder: 0,
  paperSpecs: null,
  threeDSpecs: null,
} as DailyGridCard;

describe('DailyGridService — gateway notifications', () => {
  let service: DailyGridService;
  let gateway: { notifyUpdated: jest.Mock };
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    gateway = { notifyUpdated: jest.fn() };
    repo = {
      find: jest.fn().mockResolvedValue([mockCard]),
      findOne: jest.fn().mockResolvedValue(mockCard),
      create: jest.fn().mockReturnValue(mockCard),
      save: jest.fn().mockResolvedValue(mockCard),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        DailyGridService,
        { provide: getRepositoryToken(DailyGridCard), useValue: repo },
        { provide: DailyGridGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(DailyGridService);
  });

  it('create calls notifyUpdated', async () => {
    await service.create({ title: 'Test', category: 'paper' } as any);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('update calls notifyUpdated', async () => {
    await service.update(1, { title: 'Updated' } as any);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('remove calls notifyUpdated', async () => {
    await service.remove(1);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('reorder calls notifyUpdated', async () => {
    await service.reorder([1, 2, 3]);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });
});
