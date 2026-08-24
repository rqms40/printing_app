import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SupplierCatalogOffering } from './entities/supplier-catalog-offering.entity';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { applyParsedCatalogProducts } from './supplier-catalog.apply';
import {
  extractCatalogText,
  parseCatalogText,
  type ParsedCatalog,
  type ParsedCatalogProduct,
} from './supplier-catalog.parser';
import { UpsertSupplierCatalogOfferingDto } from './dto/supplier-catalog.dto';

@Injectable()
export class SupplierCatalogService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SupplierCatalogOffering)
    private readonly offeringRepo: Repository<SupplierCatalogOffering>,
    @InjectRepository(SupplierProfile)
    private readonly profileRepo: Repository<SupplierProfile>,
  ) {}

  async listMine(userId: number): Promise<SupplierCatalogOffering[]> {
    const profile = await this.requireProfile(userId);
    return this.offeringRepo.find({
      where: { supplierId: profile.id },
      order: { id: 'ASC' },
    });
  }

  async listForSupplier(supplierId: number): Promise<SupplierCatalogOffering[]> {
    return this.offeringRepo.find({
      where: { supplierId, isActive: true },
      order: { id: 'ASC' },
    });
  }

  async upsertMine(
    userId: number,
    dto: UpsertSupplierCatalogOfferingDto,
  ): Promise<SupplierCatalogOffering[]> {
    const profile = await this.requireProfile(userId);
    const product: ParsedCatalogProduct = {
      title: dto.title.trim(),
      categorySlugs: dto.categorySlugs.map((s) => s.trim()).filter(Boolean),
      specs: Object.entries(dto.specOptions ?? {}).map(([key, values]) => ({
        key,
        label: key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        options: (values ?? []).map((value) => ({
          label: value,
          value,
        })),
      })),
      addons: (dto.addons ?? []).map((addon) => ({
        name: addon.name,
        price: Number(addon.price) || 0,
        priceType: addon.priceType ?? 'flat',
      })),
      notes: dto.notes ?? [],
      baseRatePesos: dto.baseRatePesos ?? null,
      pricingUnit: dto.pricingUnit ?? null,
    };
    if (!product.title) {
      throw new BadRequestException('Catalog product title is required');
    }
    await applyParsedCatalogProducts(this.dataSource, profile.id, [product], {
      kind: 'manual',
    });
    return this.listMine(userId);
  }

  async removeMine(userId: number, offeringId: number): Promise<void> {
    const profile = await this.requireProfile(userId);
    const offering = await this.offeringRepo.findOne({
      where: { id: offeringId, supplierId: profile.id },
    });
    if (!offering) {
      throw new NotFoundException(`Catalog offering ${offeringId} not found`);
    }
    await this.offeringRepo.remove(offering);
  }

  async previewImport(
    file: { buffer: Buffer; originalname: string },
  ): Promise<ParsedCatalog> {
    const name = file.originalname || 'catalog';
    const lower = name.toLowerCase();
    if (!/\.(docx|pdf|xlsx|xls|csv|txt|md)$/.test(lower)) {
      throw new BadRequestException(
        'Upload a catalog as .docx, .pdf, .xlsx, or .csv',
      );
    }
    let text: string;
    try {
      text = await extractCatalogText(file.buffer, name);
    } catch (err) {
      throw new BadRequestException(
        `Could not read catalog file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const parsed = parseCatalogText(text);
    if (parsed.products.length === 0) {
      throw new BadRequestException(
        'No products, specs, or add-ons could be read from that file',
      );
    }
    return parsed;
  }

  async importMine(
    userId: number,
    file: { buffer: Buffer; originalname: string },
    apply = true,
  ): Promise<{
    parsed: ParsedCatalog;
    applied?: { offerings: number; specsAdded: number; categories: string[] };
  }> {
    const profile = await this.requireProfile(userId);
    const parsed = await this.previewImport(file);
    if (!apply) return { parsed };
    const applied = await applyParsedCatalogProducts(
      this.dataSource,
      profile.id,
      parsed.products,
      { kind: 'import', fileName: file.originalname },
    );
    return { parsed, applied };
  }

  private async requireProfile(userId: number): Promise<SupplierProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Supplier profile not found');
    }
    return profile;
  }
}
