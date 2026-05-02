import { BadRequestException, Injectable } from '@nestjs/common';

import { QuoteOrderDto } from '../orders/dto/quote-order.dto';
import { CatalogCategory, CatalogReadService } from './catalog-read.service';
import {
  CatalogValidationService,
  SelectedSpec,
} from './catalog-validation.service';
import { PricingModel, PricingRole } from './enums/catalog.enums';

export interface SpecSnapshotDraft {
  specDefinitionId: number;
  specKey: string;
  specLabel: string;
  inputType: string;
  value: string;
  displayValue: string;
  optionId: number | null;
  optionLabel: string | null;
  multiplier: number;
  fixedFee: number;
  unitCost: number;
  estimatedQuantity: number | null;
}

export interface QuoteItemResult {
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  pricingModel: PricingModel;
  quantity: number;
  printSubtotal: number;
  specSnapshots: SpecSnapshotDraft[];
  pricingBreakdown: { label: string; amount: number }[];
}

export interface QuoteResult {
  items: QuoteItemResult[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
}

@Injectable()
export class CatalogPricingService {
  constructor(
    private readonly catalogReadService: CatalogReadService,
    private readonly validationService: CatalogValidationService,
  ) {}

  async quote(dto: QuoteOrderDto): Promise<QuoteResult> {
    const catalog = await this.catalogReadService.getPublicCatalog();
    const items = dto.items.map((item) => {
      const category = catalog.categories.find(
        (candidate) => candidate.slug === item.categorySlug,
      );
      if (!category) {
        throw new BadRequestException({
          code: 'CATEGORY_INACTIVE',
          message: `Category '${item.categorySlug}' is not available`,
        });
      }
      const selected = this.validationService.validateSpecs(
        category,
        item.specs,
      );
      return this.priceItem(category, selected, item.quantity);
    });
    const subtotal = this.roundMoney(
      items.reduce((sum, item) => sum + item.printSubtotal, 0),
    );
    return {
      items,
      subtotal,
      deliveryFee: 0,
      serviceFee: 0,
      total: subtotal,
    };
  }

  private priceItem(
    category: CatalogCategory,
    selected: SelectedSpec[],
    quantity: number,
  ): QuoteItemResult {
    if (category.pricingModel === PricingModel.PER_PAGE_MODIFIERS) {
      return this.pricePerPage(category, selected, quantity);
    }
    if (category.pricingModel === PricingModel.BASE_PLUS_MATERIAL_ESTIMATE) {
      return this.priceBasePlusEstimate(category, selected, quantity);
    }
    throw new BadRequestException(
      `Unsupported pricing model ${category.pricingModel}`,
    );
  }

  private pricePerPage(
    category: CatalogCategory,
    selected: SelectedSpec[],
    quantity: number,
  ): QuoteItemResult {
    const pageCount = Number(
      selected.find((entry) => entry.spec.key === 'page_count')?.value ?? 1,
    );
    let multiplier = 1;
    let fixedFees = 0;
    for (const entry of selected) {
      if (entry.option && entry.spec.pricingRole === PricingRole.MULTIPLIER) {
        multiplier *= entry.option.multiplier;
      }
      if (entry.option && entry.spec.pricingRole === PricingRole.FIXED_FEE) {
        fixedFees += entry.option.fixedFee;
      }
    }
    const base = category.baseRate * pageCount * multiplier;
    const printSubtotal = this.roundMoney((base + fixedFees) * quantity);
    return {
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
      pricingModel: category.pricingModel,
      quantity,
      printSubtotal,
      specSnapshots: selected.map((entry) => this.toSnapshot(entry)),
      pricingBreakdown: [
        { label: 'Base', amount: this.roundMoney(base) },
        { label: 'Fixed fees', amount: this.roundMoney(fixedFees) },
      ],
    };
  }

  private priceBasePlusEstimate(
    category: CatalogCategory,
    selected: SelectedSpec[],
    quantity: number,
  ): QuoteItemResult {
    const material = selected.find(
      (entry) => entry.spec.pricingRole === PricingRole.UNIT_COST && entry.option,
    );
    const estimate = selected.find(
      (entry) =>
        entry.spec.pricingRole === PricingRole.ESTIMATED_QUANTITY &&
        entry.option,
    );
    const unitCost = material?.option?.unitCost ?? 0;
    const estimatedQuantity = estimate?.option?.estimatedQuantity ?? 0;
    const fixedFees = selected.reduce((sum, entry) => {
      if (entry.option && entry.spec.pricingRole === PricingRole.FIXED_FEE) {
        return sum + entry.option.fixedFee;
      }
      return sum;
    }, 0);
    const materialEstimate = estimatedQuantity * unitCost;
    const printSubtotal = this.roundMoney(
      (category.baseRate + materialEstimate + fixedFees) * quantity,
    );
    return {
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
      pricingModel: category.pricingModel,
      quantity,
      printSubtotal,
      specSnapshots: selected.map((entry) => this.toSnapshot(entry)),
      pricingBreakdown: [
        { label: 'Base', amount: category.baseRate },
        { label: 'Material estimate', amount: this.roundMoney(materialEstimate) },
        { label: 'Fixed fees', amount: this.roundMoney(fixedFees) },
      ],
    };
  }

  private toSnapshot(entry: SelectedSpec): SpecSnapshotDraft {
    return {
      specDefinitionId: entry.spec.id,
      specKey: entry.spec.key,
      specLabel: entry.spec.label,
      inputType: entry.spec.inputType,
      value: String(entry.value ?? ''),
      displayValue: entry.displayValue,
      optionId: entry.option?.id ?? null,
      optionLabel: entry.option?.label ?? null,
      multiplier: entry.option?.multiplier ?? 1,
      fixedFee: entry.option?.fixedFee ?? 0,
      unitCost: entry.option?.unitCost ?? 0,
      estimatedQuantity: entry.option?.estimatedQuantity ?? null,
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
