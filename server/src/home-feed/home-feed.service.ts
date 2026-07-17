import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
import { CreateHomeFeedPromoCardDto } from './dto/create-home-feed-promo-card.dto';
import { UpdateHomeFeedPromoCardDto } from './dto/update-home-feed-promo-card.dto';
import { UpdateHomeFeedSettingsDto } from './dto/update-home-feed-settings.dto';
import { HomeFeedPromoCard } from './entities/home-feed-promo-card.entity';
import {
  HomeFeedMode,
  HomeFeedSettings,
} from './entities/home-feed-settings.entity';
import { HomeFeedGateway } from './home-feed.gateway';

type FeedItems = Awaited<ReturnType<TamSurveysService['getApprovedFeed']>>;
type ResolvedHomeFeedMode = 'community' | 'promo' | 'empty';

const MAX_ACTIVE_PROMO_CARDS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface HomeFeedResponse {
  mode: HomeFeedMode;
  resolvedMode: ResolvedHomeFeedMode;
  promoCards: HomeFeedPromoCard[];
  feedItems: FeedItems;
}

export interface HomeFeedSettingsResponse {
  mode: HomeFeedMode;
}

@Injectable()
export class HomeFeedService {
  constructor(
    @InjectRepository(HomeFeedSettings)
    private readonly settingsRepo: Repository<HomeFeedSettings>,
    @InjectRepository(HomeFeedPromoCard)
    private readonly promoCardsRepo: Repository<HomeFeedPromoCard>,
    private readonly tamSurveysService: TamSurveysService,
    private readonly gateway: HomeFeedGateway,
  ) {}

  async getHomeFeed(): Promise<HomeFeedResponse> {
    const [settings, feedItems, promoCards] = await Promise.all([
      this.getOrCreateSettings(),
      this.tamSurveysService.getApprovedFeed(),
      this.getActivePromoCards(),
    ]);

    return {
      mode: settings.mode,
      resolvedMode: this.resolveMode(
        settings.mode,
        feedItems.length,
        promoCards.length,
      ),
      promoCards,
      feedItems,
    };
  }

  async getSettings(): Promise<HomeFeedSettingsResponse> {
    const settings = await this.getOrCreateSettings();
    return { mode: settings.mode };
  }

  private async getOrCreateSettings(): Promise<HomeFeedSettings> {
    const existing = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (existing) return existing;

    const defaults = this.settingsRepo.create({
      id: 1,
      mode: HomeFeedMode.AUTO,
    });
    try {
      return await this.settingsRepo.save(defaults);
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const racedSettings = await this.settingsRepo.findOne({
        where: { id: 1 },
      });
      if (!racedSettings) throw error;
      return racedSettings;
    }
  }

  async updateSettings(
    dto: UpdateHomeFeedSettingsDto,
  ): Promise<HomeFeedSettingsResponse> {
    const settings = await this.getOrCreateSettings();
    settings.mode = dto.mode;

    const saved = await this.settingsRepo.save(settings);
    this.gateway.notifyUpdated();
    return { mode: saved.mode };
  }

  getActivePromoCards(): Promise<HomeFeedPromoCard[]> {
    return this.promoCardsRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  getPromoCards(): Promise<HomeFeedPromoCard[]> {
    return this.promoCardsRepo.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async createPromoCard(
    dto: CreateHomeFeedPromoCardDto,
  ): Promise<HomeFeedPromoCard> {
    const saved = await this.withLockedPromoCards(async (repo) => {
      const isActive = dto.isActive ?? true;
      if (isActive) await this.assertActiveCardCapacity(repo);

      const [lastCard] = await repo.find({
        order: { sortOrder: 'DESC', id: 'DESC' },
        take: 1,
      });
      const ctaLabel = dto.ctaLabel ?? null;
      const ctaTarget = dto.ctaTarget ?? null;
      this.assertCtaPair(ctaLabel, ctaTarget);

      const card = repo.create({
        title: dto.title,
        body: dto.body ?? null,
        ctaLabel,
        ctaTarget,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: (lastCard?.sortOrder ?? -1) + 1,
        isActive,
      });
      return repo.save(card);
    });
    this.gateway.notifyUpdated();
    return saved;
  }

  async updatePromoCard(
    id: number,
    dto: UpdateHomeFeedPromoCardDto,
  ): Promise<HomeFeedPromoCard> {
    const saved = await this.withLockedPromoCards(async (repo) => {
      const card = await this.findPromoCard(id, repo);
      if (dto.isActive === true && !card.isActive) {
        await this.assertActiveCardCapacity(repo);
      }

      const ctaLabel = this.hasOwn(dto, 'ctaLabel')
        ? (dto.ctaLabel ?? null)
        : card.ctaLabel;
      const ctaTarget = this.hasOwn(dto, 'ctaTarget')
        ? (dto.ctaTarget ?? null)
        : card.ctaTarget;
      this.assertCtaPair(ctaLabel, ctaTarget);

      if (dto.title !== undefined) card.title = dto.title;
      if (this.hasOwn(dto, 'body')) card.body = dto.body ?? null;
      if (this.hasOwn(dto, 'ctaLabel')) card.ctaLabel = ctaLabel;
      if (this.hasOwn(dto, 'ctaTarget')) card.ctaTarget = ctaTarget;
      if (this.hasOwn(dto, 'imageUrl')) card.imageUrl = dto.imageUrl ?? null;
      if (dto.isActive !== undefined) card.isActive = dto.isActive;

      return repo.save(card);
    });
    this.gateway.notifyUpdated();
    return saved;
  }

  async removePromoCard(id: number): Promise<void> {
    await this.withLockedPromoCards(async (repo) => {
      await this.findPromoCard(id, repo);
      await repo.delete(id);
    });
    this.gateway.notifyUpdated();
  }

  async reorderPromoCards(ids: number[]): Promise<void> {
    await this.withLockedPromoCards(async (repo) => {
      const cards = await repo.find({ select: { id: true } });
      const existingIds = new Set(cards.map((card) => card.id));
      if (
        cards.length !== ids.length ||
        ids.some((id) => !existingIds.has(id))
      ) {
        throw new BadRequestException(
          'Reorder ids must contain every existing home feed promo card',
        );
      }

      await Promise.all(
        ids.map((id, sortOrder) => repo.update(id, { sortOrder })),
      );
    });
    this.gateway.notifyUpdated();
  }

  private async findPromoCard(
    id: number,
    repo: Repository<HomeFeedPromoCard>,
  ): Promise<HomeFeedPromoCard> {
    const card = await repo.findOne({ where: { id } });
    if (!card) {
      throw new NotFoundException(`Home feed promo card ${id} not found`);
    }
    return card;
  }

  private async assertActiveCardCapacity(
    repo: Repository<HomeFeedPromoCard>,
  ): Promise<void> {
    const activeCount = await repo.count({
      where: { isActive: true },
    });
    if (activeCount >= MAX_ACTIVE_PROMO_CARDS) {
      throw new BadRequestException(
        `A maximum of ${MAX_ACTIVE_PROMO_CARDS} active home feed promo cards is allowed`,
      );
    }
  }

  private withLockedPromoCards<T>(
    operation: (repo: Repository<HomeFeedPromoCard>) => Promise<T>,
  ): Promise<T> {
    return this.promoCardsRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'home-feed-promo-cards',
      ]);
      return operation(manager.getRepository(HomeFeedPromoCard));
    });
  }

  private assertCtaPair(
    ctaLabel: string | null,
    ctaTarget: string | null,
  ): void {
    if ((ctaLabel === null) !== (ctaTarget === null)) {
      throw new BadRequestException(
        'ctaLabel and ctaTarget must be provided together',
      );
    }
  }

  private resolveMode(
    mode: HomeFeedMode,
    feedItemCount: number,
    promoCardCount: number,
  ): ResolvedHomeFeedMode {
    if (mode === HomeFeedMode.COMMUNITY) return 'community';
    if (mode === HomeFeedMode.PROMO) {
      return promoCardCount > 0 ? 'promo' : 'empty';
    }
    if (feedItemCount > 0) return 'community';
    return promoCardCount > 0 ? 'promo' : 'empty';
  }

  private hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
