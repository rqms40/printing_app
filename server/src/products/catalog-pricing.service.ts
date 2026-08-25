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
      return this.priceItem(
        category,
        selected,
        item.quantity,
        item.addonIds ?? [],
      );
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
    addonIds: number[],
  ): QuoteItemResult {
    if (category.pricingModel === PricingModel.PER_PAGE_MODIFIERS) {
      return this.pricePerPage(category, selected, quantity, addonIds);
    }
    if (category.pricingModel === PricingModel.BASE_PLUS_MATERIAL_ESTIMATE) {
      return this.priceBasePlusEstimate(category, selected, quantity, addonIds);
    }
    throw new BadRequestException(
      `Unsupported pricing model ${String(category.pricingModel)}`,
    );
  }

  private pricePerPage(
    category: CatalogCategory,
    selected: SelectedSpec[],
    quantity: number,
    addonIds: number[],
  ): QuoteItemResult {
    const pageCount = Number(
      selected.find((entry) => entry.spec.key === 'page_count')?.value ?? 1,
    );
    let multiplier = 1;
    let fixedFees = 0;
    let unitRate = Number(category.baseRate) || 0;
    for (const entry of selected) {
      if (entry.option && entry.spec.pricingRole === PricingRole.MULTIPLIER) {
        multiplier *= entry.option.multiplier;
      }
      if (entry.option && entry.spec.pricingRole === PricingRole.FIXED_FEE) {
        fixedFees += entry.option.fixedFee;
      }
      if (
        entry.option &&
        entry.spec.pricingRole === PricingRole.UNIT_COST &&
        Number(entry.option.unitCost) > 0
      ) {
        unitRate = Number(entry.option.unitCost);
      }
    }
    const area = this.billedArea(selected);
    const units =
      (Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1) * area;
    const base = unitRate * units * multiplier;
    const addonTotal = this.addonTotal(category, addonIds, quantity, area);
    const printSubtotal = this.roundMoney(
      (base + fixedFees) * quantity + addonTotal,
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
        { label: 'Base', amount: this.roundMoney(base) },
        { label: 'Fixed fees', amount: this.roundMoney(fixedFees) },
        { label: 'Add-ons', amount: addonTotal },
      ],
    };
  }

  private priceBasePlusEstimate(
    category: CatalogCategory,
    selected: SelectedSpec[],
    quantity: number,
    addonIds: number[],
  ): QuoteItemResult {
    const material = selected.find(
      (entry) =>
        entry.spec.pricingRole === PricingRole.UNIT_COST && entry.option,
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
    const addonTotal = this.addonTotal(
      category,
      addonIds,
      quantity,
      estimatedQuantity || 1,
    );
    const printSubtotal = this.roundMoney(
      (category.baseRate + materialEstimate + fixedFees) * quantity +
        addonTotal,
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
        {
          label: 'Material estimate',
          amount: this.roundMoney(materialEstimate),
        },
        { label: 'Fixed fees', amount: this.roundMoney(fixedFees) },
        { label: 'Add-ons', amount: addonTotal },
      ],
    };
  }

  private billedArea(selected: SelectedSpec[]): number {
    let area = 1;
    let minCharge = 0;
    for (const entry of selected) {
      const specMeta = (entry.spec.metadata ?? {}) as {
        minChargeArea?: number;
      };
      if (entry.spec.key === 'size' && Number(specMeta.minChargeArea) > 0) {
        minCharge = Number(specMeta.minChargeArea);
      }
      const optionMeta = (entry.option?.metadata ?? {}) as {
        outsourced?: boolean;
      };
      if (optionMeta.outsourced) {
        throw new BadRequestException({
          code: 'SIZE_OUTSOURCED',
          message:
            'This size exceeds in-house maximum and must be quoted separately',
        });
      }
      if (entry.option && Number(entry.option.estimatedQuantity) > 0) {
        area = Number(entry.option.estimatedQuantity);
      }
    }
    if (minCharge > area) return minCharge;
    return area;
  }

  private addonTotal(
    category: CatalogCategory,
    addonIds: number[],
    quantity: number,
    billedArea: number,
  ): number {
    if (!addonIds.length) return 0;
    const addons = category.addons ?? [];
    let sum = 0;
    for (const id of addonIds) {
      const addon = addons.find((entry) => entry.id === id && entry.isActive);
      if (!addon) continue;
      const price = Number(addon.price) || 0;
      if (String(addon.priceType) === 'per_unit') {
        sum += price * billedArea * quantity;
      } else {
        sum += price * quantity;
      }
    }
    return this.roundMoney(sum);
  }

  private toSnapshot(entry: SelectedSpec): SpecSnapshotDraft {
    return {
      specDefinitionId: entry.spec.id,
      specKey: entry.spec.key,
      specLabel: entry.spec.label,
      inputType: entry.spec.inputType,
      value:
        entry.value == null
          ? ''
          : typeof entry.value === 'object'
            ? JSON.stringify(entry.value)
            : String(entry.value as string | number | boolean),
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
