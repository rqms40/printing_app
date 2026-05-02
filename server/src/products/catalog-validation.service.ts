import { BadRequestException, Injectable } from '@nestjs/common';

import { ProductSpecDefinition } from './entities/product-spec-definition.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { CatalogCategory } from './catalog-read.service';
import { InputType, ValueType } from './enums/catalog.enums';

export interface SelectedSpec {
  spec: ProductSpecDefinition;
  option: ProductSpecOption | null;
  value: unknown;
  displayValue: string;
}

@Injectable()
export class CatalogValidationService {
  validateSpecs(
    category: CatalogCategory,
    rawSpecs: Record<string, unknown> = {},
  ): SelectedSpec[] {
    const specs = category.specs ?? [];
    return specs.map((spec) => this.validateSpec(category.slug, spec, rawSpecs));
  }

  private validateSpec(
    categorySlug: string,
    spec: ProductSpecDefinition,
    rawSpecs: Record<string, unknown>,
  ): SelectedSpec {
    const rawValue = rawSpecs[spec.key] ?? spec.defaultValue;
    if (
      spec.isRequired &&
      (rawValue == null || (typeof rawValue === 'string' && rawValue.trim() === ''))
    ) {
      throw new BadRequestException({
        code: 'SPEC_REQUIRED',
        message: `${spec.label} is required`,
        category: categorySlug,
        specKey: spec.key,
      });
    }

    if (rawValue == null || rawValue === '') {
      return { spec, option: null, value: '', displayValue: '' };
    }

    if (spec.inputType === InputType.SELECT) {
      const value = String(rawValue);
      const option = (spec.options ?? []).find((entry) => entry.value === value);
      if (!option) {
        throw new BadRequestException({
          code: 'SPEC_OPTION_INACTIVE',
          message: `${spec.label} option '${value}' is not available`,
          category: categorySlug,
          specKey: spec.key,
        });
      }
      return { spec, option, value, displayValue: option.label };
    }

    if (spec.valueType === ValueType.NUMBER) {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        throw new BadRequestException({
          code: 'SPEC_INVALID_NUMBER',
          message: `${spec.label} must be a number`,
          category: categorySlug,
          specKey: spec.key,
        });
      }
      if (spec.minValue != null && value < spec.minValue) {
        throw new BadRequestException({
          code: 'SPEC_BELOW_MIN',
          message: `${spec.label} must be at least ${spec.minValue}`,
          category: categorySlug,
          specKey: spec.key,
        });
      }
      if (spec.maxValue != null && value > spec.maxValue) {
        throw new BadRequestException({
          code: 'SPEC_ABOVE_MAX',
          message: `${spec.label} must be at most ${spec.maxValue}`,
          category: categorySlug,
          specKey: spec.key,
        });
      }
      return { spec, option: null, value, displayValue: String(value) };
    }

    if (spec.valueType === ValueType.BOOLEAN) {
      const value =
        rawValue === true ||
        rawValue === 'true' ||
        rawValue === 'yes' ||
        rawValue === '1';
      return { spec, option: null, value, displayValue: value ? 'Yes' : 'No' };
    }

    const value = String(rawValue);
    return { spec, option: null, value, displayValue: value };
  }
}
