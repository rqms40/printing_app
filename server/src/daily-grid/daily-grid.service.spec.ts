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
  let callOrder: string[];

  beforeEach(async () => {
    callOrder = [];
    gateway = {
      notifyUpdated: jest.fn().mockImplementation(() => {
        callOrder.push('notify');
      }),
    };
    repo = {
      find: jest.fn().mockResolvedValue([mockCard]),
      findOne: jest.fn().mockResolvedValue(mockCard),
      create: jest.fn().mockReturnValue(mockCard),
      save: jest.fn().mockImplementation(async () => {
        callOrder.push('save');
        return mockCard;
      }),
      update: jest.fn().mockImplementation(async () => {
        callOrder.push('update');
      }),
      delete: jest.fn().mockImplementation(async () => {
        callOrder.push('delete');
      }),
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

  it('create notifies after saving', async () => {
    await service.create({ title: 'Test', category: 'paper' } as any);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['save', 'notify']);
  });

  it('update notifies after updating', async () => {
    await service.update(1, { title: 'Updated' } as any);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
    const notifyIndex = callOrder.lastIndexOf('notify');
    const lastUpdateIndex = callOrder.lastIndexOf('update');
    expect(notifyIndex).toBeGreaterThan(lastUpdateIndex);
  });

  it('remove notifies after deleting', async () => {
    await service.remove(1);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['delete', 'notify']);
  });

  it('reorder notifies after bulk update', async () => {
    await service.reorder([1, 2, 3]);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
    const notifyIndex = callOrder.indexOf('notify');
    expect(notifyIndex).toBeGreaterThan(0); // at least one update before notify
    expect(callOrder[callOrder.length - 1]).toBe('notify');
  });
});
