import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
import { HomeFeedPromoCard } from './entities/home-feed-promo-card.entity';
import {
  HomeFeedMode,
  HomeFeedSettings,
} from './entities/home-feed-settings.entity';
import { HomeFeedGateway } from './home-feed.gateway';
import { HomeFeedService } from './home-feed.service';

const feedItem = {
  id: 7,
  user_name: 'Customer',
  rating: 4.8,
  feedback: 'Great prints',
  created_at: new Date('2026-07-17T00:00:00Z'),
};

function makeSettings(
  overrides: Partial<HomeFeedSettings> = {},
): HomeFeedSettings {
  return {
    id: 1,
    mode: HomeFeedMode.AUTO,
    updatedAt: new Date('2026-07-17T00:00:00Z'),
    ...overrides,
  };
}

function makeCard(overrides: Partial<HomeFeedPromoCard> = {}) {
  return {
    id: 1,
    title: 'Promo title',
    body: 'Promo body',
    ctaLabel: 'Open',
    ctaTarget: '/customer/order/new',
    imageUrl: 'https://cdn.example.com/promo.webp',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-07-17T00:00:00Z'),
    updatedAt: new Date('2026-07-17T00:00:00Z'),
    ...overrides,
  } as HomeFeedPromoCard;
}

describe('HomeFeedService', () => {
  let service: HomeFeedService;
  let settingsRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let promoCardsRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let tamSurveysService: { getApprovedFeed: jest.Mock };
  let gateway: { notifyUpdated: jest.Mock };
  let transactionQuery: jest.Mock;

  beforeEach(async () => {
    const settings = makeSettings();
    settingsRepo = {
      findOne: jest.fn().mockResolvedValue(settings),
      create: jest
        .fn()
        .mockImplementation((input: Partial<HomeFeedSettings>) =>
          makeSettings(input),
        ),
      save: jest
        .fn()
        .mockImplementation(async (input: HomeFeedSettings) => input),
    };
    promoCardsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((input: Partial<HomeFeedPromoCard>) =>
          makeCard(input),
        ),
      save: jest
        .fn()
        .mockImplementation(async (input: HomeFeedPromoCard) => input),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      manager: { transaction: jest.fn() },
    };
    transactionQuery = jest.fn().mockResolvedValue([]);
    const transactionManager = {
      query: transactionQuery,
      getRepository: jest.fn().mockReturnValue(promoCardsRepo),
    } as unknown as EntityManager;
    promoCardsRepo.manager.transaction.mockImplementation(
      async (operation: (manager: EntityManager) => Promise<unknown>) =>
        operation(transactionManager),
    );
    tamSurveysService = {
      getApprovedFeed: jest.fn().mockResolvedValue([]),
    };
    gateway = { notifyUpdated: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        HomeFeedService,
        {
          provide: getRepositoryToken(HomeFeedSettings),
          useValue: settingsRepo,
        },
        {
          provide: getRepositoryToken(HomeFeedPromoCard),
          useValue: promoCardsRepo,
        },
        { provide: TamSurveysService, useValue: tamSurveysService },
        { provide: HomeFeedGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(HomeFeedService);
  });

  it('lazily creates the default settings row with id 1', async () => {
    const created = makeSettings();
    settingsRepo.findOne.mockResolvedValueOnce(null);
    settingsRepo.create.mockReturnValueOnce(created);
    settingsRepo.save.mockResolvedValueOnce(created);

    await expect(service.getSettings()).resolves.toEqual({
      mode: HomeFeedMode.AUTO,
    });
    expect(settingsRepo.create).toHaveBeenCalledWith({
      id: 1,
      mode: HomeFeedMode.AUTO,
    });
  });

  it('returns the row created by a concurrent lazy-create request', async () => {
    const racedSettings = makeSettings();
    settingsRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(racedSettings);
    settingsRepo.save.mockRejectedValueOnce({ code: '23505' });

    await expect(service.getSettings()).resolves.toEqual({
      mode: HomeFeedMode.AUTO,
    });
  });

  it.each([
    [HomeFeedMode.COMMUNITY, [feedItem], [makeCard()], 'community'],
    [HomeFeedMode.COMMUNITY, [], [], 'community'],
    [HomeFeedMode.PROMO, [feedItem], [makeCard()], 'promo'],
    [HomeFeedMode.PROMO, [feedItem], [], 'empty'],
    [HomeFeedMode.AUTO, [feedItem], [makeCard()], 'community'],
    [HomeFeedMode.AUTO, [feedItem], [], 'community'],
    [HomeFeedMode.AUTO, [], [makeCard()], 'promo'],
    [HomeFeedMode.AUTO, [], [], 'empty'],
  ] as const)(
    'resolves mode %s with the available feed and cards',
    async (mode, feedItems, promoCards, expected) => {
      settingsRepo.findOne.mockResolvedValueOnce(makeSettings({ mode }));
      tamSurveysService.getApprovedFeed.mockResolvedValueOnce(feedItems);
      promoCardsRepo.find.mockResolvedValueOnce(promoCards);

      const result = await service.getHomeFeed();

      expect(result).toEqual({
        mode,
        resolvedMode: expected,
        promoCards,
        feedItems,
      });
      expect(result).not.toHaveProperty('promo');
      expect(promoCardsRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      });
    },
  );

  it('lists all cards in stable display order for admins', async () => {
    const cards = [makeCard(), makeCard({ id: 2, isActive: false })];
    promoCardsRepo.find.mockResolvedValueOnce(cards);

    await expect(service.getPromoCards()).resolves.toBe(cards);
    expect(promoCardsRepo.find).toHaveBeenCalledWith({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  });

  it('updates mode and emits only after persistence succeeds', async () => {
    const settings = makeSettings();
    settingsRepo.findOne.mockResolvedValueOnce(settings);

    await expect(
      service.updateSettings({ mode: HomeFeedMode.PROMO }),
    ).resolves.toEqual({ mode: HomeFeedMode.PROMO });
    expect(settingsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ mode: HomeFeedMode.PROMO }),
    );
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('does not emit when a settings update fails', async () => {
    settingsRepo.save.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.updateSettings({ mode: HomeFeedMode.AUTO }),
    ).rejects.toThrow('database unavailable');
    expect(gateway.notifyUpdated).not.toHaveBeenCalled();
  });

  it('appends a new promo card and emits after saving', async () => {
    promoCardsRepo.find.mockResolvedValueOnce([
      makeCard({ id: 8, sortOrder: 3 }),
    ]);

    const result = await service.createPromoCard({
      title: 'New card',
      body: 'New body',
      isActive: true,
    });

    expect(promoCardsRepo.count).toHaveBeenCalledWith({
      where: { isActive: true },
    });
    expect(transactionQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['home-feed-promo-cards'],
    );
    expect(promoCardsRepo.find).toHaveBeenCalledWith({
      order: { sortOrder: 'DESC', id: 'DESC' },
      take: 1,
    });
    expect(promoCardsRepo.create).toHaveBeenCalledWith({
      title: 'New card',
      body: 'New body',
      ctaLabel: null,
      ctaTarget: null,
      imageUrl: null,
      sortOrder: 4,
      isActive: true,
    });
    expect(result.sortOrder).toBe(4);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('allows creating an inactive sixth card', async () => {
    promoCardsRepo.count.mockResolvedValueOnce(5);

    await service.createPromoCard({ title: 'Hidden', isActive: false });

    expect(promoCardsRepo.count).not.toHaveBeenCalled();
    expect(promoCardsRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects creating or activating a sixth active card', async () => {
    promoCardsRepo.count.mockResolvedValue(5);

    await expect(service.createPromoCard({ title: 'Sixth' })).rejects.toThrow(
      BadRequestException,
    );

    promoCardsRepo.findOne.mockResolvedValueOnce(
      makeCard({ id: 6, isActive: false }),
    );
    await expect(
      service.updatePromoCard(6, { isActive: true }),
    ).rejects.toThrow('A maximum of 5 active');
    expect(promoCardsRepo.save).not.toHaveBeenCalled();
    expect(gateway.notifyUpdated).not.toHaveBeenCalled();
  });

  it('allows editing an active card when five cards are active', async () => {
    const card = makeCard();
    promoCardsRepo.findOne.mockResolvedValueOnce(card);

    await service.updatePromoCard(card.id, {
      title: 'Updated',
      isActive: true,
    });

    expect(promoCardsRepo.count).not.toHaveBeenCalled();
    expect(card.title).toBe('Updated');
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('requires CTA label and target to remain paired', async () => {
    await expect(
      service.createPromoCard({ title: 'Card', ctaLabel: 'Open' }),
    ).rejects.toThrow('ctaLabel and ctaTarget must be provided together');

    const card = makeCard();
    promoCardsRepo.findOne.mockResolvedValueOnce(card);
    await expect(
      service.updatePromoCard(card.id, { ctaTarget: null }),
    ).rejects.toThrow(BadRequestException);
    expect(gateway.notifyUpdated).not.toHaveBeenCalled();
  });

  it('deletes an existing card and emits afterward', async () => {
    promoCardsRepo.findOne.mockResolvedValueOnce(makeCard());

    await service.removePromoCard(1);

    expect(promoCardsRepo.delete).toHaveBeenCalledWith(1);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('rejects changes to a missing card without emitting', async () => {
    promoCardsRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.removePromoCard(404)).rejects.toThrow(
      NotFoundException,
    );
    expect(promoCardsRepo.delete).not.toHaveBeenCalled();
    expect(gateway.notifyUpdated).not.toHaveBeenCalled();
  });

  it('reorders validated card ids and emits after all updates', async () => {
    promoCardsRepo.find.mockResolvedValueOnce([
      makeCard({ id: 3 }),
      makeCard({ id: 1 }),
      makeCard({ id: 2 }),
    ]);

    await service.reorderPromoCards([3, 1, 2]);

    expect(promoCardsRepo.update.mock.calls).toEqual([
      [3, { sortOrder: 0 }],
      [1, { sortOrder: 1 }],
      [2, { sortOrder: 2 }],
    ]);
    expect(gateway.notifyUpdated).toHaveBeenCalledTimes(1);
  });

  it('rejects reorder ids that do not all exist', async () => {
    promoCardsRepo.find.mockResolvedValueOnce([makeCard({ id: 1 })]);

    await expect(service.reorderPromoCards([1, 404])).rejects.toThrow(
      BadRequestException,
    );
    expect(promoCardsRepo.update).not.toHaveBeenCalled();
    expect(gateway.notifyUpdated).not.toHaveBeenCalled();
  });

  it('does not emit when a card persistence transaction fails', async () => {
    promoCardsRepo.save.mockRejectedValueOnce(new Error('save failed'));

    await expect(
      service.createPromoCard({ title: 'Unsaved card' }),
    ).rejects.toThrow('save failed');
    expect(gateway.notifyUpdated).not.toHaveBeenCalled();
  });
});
