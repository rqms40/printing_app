import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import {
  ArtworkMockupRender,
  MockupRenderStatus,
} from './entities/artwork-mockup-render.entity';
import { CreateMockupDto } from './dto/create-mockup.dto';
import {
  buildStaticMockupSvg,
  getMockupTemplate,
  resolveMockupProductType,
} from './mockup.templates';

/** Preview rows expire after 7 days (regenerate freely). */
const MOCKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STATIC_KEY_TO_TYPE: Record<string, string> = {
  'flyer-v1': 'flyer',
  'tarpaulin-v1': 'tarpaulin',
  'signage-v1': 'signage',
  'tshirt-v1': 't-shirt',
  'generic-v1': 'other',
};

export type MockupResponse = {
  id: number;
  artworkFileId: number;
  orderId: number | null;
  productType: string;
  templateVersion: string;
  renderStatus: MockupRenderStatus;
  renderUrl: string | null;
  /** Always true — Product Preview is not print-ready production artwork. */
  isNonProduction: boolean;
  notPrintReady: true;
  label: string;
  surfaceColor: string;
  accentColor: string;
  aspectRatio: string;
  expiresAt: string | null;
  createdAt: string;
};

@Injectable()
export class MockupService {
  constructor(
    @InjectRepository(ArtworkMockupRender)
    private readonly mockupRepo: Repository<ArtworkMockupRender>,
    @InjectRepository(FileMetadata)
    private readonly fileRepo: Repository<FileMetadata>,
  ) {}

  /**
   * Create or reuse a static template composite for an artwork file.
   * Invalidates prior ready renders for the same artwork+productType.
   */
  async render(
    dto: CreateMockupDto,
    actorUserId: number,
    isStaff: boolean,
  ): Promise<MockupResponse> {
    const file = await this.fileRepo.findOne({
      where: { id: dto.artworkFileId },
    });
    if (!file) {
      throw new NotFoundException(`Artwork file ${dto.artworkFileId} not found`);
    }
    if (!isStaff && file.uploadedBy != null && file.uploadedBy !== actorUserId) {
      throw new ForbiddenException('Not allowed to preview this artwork');
    }

    const productType = resolveMockupProductType(
      dto.productType,
      dto.categoryHint,
    );
    const template = getMockupTemplate(productType);

    await this.invalidateForArtwork(dto.artworkFileId, productType);

    const expiresAt = new Date(Date.now() + MOCKUP_TTL_MS);
    const row = this.mockupRepo.create({
      artworkFileId: dto.artworkFileId,
      orderId: dto.orderId ?? null,
      productType: template.productType,
      templateVersion: template.templateVersion,
      renderStatus: MockupRenderStatus.READY,
      renderUrl: template.staticPath,
      isNonProduction: true,
      failureReason: null,
      expiresAt,
      invalidatedAt: null,
    });
    const saved = await this.mockupRepo.save(row);
    return this.toResponse(saved);
  }

  async getById(
    id: number,
    actorUserId: number,
    isStaff: boolean,
  ): Promise<MockupResponse> {
    const row = await this.mockupRepo.findOne({
      where: { id },
      relations: { artworkFile: true },
    });
    if (!row) throw new NotFoundException(`Mockup ${id} not found`);
    const ownerId = row.artworkFile?.uploadedBy;
    if (!isStaff && ownerId != null && ownerId !== actorUserId) {
      throw new ForbiddenException('Not allowed to view this mockup');
    }
    return this.toResponse(row);
  }

  async listForArtwork(
    artworkFileId: number,
    actorUserId: number,
    isStaff: boolean,
  ): Promise<MockupResponse[]> {
    const file = await this.fileRepo.findOne({ where: { id: artworkFileId } });
    if (!file) {
      throw new NotFoundException(`Artwork file ${artworkFileId} not found`);
    }
    if (!isStaff && file.uploadedBy != null && file.uploadedBy !== actorUserId) {
      throw new ForbiddenException('Not allowed to list mockups for this artwork');
    }
    const rows = await this.mockupRepo.find({
      where: {
        artworkFileId,
        renderStatus: In([MockupRenderStatus.READY, MockupRenderStatus.PENDING]),
      },
      order: { id: 'DESC' },
      take: 20,
    });
    return rows.map((r) => this.toResponse(r));
  }

  /** Invalidate ready mockups when artwork or product type changes. */
  async invalidateForArtwork(
    artworkFileId: number,
    productType?: string,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      artworkFileId,
      renderStatus: MockupRenderStatus.READY,
    };
    if (productType) where.productType = productType;

    const active = await this.mockupRepo.find({ where });
    if (active.length === 0) return 0;
    const now = new Date();
    for (const row of active) {
      row.renderStatus = MockupRenderStatus.INVALIDATED;
      row.invalidatedAt = now;
    }
    await this.mockupRepo.save(active);
    return active.length;
  }

  /** Serve static SVG bytes for a known template version. */
  getStaticSvg(templateKey: string): string | null {
    const normalized = templateKey.replace(/\.svg$/i, '').toLowerCase();
    const productType = STATIC_KEY_TO_TYPE[normalized];
    if (productType) {
      return buildStaticMockupSvg(getMockupTemplate(productType));
    }
    return null;
  }

  private toResponse(row: ArtworkMockupRender): MockupResponse {
    const template = getMockupTemplate(row.productType);
    return {
      id: row.id,
      artworkFileId: row.artworkFileId,
      orderId: row.orderId,
      productType: row.productType,
      templateVersion: row.templateVersion,
      renderStatus: row.renderStatus,
      renderUrl: row.renderUrl,
      isNonProduction: true,
      notPrintReady: true,
      label: template.label,
      surfaceColor: template.surfaceColor,
      accentColor: template.accentColor,
      aspectRatio: template.aspectRatio,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }
}
