# Dynamic Product Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh-migration, server-driven product catalog so admin controls categories/specs/options, mobile renders order flows from database data, and server validates/recomputes all quote/order pricing.

**Architecture:** Add first-class catalog entities for categories, spec definitions, and spec options. Add catalog read/validation/pricing services in `server/src/products`, then wire quote/order creation through those services. Admin manages the catalog structure; mobile consumes active catalog payloads and submits generic selected specs.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL, Jest, React 18 + Ant Design admin, Flutter + Riverpod mobile.

---

## Scope And Sequencing

This is a full-stack feature. Implement tasks in order because later tasks depend on the server catalog API and quote contract. Do not reset the working tree; this repo may contain unrelated user changes.

The plan intentionally keeps pricing formulas in server code. Database records provide formula inputs only.

## Current Code Drift Notes

Reviewed again on 2026-05-02 at `dbeb735`. The worktree also had unrelated dirty landing-page files; ignore those while implementing catalog work.

- Preserve recent mobile tutorial and checkout coach-mark state when changing category, spec, upload, checkout, and payment screens.
- Preserve recent upload support: paper uploads now include `tif` and `tiff`; both the initial upload screen and edit-item replacement picker must read active catalog extensions instead of `AppConstants`.
- Preserve current `OrdersService.createBatch` behavior for PH-local same-day slot validation, 3D bounds validation, delivery/priority/extra-destination fee calculation, credits/payment handling, slot broadcasts, notifications, and post-delivery survey triggers while adding catalog pricing.
- Use a migration timestamp newer than the existing `1777593600000-add-beta-testimonial-columns.ts`.

---

## File Structure

### Server

- Create `server/src/products/enums/catalog.enums.ts` for catalog enum constants.
- Create `server/src/products/entities/product-category.entity.ts` for top-level orderable categories.
- Create `server/src/products/entities/product-spec-definition.entity.ts` for category-specific fields.
- Create `server/src/products/entities/product-spec-option.entity.ts` for selectable field values.
- Modify `server/src/products/entities/service-addon.entity.ts` to reference `ProductCategory`.
- Create `server/src/orders/entities/order-item-spec-value.entity.ts` for generic order spec snapshots.
- Modify `server/src/orders/entities/order-item.entity.ts` to store category snapshots and relation to spec values.
- Keep `server/src/orders/entities/paper-specs.entity.ts` and `server/src/orders/entities/three-d-specs.entity.ts` only until all consumers are migrated; then remove them in the cleanup task.
- Create `server/src/products/dto/create-spec-definition.dto.ts`.
- Create `server/src/products/dto/update-spec-definition.dto.ts`.
- Create `server/src/products/dto/create-spec-option-v2.dto.ts`.
- Create `server/src/products/dto/update-spec-option-v2.dto.ts`.
- Create `server/src/orders/dto/quote-order.dto.ts`.
- Create `server/src/products/catalog-read.service.ts`.
- Create `server/src/products/catalog-validation.service.ts`.
- Create `server/src/products/catalog-pricing.service.ts`.
- Modify `server/src/products/products.module.ts`, `server/src/products/products.controller.ts`, `server/src/products/products.service.ts`.
- Modify `server/src/orders/orders.module.ts`, `server/src/orders/orders.controller.ts`, `server/src/orders/orders.service.ts`.
- Modify `server/src/seed.ts`.
- Create migration `server/migrations/1777680000000-dynamic-product-catalog.ts`.

### Admin

- Modify `admin/src/types/products.ts`.
- Modify `admin/src/utils/api-normalizers.ts` and `admin/src/utils/api-normalizers.test.ts`.
- Replace internals of `admin/src/pages/products/list.tsx`.
- Replace internals of `admin/src/pages/products/options.tsx`.
- Modify `admin/src/pages/products-addons/list.tsx`.
- Keep route paths in `admin/src/App.tsx`: `/products`, `/products/:id/options`, `/products-addons`.

### Mobile

- Create `apps/mobile/lib/features/customer/order/catalog/models/product_catalog.dart`.
- Create `apps/mobile/lib/features/customer/order/catalog/providers/catalog_provider.dart`.
- Create `apps/mobile/lib/features/customer/order/catalog/providers/quote_provider.dart`.
- Create `apps/mobile/lib/features/customer/order/catalog/widgets/dynamic_spec_field.dart`.
- Modify `apps/mobile/lib/features/customer/order/screens/category_screen.dart`.
- Modify `apps/mobile/lib/features/customer/order/screens/paper_specs_screen.dart`.
- Modify `apps/mobile/lib/features/customer/order/screens/three_d_specs_screen.dart`.
- Modify `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`.
- Modify `apps/mobile/lib/features/customer/cart/models/cart_item.dart`.
- Modify `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`.
- Modify checkout item/edit widgets, especially `apps/mobile/lib/features/customer/order/sheets/edit_item_sheet.dart`, that display, edit, or replace files for paper/3D enum specs.
- Keep old enum files until checkout/order parsing is migrated; remove obsolete pricing use in the cleanup task.

---

### Task 1: Server Catalog Entities

**Files:**
- Create: `server/src/products/enums/catalog.enums.ts`
- Create: `server/src/products/entities/product-category.entity.ts`
- Create: `server/src/products/entities/product-spec-definition.entity.ts`
- Create: `server/src/products/entities/product-spec-option.entity.ts`
- Modify: `server/src/products/entities/service-addon.entity.ts`
- Test: `server/src/products/entities/catalog-entity-metadata.spec.ts`

- [ ] **Step 1: Write the failing entity metadata test**

Create `server/src/products/entities/catalog-entity-metadata.spec.ts`:

```ts
import { getMetadataArgsStorage } from 'typeorm';

import { ProductCategory } from './product-category.entity';
import { ProductSpecDefinition } from './product-spec-definition.entity';
import { ProductSpecOption } from './product-spec-option.entity';
import { ServiceAddon } from './service-addon.entity';

describe('catalog entity metadata', () => {
  it('maps catalog tables with stable table names', () => {
    const tables = getMetadataArgsStorage().tables;

    expect(tables.find((t) => t.target === ProductCategory)?.name).toBe(
      'product_categories',
    );
    expect(tables.find((t) => t.target === ProductSpecDefinition)?.name).toBe(
      'product_spec_definitions',
    );
    expect(tables.find((t) => t.target === ProductSpecOption)?.name).toBe(
      'product_spec_options',
    );
  });

  it('uses jsonb for category extensions and metadata columns', () => {
    const columns = getMetadataArgsStorage().columns;
    const allowedExtensions = columns.find(
      (c) => c.target === ProductCategory && c.propertyName === 'allowedExtensions',
    );
    const categoryMetadata = columns.find(
      (c) => c.target === ProductSpecDefinition && c.propertyName === 'metadata',
    );
    const optionMetadata = columns.find(
      (c) => c.target === ProductSpecOption && c.propertyName === 'metadata',
    );

    expect(allowedExtensions?.options.type).toBe('jsonb');
    expect(categoryMetadata?.options.type).toBe('jsonb');
    expect(optionMetadata?.options.type).toBe('jsonb');
  });

  it('points service addons at product categories', () => {
    const relations = getMetadataArgsStorage().relations;
    const addonCategory = relations.find(
      (r) => r.target === ServiceAddon && r.propertyName === 'category',
    );

    expect(addonCategory?.type).toBe(ProductCategory);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd server
npm test -- products/entities/catalog-entity-metadata.spec.ts
```

Expected: FAIL because `product-category.entity.ts` and related entities do not exist.

- [ ] **Step 3: Add catalog enums**

Create `server/src/products/enums/catalog.enums.ts`:

```ts
export enum FileProcessingType {
  DOCUMENT = 'document',
  MODEL_3D = 'model_3d',
  GENERIC_FILE = 'generic_file',
}

export enum PricingModel {
  PER_PAGE_MODIFIERS = 'per_page_modifiers',
  BASE_PLUS_MATERIAL_ESTIMATE = 'base_plus_material_estimate',
}

export enum SpecInputType {
  SELECT = 'select',
  BOOLEAN = 'boolean',
  TEXT = 'text',
  NUMBER = 'number',
}

export enum SpecValueType {
  STRING = 'string',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
}

export enum PricingRole {
  NONE = 'none',
  MULTIPLIER = 'multiplier',
  FIXED_FEE = 'fixed_fee',
  UNIT_COST = 'unit_cost',
  ESTIMATED_QUANTITY = 'estimated_quantity',
}
```

- [ ] **Step 4: Add `ProductCategory` entity**

Create `server/src/products/entities/product-category.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  FileProcessingType,
  PricingModel,
} from '../enums/catalog.enums';
import { ProductSpecDefinition } from './product-spec-definition.entity';
import { ServiceAddon } from './service-addon.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('product_categories')
@Index('uq_product_categories_slug', ['slug'], { unique: true })
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'mobile_description', type: 'varchar', length: 160, nullable: true })
  mobileDescription: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({
    name: 'file_processing_type',
    type: 'varchar',
    length: 30,
    default: FileProcessingType.GENERIC_FILE,
  })
  fileProcessingType: FileProcessingType;

  @Column({
    name: 'pricing_model',
    type: 'varchar',
    length: 50,
  })
  pricingModel: PricingModel;

  @Column({
    name: 'base_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseRate: number;

  @Column({ name: 'quantity_unit', type: 'varchar', length: 30, default: 'copy' })
  quantityUnit: string;

  @Column({ name: 'max_file_size_mb', type: 'int', default: 50 })
  maxFileSizeMb: number;

  @Column({ name: 'allowed_extensions', type: 'jsonb', default: () => "'[]'::jsonb" })
  allowedExtensions: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => ProductSpecDefinition, (spec) => spec.category)
  specDefinitions: ProductSpecDefinition[];

  @OneToMany(() => ServiceAddon, (addon) => addon.category)
  addons: ServiceAddon[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 5: Add spec definition and option entities**

Create `server/src/products/entities/product-spec-definition.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  PricingRole,
  SpecInputType,
  SpecValueType,
} from '../enums/catalog.enums';
import { ProductCategory } from './product-category.entity';
import { ProductSpecOption } from './product-spec-option.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('product_spec_definitions')
@Index('uq_product_spec_key', ['categoryId', 'key'], { unique: true })
export class ProductSpecDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => ProductCategory, (category) => category.specDefinitions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory;

  @Column({ length: 50 })
  key: string;

  @Column({ length: 100 })
  label: string;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText: string | null;

  @Column({ name: 'input_type', type: 'varchar', length: 30 })
  inputType: SpecInputType;

  @Column({ name: 'value_type', type: 'varchar', length: 30 })
  valueType: SpecValueType;

  @Column({ name: 'is_required', default: true })
  isRequired: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'default_value', type: 'varchar', length: 100, nullable: true })
  defaultValue: string | null;

  @Column({
    name: 'pricing_role',
    type: 'varchar',
    length: 40,
    default: PricingRole.NONE,
  })
  pricingRole: PricingRole;

  @Column({ name: 'unit_label', type: 'varchar', length: 20, nullable: true })
  unitLabel: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  placeholder: string | null;

  @Column({ name: 'min_value', type: 'decimal', precision: 10, scale: 3, nullable: true, transformer: decimalTransformer })
  minValue: number | null;

  @Column({ name: 'max_value', type: 'decimal', precision: 10, scale: 3, nullable: true, transformer: decimalTransformer })
  maxValue: number | null;

  @Column({ name: 'step_value', type: 'decimal', precision: 10, scale: 3, nullable: true, transformer: decimalTransformer })
  stepValue: number | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => ProductSpecOption, (option) => option.specDefinition)
  options: ProductSpecOption[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

Create `server/src/products/entities/product-spec-option.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProductSpecDefinition } from './product-spec-definition.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('product_spec_options')
@Index('uq_product_spec_option_value', ['specDefinitionId', 'value'], {
  unique: true,
})
export class ProductSpecOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'spec_definition_id' })
  specDefinitionId: number;

  @ManyToOne(() => ProductSpecDefinition, (spec) => spec.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'spec_definition_id' })
  specDefinition: ProductSpecDefinition;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 50 })
  value: string;

  @Column({ type: 'decimal', precision: 8, scale: 3, default: 1, transformer: decimalTransformer })
  multiplier: number;

  @Column({ name: 'fixed_fee', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  fixedFee: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  unitCost: number;

  @Column({ name: 'estimated_quantity', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  estimatedQuantity: number | null;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 6: Point `ServiceAddon` at `ProductCategory`**

In `server/src/products/entities/service-addon.entity.ts`, replace the `ServiceCategory` import/relation with `ProductCategory`. Keep the table name `service_addons`:

```ts
import { ProductCategory } from './product-category.entity';
```

```ts
@ManyToOne(() => ProductCategory, (cat) => cat.addons, {
  nullable: true,
  onDelete: 'SET NULL',
})
@JoinColumn({ name: 'category_id' })
category: ProductCategory | null;
```

- [ ] **Step 7: Run the entity test**

Run:

```bash
cd server
npm test -- products/entities/catalog-entity-metadata.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/products/enums/catalog.enums.ts server/src/products/entities/product-category.entity.ts server/src/products/entities/product-spec-definition.entity.ts server/src/products/entities/product-spec-option.entity.ts server/src/products/entities/service-addon.entity.ts server/src/products/entities/catalog-entity-metadata.spec.ts
git commit -m "feat(server): add dynamic catalog entities"
```

---

### Task 2: Server Catalog Module Wiring And DTOs

**Files:**
- Modify: `server/src/products/products.module.ts`
- Create: `server/src/products/dto/create-spec-definition.dto.ts`
- Create: `server/src/products/dto/update-spec-definition.dto.ts`
- Create: `server/src/products/dto/create-spec-option-v2.dto.ts`
- Create: `server/src/products/dto/update-spec-option-v2.dto.ts`
- Modify: `server/src/products/dto/create-category.dto.ts`
- Modify: `server/src/products/dto/update-category.dto.ts`
- Test: `server/src/products/products.module.spec.ts`

- [ ] **Step 1: Write module wiring test**

Create `server/src/products/products.module.spec.ts`:

```ts
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductCategory } from './entities/product-category.entity';
import { ProductSpecDefinition } from './entities/product-spec-definition.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { ProductsModule } from './products.module';

describe('ProductsModule', () => {
  it('registers the dynamic catalog entities with TypeOrmModule', () => {
    const typeOrmImport = Reflect.getMetadata('imports', ProductsModule).find(
      (entry: { module?: unknown }) => entry.module === TypeOrmModule,
    );

    const entities = typeOrmImport.providers
      .map((provider: { provide?: string }) => provider.provide)
      .join(' ');

    expect(entities).toContain(ProductCategory.name);
    expect(entities).toContain(ProductSpecDefinition.name);
    expect(entities).toContain(ProductSpecOption.name);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd server
npm test -- products/products.module.spec.ts
```

Expected: FAIL because `ProductsModule` still registers old entities.

- [ ] **Step 3: Add spec-definition DTOs**

Create `server/src/products/dto/create-spec-definition.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PricingRole,
  SpecInputType,
  SpecValueType,
} from '../enums/catalog.enums';

export class CreateSpecDefinitionDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  categoryId: number;

  @ApiProperty({ example: 'paper_size' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/)
  key: string;

  @ApiProperty({ example: 'Paper Size' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiProperty({ enum: SpecInputType })
  @IsEnum(SpecInputType)
  inputType: SpecInputType;

  @ApiProperty({ enum: SpecValueType })
  @IsEnum(SpecValueType)
  valueType: SpecValueType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultValue?: string;

  @ApiPropertyOptional({ enum: PricingRole })
  @IsOptional()
  @IsEnum(PricingRole)
  pricingRole?: PricingRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stepValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
```

Create `server/src/products/dto/update-spec-definition.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger';

import { CreateSpecDefinitionDto } from './create-spec-definition.dto';

export class UpdateSpecDefinitionDto extends PartialType(
  CreateSpecDefinitionDto,
) {}
```

- [ ] **Step 4: Add option DTOs**

Create `server/src/products/dto/create-spec-option-v2.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSpecOptionV2Dto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  specDefinitionId: number;

  @ApiProperty({ example: 'A4' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiProperty({ example: 'a4' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9_\\.]+$/)
  value: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  multiplier?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedFee?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedQuantity?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
```

Create `server/src/products/dto/update-spec-option-v2.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger';

import { CreateSpecOptionV2Dto } from './create-spec-option-v2.dto';

export class UpdateSpecOptionV2Dto extends PartialType(CreateSpecOptionV2Dto) {}
```

- [ ] **Step 5: Update category DTOs for the new entity fields**

Modify `server/src/products/dto/create-category.dto.ts` so it includes:

```ts
import { IsArray, IsEnum } from 'class-validator';
import {
  FileProcessingType,
  PricingModel,
} from '../enums/catalog.enums';
```

Add fields:

```ts
@ApiPropertyOptional()
@IsOptional()
@IsString()
@MaxLength(160)
mobileDescription?: string;

@ApiProperty({ enum: FileProcessingType })
@IsEnum(FileProcessingType)
fileProcessingType: FileProcessingType;

@ApiProperty({ enum: PricingModel })
@IsEnum(PricingModel)
pricingModel: PricingModel;

@ApiPropertyOptional({ example: 'copy' })
@IsOptional()
@IsString()
@MaxLength(30)
quantityUnit?: string;

@ApiProperty({ example: ['pdf', 'png'] })
@IsArray()
@IsString({ each: true })
allowedExtensions: string[];
```

Remove the old string-only `allowedExtensions` property. Update `UpdateCategoryDto` if it uses `PartialType`; no extra code is needed after `CreateCategoryDto` changes.

- [ ] **Step 6: Update `ProductsModule`**

Modify `server/src/products/products.module.ts`:

```ts
import { ProductCategory } from './entities/product-category.entity';
import { ProductSpecDefinition } from './entities/product-spec-definition.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { CatalogReadService } from './catalog-read.service';
import { CatalogValidationService } from './catalog-validation.service';
import { CatalogPricingService } from './catalog-pricing.service';
```

Register:

```ts
TypeOrmModule.forFeature([
  ProductCategory,
  ProductSpecDefinition,
  ProductSpecOption,
  ServiceAddon,
])
```

Providers/exports:

```ts
providers: [
  ProductsService,
  CatalogReadService,
  CatalogValidationService,
  CatalogPricingService,
],
exports: [
  ProductsService,
  CatalogReadService,
  CatalogValidationService,
  CatalogPricingService,
],
```

Create temporary empty service classes in the same task so the module compiles:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CatalogReadService {}
```

Repeat for `CatalogValidationService` and `CatalogPricingService`; later tasks replace the bodies.

- [ ] **Step 7: Run module and products tests**

Run:

```bash
cd server
npm test -- products/products.module.spec.ts products/entities/catalog-entity-metadata.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/products
git commit -m "feat(server): wire dynamic catalog module"
```

---

### Task 3: Server Public Catalog Read Service

**Files:**
- Create: `server/src/products/catalog.types.ts`
- Modify: `server/src/products/catalog-read.service.ts`
- Modify: `server/src/products/products.controller.ts`
- Modify: `server/src/products/products.service.ts`
- Test: `server/src/products/catalog-read.service.spec.ts`

- [ ] **Step 1: Write the catalog read service test**

Create `server/src/products/catalog-read.service.spec.ts`:

```ts
import { CatalogReadService } from './catalog-read.service';
import { FileProcessingType, PricingModel, PricingRole, SpecInputType, SpecValueType } from './enums/catalog.enums';

describe('CatalogReadService', () => {
  it('returns only active categories, specs, options, and addons in display order', async () => {
    const categoryRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          slug: 'paper',
          name: 'Paper Printing',
          mobileDescription: 'Documents',
          description: 'Standard printing',
          icon: 'file-text',
          fileProcessingType: FileProcessingType.DOCUMENT,
          pricingModel: PricingModel.PER_PAGE_MODIFIERS,
          baseRate: 2,
          quantityUnit: 'copy',
          maxFileSizeMb: 50,
          allowedExtensions: ['pdf'],
          isActive: true,
          sortOrder: 1,
          specDefinitions: [
            {
              id: 10,
              key: 'paper_size',
              label: 'Paper Size',
              inputType: SpecInputType.SELECT,
              valueType: SpecValueType.STRING,
              isRequired: true,
              isActive: true,
              defaultValue: null,
              pricingRole: PricingRole.MULTIPLIER,
              sortOrder: 1,
              options: [
                { id: 101, label: 'A4', value: 'a4', multiplier: 1, fixedFee: 0, unitCost: 0, estimatedQuantity: null, isDefault: true, isActive: true, sortOrder: 1 },
                { id: 102, label: 'A3', value: 'a3', multiplier: 1.5, fixedFee: 0, unitCost: 0, estimatedQuantity: null, isDefault: false, isActive: false, sortOrder: 2 },
              ],
            },
          ],
          addons: [
            { id: 1001, name: 'Rush', description: null, price: 150, priceType: 'flat', isActive: true, sortOrder: 1 },
            { id: 1002, name: 'Hidden', description: null, price: 1, priceType: 'flat', isActive: false, sortOrder: 2 },
          ],
        },
      ]),
    };

    const service = new CatalogReadService(categoryRepo as any);
    const catalog = await service.getPublicCatalog();

    expect(categoryRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      relations: {
        specDefinitions: { options: true },
        addons: true,
      },
      order: {
        sortOrder: 'ASC',
        id: 'ASC',
        specDefinitions: {
          sortOrder: 'ASC',
          id: 'ASC',
          options: { sortOrder: 'ASC', id: 'ASC' },
        },
        addons: { sortOrder: 'ASC', id: 'ASC' },
      },
    });
    expect(catalog.categories).toHaveLength(1);
    expect(catalog.categories[0].specs[0].options).toEqual([
      expect.objectContaining({ value: 'a4' }),
    ]);
    expect(catalog.categories[0].addons).toEqual([
      expect.objectContaining({ name: 'Rush' }),
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:

```bash
cd server
npm test -- products/catalog-read.service.spec.ts
```

Expected: FAIL because `getPublicCatalog` does not exist.

- [ ] **Step 3: Add catalog payload types**

Create `server/src/products/catalog.types.ts`:

```ts
import {
  FileProcessingType,
  PricingModel,
  PricingRole,
  SpecInputType,
  SpecValueType,
} from './enums/catalog.enums';

export interface PublicCatalogOption {
  id: number;
  label: string;
  value: string;
  multiplier: number;
  fixedFee: number;
  unitCost: number;
  estimatedQuantity: number | null;
  isDefault: boolean;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}

export interface PublicCatalogSpec {
  id: number;
  key: string;
  label: string;
  helpText: string | null;
  inputType: SpecInputType;
  valueType: SpecValueType;
  isRequired: boolean;
  defaultValue: string | null;
  pricingRole: PricingRole;
  unitLabel: string | null;
  placeholder: string | null;
  minValue: number | null;
  maxValue: number | null;
  stepValue: number | null;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
  options: PublicCatalogOption[];
}

export interface PublicCatalogAddon {
  id: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  price: number;
  priceType: string;
  sortOrder: number;
}

export interface PublicCatalogCategory {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  mobileDescription: string | null;
  icon: string | null;
  fileProcessingType: FileProcessingType;
  pricingModel: PricingModel;
  baseRate: number;
  quantityUnit: string;
  maxFileSizeMb: number;
  allowedExtensions: string[];
  sortOrder: number;
  specs: PublicCatalogSpec[];
  addons: PublicCatalogAddon[];
}

export interface PublicCatalogResponse {
  categories: PublicCatalogCategory[];
}
```

- [ ] **Step 4: Implement `CatalogReadService`**

Replace `server/src/products/catalog-read.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  PublicCatalogCategory,
  PublicCatalogResponse,
} from './catalog.types';
import { ProductCategory } from './entities/product-category.entity';

@Injectable()
export class CatalogReadService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  async getPublicCatalog(): Promise<PublicCatalogResponse> {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      relations: {
        specDefinitions: { options: true },
        addons: true,
      },
      order: {
        sortOrder: 'ASC',
        id: 'ASC',
        specDefinitions: {
          sortOrder: 'ASC',
          id: 'ASC',
          options: { sortOrder: 'ASC', id: 'ASC' },
        },
        addons: { sortOrder: 'ASC', id: 'ASC' },
      },
    });

    return { categories: categories.map((category) => this.toPublicCategory(category)) };
  }

  async getPublicCategoryBySlug(slug: string): Promise<PublicCatalogCategory> {
    const catalog = await this.getPublicCatalog();
    const category = catalog.categories.find((item) => item.slug === slug);
    if (!category) {
      throw new NotFoundException(`Active category '${slug}' was not found`);
    }
    return category;
  }

  private toPublicCategory(category: ProductCategory): PublicCatalogCategory {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      mobileDescription: category.mobileDescription,
      icon: category.icon,
      fileProcessingType: category.fileProcessingType,
      pricingModel: category.pricingModel,
      baseRate: Number(category.baseRate),
      quantityUnit: category.quantityUnit,
      maxFileSizeMb: category.maxFileSizeMb,
      allowedExtensions: category.allowedExtensions ?? [],
      sortOrder: category.sortOrder,
      specs: (category.specDefinitions ?? [])
        .filter((spec) => spec.isActive)
        .map((spec) => ({
          id: spec.id,
          key: spec.key,
          label: spec.label,
          helpText: spec.helpText,
          inputType: spec.inputType,
          valueType: spec.valueType,
          isRequired: spec.isRequired,
          defaultValue: spec.defaultValue,
          pricingRole: spec.pricingRole,
          unitLabel: spec.unitLabel,
          placeholder: spec.placeholder,
          minValue: spec.minValue == null ? null : Number(spec.minValue),
          maxValue: spec.maxValue == null ? null : Number(spec.maxValue),
          stepValue: spec.stepValue == null ? null : Number(spec.stepValue),
          sortOrder: spec.sortOrder,
          metadata: spec.metadata,
          options: (spec.options ?? [])
            .filter((option) => option.isActive)
            .map((option) => ({
              id: option.id,
              label: option.label,
              value: option.value,
              multiplier: Number(option.multiplier),
              fixedFee: Number(option.fixedFee),
              unitCost: Number(option.unitCost),
              estimatedQuantity:
                option.estimatedQuantity == null
                  ? null
                  : Number(option.estimatedQuantity),
              isDefault: option.isDefault,
              sortOrder: option.sortOrder,
              metadata: option.metadata,
            })),
        })),
      addons: (category.addons ?? [])
        .filter((addon) => addon.isActive)
        .map((addon) => ({
          id: addon.id,
          categoryId: addon.categoryId,
          name: addon.name,
          description: addon.description,
          price: Number(addon.price),
          priceType: addon.priceType,
          sortOrder: addon.sortOrder,
        })),
    };
  }
}
```

- [ ] **Step 5: Add public controller routes**

In `server/src/products/products.controller.ts`, inject `CatalogReadService` and add:

```ts
@Get('catalog')
getCatalog() {
  return this.catalogReadService.getPublicCatalog();
}

@Get('categories/:slug/catalog')
getCategoryCatalog(@Param('slug') slug: string) {
  return this.catalogReadService.getPublicCategoryBySlug(slug);
}
```

Keep `categories/:slug/catalog` above `categories/:id` to avoid route ambiguity.

- [ ] **Step 6: Run tests**

Run:

```bash
cd server
npm test -- products/catalog-read.service.spec.ts products/products.module.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/products
git commit -m "feat(server): expose public product catalog"
```

---

### Task 4: Server Catalog Validation And Pricing

**Files:**
- Modify: `server/src/products/catalog-validation.service.ts`
- Modify: `server/src/products/catalog-pricing.service.ts`
- Create: `server/src/orders/dto/quote-order.dto.ts`
- Test: `server/src/products/catalog-pricing.service.spec.ts`

- [ ] **Step 1: Write pricing service tests**

Create `server/src/products/catalog-pricing.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogValidationService } from './catalog-validation.service';
import { FileProcessingType, PricingModel, PricingRole, SpecInputType, SpecValueType } from './enums/catalog.enums';

const paperCategory = {
  id: 1,
  slug: 'paper',
  name: 'Paper Printing',
  description: null,
  mobileDescription: null,
  icon: null,
  fileProcessingType: FileProcessingType.DOCUMENT,
  pricingModel: PricingModel.PER_PAGE_MODIFIERS,
  baseRate: 2,
  quantityUnit: 'copy',
  maxFileSizeMb: 50,
  allowedExtensions: ['pdf'],
  sortOrder: 1,
  addons: [],
  specs: [
    {
      id: 1,
      key: 'paper_size',
      label: 'Paper Size',
      helpText: null,
      inputType: SpecInputType.SELECT,
      valueType: SpecValueType.STRING,
      isRequired: true,
      defaultValue: null,
      pricingRole: PricingRole.MULTIPLIER,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 1,
      metadata: null,
      options: [{ id: 10, label: 'A4', value: 'a4', multiplier: 1, fixedFee: 0, unitCost: 0, estimatedQuantity: null, isDefault: true, sortOrder: 1, metadata: null }],
    },
    {
      id: 2,
      key: 'color_mode',
      label: 'Color Mode',
      helpText: null,
      inputType: SpecInputType.SELECT,
      valueType: SpecValueType.STRING,
      isRequired: true,
      defaultValue: null,
      pricingRole: PricingRole.MULTIPLIER,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 2,
      metadata: null,
      options: [{ id: 20, label: 'Full Color', value: 'full_color', multiplier: 2.5, fixedFee: 0, unitCost: 0, estimatedQuantity: null, isDefault: true, sortOrder: 1, metadata: null }],
    },
    {
      id: 3,
      key: 'binding',
      label: 'Binding',
      helpText: null,
      inputType: SpecInputType.SELECT,
      valueType: SpecValueType.STRING,
      isRequired: true,
      defaultValue: null,
      pricingRole: PricingRole.FIXED_FEE,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 3,
      metadata: null,
      options: [{ id: 30, label: 'Spiral', value: 'spiral', multiplier: 1, fixedFee: 25, unitCost: 0, estimatedQuantity: null, isDefault: false, sortOrder: 1, metadata: null }],
    },
    {
      id: 4,
      key: 'page_count',
      label: 'Page Count',
      helpText: null,
      inputType: SpecInputType.NUMBER,
      valueType: SpecValueType.INTEGER,
      isRequired: true,
      defaultValue: '1',
      pricingRole: PricingRole.NONE,
      unitLabel: null,
      placeholder: null,
      minValue: 1,
      maxValue: null,
      stepValue: 1,
      sortOrder: 4,
      metadata: null,
      options: [],
    },
  ],
};

describe('CatalogPricingService', () => {
  const readService = {
    getPublicCatalog: jest.fn().mockResolvedValue({ categories: [paperCategory] }),
  };
  const validation = new CatalogValidationService();
  const service = new CatalogPricingService(readService as any, validation);

  it('computes paper pricing from selected active specs', async () => {
    const quote = await service.quote({
      items: [
        {
          categorySlug: 'paper',
          quantity: 2,
          specs: {
            paper_size: 'a4',
            color_mode: 'full_color',
            binding: 'spiral',
            page_count: 10,
          },
          addonIds: [],
        },
      ],
      deliveryOption: 'pickup',
    });

    expect(quote.items[0].printSubtotal).toBe(150);
    expect(quote.subtotal).toBe(150);
    expect(quote.total).toBe(150);
    expect(quote.items[0].specSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specKey: 'paper_size', value: 'a4', displayValue: 'A4' }),
        expect.objectContaining({ specKey: 'binding', fixedFee: 25 }),
      ]),
    );
  });

  it('rejects an unknown spec key', async () => {
    await expect(
      service.quote({
        items: [
          {
            categorySlug: 'paper',
            quantity: 1,
            specs: {
              paper_size: 'a4',
              color_mode: 'full_color',
              binding: 'spiral',
              page_count: 1,
              stale_key: 'bad',
            },
            addonIds: [],
          },
        ],
        deliveryOption: 'pickup',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd server
npm test -- products/catalog-pricing.service.spec.ts
```

Expected: FAIL because `quote` and validation behavior do not exist.

- [ ] **Step 3: Add quote DTO**

Create `server/src/orders/dto/quote-order.dto.ts`:

```ts
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteOrderItemDto {
  @IsString()
  categorySlug: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;

  @IsObject()
  specs: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  addonIds?: number[];
}

export class QuoteOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteOrderItemDto)
  items: QuoteOrderItemDto[];

  @IsString()
  @IsIn(['pickup', 'delivery'])
  deliveryOption: string;

  @IsOptional()
  @IsString()
  speedTier?: string;
}
```

- [ ] **Step 4: Implement validation service**

Replace `server/src/products/catalog-validation.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

import {
  PublicCatalogCategory,
  PublicCatalogOption,
  PublicCatalogSpec,
} from './catalog.types';
import { SpecInputType, SpecValueType } from './enums/catalog.enums';

export interface SelectedSpec {
  spec: PublicCatalogSpec;
  option: PublicCatalogOption | null;
  value: unknown;
  displayValue: string;
}

@Injectable()
export class CatalogValidationService {
  validateSpecs(
    category: PublicCatalogCategory,
    input: Record<string, unknown>,
  ): SelectedSpec[] {
    const specByKey = new Map(category.specs.map((spec) => [spec.key, spec]));
    for (const key of Object.keys(input)) {
      if (!specByKey.has(key)) {
        throw new BadRequestException({
          code: 'OPTION_INVALID',
          message: `Unknown spec '${key}' for category '${category.slug}'`,
        });
      }
    }

    return category.specs.map((spec) => {
      const rawValue = input[spec.key] ?? spec.defaultValue;
      if (spec.isRequired && (rawValue === undefined || rawValue === null || rawValue === '')) {
        throw new BadRequestException({
          code: 'SPEC_REQUIRED',
          message: `${spec.label} is required`,
        });
      }
      return this.validateOne(spec, rawValue);
    });
  }

  private validateOne(spec: PublicCatalogSpec, rawValue: unknown): SelectedSpec {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return { spec, option: null, value: rawValue, displayValue: '' };
    }

    if (spec.inputType === SpecInputType.SELECT) {
      const value = String(rawValue);
      const option = spec.options.find((candidate) => candidate.value === value);
      if (!option) {
        throw new BadRequestException({
          code: 'OPTION_INVALID',
          message: `${value} is not available for ${spec.label}`,
        });
      }
      return { spec, option, value, displayValue: option.label };
    }

    if (spec.inputType === SpecInputType.BOOLEAN) {
      const value = rawValue === true || rawValue === 'true';
      return { spec, option: null, value, displayValue: value ? 'Yes' : 'No' };
    }

    if (spec.inputType === SpecInputType.NUMBER) {
      const numberValue = Number(rawValue);
      if (!Number.isFinite(numberValue)) {
        throw new BadRequestException({
          code: 'OPTION_INVALID',
          message: `${spec.label} must be numeric`,
        });
      }
      if (spec.minValue != null && numberValue < spec.minValue) {
        throw new BadRequestException({
          code: 'OPTION_INVALID',
          message: `${spec.label} must be at least ${spec.minValue}`,
        });
      }
      if (spec.maxValue != null && numberValue > spec.maxValue) {
        throw new BadRequestException({
          code: 'OPTION_INVALID',
          message: `${spec.label} must be at most ${spec.maxValue}`,
        });
      }
      const value = spec.valueType === SpecValueType.INTEGER ? Math.trunc(numberValue) : numberValue;
      return { spec, option: null, value, displayValue: String(value) };
    }

    const value = String(rawValue);
    return { spec, option: null, value, displayValue: value };
  }
}
```

- [ ] **Step 5: Implement pricing service**

Replace `server/src/products/catalog-pricing.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

import { QuoteOrderDto } from '../orders/dto/quote-order.dto';
import { CatalogReadService } from './catalog-read.service';
import { CatalogValidationService, SelectedSpec } from './catalog-validation.service';
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
      const category = catalog.categories.find((candidate) => candidate.slug === item.categorySlug);
      if (!category) {
        throw new BadRequestException({
          code: 'CATEGORY_INACTIVE',
          message: `Category '${item.categorySlug}' is not available`,
        });
      }
      const selected = this.validationService.validateSpecs(category, item.specs);
      return this.priceItem(category, selected, item.quantity);
    });
    const subtotal = this.roundMoney(items.reduce((sum, item) => sum + item.printSubtotal, 0));
    return {
      items,
      subtotal,
      deliveryFee: 0,
      serviceFee: 0,
      total: subtotal,
    };
  }

  private priceItem(
    category: Awaited<ReturnType<CatalogReadService['getPublicCategoryBySlug']>>,
    selected: SelectedSpec[],
    quantity: number,
  ): QuoteItemResult {
    if (category.pricingModel === PricingModel.PER_PAGE_MODIFIERS) {
      return this.pricePerPage(category, selected, quantity);
    }
    if (category.pricingModel === PricingModel.BASE_PLUS_MATERIAL_ESTIMATE) {
      return this.priceBasePlusEstimate(category, selected, quantity);
    }
    throw new BadRequestException(`Unsupported pricing model ${category.pricingModel}`);
  }

  private pricePerPage(
    category: Awaited<ReturnType<CatalogReadService['getPublicCategoryBySlug']>>,
    selected: SelectedSpec[],
    quantity: number,
  ): QuoteItemResult {
    const pageCount = Number(selected.find((entry) => entry.spec.key === 'page_count')?.value ?? 1);
    let multiplier = 1;
    let fixedFees = 0;
    const snapshots = selected.map((entry) => this.toSnapshot(entry));
    for (const entry of selected) {
      if (entry.option && entry.spec.pricingRole === PricingRole.MULTIPLIER) {
        multiplier *= entry.option.multiplier;
      }
      if (entry.option && entry.spec.pricingRole === PricingRole.FIXED_FEE) {
        fixedFees += entry.option.fixedFee;
      }
    }
    const printSubtotal = this.roundMoney((category.baseRate * pageCount * multiplier + fixedFees) * quantity);
    return {
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
      pricingModel: category.pricingModel,
      quantity,
      printSubtotal,
      specSnapshots: snapshots,
      pricingBreakdown: [
        { label: 'Base', amount: this.roundMoney(category.baseRate * pageCount * multiplier) },
        { label: 'Fixed fees', amount: this.roundMoney(fixedFees) },
      ],
    };
  }

  private priceBasePlusEstimate(
    category: Awaited<ReturnType<CatalogReadService['getPublicCategoryBySlug']>>,
    selected: SelectedSpec[],
    quantity: number,
  ): QuoteItemResult {
    const material = selected.find((entry) => entry.spec.pricingRole === PricingRole.UNIT_COST && entry.option);
    const estimate = selected.find((entry) => entry.spec.pricingRole === PricingRole.ESTIMATED_QUANTITY && entry.option);
    const unitCost = material?.option?.unitCost ?? 0;
    const estimatedQuantity = estimate?.option?.estimatedQuantity ?? 0;
    const fixedFees = selected.reduce((sum, entry) => {
      if (entry.option && entry.spec.pricingRole === PricingRole.FIXED_FEE) {
        return sum + entry.option.fixedFee;
      }
      return sum;
    }, 0);
    const printSubtotal = this.roundMoney((category.baseRate + estimatedQuantity * unitCost + fixedFees) * quantity);
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
        { label: 'Material estimate', amount: this.roundMoney(estimatedQuantity * unitCost) },
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
```

This quote is authoritative for catalog item pricing and spec validation. Do not let mobile treat the placeholder `deliveryFee` and `serviceFee` values as final checkout delivery pricing unless this service is extended to use the same delivery settings and destination inputs as `OrdersService.createBatch`; final order creation must still recompute delivery, priority, and extra-destination fees server-side.

- [ ] **Step 6: Run pricing tests**

Run:

```bash
cd server
npm test -- products/catalog-pricing.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/products/catalog-validation.service.ts server/src/products/catalog-pricing.service.ts server/src/orders/dto/quote-order.dto.ts server/src/products/catalog-pricing.service.spec.ts
git commit -m "feat(server): add catalog quote pricing"
```

---

### Task 5: Server Quote Endpoint And Generic Order Snapshots

**Files:**
- Create: `server/src/orders/entities/order-item-spec-value.entity.ts`
- Modify: `server/src/orders/entities/order-item.entity.ts`
- Modify: `server/src/orders/orders.module.ts`
- Modify: `server/src/orders/orders.controller.ts`
- Modify: `server/src/orders/orders.service.ts`
- Test: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Add failing order quote/controller test**

In `server/src/orders/orders.service.spec.ts`, add a focused describe block using the existing test setup pattern:

```ts
describe('createBatch catalog pricing', () => {
  it('uses catalog pricing result instead of client totals', async () => {
    const pricing = {
      quote: jest.fn().mockResolvedValue({
        items: [
          {
            categoryId: 1,
            categorySlug: 'paper',
            categoryName: 'Paper Printing',
            pricingModel: 'per_page_modifiers',
            quantity: 1,
            printSubtotal: 2,
            specSnapshots: [
              {
                specDefinitionId: 10,
                specKey: 'paper_size',
                specLabel: 'Paper Size',
                inputType: 'select',
                value: 'a4',
                displayValue: 'A4',
                optionId: 100,
                optionLabel: 'A4',
                multiplier: 1,
                fixedFee: 0,
                unitCost: 0,
                estimatedQuantity: null,
              },
            ],
            pricingBreakdown: [],
          },
        ],
        subtotal: 2,
        deliveryFee: 0,
        serviceFee: 0,
        total: 2,
      }),
    };

    expect(pricing.quote).toBeDefined();
  });
});
```

This first assertion is intentionally small. Expand it after injecting `CatalogPricingService` into the real `OrdersService` setup in the same file.

- [ ] **Step 2: Create generic spec snapshot entity**

Create `server/src/orders/entities/order-item-spec-value.entity.ts`:

```ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { OrderItem } from './order-item.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('order_item_spec_values')
export class OrderItemSpecValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_item_id' })
  orderItemId: number;

  @ManyToOne(() => OrderItem, (item) => item.specValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ name: 'spec_definition_id', type: 'int', nullable: true })
  specDefinitionId: number | null;

  @Column({ name: 'spec_key', length: 50 })
  specKey: string;

  @Column({ name: 'spec_label', length: 100 })
  specLabel: string;

  @Column({ name: 'input_type', length: 30 })
  inputType: string;

  @Column({ length: 120 })
  value: string;

  @Column({ name: 'display_value', length: 120 })
  displayValue: string;

  @Column({ name: 'option_id', type: 'int', nullable: true })
  optionId: number | null;

  @Column({ name: 'option_label', type: 'varchar', length: 100, nullable: true })
  optionLabel: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 3, default: 1, transformer: decimalTransformer })
  multiplier: number;

  @Column({ name: 'fixed_fee', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  fixedFee: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  unitCost: number;

  @Column({ name: 'estimated_quantity', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  estimatedQuantity: number | null;
}
```

- [ ] **Step 3: Update `OrderItem`**

In `server/src/orders/entities/order-item.entity.ts`, add:

```ts
import { OneToMany } from 'typeorm';
import { OrderItemSpecValue } from './order-item-spec-value.entity';
```

Add columns:

```ts
@Column({ name: 'category_id', type: 'int', nullable: true })
categoryId: number | null;

@Column({ name: 'category_slug', length: 50, nullable: true })
categorySlug: string | null;

@Column({ name: 'category_name', length: 100, nullable: true })
categoryName: string | null;

@Column({ name: 'pricing_model', length: 50, nullable: true })
pricingModel: string | null;
```

Add relation:

```ts
@OneToMany(() => OrderItemSpecValue, (value) => value.orderItem)
specValues: OrderItemSpecValue[];
```

- [ ] **Step 4: Wire `OrdersModule`**

In `server/src/orders/orders.module.ts`:

```ts
import { ProductsModule } from '../products/products.module';
import { OrderItemSpecValue } from './entities/order-item-spec-value.entity';
```

Add `OrderItemSpecValue` to `TypeOrmModule.forFeature`.

Add `ProductsModule` to module imports.

- [ ] **Step 5: Add quote endpoint**

In `server/src/orders/orders.controller.ts`, inject or use existing `OrdersService`, then add:

```ts
@Post('quote')
quote(@Body() dto: QuoteOrderDto) {
  return this.ordersService.quote(dto);
}
```

Import `QuoteOrderDto`.

- [ ] **Step 6: Integrate pricing in `OrdersService`**

In `server/src/orders/orders.service.ts`, inject:

```ts
private readonly catalogPricingService: CatalogPricingService,
@InjectRepository(OrderItemSpecValue)
private readonly orderItemSpecValueRepo: Repository<OrderItemSpecValue>,
```

Add method:

```ts
quote(dto: QuoteOrderDto) {
  return this.catalogPricingService.quote(dto);
}
```

At the start of `createBatch`, build a quote from `dto.items`:

```ts
const quote = await this.catalogPricingService.quote({
  items: dto.items.map((item) => ({
    categorySlug: item.category,
    quantity: Number(item.quantity ?? 1),
    specs: item.specs ?? {
      ...(item.paperSpecs ?? {}),
      ...(item.threeDSpecs ?? {}),
    },
    addonIds: item.addonIds ?? [],
  })),
  deliveryOption: dto.deliveryOption,
  speedTier: dto.speedTier,
});
```

Use `quote.items[index].printSubtotal` instead of `item.totalPrice` when creating order items. When saving each item, save spec snapshots:

```ts
for (const snapshot of quoteItem.specSnapshots) {
  await txSpecValueRepo.save(
    txSpecValueRepo.create({
      orderItemId: savedItem.id,
      ...snapshot,
    }),
  );
}
```

Keep legacy `paperSpecs`/`threeDSpecs` handling until mobile migrates. Once mobile uses generic specs, remove legacy branches in the cleanup task.

Preserve the existing non-catalog `createBatch` branches while inserting quote validation:

- Keep 3D printer bounds validation before the transaction rejects impossible models.
- Keep PH-local same-day bookable-slot validation when no `slotTemplateId` is provided.
- Keep current delivery type, speed tier, priority, and extra-destination fee calculation.
- Keep credits deduction, payment summary behavior, slot WebSocket broadcasts, and `notifyOrderPlaced` after the transaction.
- Keep post-delivery survey trigger logic in order status updates; catalog work must not move or delete it.

- [ ] **Step 7: Run server tests**

Run:

```bash
cd server
npm test -- orders/orders.service.spec.ts products/catalog-pricing.service.spec.ts
```

Expected: PASS after expanding the order-service mock providers to include `CatalogPricingService` and `OrderItemSpecValue`; keep the existing no-slot, printer-bounds, delivery-fee, credits, and survey-related tests passing.

- [ ] **Step 8: Commit**

```bash
git add server/src/orders server/src/products
git commit -m "feat(server): price orders from catalog quotes"
```

---

### Task 6: Migration And Seed Data

**Files:**
- Create: `server/migrations/1777680000000-dynamic-product-catalog.ts`
- Modify: `server/src/seed.ts`
- Modify: `server/src/seed.spec.ts`

- [ ] **Step 1: Add seed assertions**

Modify `server/src/seed.spec.ts`:

```ts
it('seeds dynamic product catalog tables', () => {
  const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

  expect(seedSource).toContain('product_categories');
  expect(seedSource).toContain('product_spec_definitions');
  expect(seedSource).toContain('product_spec_options');
  expect(seedSource).toContain('order_item_spec_values');
  expect(seedSource).toContain('per_page_modifiers');
  expect(seedSource).toContain('base_plus_material_estimate');
});
```

- [ ] **Step 2: Run seed test to verify it fails**

Run:

```bash
cd server
npm test -- seed.spec.ts
```

Expected: FAIL because seed still uses old tables.

- [ ] **Step 3: Create migration**

Create `server/migrations/1777680000000-dynamic-product-catalog.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DynamicProductCatalog1777680000000 implements MigrationInterface {
  name = 'DynamicProductCatalog1777680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "paper_specs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "three_d_specs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "spec_options" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_categories" CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "slug" varchar(50) NOT NULL UNIQUE,
        "description" text,
        "mobile_description" varchar(160),
        "icon" varchar(50),
        "file_processing_type" varchar(30) NOT NULL DEFAULT 'generic_file',
        "pricing_model" varchar(50) NOT NULL,
        "base_rate" numeric(10,2) NOT NULL,
        "quantity_unit" varchar(30) NOT NULL DEFAULT 'copy',
        "max_file_size_mb" integer NOT NULL DEFAULT 50,
        "allowed_extensions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_spec_definitions" (
        "id" SERIAL PRIMARY KEY,
        "category_id" integer NOT NULL REFERENCES "product_categories"("id") ON DELETE CASCADE,
        "key" varchar(50) NOT NULL,
        "label" varchar(100) NOT NULL,
        "help_text" text,
        "input_type" varchar(30) NOT NULL,
        "value_type" varchar(30) NOT NULL,
        "is_required" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "default_value" varchar(100),
        "pricing_role" varchar(40) NOT NULL DEFAULT 'none',
        "unit_label" varchar(20),
        "placeholder" varchar(120),
        "min_value" numeric(10,3),
        "max_value" numeric(10,3),
        "step_value" numeric(10,3),
        "sort_order" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_product_spec_key" UNIQUE ("category_id", "key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_spec_options" (
        "id" SERIAL PRIMARY KEY,
        "spec_definition_id" integer NOT NULL REFERENCES "product_spec_definitions"("id") ON DELETE CASCADE,
        "label" varchar(100) NOT NULL,
        "value" varchar(50) NOT NULL,
        "multiplier" numeric(8,3) NOT NULL DEFAULT 1,
        "fixed_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "unit_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "estimated_quantity" numeric(10,2),
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_product_spec_option_value" UNIQUE ("spec_definition_id", "value")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "order_item_spec_values" (
        "id" SERIAL PRIMARY KEY,
        "order_item_id" integer NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
        "spec_definition_id" integer,
        "spec_key" varchar(50) NOT NULL,
        "spec_label" varchar(100) NOT NULL,
        "input_type" varchar(30) NOT NULL,
        "value" varchar(120) NOT NULL,
        "display_value" varchar(120) NOT NULL,
        "option_id" integer,
        "option_label" varchar(100),
        "multiplier" numeric(8,3) NOT NULL DEFAULT 1,
        "fixed_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "unit_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "estimated_quantity" numeric(10,2)
      )
    `);

    await queryRunner.query(`ALTER TABLE "service_addons" DROP CONSTRAINT IF EXISTS "FK_service_addons_category"`);
    await queryRunner.query(`ALTER TABLE "service_addons" ADD CONSTRAINT "FK_service_addons_product_category" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_id" integer`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_slug" varchar(50)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_name" varchar(100)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "pricing_model" varchar(50)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_item_spec_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_spec_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_spec_definitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "pricing_model"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "category_name"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "category_slug"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "category_id"`);
  }
}
```

- [ ] **Step 4: Update seed data**

In `server/src/seed.ts`:

- Add `order_item_spec_values`, `product_spec_options`, `product_spec_definitions`, `product_categories` to the truncate list before dependent order tables.
- Replace old service category/spec option inserts with insert helpers that create:
  - paper category
  - paper spec definitions and options
  - 3D category
  - 3D spec definitions and options
  - addons pointing to `product_categories`

Use canonical values from the design spec. For paper allowed extensions, include `pdf`, `png`, `jpg`, `jpeg`, `tif`, `tiff`, `docx`. For 3D allowed extensions, include `stl`, `obj`, `3mf`, `glb`, `gltf`.

- [ ] **Step 5: Run seed tests**

Run:

```bash
cd server
npm test -- seed.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/1777680000000-dynamic-product-catalog.ts server/src/seed.ts server/src/seed.spec.ts
git commit -m "feat(server): seed dynamic product catalog"
```

---

### Task 7: Admin Types, Normalizers, And API Error Behavior

**Files:**
- Modify: `admin/src/types/products.ts`
- Modify: `admin/src/utils/api-normalizers.ts`
- Modify: `admin/src/utils/api-normalizers.test.ts`
- Modify: `admin/src/providers/mock-data.ts`

- [ ] **Step 1: Write normalizer tests**

In `admin/src/utils/api-normalizers.test.ts`, add:

```ts
import {
  normalizeProductCategory,
  normalizeProductSpecDefinition,
  normalizeProductSpecOption,
} from './api-normalizers';

describe('product catalog normalizers', () => {
  it('normalizes dynamic catalog category payloads', () => {
    expect(
      normalizeProductCategory({
        id: 1,
        name: 'Paper Printing',
        slug: 'paper',
        mobileDescription: 'Documents',
        fileProcessingType: 'document',
        pricingModel: 'per_page_modifiers',
        baseRate: '2.00',
        allowedExtensions: ['pdf'],
        isActive: true,
      }),
    ).toMatchObject({
      id: '1',
      slug: 'paper',
      file_processing_type: 'document',
      pricing_model: 'per_page_modifiers',
      base_rate: 2,
      allowed_extensions: ['pdf'],
      is_active: true,
    });
  });

  it('normalizes spec definitions and options', () => {
    expect(
      normalizeProductSpecDefinition({
        id: 10,
        categoryId: 1,
        key: 'paper_size',
        label: 'Paper Size',
        inputType: 'select',
        valueType: 'string',
        pricingRole: 'multiplier',
        isRequired: true,
        isActive: true,
        options: [{ id: 100, label: 'A4', value: 'a4', multiplier: '1.000' }],
      }),
    ).toMatchObject({
      key: 'paper_size',
      input_type: 'select',
      pricing_role: 'multiplier',
      options: [expect.objectContaining({ value: 'a4', multiplier: 1 })],
    });

    expect(
      normalizeProductSpecOption({
        id: 100,
        specDefinitionId: 10,
        label: 'A4',
        value: 'a4',
        fixedFee: '0',
      }),
    ).toMatchObject({ spec_definition_id: '10', fixed_fee: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd admin
npm test -- src/utils/api-normalizers.test.ts
```

Expected: FAIL because new normalizers/types do not exist.

- [ ] **Step 3: Update admin product types**

Replace product types in `admin/src/types/products.ts` with:

```ts
export type FileProcessingType = 'document' | 'model_3d' | 'generic_file';
export type PricingModel = 'per_page_modifiers' | 'base_plus_material_estimate';
export type SpecInputType = 'select' | 'boolean' | 'text' | 'number';
export type SpecValueType = 'string' | 'integer' | 'decimal' | 'boolean';
export type PricingRole = 'none' | 'multiplier' | 'fixed_fee' | 'unit_cost' | 'estimated_quantity';

export interface ProductSpecOption {
  id: string;
  spec_definition_id: string;
  label: string;
  value: string;
  multiplier: number;
  fixed_fee: number;
  unit_cost: number;
  estimated_quantity?: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  metadata?: Record<string, unknown>;
}

export interface ProductSpecDefinition {
  id: string;
  category_id: string;
  key: string;
  label: string;
  help_text?: string;
  input_type: SpecInputType;
  value_type: SpecValueType;
  is_required: boolean;
  is_active: boolean;
  default_value?: string;
  pricing_role: PricingRole;
  unit_label?: string;
  placeholder?: string;
  min_value?: number;
  max_value?: number;
  step_value?: number;
  sort_order: number;
  metadata?: Record<string, unknown>;
  options: ProductSpecOption[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  mobile_description?: string;
  icon?: string;
  file_processing_type: FileProcessingType;
  pricing_model: PricingModel;
  base_rate: number;
  quantity_unit: string;
  max_file_size_mb: number;
  allowed_extensions: string[];
  is_active: boolean;
  sort_order: number;
  specs?: ProductSpecDefinition[];
  created_at: string;
  updated_at: string;
}

export interface ServiceAddon {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  price_type: 'flat' | 'per_unit';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Add normalizers**

In `admin/src/utils/api-normalizers.ts`, add exports:

```ts
export function normalizeProductSpecOption(input: unknown): ProductSpecOption {
  const record = asRecord(input);
  const estimated = read(record, 'estimated_quantity', 'estimatedQuantity');
  return {
    id: toRequiredString(record, '', 'id'),
    spec_definition_id: toRequiredString(record, '', 'spec_definition_id', 'specDefinitionId'),
    label: toRequiredString(record, '', 'label'),
    value: toRequiredString(record, '', 'value'),
    multiplier: toNumberValue(record, 1, 'multiplier'),
    fixed_fee: toNumberValue(record, 0, 'fixed_fee', 'fixedFee'),
    unit_cost: toNumberValue(record, 0, 'unit_cost', 'unitCost'),
    estimated_quantity: estimated == null ? undefined : toNumberValue(record, 0, 'estimated_quantity', 'estimatedQuantity'),
    is_default: toBooleanValue(record, false, 'is_default', 'isDefault'),
    is_active: toBooleanValue(record, true, 'is_active', 'isActive'),
    sort_order: toNumberValue(record, 0, 'sort_order', 'sortOrder'),
    metadata: asRecord(read(record, 'metadata')),
  };
}

export function normalizeProductSpecDefinition(input: unknown): ProductSpecDefinition {
  const record = asRecord(input);
  const options = read(record, 'options');
  return {
    id: toRequiredString(record, '', 'id'),
    category_id: toRequiredString(record, '', 'category_id', 'categoryId'),
    key: toRequiredString(record, '', 'key'),
    label: toRequiredString(record, '', 'label'),
    help_text: toOptionalString(record, 'help_text', 'helpText'),
    input_type: toRequiredString(record, 'select', 'input_type', 'inputType') as SpecInputType,
    value_type: toRequiredString(record, 'string', 'value_type', 'valueType') as SpecValueType,
    is_required: toBooleanValue(record, true, 'is_required', 'isRequired'),
    is_active: toBooleanValue(record, true, 'is_active', 'isActive'),
    default_value: toOptionalString(record, 'default_value', 'defaultValue'),
    pricing_role: toRequiredString(record, 'none', 'pricing_role', 'pricingRole') as PricingRole,
    unit_label: toOptionalString(record, 'unit_label', 'unitLabel'),
    placeholder: toOptionalString(record, 'placeholder'),
    min_value: read(record, 'min_value', 'minValue') == null ? undefined : toNumberValue(record, 0, 'min_value', 'minValue'),
    max_value: read(record, 'max_value', 'maxValue') == null ? undefined : toNumberValue(record, 0, 'max_value', 'maxValue'),
    step_value: read(record, 'step_value', 'stepValue') == null ? undefined : toNumberValue(record, 0, 'step_value', 'stepValue'),
    sort_order: toNumberValue(record, 0, 'sort_order', 'sortOrder'),
    metadata: asRecord(read(record, 'metadata')),
    options: Array.isArray(options) ? options.map(normalizeProductSpecOption) : [],
  };
}

export function normalizeProductCategory(input: unknown): ServiceCategory {
  const record = asRecord(input);
  const specs = read(record, 'specs', 'specDefinitions');
  return {
    id: toRequiredString(record, '', 'id'),
    name: toRequiredString(record, '', 'name'),
    slug: toRequiredString(record, '', 'slug'),
    description: toOptionalString(record, 'description'),
    mobile_description: toOptionalString(record, 'mobile_description', 'mobileDescription'),
    icon: toOptionalString(record, 'icon'),
    file_processing_type: toRequiredString(record, 'generic_file', 'file_processing_type', 'fileProcessingType') as FileProcessingType,
    pricing_model: toRequiredString(record, 'per_page_modifiers', 'pricing_model', 'pricingModel') as PricingModel,
    base_rate: toNumberValue(record, 0, 'base_rate', 'baseRate'),
    quantity_unit: toRequiredString(record, 'copy', 'quantity_unit', 'quantityUnit'),
    max_file_size_mb: toNumberValue(record, 0, 'max_file_size_mb', 'maxFileSizeMb'),
    allowed_extensions: toStringArray(read(record, 'allowed_extensions', 'allowedExtensions')),
    is_active: toBooleanValue(record, true, 'is_active', 'isActive'),
    sort_order: toNumberValue(record, 0, 'sort_order', 'sortOrder'),
    specs: Array.isArray(specs) ? specs.map(normalizeProductSpecDefinition) : [],
    created_at: toRequiredString(record, EMPTY_DATE, 'created_at', 'createdAt'),
    updated_at: toRequiredString(record, EMPTY_DATE, 'updated_at', 'updatedAt'),
  };
}

export function normalizeProductCategories(payload: unknown): ServiceCategory[] {
  return Array.isArray(payload) ? payload.map(normalizeProductCategory) : [];
}
```

Update existing `normalizeServiceCategory` exports to delegate to `normalizeProductCategory` during migration:

```ts
export const normalizeServiceCategory = normalizeProductCategory;
export const normalizeServiceCategories = normalizeProductCategories;
```

- [ ] **Step 5: Remove silent product mock fallback**

Keep `mock-data.ts` for non-product pages, but product pages should show API errors after their UI updates in the next task. Do not delete mocks that unrelated tests import.

- [ ] **Step 6: Run admin tests**

Run:

```bash
cd admin
npm test -- src/utils/api-normalizers.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add admin/src/types/products.ts admin/src/utils/api-normalizers.ts admin/src/utils/api-normalizers.test.ts admin/src/providers/mock-data.ts
git commit -m "feat(admin): add dynamic catalog types"
```

---

### Task 8: Admin Category And Spec Management UI

**Files:**
- Modify: `admin/src/pages/products/list.tsx`
- Modify: `admin/src/pages/products/options.tsx`
- Modify: `admin/src/pages/products-addons/list.tsx`

- [ ] **Step 1: Update product category page fetch behavior**

In `admin/src/pages/products/list.tsx`, change category fetch to:

```ts
const fetchCategories = async () => {
  setLoading(true);
  try {
    const res = await apiClient.get('/products/categories?include_inactive=true');
    setCategories(normalizeProductCategories(res.data));
    setError(null);
  } catch (err) {
    setError('Could not load product categories. Check the API server and try again.');
  } finally {
    setLoading(false);
  }
};
```

Add an error branch:

```tsx
if (error) {
  return (
    <Result
      status="warning"
      title={error}
      extra={<Button onClick={fetchCategories}>Retry</Button>}
    />
  );
}
```

- [ ] **Step 2: Update category form fields**

In the category drawer, include:

```tsx
<Form.Item label="Mobile Description" name="mobileDescription">
  <Input maxLength={160} />
</Form.Item>
<Form.Item label="File Processing" name="fileProcessingType" rules={[{ required: true }]}>
  <Select
    options={[
      { value: 'document', label: 'Document' },
      { value: 'model_3d', label: '3D Model' },
      { value: 'generic_file', label: 'Generic File' },
    ]}
  />
</Form.Item>
<Form.Item label="Pricing Model" name="pricingModel" rules={[{ required: true }]}>
  <Select
    options={[
      { value: 'per_page_modifiers', label: 'Per-page modifiers' },
      { value: 'base_plus_material_estimate', label: 'Base + material estimate' },
    ]}
  />
</Form.Item>
<Form.Item label="Quantity Unit" name="quantityUnit">
  <Input placeholder="copy" />
</Form.Item>
<Form.Item label="Active" name="isActive" valuePropName="checked">
  <Switch />
</Form.Item>
```

Save payload should use camelCase fields:

```ts
const payload = {
  name: values.name,
  slug: values.slug,
  description: values.description,
  mobileDescription: values.mobileDescription,
  icon: values.icon,
  fileProcessingType: values.fileProcessingType,
  pricingModel: values.pricingModel,
  baseRate: values.base_rate,
  quantityUnit: values.quantityUnit ?? 'copy',
  maxFileSizeMb: values.max_file_size_mb,
  allowedExtensions: (values.allowed_extensions as string)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  isActive: values.isActive ?? true,
  sortOrder: values.sort_order ?? 0,
};
```

- [ ] **Step 3: Replace options page with spec-definition management**

In `admin/src/pages/products/options.tsx`, fetch:

```ts
const [catRes, specRes] = await Promise.all([
  apiClient.get(`/products/categories/${id!}`),
  apiClient.get(`/products/spec-definitions?category_id=${id!}`),
]);
setCategory(normalizeProductCategory(catRes.data));
setSpecs((Array.isArray(specRes.data) ? specRes.data : []).map(normalizeProductSpecDefinition));
```

Render one panel per spec. For option pricing columns:

```ts
const shouldShowMultiplier = spec.pricing_role === 'multiplier';
const shouldShowFixedFee = spec.pricing_role === 'fixed_fee';
const shouldShowUnitCost = spec.pricing_role === 'unit_cost';
const shouldShowEstimate = spec.pricing_role === 'estimated_quantity';
```

Add a "New Spec" button that posts:

```ts
await apiClient.post('/products/spec-definitions', {
  categoryId: Number(id),
  key: values.key,
  label: values.label,
  inputType: values.inputType,
  valueType: values.valueType,
  isRequired: values.isRequired ?? true,
  isActive: values.isActive ?? true,
  defaultValue: values.defaultValue,
  pricingRole: values.pricingRole ?? 'none',
  unitLabel: values.unitLabel,
  placeholder: values.placeholder,
  minValue: values.minValue,
  maxValue: values.maxValue,
  stepValue: values.stepValue,
  sortOrder: values.sortOrder ?? 0,
});
```

Option create posts to `/products/spec-options` with `specDefinitionId`.

- [ ] **Step 4: Update addons page**

In `admin/src/pages/products-addons/list.tsx`, keep existing layout but:

- Use `normalizeProductCategories`.
- Remove mock fallback.
- Add active switch to create/edit modal:

```tsx
<Form.Item label="Active" name="isActive" valuePropName="checked" initialValue>
  <Switch />
</Form.Item>
```

- [ ] **Step 5: Run admin build**

Run:

```bash
cd admin
npm run build
```

Expected: build completes without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add admin/src/pages/products/list.tsx admin/src/pages/products/options.tsx admin/src/pages/products-addons/list.tsx
git commit -m "feat(admin): manage dynamic product specs"
```

---

### Task 9: Mobile Catalog Models And Providers

**Files:**
- Create: `apps/mobile/lib/features/customer/order/catalog/models/product_catalog.dart`
- Create: `apps/mobile/lib/features/customer/order/catalog/providers/catalog_provider.dart`
- Create: `apps/mobile/lib/features/customer/order/catalog/providers/quote_provider.dart`
- Test: `apps/mobile/test/features/customer/order/catalog/product_catalog_test.dart`

- [ ] **Step 1: Write catalog parsing tests**

Create `apps/mobile/test/features/customer/order/catalog/product_catalog_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/catalog/models/product_catalog.dart';

void main() {
  test('parses catalog category with specs and options', () {
    final category = ProductCategoryCatalog.fromJson({
      'id': 1,
      'slug': 'paper',
      'name': 'Paper Printing',
      'fileProcessingType': 'document',
      'pricingModel': 'per_page_modifiers',
      'baseRate': 2,
      'quantityUnit': 'copy',
      'maxFileSizeMb': 50,
      'allowedExtensions': ['pdf'],
      'specs': [
        {
          'id': 10,
          'key': 'paper_size',
          'label': 'Paper Size',
          'inputType': 'select',
          'valueType': 'string',
          'isRequired': true,
          'pricingRole': 'multiplier',
          'options': [
            {'id': 100, 'label': 'A4', 'value': 'a4', 'isDefault': true}
          ],
        }
      ],
      'addons': [],
    });

    expect(category.slug, 'paper');
    expect(category.allowedExtensions, ['pdf']);
    expect(category.specs.single.defaultOption?.value, 'a4');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/order/catalog/product_catalog_test.dart
```

Expected: FAIL because catalog models do not exist.

- [ ] **Step 3: Add catalog models**

Create `apps/mobile/lib/features/customer/order/catalog/models/product_catalog.dart`:

```dart
class ProductCatalog {
  const ProductCatalog({required this.categories});

  final List<ProductCategoryCatalog> categories;

  factory ProductCatalog.fromJson(Map<String, dynamic> json) {
    final raw = json['categories'] as List<dynamic>? ?? const [];
    return ProductCatalog(
      categories: raw
          .whereType<Map>()
          .map((item) => ProductCategoryCatalog.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
    );
  }
}

class ProductCategoryCatalog {
  const ProductCategoryCatalog({
    required this.id,
    required this.slug,
    required this.name,
    required this.fileProcessingType,
    required this.pricingModel,
    required this.baseRate,
    required this.quantityUnit,
    required this.maxFileSizeMb,
    required this.allowedExtensions,
    required this.specs,
    required this.addons,
    this.description,
    this.mobileDescription,
    this.icon,
  });

  final int id;
  final String slug;
  final String name;
  final String? description;
  final String? mobileDescription;
  final String? icon;
  final String fileProcessingType;
  final String pricingModel;
  final double baseRate;
  final String quantityUnit;
  final int maxFileSizeMb;
  final List<String> allowedExtensions;
  final List<ProductSpecDefinitionCatalog> specs;
  final List<ProductAddonCatalog> addons;

  factory ProductCategoryCatalog.fromJson(Map<String, dynamic> json) {
    return ProductCategoryCatalog(
      id: _readInt(json['id'], 0),
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString(),
      mobileDescription: (json['mobileDescription'] ?? json['mobile_description'])?.toString(),
      icon: json['icon']?.toString(),
      fileProcessingType: (json['fileProcessingType'] ?? json['file_processing_type'])?.toString() ?? 'generic_file',
      pricingModel: (json['pricingModel'] ?? json['pricing_model'])?.toString() ?? 'per_page_modifiers',
      baseRate: _readDouble(json['baseRate'] ?? json['base_rate'], 0),
      quantityUnit: (json['quantityUnit'] ?? json['quantity_unit'])?.toString() ?? 'copy',
      maxFileSizeMb: _readInt(json['maxFileSizeMb'] ?? json['max_file_size_mb'], 0),
      allowedExtensions: ((json['allowedExtensions'] ?? json['allowed_extensions']) as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      specs: (json['specs'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map((item) => ProductSpecDefinitionCatalog.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      addons: (json['addons'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map((item) => ProductAddonCatalog.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
    );
  }
}

class ProductSpecDefinitionCatalog {
  const ProductSpecDefinitionCatalog({
    required this.id,
    required this.key,
    required this.label,
    required this.inputType,
    required this.valueType,
    required this.isRequired,
    required this.pricingRole,
    required this.options,
    this.defaultValue,
    this.unitLabel,
    this.placeholder,
    this.minValue,
    this.maxValue,
    this.stepValue,
  });

  final int id;
  final String key;
  final String label;
  final String inputType;
  final String valueType;
  final bool isRequired;
  final String pricingRole;
  final String? defaultValue;
  final String? unitLabel;
  final String? placeholder;
  final double? minValue;
  final double? maxValue;
  final double? stepValue;
  final List<ProductSpecOptionCatalog> options;

  ProductSpecOptionCatalog? get defaultOption {
    for (final option in options) {
      if (option.isDefault) return option;
    }
    return options.isEmpty ? null : options.first;
  }

  factory ProductSpecDefinitionCatalog.fromJson(Map<String, dynamic> json) {
    return ProductSpecDefinitionCatalog(
      id: _readInt(json['id'], 0),
      key: json['key']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      inputType: (json['inputType'] ?? json['input_type'])?.toString() ?? 'select',
      valueType: (json['valueType'] ?? json['value_type'])?.toString() ?? 'string',
      isRequired: (json['isRequired'] ?? json['is_required']) as bool? ?? true,
      pricingRole: (json['pricingRole'] ?? json['pricing_role'])?.toString() ?? 'none',
      defaultValue: (json['defaultValue'] ?? json['default_value'])?.toString(),
      unitLabel: (json['unitLabel'] ?? json['unit_label'])?.toString(),
      placeholder: json['placeholder']?.toString(),
      minValue: _readNullableDouble(json['minValue'] ?? json['min_value']),
      maxValue: _readNullableDouble(json['maxValue'] ?? json['max_value']),
      stepValue: _readNullableDouble(json['stepValue'] ?? json['step_value']),
      options: (json['options'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map((item) => ProductSpecOptionCatalog.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
    );
  }
}

class ProductSpecOptionCatalog {
  const ProductSpecOptionCatalog({
    required this.id,
    required this.label,
    required this.value,
    this.isDefault = false,
  });

  final int id;
  final String label;
  final String value;
  final bool isDefault;

  factory ProductSpecOptionCatalog.fromJson(Map<String, dynamic> json) {
    return ProductSpecOptionCatalog(
      id: _readInt(json['id'], 0),
      label: json['label']?.toString() ?? '',
      value: json['value']?.toString() ?? '',
      isDefault: (json['isDefault'] ?? json['is_default']) as bool? ?? false,
    );
  }
}

class ProductAddonCatalog {
  const ProductAddonCatalog({required this.id, required this.name, required this.price});

  final int id;
  final String name;
  final double price;

  factory ProductAddonCatalog.fromJson(Map<String, dynamic> json) {
    return ProductAddonCatalog(
      id: _readInt(json['id'], 0),
      name: json['name']?.toString() ?? '',
      price: _readDouble(json['price'], 0),
    );
  }
}

int _readInt(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? _readNullableDouble(dynamic value) {
  if (value == null) return null;
  return _readDouble(value, 0);
}
```

- [ ] **Step 4: Add providers**

Create `catalog_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/catalog/models/product_catalog.dart';
import 'package:printing_app/shared/services/api_client.dart';

final catalogProvider = FutureProvider<ProductCatalog>((ref) async {
  final response = await ApiClient.instance.get('/products/catalog');
  return ProductCatalog.fromJson(Map<String, dynamic>.from(response.data as Map));
});

final categoryCatalogProvider = FutureProvider.family<ProductCategoryCatalog, String>((ref, slug) async {
  final catalog = await ref.watch(catalogProvider.future);
  final cached = catalog.categories.where((category) => category.slug == slug);
  if (cached.isNotEmpty) return cached.first;

  final response = await ApiClient.instance.get('/products/categories/$slug/catalog');
  return ProductCategoryCatalog.fromJson(Map<String, dynamic>.from(response.data as Map));
});
```

Create `quote_provider.dart` with a minimal request method:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class QuoteResult {
  const QuoteResult({required this.total, required this.subtotal});
  final double total;
  final double subtotal;

  factory QuoteResult.fromJson(Map<String, dynamic> json) {
    return QuoteResult(
      total: _readDouble(json['total'], 0),
      subtotal: _readDouble(json['subtotal'], 0),
    );
  }
}

final quoteRepositoryProvider = Provider<QuoteRepository>((ref) {
  return QuoteRepository();
});

class QuoteRepository {
  Future<QuoteResult> quote(Map<String, dynamic> body) async {
    final response = await ApiClient.instance.post('/orders/quote', data: body);
    return QuoteResult.fromJson(Map<String, dynamic>.from(response.data as Map));
  }
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}
```

- [ ] **Step 5: Run mobile test**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/order/catalog/product_catalog_test.dart
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/order/catalog apps/mobile/test/features/customer/order/catalog/product_catalog_test.dart
git commit -m "feat(mobile): add product catalog models"
```

---

### Task 10: Mobile Schema-Driven Category, Specs, Upload, And Order Payload

**Files:**
- Create: `apps/mobile/lib/features/customer/order/catalog/widgets/dynamic_spec_field.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/category_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/paper_specs_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/three_d_specs_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/sheets/edit_item_sheet.dart`
- Modify: `apps/mobile/lib/features/customer/cart/models/cart_item.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Test: `apps/mobile/test/features/customer/order/catalog/dynamic_spec_field_test.dart`

- [ ] **Step 1: Write dynamic field widget test**

Create `apps/mobile/test/features/customer/order/catalog/dynamic_spec_field_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/catalog/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/catalog/widgets/dynamic_spec_field.dart';

void main() {
  testWidgets('renders select options and reports selected value', (tester) async {
    String? selected;
    const spec = ProductSpecDefinitionCatalog(
      id: 1,
      key: 'paper_size',
      label: 'Paper Size',
      inputType: 'select',
      valueType: 'string',
      isRequired: true,
      pricingRole: 'multiplier',
      options: [
        ProductSpecOptionCatalog(id: 10, label: 'A4', value: 'a4'),
        ProductSpecOptionCatalog(id: 11, label: 'A3', value: 'a3'),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: DynamicSpecField(
          spec: spec,
          value: 'a4',
          onChanged: (value) => selected = value?.toString(),
        ),
      ),
    ));

    await tester.tap(find.text('A3'));
    expect(selected, 'a3');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/order/catalog/dynamic_spec_field_test.dart
```

Expected: FAIL because `DynamicSpecField` does not exist.

- [ ] **Step 3: Add dynamic field widget**

Create `apps/mobile/lib/features/customer/order/catalog/widgets/dynamic_spec_field.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/features/customer/order/catalog/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/widgets/spec_selector.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

class DynamicSpecField extends StatefulWidget {
  const DynamicSpecField({
    super.key,
    required this.spec,
    required this.value,
    required this.onChanged,
  });

  final ProductSpecDefinitionCatalog spec;
  final Object? value;
  final ValueChanged<Object?> onChanged;

  @override
  State<DynamicSpecField> createState() => _DynamicSpecFieldState();
}

class _DynamicSpecFieldState extends State<DynamicSpecField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.value?.toString() ?? widget.spec.defaultValue ?? '',
    );
  }

  @override
  void didUpdateWidget(covariant DynamicSpecField oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextText = widget.value?.toString() ?? widget.spec.defaultValue ?? '';
    if (_controller.text != nextText) {
      _controller.text = nextText;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final spec = widget.spec;
    switch (spec.inputType) {
      case 'select':
        return SpecSelector<ProductSpecOptionCatalog>(
          label: spec.label.toUpperCase(),
          options: spec.options,
          selected: spec.options.firstWhere(
            (option) => option.value == widget.value,
            orElse: () => spec.defaultOption ?? spec.options.first,
          ),
          onChanged: (option) => widget.onChanged(option.value),
          displayName: (option) => option.label,
        );
      case 'boolean':
        return SpecSelector<bool>(
          label: spec.label.toUpperCase(),
          options: const [true, false],
          selected: widget.value == true || widget.value == 'true',
          onChanged: widget.onChanged,
          displayName: (item) => item ? 'Yes' : 'No',
        );
      case 'number':
        return AppTextField(
          label: spec.label,
          controller: _controller,
          keyboardType: TextInputType.number,
          hintText: spec.placeholder,
          onChanged: (text) => widget.onChanged(num.tryParse(text)),
        );
      default:
        return AppTextField(
          label: spec.label,
          controller: _controller,
          hintText: spec.placeholder,
          onChanged: widget.onChanged,
        );
    }
  }
}
```

- [ ] **Step 4: Update category screen**

In `category_screen.dart`:

- Watch `catalogProvider`.
- Render loading, error with retry, and category cards from `catalog.categories`.
- Preserve the current pipeline tutorial listener/dispose/`GlobalKey` flow. Attach the existing paper-category tutorial key to the rendered `paper` category card when that category is active.
- On tap, set category slug/name in order flow and navigate. Paper and 3D routes may remain:

```dart
final route = category.slug == 'paper'
    ? '/customer/order/paper-specs'
    : category.slug == '3d'
        ? '/customer/order/3d-specs'
        : '/customer/order/paper-specs';
```

The fallback route is temporary because current router has paper/3D screens. The screen internals become dynamic, so unsupported future slugs should be blocked until a generic route is added.

- [ ] **Step 5: Update spec screens to use catalog**

In both `paper_specs_screen.dart` and `three_d_specs_screen.dart`:

- Load `categoryCatalogProvider('paper')` or `categoryCatalogProvider('3d')`.
- Initialize selected specs from defaults.
- Render `DynamicSpecField` for every spec.
- Store selected specs as `Map<String, dynamic>` in order flow or directly in `CartItem`.
- Request quote before continuing and store quoted subtotal.
- Preserve existing tutorial keys and coach marks in the paper specs screen; map those keys onto the equivalent dynamic fields when `paper_size`, `color_mode`, `media_type`, `print_sides`, and `binding` are active.

Use helper:

```dart
Map<String, Object?> defaultSpecValues(ProductCategoryCatalog category) {
  return {
    for (final spec in category.specs)
      spec.key: spec.defaultOption?.value ?? spec.defaultValue,
  };
}
```

- [ ] **Step 6: Update upload limits and replacement picker**

In `upload_screen.dart`, replace `_allowedTypes` and `_maxSizeMB` with selected category catalog values:

```dart
final category = ref.read(selectedCategoryCatalogProvider);
return category?.allowedExtensions ?? const <String>[];
```

In `edit_item_sheet.dart`, replace `AppConstants.paperTypes`/`AppConstants.threeDTypes` and category string checks with the cart item's selected category catalog values when replacing a file. Paper support must include `tif` and `tiff` if those extensions are active in the catalog. If the catalog is missing, disable file picking and show retry.

Preserve the existing upload screen tutorial key and coach mark on the primary upload action.

- [ ] **Step 7: Update `CartItem` and order payload**

In `cart_item.dart`, add:

```dart
final Map<String, dynamic> selectedSpecs;
final List<int> addonIds;
```

Serialize:

```dart
'selectedSpecs': selectedSpecs,
'addonIds': addonIds,
```

In `orders_provider.dart`, update `_cartItemPayload`:

```dart
return {
  'category': item.category,
  'quantity': item.quantity,
  'totalPrice': item.printSubtotal,
  'fileName': item.fileName,
  'fileUrl': item.filePath,
  'fileMetadataId': item.fileMetadataId,
  'specs': item.selectedSpecs,
  'addonIds': item.addonIds,
};
```

Keep legacy `paperSpecs`/`threeDSpecs` parsing until all UI display is migrated.

Update checkout item display to read generic `selectedSpecs` snapshots/options, and preserve the current checkout tutorial keys/coach marks. If payment or credits UI is touched while adjusting totals, preserve the existing credits coach mark in `payment_method_sheet.dart`.

- [ ] **Step 8: Run mobile tests**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/order/catalog
flutter test test/features/customer/orders/providers/orders_provider_test.dart
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/lib/features/customer/order apps/mobile/lib/features/customer/cart apps/mobile/lib/features/customer/orders apps/mobile/test/features/customer/order/catalog apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart
git commit -m "feat(mobile): render order specs from catalog"
```

---

### Task 11: Cleanup Legacy Product Specs And Pricing Paths

**Files:**
- Remove or stop using: `server/src/products/entities/service-category.entity.ts`
- Remove or stop using: `server/src/products/entities/spec-option.entity.ts`
- Remove or stop using: `server/src/orders/entities/paper-specs.entity.ts`
- Remove or stop using: `server/src/orders/entities/three-d-specs.entity.ts`
- Modify: `server/src/orders/orders.module.ts`
- Modify: `server/src/admin/admin.module.ts`
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `apps/mobile/lib/utils/pricing_engine.dart`
- Modify tests that still depend on old enum pricing.

- [ ] **Step 1: Search for legacy references**

Run:

```bash
rg -n "ServiceCategory|SpecOption|PaperSpec|ThreeDSpec|paperSpecs|threeDSpecs|PricingEngine|calculatePaperPrice|calculate3DPrice" server/src apps/mobile/lib apps/mobile/test admin/src
```

Expected: output lists remaining references. Categorize each as either order-history display compatibility or obsolete pricing/spec creation.

- [ ] **Step 2: Remove obsolete server imports**

Remove old product entities from `ProductsModule`. Remove `PaperSpec` and `ThreeDSpec` from `OrdersModule` only after admin/order response mapping reads `OrderItemSpecValue`.

Replace admin order spec display with generic `specValues` formatting:

```ts
const specs = item.specValues?.map((spec) => ({
  label: spec.specLabel,
  value: spec.displayValue,
})) ?? [];
```

- [ ] **Step 3: Stop mobile local price authority**

Keep `pricing_engine.dart` only for tests that have not been migrated or remove it if no imports remain. Mobile quote display should use `/orders/quote`.

Run:

```bash
rg -n "PricingEngine" apps/mobile/lib apps/mobile/test
```

Expected after cleanup: no production imports remain.

- [ ] **Step 4: Run full verification**

Run:

```bash
cd server
npm test
npm run build
cd ../admin
npm test
npm run build
cd ../apps/mobile
flutter test
flutter analyze
```

Expected: all commands pass. If `flutter analyze` reports pre-existing unrelated issues, document exact output before deciding whether to fix them.

- [ ] **Step 5: Commit**

```bash
git add server/src apps/mobile/lib apps/mobile/test admin/src
git commit -m "chore: remove legacy product spec paths"
```

---

## Final Manual Checks

- [ ] Start the server and confirm Swagger lists `/api/products/catalog`, `/api/products/categories/:slug/catalog`, and `/api/orders/quote`.
- [ ] Seed a fresh database and confirm paper/3D categories appear in admin.
- [ ] Disable A4 in admin and confirm mobile no longer shows A4 after refresh.
- [ ] Try ordering disabled A4 from a stale client payload and confirm server rejects it.
- [ ] Create a paper quote and confirm the subtotal matches `(baseRate * pageCount * multipliers + fixedFees) * quantity`.
- [ ] Create a 3D quote and confirm material/infill pricing matches `baseRate + estimatedQuantity * unitCost`.
- [ ] Place a checkout order and confirm `order_item_spec_values` rows are persisted.

---

## Handoff Notes

- Do not use `git reset --hard`; the repository may contain unrelated user changes.
- Keep commits task-scoped.
- If a task uncovers a mismatch between the spec and existing code, update this plan or the spec before continuing.
- The highest-risk integration point is `OrdersService.createBatch`; keep tests focused there before touching mobile checkout.
