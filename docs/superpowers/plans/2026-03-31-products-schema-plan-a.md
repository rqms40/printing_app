# Products & Pricing Schema — Plan A: Backend + Admin UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the dynamic products/pricing system — NestJS `products` module with 3 DB tables and 14 endpoints, seed data migrating all hardcoded pricing values, and 3 Refine admin pages for full CRUD.

**Architecture:** Hybrid dynamic pricing — formula-based engine (unchanged) with all inputs stored in `service_categories`, `spec_options`, and `service_addons` tables. Public read endpoints serve the mobile app; write endpoints require admin JWT. Admin UI replaces the existing mock products page with real API-connected pages.

**Spec:** `docs/superpowers/specs/2026-03-31-products-schema-design.md`

**Tech Stack:** NestJS 11 + TypeORM + PostgreSQL (backend), Refine + Ant Design + React (admin)

**Run backend from:** `server/` — `npm run start:dev`
**Run admin from:** `admin/` — `npm run dev`

---

## File Map

```
server/src/products/                           ← new module
├── entities/
│   ├── service-category.entity.ts             CREATE
│   ├── spec-option.entity.ts                  CREATE
│   └── service-addon.entity.ts                CREATE
├── dto/
│   ├── create-category.dto.ts                 CREATE
│   ├── update-category.dto.ts                 CREATE
│   ├── create-spec-option.dto.ts              CREATE
│   ├── update-spec-option.dto.ts              CREATE
│   ├── reorder-options.dto.ts                 CREATE
│   ├── create-addon.dto.ts                    CREATE
│   └── update-addon.dto.ts                    CREATE
├── products.service.ts                        CREATE
├── products.service.spec.ts                   CREATE
├── products.controller.ts                     CREATE
└── products.module.ts                         CREATE

server/src/app.module.ts                       MODIFY — import ProductsModule
server/src/seed.ts                             MODIFY — add products seed data

admin/src/types/products.ts                    CREATE
admin/src/providers/mock-data.ts               MODIFY — add mock categories/options/addons
admin/src/pages/products/list.tsx              MODIFY — replace mock with categories overview
admin/src/pages/products/options.tsx           CREATE  — spec options tabbed page
admin/src/pages/products-addons/list.tsx       CREATE  — addons CRUD page
admin/src/App.tsx                              MODIFY — add routes + resources
```

---

## Task 1: NestJS Entities

**Files:**
- Create: `server/src/products/entities/service-category.entity.ts`
- Create: `server/src/products/entities/spec-option.entity.ts`
- Create: `server/src/products/entities/service-addon.entity.ts`

- [ ] **Step 1: Create `service-category.entity.ts`**

```typescript
// server/src/products/entities/service-category.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { SpecOption } from './spec-option.entity';
import { ServiceAddon } from './service-addon.entity';

@Entity('service_categories')
export class ServiceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ name: 'base_rate', type: 'decimal', precision: 10, scale: 2 })
  baseRate: number;

  @Column({ name: 'max_file_size_mb', default: 50 })
  maxFileSizeMb: number;

  @Column({ name: 'allowed_extensions', type: 'text' })
  allowedExtensions: string; // stored as JSON string e.g. '["pdf","png"]'

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => SpecOption, (opt) => opt.category)
  specOptions: SpecOption[];

  @OneToMany(() => ServiceAddon, (addon) => addon.category)
  addons: ServiceAddon[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create `spec-option.entity.ts`**

```typescript
// server/src/products/entities/spec-option.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';

@Entity('spec_options')
@Unique('uq_spec_option', ['categoryId', 'optionGroup', 'value'])
export class SpecOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => ServiceCategory, (cat) => cat.specOptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  // Column named 'option_group' to avoid SQL reserved word 'group'
  @Column({ name: 'option_group', length: 50 })
  optionGroup: string;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 50 })
  value: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 1.0 })
  multiplier: number;

  @Column({ name: 'fixed_fee', type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixedFee: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ name: 'estimated_grams', type: 'int', nullable: true })
  estimatedGrams: number;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 3: Create `service-addon.entity.ts`**

```typescript
// server/src/products/entities/service-addon.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';

@Entity('service_addons')
export class ServiceAddon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number;

  @ManyToOne(() => ServiceCategory, (cat) => cat.addons, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'price_type', length: 20 })
  priceType: string; // 'flat' | 'per_unit'

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 4: Commit**

```bash
git add server/src/products/entities/
git commit -m "feat(products): add ServiceCategory, SpecOption, ServiceAddon entities"
```

---

## Task 2: DTOs

**Files:**
- Create: `server/src/products/dto/create-category.dto.ts`
- Create: `server/src/products/dto/update-category.dto.ts`
- Create: `server/src/products/dto/create-spec-option.dto.ts`
- Create: `server/src/products/dto/update-spec-option.dto.ts`
- Create: `server/src/products/dto/reorder-options.dto.ts`
- Create: `server/src/products/dto/create-addon.dto.ts`
- Create: `server/src/products/dto/update-addon.dto.ts`

- [ ] **Step 1: Create `create-category.dto.ts`**

```typescript
// server/src/products/dto/create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive,
  IsOptional, IsBoolean, MaxLength, Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Paper Printing' })
  @IsString() @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'paper', description: 'Lowercase alphanumeric + hyphens' })
  @IsString() @MaxLength(50) @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'FileTextOutlined' })
  @IsOptional() @IsString() @MaxLength(50)
  icon?: string;

  @ApiProperty({ example: 2.0 })
  @IsNumber() @IsPositive()
  baseRate: number;

  @ApiProperty({ example: 50 })
  @IsInt() @IsPositive()
  maxFileSizeMb: number;

  @ApiProperty({ example: '["pdf","png","jpg"]', description: 'JSON array string of allowed file extensions' })
  @IsString()
  allowedExtensions: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  sortOrder?: number;
}
```

- [ ] **Step 2: Create `update-category.dto.ts`**

```typescript
// server/src/products/dto/update-category.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive,
  IsOptional, IsBoolean, MaxLength, Matches,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) @Matches(/^[a-z0-9-]+$/) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @IsPositive() baseRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @IsPositive() maxFileSizeMb?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() allowedExtensions?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
```

- [ ] **Step 3: Create `create-spec-option.dto.ts`**

```typescript
// server/src/products/dto/create-spec-option.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive, Min,
  IsOptional, IsBoolean, MaxLength,
} from 'class-validator';

export class CreateSpecOptionDto {
  @ApiProperty({ example: 1 })
  @IsInt() @IsPositive()
  categoryId: number;

  @ApiProperty({ example: 'paper_size', description: 'Group name: paper_size, color_mode, material, etc.' })
  @IsString() @MaxLength(50)
  optionGroup: string;

  @ApiProperty({ example: 'A4' })
  @IsString() @MaxLength(100)
  label: string;

  @ApiProperty({ example: 'a4' })
  @IsString() @MaxLength(50)
  value: string;

  @ApiPropertyOptional({ example: 1.0, default: 1.0 })
  @IsOptional() @IsNumber() @IsPositive()
  multiplier?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  fixedFee?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ example: 40, description: 'Estimated grams for 3D infill options' })
  @IsOptional() @IsInt() @Min(0)
  estimatedGrams?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  sortOrder?: number;
}
```

- [ ] **Step 4: Create `update-spec-option.dto.ts`**

```typescript
// server/src/products/dto/update-spec-option.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive, Min,
  IsOptional, IsBoolean, MaxLength,
} from 'class-validator';

export class UpdateSpecOptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) optionGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) value?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @IsPositive() multiplier?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fixedFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) estimatedGrams?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
```

- [ ] **Step 5: Create `reorder-options.dto.ts`**

```typescript
// server/src/products/dto/reorder-options.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderItemDto {
  @IsInt() @IsPositive() id: number;
  @IsInt() sortOrder: number;
}

export class ReorderOptionsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
```

- [ ] **Step 6: Create `create-addon.dto.ts`**

```typescript
// server/src/products/dto/create-addon.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive,
  IsOptional, IsBoolean, MaxLength, IsIn,
} from 'class-validator';

export class CreateAddonDto {
  @ApiPropertyOptional({ description: 'null means applies to all categories' })
  @IsOptional() @IsInt() @IsPositive()
  categoryId?: number;

  @ApiProperty({ example: 'Lamination' })
  @IsString() @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ example: 20.0 })
  @IsNumber() @IsPositive()
  price: number;

  @ApiProperty({ enum: ['flat', 'per_unit'], example: 'per_unit' })
  @IsString() @IsIn(['flat', 'per_unit'])
  priceType: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  sortOrder?: number;
}
```

- [ ] **Step 7: Create `update-addon.dto.ts`**

```typescript
// server/src/products/dto/update-addon.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive,
  IsOptional, IsBoolean, MaxLength, IsIn,
} from 'class-validator';

export class UpdateAddonDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @IsPositive() categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @IsPositive() price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['flat', 'per_unit']) priceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
```

- [ ] **Step 8: Commit**

```bash
git add server/src/products/dto/
git commit -m "feat(products): add DTOs for categories, spec options, and addons"
```

---

## Task 3: ProductsService + Unit Tests

**Files:**
- Create: `server/src/products/products.service.ts`
- Create: `server/src/products/products.service.spec.ts`

- [ ] **Step 1: Write failing unit tests**

```typescript
// server/src/products/products.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ServiceCategory } from './entities/service-category.entity';
import { SpecOption } from './entities/spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';

const mockCatRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockOptRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  remove: jest.fn(),
});

const mockAddonRepo = () => ({
  find: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let optRepo: ReturnType<typeof mockOptRepo>;
  let catRepo: ReturnType<typeof mockCatRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(ServiceCategory), useFactory: mockCatRepo },
        { provide: getRepositoryToken(SpecOption), useFactory: mockOptRepo },
        { provide: getRepositoryToken(ServiceAddon), useFactory: mockAddonRepo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    catRepo = module.get(getRepositoryToken(ServiceCategory));
    optRepo = module.get(getRepositoryToken(SpecOption));
  });

  describe('createCategory', () => {
    it('throws ConflictException if slug already exists', async () => {
      catRepo.findOne.mockResolvedValue({ id: 99, slug: 'paper' });
      await expect(
        service.createCategory({ slug: 'paper', name: 'X', baseRate: 2, maxFileSizeMb: 50, allowedExtensions: '[]' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates and returns a new category', async () => {
      catRepo.findOne.mockResolvedValue(null);
      catRepo.create.mockReturnValue({ id: 1, slug: 'paper', name: 'Paper' });
      catRepo.save.mockResolvedValue({ id: 1, slug: 'paper', name: 'Paper' });
      const result = await service.createCategory({
        slug: 'paper', name: 'Paper', baseRate: 2, maxFileSizeMb: 50, allowedExtensions: '["pdf"]',
      });
      expect(result.slug).toBe('paper');
      expect(catRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('createOption', () => {
    it('throws ConflictException if (categoryId, optionGroup, value) already exists', async () => {
      optRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.createOption({ categoryId: 1, optionGroup: 'paper_size', label: 'A4', value: 'a4' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if multiplier is 0', async () => {
      optRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createOption({ categoryId: 1, optionGroup: 'paper_size', label: 'A4', value: 'a4', multiplier: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if multiplier is negative', async () => {
      optRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createOption({ categoryId: 1, optionGroup: 'paper_size', label: 'A4', value: 'a4', multiplier: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates and returns the option', async () => {
      optRepo.findOne.mockResolvedValue(null);
      optRepo.create.mockReturnValue({ id: 1, label: 'A4' });
      optRepo.save.mockResolvedValue({ id: 1, label: 'A4' });
      const result = await service.createOption({
        categoryId: 1, optionGroup: 'paper_size', label: 'A4', value: 'a4', multiplier: 1.0,
      });
      expect(result.label).toBe('A4');
    });
  });

  describe('updateOption', () => {
    it('throws BadRequestException when disabling the last active option in a group', async () => {
      optRepo.findOneOrFail.mockResolvedValue({ id: 1, categoryId: 1, optionGroup: 'paper_size', isActive: true });
      optRepo.count.mockResolvedValue(1); // only 1 active
      await expect(
        service.updateOption(1, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows disabling when 2+ options are active in the group', async () => {
      optRepo.findOneOrFail
        .mockResolvedValueOnce({ id: 1, categoryId: 1, optionGroup: 'paper_size', isActive: true })
        .mockResolvedValueOnce({ id: 1, isActive: false });
      optRepo.count.mockResolvedValue(2);
      optRepo.update.mockResolvedValue(undefined);
      const result = await service.updateOption(1, { isActive: false });
      expect(optRepo.update).toHaveBeenCalledWith(1, { isActive: false });
    });
  });

  describe('deleteOption', () => {
    it('throws BadRequestException when removing last active option in a group', async () => {
      optRepo.findOneOrFail.mockResolvedValue({ id: 1, categoryId: 1, optionGroup: 'paper_size', isActive: true });
      optRepo.count.mockResolvedValue(1);
      await expect(service.deleteOption(1)).rejects.toThrow(BadRequestException);
    });

    it('removes the option when it is not the last active', async () => {
      const opt = { id: 1, categoryId: 1, optionGroup: 'paper_size', isActive: true };
      optRepo.findOneOrFail.mockResolvedValue(opt);
      optRepo.count.mockResolvedValue(2);
      optRepo.remove.mockResolvedValue(undefined);
      await service.deleteOption(1);
      expect(optRepo.remove).toHaveBeenCalledWith(opt);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server
npm test -- --testPathPattern=products.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — "ProductsService is not defined"

- [ ] **Step 3: Implement `products.service.ts`**

```typescript
// server/src/products/products.service.ts
import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { SpecOption } from './entities/spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { CreateSpecOptionDto } from './dto/create-spec-option.dto';
import type { UpdateSpecOptionDto } from './dto/update-spec-option.dto';
import type { ReorderOptionsDto } from './dto/reorder-options.dto';
import type { CreateAddonDto } from './dto/create-addon.dto';
import type { UpdateAddonDto } from './dto/update-addon.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ServiceCategory)
    private catRepo: Repository<ServiceCategory>,
    @InjectRepository(SpecOption)
    private optRepo: Repository<SpecOption>,
    @InjectRepository(ServiceAddon)
    private addonRepo: Repository<ServiceAddon>,
  ) {}

  // ─── Categories ──────────────────────────────────────────────────────

  findAllCategories(): Promise<ServiceCategory[]> {
    return this.catRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  findCategoryById(id: number): Promise<ServiceCategory> {
    return this.catRepo.findOneOrFail({
      where: { id },
      relations: ['specOptions', 'addons'],
    });
  }

  async getCategoryPricing(slug: string): Promise<Record<string, unknown>> {
    const category = await this.catRepo.findOneOrFail({ where: { slug } });
    const options = await this.optRepo.find({
      where: { categoryId: category.id, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const addons = await this.addonRepo.find({
      where: [
        { categoryId: category.id, isActive: true },
        { categoryId: IsNull(), isActive: true },
      ],
      order: { sortOrder: 'ASC' },
    });

    const groups: Record<string, unknown[]> = {};
    for (const opt of options) {
      if (!groups[opt.optionGroup]) groups[opt.optionGroup] = [];
      groups[opt.optionGroup].push({
        id: opt.id,
        label: opt.label,
        value: opt.value,
        multiplier: Number(opt.multiplier),
        fixed_fee: Number(opt.fixedFee),
        unit_cost: Number(opt.unitCost),
        estimated_grams: opt.estimatedGrams,
        is_default: opt.isDefault,
        sort_order: opt.sortOrder,
      });
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      base_rate: Number(category.baseRate),
      max_file_size_mb: category.maxFileSizeMb,
      allowed_extensions: JSON.parse(category.allowedExtensions) as string[],
      groups,
      addons,
    };
  }

  async createCategory(dto: CreateCategoryDto): Promise<ServiceCategory> {
    const existing = await this.catRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' is already in use`);
    const cat = this.catRepo.create(dto);
    return this.catRepo.save(cat);
  }

  async updateCategory(id: number, dto: UpdateCategoryDto): Promise<ServiceCategory> {
    await this.catRepo.findOneOrFail({ where: { id } });
    if (dto.slug) {
      const conflict = await this.catRepo.findOne({ where: { slug: dto.slug } });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Slug '${dto.slug}' is already in use`);
      }
    }
    await this.catRepo.update(id, dto);
    return this.catRepo.findOneOrFail({ where: { id } });
  }

  async deleteCategory(id: number): Promise<void> {
    await this.catRepo.findOneOrFail({ where: { id } });
    // Soft-delete: set isActive = false (orders reference category as a string slug, no FK)
    await this.catRepo.update(id, { isActive: false });
  }

  // ─── Spec Options ────────────────────────────────────────────────────

  findOptions(categoryId?: number, optionGroup?: string): Promise<SpecOption[]> {
    const where: Partial<SpecOption> = {};
    if (categoryId) where.categoryId = categoryId;
    if (optionGroup) where.optionGroup = optionGroup;
    return this.optRepo.find({ where, order: { optionGroup: 'ASC', sortOrder: 'ASC', id: 'ASC' } });
  }

  async createOption(dto: CreateSpecOptionDto): Promise<SpecOption> {
    const existing = await this.optRepo.findOne({
      where: { categoryId: dto.categoryId, optionGroup: dto.optionGroup, value: dto.value },
    });
    if (existing) {
      throw new ConflictException('A spec option with this category/group/value already exists');
    }
    if (dto.multiplier !== undefined && dto.multiplier <= 0) {
      throw new BadRequestException('multiplier must be greater than 0');
    }
    const opt = this.optRepo.create(dto);
    return this.optRepo.save(opt);
  }

  async updateOption(id: number, dto: UpdateSpecOptionDto): Promise<SpecOption> {
    const opt = await this.optRepo.findOneOrFail({ where: { id } });
    if (dto.multiplier !== undefined && dto.multiplier <= 0) {
      throw new BadRequestException('multiplier must be greater than 0');
    }
    if (dto.isActive === false && opt.isActive) {
      const activeCount = await this.optRepo.count({
        where: { categoryId: opt.categoryId, optionGroup: opt.optionGroup, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException('Cannot disable the last active option in a group');
      }
    }
    await this.optRepo.update(id, dto);
    return this.optRepo.findOneOrFail({ where: { id } });
  }

  async deleteOption(id: number): Promise<void> {
    const opt = await this.optRepo.findOneOrFail({ where: { id } });
    if (opt.isActive) {
      const activeCount = await this.optRepo.count({
        where: { categoryId: opt.categoryId, optionGroup: opt.optionGroup, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException('Cannot delete the last active option in a group');
      }
    }
    await this.optRepo.remove(opt);
  }

  async reorderOptions(dto: ReorderOptionsDto): Promise<void> {
    await Promise.all(
      dto.items.map((item) => this.optRepo.update(item.id, { sortOrder: item.sortOrder })),
    );
  }

  // ─── Addons ──────────────────────────────────────────────────────────

  findAddons(categoryId?: number): Promise<ServiceAddon[]> {
    if (categoryId) {
      return this.addonRepo.find({
        where: [{ categoryId }, { categoryId: IsNull() }],
        order: { sortOrder: 'ASC', id: 'ASC' },
      });
    }
    return this.addonRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createAddon(dto: CreateAddonDto): Promise<ServiceAddon> {
    const addon = this.addonRepo.create(dto);
    return this.addonRepo.save(addon);
  }

  async updateAddon(id: number, dto: UpdateAddonDto): Promise<ServiceAddon> {
    await this.addonRepo.findOneOrFail({ where: { id } });
    await this.addonRepo.update(id, dto);
    return this.addonRepo.findOneOrFail({ where: { id } });
  }

  async deleteAddon(id: number): Promise<void> {
    const addon = await this.addonRepo.findOneOrFail({ where: { id } });
    await this.addonRepo.remove(addon);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=products.service.spec --no-coverage 2>&1 | tail -20
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/products/products.service.ts server/src/products/products.service.spec.ts
git commit -m "feat(products): implement ProductsService with validation + unit tests"
```

---

## Task 4: ProductsController + ProductsModule

**Files:**
- Create: `server/src/products/products.controller.ts`
- Create: `server/src/products/products.module.ts`

- [ ] **Step 1: Create `products.controller.ts`**

```typescript
// server/src/products/products.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ProductsService } from './products.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSpecOptionDto } from './dto/create-spec-option.dto';
import { UpdateSpecOptionDto } from './dto/update-spec-option.dto';
import { ReorderOptionsDto } from './dto/reorder-options.dto';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Categories (public reads, admin writes) ──────────────────────

  @Get('categories')
  findAllCategories() {
    return this.productsService.findAllCategories();
  }

  // IMPORTANT: declare ':slug/pricing' before ':id' — different segment count, no conflict
  @Get('categories/:slug/pricing')
  getCategoryPricing(@Param('slug') slug: string) {
    return this.productsService.getCategoryPricing(slug);
  }

  @Get('categories/:id')
  findCategory(@Param('id') id: number) {
    return this.productsService.findCategoryById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('categories/:id')
  updateCategory(@Param('id') id: number, @Body() dto: UpdateCategoryDto) {
    return this.productsService.updateCategory(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: number) {
    return this.productsService.deleteCategory(id);
  }

  // ─── Spec Options ─────────────────────────────────────────────────

  @ApiQuery({ name: 'category_id', required: false, type: Number })
  @ApiQuery({ name: 'group', required: false })
  @Get('options')
  findOptions(
    @Query('category_id') categoryId?: number,
    @Query('group') group?: string,
  ) {
    return this.productsService.findOptions(categoryId, group);
  }

  // IMPORTANT: 'reorder' route must be declared BEFORE ':id' route
  // to prevent NestJS from treating "reorder" as an id param
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('options/reorder')
  reorderOptions(@Body() dto: ReorderOptionsDto) {
    return this.productsService.reorderOptions(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('options')
  createOption(@Body() dto: CreateSpecOptionDto) {
    return this.productsService.createOption(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('options/:id')
  updateOption(@Param('id') id: number, @Body() dto: UpdateSpecOptionDto) {
    return this.productsService.updateOption(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('options/:id')
  deleteOption(@Param('id') id: number) {
    return this.productsService.deleteOption(id);
  }

  // ─── Addons ───────────────────────────────────────────────────────

  @ApiQuery({ name: 'category_id', required: false, type: Number })
  @Get('addons')
  findAddons(@Query('category_id') categoryId?: number) {
    return this.productsService.findAddons(categoryId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('addons')
  createAddon(@Body() dto: CreateAddonDto) {
    return this.productsService.createAddon(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('addons/:id')
  updateAddon(@Param('id') id: number, @Body() dto: UpdateAddonDto) {
    return this.productsService.updateAddon(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('addons/:id')
  deleteAddon(@Param('id') id: number) {
    return this.productsService.deleteAddon(id);
  }
}
```

- [ ] **Step 2: Create `products.module.ts`**

```typescript
// server/src/products/products.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { SpecOption } from './entities/spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCategory, SpecOption, ServiceAddon])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

- [ ] **Step 3: Register ProductsModule in `app.module.ts`**

Add to the imports array in `server/src/app.module.ts`:

```typescript
// Add at top of file with other imports:
import { ProductsModule } from './products/products.module';

// Add to @Module imports array (after AdminModule):
    ProductsModule,
```

- [ ] **Step 4: Run the server and verify endpoints appear in Swagger**

```bash
cd server
npm run start:dev
```

Open `http://localhost:3000/docs` — confirm a `products` section exists with all 14 endpoints.

- [ ] **Step 5: Commit**

```bash
git add server/src/products/products.controller.ts server/src/products/products.module.ts server/src/app.module.ts
git commit -m "feat(products): add ProductsController + ProductsModule, register in AppModule"
```

---

## Task 5: Seed Products Data

**Files:**
- Modify: `server/src/seed.ts`

- [ ] **Step 1: Add cleanup and sequence resets for new tables**

Find the block that starts with `// Clear existing data` in `seed.ts` and add these lines at the **beginning** of that block (before `DELETE FROM notifications`):

```typescript
  // Product tables (add before existing DELETE statements)
  await ds.query('DELETE FROM spec_options');
  await ds.query('DELETE FROM service_addons');
  await ds.query('DELETE FROM service_categories');
```

And add these sequence resets after the existing `setval` calls:

```typescript
  await ds.query("SELECT setval('service_categories_id_seq', 1, false)");
  await ds.query("SELECT setval('spec_options_id_seq', 1, false)");
  await ds.query("SELECT setval('service_addons_id_seq', 1, false)");
```

- [ ] **Step 2: Add seed data at the end of `seed()`, before `app.close()`**

Add this block right before `console.log('\n🎉 Seed complete!')`:

```typescript
  // ─── Service Categories ─────────────────────────────────────────────
  await ds.query(
    `INSERT INTO service_categories (name, slug, description, icon, base_rate, max_file_size_mb, allowed_extensions, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    ['Paper Printing', 'paper', 'Standard and large-format paper printing', 'FileTextOutlined', 2.00, 50, '["pdf","png","jpg","jpeg","docx"]', true, 1],
  );
  await ds.query(
    `INSERT INTO service_categories (name, slug, description, icon, base_rate, max_file_size_mb, allowed_extensions, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    ['3D Printing', '3d', 'FDM 3D printing with PLA, ABS, and PETG materials', 'AppstoreOutlined', 50.00, 200, '["stl","obj","3mf"]', true, 2],
  );
  console.log('✅ 2 service categories created (paper, 3d)');

  interface IdRow2 { id: number; }
  const [paperCat] = await ds.query<IdRow2[]>('SELECT id FROM service_categories WHERE slug = $1', ['paper']);
  const [threeDCat] = await ds.query<IdRow2[]>('SELECT id FROM service_categories WHERE slug = $1', ['3d']);
  const paperId: number = paperCat.id;
  const tdId: number = threeDCat.id;

  // ─── Paper Spec Options ─────────────────────────────────────────────
  const paperOptions = [
    // paper_size
    [paperId, 'paper_size', 'A5', 'a5', 0.800, 0, 0, null, false, true, 10],
    [paperId, 'paper_size', 'A4', 'a4', 1.000, 0, 0, null, true,  true, 20],
    [paperId, 'paper_size', 'A3', 'a3', 1.500, 0, 0, null, false, true, 30],
    [paperId, 'paper_size', 'A2', 'a2', 2.500, 0, 0, null, false, true, 40],
    [paperId, 'paper_size', 'A1', 'a1', 4.000, 0, 0, null, false, true, 50],
    [paperId, 'paper_size', '20×30in', 'twenty_by_thirty', 3.000, 0, 0, null, false, true, 60],
    [paperId, 'paper_size', 'Custom', 'custom', 2.000, 0, 0, null, false, true, 70],
    // color_mode
    [paperId, 'color_mode', 'Black & White', 'black_and_white', 1.000, 0, 0, null, true,  true, 10],
    [paperId, 'color_mode', 'Full Color',    'full_color',      2.500, 0, 0, null, false, true, 20],
    // media_type
    [paperId, 'media_type', 'Matte',  'matte',  1.000, 0, 0, null, true,  true, 10],
    [paperId, 'media_type', 'Glossy', 'glossy', 1.300, 0, 0, null, false, true, 20],
    // print_sides
    [paperId, 'print_sides', 'Front Only',   'front_only',   1.000, 0, 0, null, true,  true, 10],
    [paperId, 'print_sides', 'Back-to-Back', 'back_to_back', 1.800, 0, 0, null, false, true, 20],
    // binding
    [paperId, 'binding', 'None',    'none',    1.000,  0.00, 0, null, true,  true, 10],
    [paperId, 'binding', 'Staple',  'staple',  1.000, 10.00, 0, null, false, true, 20],
    [paperId, 'binding', 'Spiral',  'spiral',  1.000, 25.00, 0, null, false, true, 30],
    [paperId, 'binding', 'Premium', 'premium', 1.000, 50.00, 0, null, false, true, 40],
  ];
  for (const o of paperOptions) {
    await ds.query(
      `INSERT INTO spec_options (category_id, option_group, label, value, multiplier, fixed_fee, unit_cost, estimated_grams, is_default, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      o,
    );
  }
  console.log('✅ 17 paper spec options created');

  // ─── 3D Spec Options ────────────────────────────────────────────────
  const tdOptions = [
    // file_format
    [tdId, 'file_format', 'STL', 'stl',      1.0, 0, 0.00, null, true,  true, 10],
    [tdId, 'file_format', 'OBJ', 'obj',      1.0, 0, 0.00, null, false, true, 20],
    [tdId, 'file_format', '3MF', 'three_mf', 1.0, 0, 0.00, null, false, true, 30],
    // material
    [tdId, 'material', 'PLA',  'pla',  1.0, 0, 3.00, null, true,  true, 10],
    [tdId, 'material', 'ABS',  'abs',  1.0, 0, 3.00, null, false, true, 20],
    [tdId, 'material', 'PETG', 'petg', 1.0, 0, 4.00, null, false, true, 30],
    // infill
    [tdId, 'infill', '10%',  'infill_10',  1.0, 0, 0, 20,  true,  true, 10],
    [tdId, 'infill', '20%',  'infill_20',  1.0, 0, 0, 40,  false, true, 20],
    [tdId, 'infill', '50%',  'infill_50',  1.0, 0, 0, 100, false, true, 30],
    [tdId, 'infill', '100%', 'infill_100', 1.0, 0, 0, 200, false, true, 40],
    // layer_height
    [tdId, 'layer_height', '0.1mm', 'layer_01', 1.0, 0, 0, null, false, true, 10],
    [tdId, 'layer_height', '0.2mm', 'layer_02', 1.0, 0, 0, null, true,  true, 20],
    [tdId, 'layer_height', '0.3mm', 'layer_03', 1.0, 0, 0, null, false, true, 30],
  ];
  for (const o of tdOptions) {
    await ds.query(
      `INSERT INTO spec_options (category_id, option_group, label, value, multiplier, fixed_fee, unit_cost, estimated_grams, is_default, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      o,
    );
  }
  console.log('✅ 13 3D spec options created');

  // ─── Service Addons ─────────────────────────────────────────────────
  await ds.query(
    `INSERT INTO service_addons (category_id, name, description, price, price_type, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [paperId, 'Lamination (A4)', 'Matte or glossy lamination for A4 sheets', 20.00, 'per_unit', true, 10],
  );
  await ds.query(
    `INSERT INTO service_addons (category_id, name, description, price, price_type, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [null, 'Rush Processing', 'Priority queue processing, ready in 2 hours', 150.00, 'flat', true, 20],
  );
  console.log('✅ 2 service addons created');
```

- [ ] **Step 3: Run the seed**

```bash
cd server
npm run seed
```

Expected output should include:
```
✅ 2 service categories created (paper, 3d)
✅ 17 paper spec options created
✅ 13 3D spec options created
✅ 2 service addons created
```

- [ ] **Step 4: Verify endpoints return data**

```bash
curl http://localhost:3000/api/products/categories
# Should return array with 2 categories

curl http://localhost:3000/api/products/categories/paper/pricing
# Should return pricing config with groups.paper_size, groups.color_mode, etc.
```

- [ ] **Step 5: Commit**

```bash
git add server/src/seed.ts
git commit -m "feat(products): seed service categories, spec options, and addons"
```

---

## Task 6: Admin TypeScript Types + Mock Data

**Files:**
- Create: `admin/src/types/products.ts`
- Modify: `admin/src/providers/mock-data.ts`

- [ ] **Step 1: Create `admin/src/types/products.ts`**

```typescript
// admin/src/types/products.ts

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  base_rate: number;
  max_file_size_mb: number;
  allowed_extensions: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SpecOption {
  id: string;
  category_id: string;
  option_group: string;
  label: string;
  value: string;
  multiplier: number;
  fixed_fee: number;
  unit_cost: number;
  estimated_grams?: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
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

- [ ] **Step 2: Add mock products data to `admin/src/providers/mock-data.ts`**

Append at the end of the file:

```typescript
// ─── Mock Products ───────────────────────────────────────────────────────────

import type { ServiceCategory, SpecOption, ServiceAddon } from '@/types/products';

export const mockCategories: ServiceCategory[] = [
  {
    id: '1',
    name: 'Paper Printing',
    slug: 'paper',
    description: 'Standard and large-format paper printing',
    icon: 'FileTextOutlined',
    base_rate: 2.0,
    max_file_size_mb: 50,
    allowed_extensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx'],
    is_active: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: '3D Printing',
    slug: '3d',
    description: 'FDM 3D printing with PLA, ABS, and PETG materials',
    icon: 'AppstoreOutlined',
    base_rate: 50.0,
    max_file_size_mb: 200,
    allowed_extensions: ['stl', 'obj', '3mf'],
    is_active: true,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

export const mockSpecOptions: SpecOption[] = [
  { id: '1',  category_id: '1', option_group: 'paper_size', label: 'A5', value: 'a5', multiplier: 0.8, fixed_fee: 0, unit_cost: 0, is_default: false, is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '2',  category_id: '1', option_group: 'paper_size', label: 'A4', value: 'a4', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, is_default: true,  is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '3',  category_id: '1', option_group: 'paper_size', label: 'A3', value: 'a3', multiplier: 1.5, fixed_fee: 0, unit_cost: 0, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '4',  category_id: '1', option_group: 'color_mode', label: 'Black & White', value: 'black_and_white', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '5',  category_id: '1', option_group: 'color_mode', label: 'Full Color',    value: 'full_color',      multiplier: 2.5, fixed_fee: 0, unit_cost: 0, is_default: false, is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '6',  category_id: '1', option_group: 'binding', label: 'None',    value: 'none',    multiplier: 1.0, fixed_fee: 0,  unit_cost: 0, is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '7',  category_id: '1', option_group: 'binding', label: 'Spiral',  value: 'spiral',  multiplier: 1.0, fixed_fee: 25, unit_cost: 0, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '8',  category_id: '2', option_group: 'material', label: 'PLA',  value: 'pla',  multiplier: 1.0, fixed_fee: 0, unit_cost: 3.0, is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '9',  category_id: '2', option_group: 'material', label: 'ABS',  value: 'abs',  multiplier: 1.0, fixed_fee: 0, unit_cost: 3.0, is_default: false, is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '10', category_id: '2', option_group: 'material', label: 'PETG', value: 'petg', multiplier: 1.0, fixed_fee: 0, unit_cost: 4.0, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '11', category_id: '2', option_group: 'infill', label: '10%', value: 'infill_10', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, estimated_grams: 20,  is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '12', category_id: '2', option_group: 'infill', label: '20%', value: 'infill_20', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, estimated_grams: 40,  is_default: false, is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '13', category_id: '2', option_group: 'infill', label: '50%', value: 'infill_50', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, estimated_grams: 100, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

export const mockAddons: ServiceAddon[] = [
  {
    id: '1',
    category_id: '1',
    name: 'Lamination (A4)',
    description: 'Matte or glossy lamination for A4 sheets',
    price: 20.0,
    price_type: 'per_unit',
    is_active: true,
    sort_order: 10,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Rush Processing',
    description: 'Priority queue processing, ready in 2 hours',
    price: 150.0,
    price_type: 'flat',
    is_active: true,
    sort_order: 20,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd admin && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add admin/src/types/products.ts admin/src/providers/mock-data.ts
git commit -m "feat(admin): add product TypeScript types and mock data"
```

---

## Task 7: Admin — Categories Page

**Files:**
- Modify: `admin/src/pages/products/list.tsx` — replace existing mock page

- [ ] **Step 1: Replace `admin/src/pages/products/list.tsx`**

```tsx
// admin/src/pages/products/list.tsx
import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Switch, Button, Drawer, Form, Input,
  InputNumber, Space, Tag, Divider, Spin, App,
} from 'antd';
import {
  EditOutlined, PlusOutlined, FileTextOutlined,
  AppstoreOutlined, SettingOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { mockCategories } from '@/providers/mock-data';
import type { ServiceCategory } from '@/types/products';
import { formatCurrency } from '@/utils/format';

const { Text, Title } = Typography;

const S = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: 20, paddingBottom: 40 },
  card: { background: '#141414', border: '1px solid #2E2E2E', borderRadius: 12, overflow: 'hidden' as const },
  label: { color: '#666', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { color: '#F0F0F0', fontSize: 14, fontWeight: 600 } as React.CSSProperties,
};

const axiosInstance = axios.create();
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('grid_admin_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  paper: <FileTextOutlined style={{ fontSize: 28, color: '#FFDE58' }} />,
  '3d': <AppstoreOutlined style={{ fontSize: 28, color: '#42A5F5' }} />,
};

export function ProductList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get<ServiceCategory[]>(`${API_URL}/products/categories`);
      setCategories(res.data);
    } catch {
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCategories(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (cat: ServiceCategory) => {
    setEditTarget(cat);
    form.setFieldsValue({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      base_rate: cat.base_rate,
      max_file_size_mb: cat.max_file_size_mb,
      allowed_extensions: cat.allowed_extensions.join(', '),
      sort_order: cat.sort_order,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        allowedExtensions: JSON.stringify(
          (values.allowed_extensions as string).split(',').map((e: string) => e.trim().toLowerCase()),
        ),
        baseRate: values.base_rate,
        maxFileSizeMb: values.max_file_size_mb,
        sortOrder: values.sort_order ?? 0,
      };
      if (editTarget) {
        await axiosInstance.patch(`${API_URL}/products/categories/${editTarget.id}`, payload);
        void message.success('Category updated');
      } else {
        await axiosInstance.post(`${API_URL}/products/categories`, payload);
        void message.success('Category created');
      }
      setDrawerOpen(false);
      void fetchCategories();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: ServiceCategory) => {
    try {
      await axiosInstance.patch(`${API_URL}/products/categories/${cat.id}`, { isActive: !cat.is_active });
      void fetchCategories();
    } catch {
      void message.error('Failed to update status');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ color: '#F0F0F0', margin: 0, marginBottom: 2 }}>Products & Services</Title>
          <Text style={{ color: '#666', fontSize: 13 }}>Manage service categories, pricing options, and addons</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#FFDE58', borderColor: '#FFDE58', color: '#141414', fontWeight: 600 }}>
          New Category
        </Button>
      </div>

      {/* Category Cards */}
      <Row gutter={[16, 16]}>
        {categories.map((cat) => (
          <Col xs={24} sm={12} lg={8} key={cat.id}>
            <Card
              style={{ ...S.card, opacity: cat.is_active ? 1 : 0.6 }}
              styles={{ body: { padding: 20 } }}
            >
              {/* Icon + name row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#1A1A1A', borderRadius: 10, padding: 10, border: '1px solid #2E2E2E' }}>
                    {CATEGORY_ICONS[cat.slug] ?? <AppstoreOutlined style={{ fontSize: 28, color: '#808080' }} />}
                  </div>
                  <div>
                    <Text strong style={{ color: '#F0F0F0', display: 'block', fontSize: 15 }}>{cat.name}</Text>
                    <Tag style={{ marginTop: 2, fontSize: 10, borderRadius: 4, background: '#1A1A1A', borderColor: '#333', color: '#808080' }}>
                      {cat.slug}
                    </Tag>
                  </div>
                </div>
                <Switch checked={cat.is_active} size="small" onChange={() => handleToggleActive(cat)} />
              </div>

              <Text style={{ color: '#666', fontSize: 12, display: 'block', marginBottom: 16, lineHeight: 1.5 }}>
                {cat.description ?? '—'}
              </Text>

              <Divider style={{ borderColor: '#2E2E2E', margin: '0 0 14px' }} />

              {/* Stats grid */}
              <Row gutter={[12, 10]}>
                <Col span={12}>
                  <Text style={S.label}>Base Rate</Text>
                  <Text style={{ ...S.value, color: '#34d399', display: 'block' }}>{formatCurrency(cat.base_rate)}/page</Text>
                </Col>
                <Col span={12}>
                  <Text style={S.label}>Max File</Text>
                  <Text style={{ ...S.value, display: 'block' }}>{cat.max_file_size_mb} MB</Text>
                </Col>
                <Col span={24}>
                  <Text style={S.label}>File Types</Text>
                  <div style={{ marginTop: 4 }}>
                    {cat.allowed_extensions.map((ext) => (
                      <Tag key={ext} style={{ fontSize: 10, background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0', marginBottom: 2 }}>
                        .{ext}
                      </Tag>
                    ))}
                  </div>
                </Col>
              </Row>

              <Divider style={{ borderColor: '#2E2E2E', margin: '14px 0 12px' }} />

              {/* Action buttons */}
              <Space size={8} style={{ width: '100%' }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(cat)}
                  style={{ background: '#1A1A1A', borderColor: '#333', color: '#F0F0F0', flex: 1 }}>
                  Edit
                </Button>
                <Button size="small" icon={<SettingOutlined />}
                  onClick={() => navigate(`/products/${cat.id}/options`)}
                  style={{ background: '#1A1A1A', borderColor: '#333', color: '#F0F0F0', flex: 1 }}>
                  Spec Options
                </Button>
                <Button size="small" icon={<ArrowRightOutlined />}
                  onClick={() => navigate(`/products-addons?category_id=${cat.id}`)}
                  style={{ background: '#1A1A1A', borderColor: '#333', color: '#F0F0F0' }}>
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Create/Edit Drawer */}
      <Drawer
        title={<Text style={{ color: '#F0F0F0', fontWeight: 600 }}>{editTarget ? 'Edit Category' : 'New Category'}</Text>}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={440}
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}
            style={{ background: '#FFDE58', borderColor: '#FFDE58', color: '#141414', fontWeight: 600 }}>
            Save
          </Button>
        }
        styles={{ body: { background: '#141414' }, header: { background: '#141414', borderBottom: '1px solid #2E2E2E' }, footer: { background: '#141414' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Name</Text>} name="name" rules={[{ required: true }]}>
            <Input placeholder="Paper Printing" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Slug</Text>} name="slug"
            rules={[{ required: true }, { pattern: /^[a-z0-9-]+$/, message: 'Lowercase alphanumeric + hyphens only' }]}>
            <Input placeholder="paper" disabled={!!editTarget} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Description</Text>} name="description">
            <Input.TextArea rows={2} placeholder="Short description..." />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Base Rate (₱)</Text>} name="base_rate" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} prefix="₱" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Max File Size (MB)</Text>} name="max_file_size_mb" rules={[{ required: true }]}>
            <InputNumber min={1} max={500} style={{ width: '100%' }} addonAfter="MB" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Allowed Extensions</Text>} name="allowed_extensions"
            rules={[{ required: true }]}
            help={<Text style={{ color: '#555', fontSize: 11 }}>Comma-separated: pdf, png, jpg</Text>}>
            <Input placeholder="pdf, png, jpg, jpeg" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd admin && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Start admin dev server and verify categories page loads**

```bash
npm run dev
```

Open `http://localhost:5173/products` — should show 2 cards (Paper Printing, 3D Printing) loaded from the API (or mock data fallback).

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/products/list.tsx
git commit -m "feat(admin): replace mock products page with real categories overview"
```

---

## Task 8: Admin — Spec Options Page

**Files:**
- Create: `admin/src/pages/products/options.tsx`

- [ ] **Step 1: Create `admin/src/pages/products/options.tsx`**

```tsx
// admin/src/pages/products/options.tsx
import React, { useState, useEffect } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber,
  Switch, Space, Typography, Spin, Breadcrumb, Tag, App,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { mockCategories, mockSpecOptions } from '@/providers/mock-data';
import type { ServiceCategory, SpecOption } from '@/types/products';

const { Text } = Typography;

const axiosInstance = axios.create();
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('grid_admin_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Groups that have a fixed_fee (bindings)
const FEE_GROUPS = new Set(['binding']);
// Groups that have a unit_cost (materials)
const COST_GROUPS = new Set(['material']);
// Groups that have estimated_grams (infill)
const GRAM_GROUPS = new Set(['infill']);

export function ProductOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [options, setOptions] = useState<SpecOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      const [catRes, optRes] = await Promise.all([
        axiosInstance.get<ServiceCategory>(`${API_URL}/products/categories/${id!}`),
        axiosInstance.get<SpecOption[]>(`${API_URL}/products/options?category_id=${id!}`),
      ]);
      setCategory(catRes.data);
      setOptions(optRes.data);
    } catch {
      const cat = mockCategories.find((c) => c.id === id) ?? null;
      setCategory(cat);
      setOptions(mockSpecOptions.filter((o) => o.category_id === id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [id]);

  const groups = [...new Set(options.map((o) => o.option_group))].sort();

  const handleToggleActive = async (opt: SpecOption) => {
    try {
      await axiosInstance.patch(`${API_URL}/products/options/${opt.id}`, { isActive: !opt.is_active });
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Update failed');
      }
    }
  };

  const handleInlineEdit = async (opt: SpecOption, field: keyof SpecOption, value: unknown) => {
    try {
      const key = field === 'option_group' ? 'optionGroup'
        : field === 'fixed_fee' ? 'fixedFee'
        : field === 'unit_cost' ? 'unitCost'
        : field === 'is_default' ? 'isDefault'
        : field === 'is_active' ? 'isActive'
        : field === 'sort_order' ? 'sortOrder'
        : field === 'estimated_grams' ? 'estimatedGrams'
        : field;
      await axiosInstance.patch(`${API_URL}/products/options/${opt.id}`, { [key]: value });
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Update failed');
      }
    }
  };

  const handleDelete = (opt: SpecOption) => {
    modal.confirm({
      title: `Delete "${opt.label}"?`,
      content: 'This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axiosInstance.delete(`${API_URL}/products/options/${opt.id}`);
          void message.success('Option deleted');
          void fetchData();
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            void message.error(err.response?.data?.message ?? 'Delete failed');
          }
        }
      },
    });
  };

  const openAddModal = (group: string) => {
    setActiveGroup(group);
    form.resetFields();
    form.setFieldValue('optionGroup', group);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await axiosInstance.post(`${API_URL}/products/options`, {
        ...values,
        categoryId: Number(id),
      });
      void message.success('Option added');
      setModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Create failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = (group: string) => [
    {
      title: 'Label',
      dataIndex: 'label',
      width: 140,
      render: (label: string, record: SpecOption) => (
        <Text
          editable={{ onChange: (v) => handleInlineEdit(record, 'label', v), triggerType: ['text'] }}
          style={{ color: '#F0F0F0', fontSize: 13 }}
        >
          {label}
        </Text>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      width: 120,
      render: (v: string) => <Text style={{ color: '#808080', fontSize: 12, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: 'Multiplier',
      dataIndex: 'multiplier',
      width: 100,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0.001}
          step={0.1}
          precision={3}
          defaultValue={v}
          style={{ width: 80 }}
          onBlur={(e) => handleInlineEdit(record, 'multiplier', parseFloat(e.target.value))}
        />
      ),
    },
    ...(FEE_GROUPS.has(group) ? [{
      title: 'Fee (₱)',
      dataIndex: 'fixed_fee',
      width: 90,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={5}
          precision={2}
          defaultValue={v}
          style={{ width: 75 }}
          onBlur={(e) => handleInlineEdit(record, 'fixed_fee', parseFloat(e.target.value))}
        />
      ),
    }] : []),
    ...(COST_GROUPS.has(group) ? [{
      title: '₱/gram',
      dataIndex: 'unit_cost',
      width: 90,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={0.5}
          precision={2}
          defaultValue={v}
          style={{ width: 75 }}
          onBlur={(e) => handleInlineEdit(record, 'unit_cost', parseFloat(e.target.value))}
        />
      ),
    }] : []),
    ...(GRAM_GROUPS.has(group) ? [{
      title: 'Est. Grams',
      dataIndex: 'estimated_grams',
      width: 100,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={1}
          defaultValue={v}
          style={{ width: 80 }}
          onBlur={(e) => handleInlineEdit(record, 'estimated_grams', parseInt(e.target.value))}
        />
      ),
    }] : []),
    {
      title: 'Default',
      dataIndex: 'is_default',
      width: 70,
      render: (v: boolean, record: SpecOption) => (
        <Switch
          checked={v}
          size="small"
          onChange={(checked) => handleInlineEdit(record, 'is_default', checked)}
        />
      ),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: 70,
      render: (v: boolean, record: SpecOption) => (
        <Switch checked={v} size="small" onChange={() => handleToggleActive(record)} />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, record: SpecOption) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record)}
          style={{ color: '#555' }}
        />
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      <div>
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={[
            { title: <HomeOutlined onClick={() => navigate('/products')} style={{ cursor: 'pointer', color: '#666' }} /> },
            { title: <Text style={{ color: '#666', cursor: 'pointer' }} onClick={() => navigate('/products')}>Products</Text> },
            { title: <Text style={{ color: '#F0F0F0' }}>{category?.name ?? 'Spec Options'}</Text> },
          ]}
        />
        <Text style={{ color: '#F0F0F0', fontSize: 20, fontWeight: 700, display: 'block' }}>
          Spec Options — {category?.name}
        </Text>
        <Text style={{ color: '#666', fontSize: 13 }}>
          Edit pricing multipliers and toggle options. Changes are saved on field blur.
        </Text>
      </div>

      <div className="riders-table-section">
        <Tabs
          style={{ padding: '0 4px' }}
          tabBarStyle={{ padding: '0 16px', borderBottom: '1px solid #2E2E2E', marginBottom: 0 }}
          items={groups.map((group) => {
            const groupOptions = options.filter((o) => o.option_group === group);
            return {
              key: group,
              label: (
                <Space size={6}>
                  <span style={{ textTransform: 'capitalize' }}>{group.replace(/_/g, ' ')}</span>
                  <Tag style={{ fontSize: 10, background: '#1A1A1A', borderColor: '#333', color: '#808080', margin: 0 }}>
                    {groupOptions.length}
                  </Tag>
                </Space>
              ),
              children: (
                <div>
                  <Table
                    dataSource={groupOptions}
                    rowKey="id"
                    columns={columns(group)}
                    size="small"
                    pagination={false}
                    scroll={{ x: 480 }}
                  />
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #1A1A1A' }}>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => openAddModal(group)}
                      style={{ borderColor: '#333', color: '#FFDE58', background: 'transparent' }}
                    >
                      Add {group.replace(/_/g, ' ')} option
                    </Button>
                  </div>
                </div>
              ),
            };
          })}
        />
      </div>

      {/* Add Option Modal */}
      <Modal
        title={<Text style={{ color: '#F0F0F0' }}>Add {activeGroup.replace(/_/g, ' ')} option</Text>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Add"
        confirmLoading={saving}
        styles={{ content: { background: '#1E1E1E' }, header: { background: '#1E1E1E', borderBottom: '1px solid #2E2E2E' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="optionGroup" hidden><Input /></Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Label</Text>} name="label" rules={[{ required: true }]}>
            <Input placeholder="e.g. A3" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Value (slug)</Text>} name="value"
            rules={[{ required: true }, { pattern: /^[a-z0-9_]+$/, message: 'Lowercase letters, numbers, underscores' }]}>
            <Input placeholder="e.g. a3" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Multiplier</Text>} name="multiplier" initialValue={1.0}>
            <InputNumber min={0.001} step={0.1} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          {FEE_GROUPS.has(activeGroup) && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Fixed Fee (₱)</Text>} name="fixedFee" initialValue={0}>
              <InputNumber min={0} step={5} precision={2} style={{ width: '100%' }} prefix="₱" />
            </Form.Item>
          )}
          {COST_GROUPS.has(activeGroup) && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Cost per Gram (₱)</Text>} name="unitCost" initialValue={0}>
              <InputNumber min={0} step={0.5} precision={2} style={{ width: '100%' }} prefix="₱" />
            </Form.Item>
          )}
          {GRAM_GROUPS.has(activeGroup) && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Estimated Grams</Text>} name="estimatedGrams">
              <InputNumber min={1} style={{ width: '100%' }} addonAfter="g" />
            </Form.Item>
          )}
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sortOrder" initialValue={99}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd admin && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/products/options.tsx
git commit -m "feat(admin): add spec options page with inline editing per group"
```

---

## Task 9: Admin — Addons Page + App Routing

**Files:**
- Create: `admin/src/pages/products-addons/list.tsx`
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Create `admin/src/pages/products-addons/list.tsx`**

```tsx
// admin/src/pages/products-addons/list.tsx
import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch,
  Select, Space, Typography, Tag, Spin, App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { mockAddons, mockCategories } from '@/providers/mock-data';
import type { ServiceAddon, ServiceCategory } from '@/types/products';
import { formatCurrency } from '@/utils/format';

const { Text, Title } = Typography;

const axiosInstance = axios.create();
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('grid_admin_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export function AddonList() {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category_id');
  const { message, modal } = App.useApp();
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceAddon | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      const [addonRes, catRes] = await Promise.all([
        axiosInstance.get<ServiceAddon[]>(`${API_URL}/products/addons${categoryId ? `?category_id=${categoryId}` : ''}`),
        axiosInstance.get<ServiceCategory[]>(`${API_URL}/products/categories`),
      ]);
      setAddons(addonRes.data);
      setCategories(catRes.data);
    } catch {
      setAddons(mockAddons);
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [categoryId]);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    if (categoryId) form.setFieldValue('categoryId', Number(categoryId));
    setModalOpen(true);
  };

  const openEdit = (addon: ServiceAddon) => {
    setEditTarget(addon);
    form.setFieldsValue({
      categoryId: addon.category_id ? Number(addon.category_id) : null,
      name: addon.name,
      description: addon.description,
      price: addon.price,
      priceType: addon.price_type,
      isActive: addon.is_active,
      sortOrder: addon.sort_order,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editTarget) {
        await axiosInstance.patch(`${API_URL}/products/addons/${editTarget.id}`, values);
        void message.success('Addon updated');
      } else {
        await axiosInstance.post(`${API_URL}/products/addons`, values);
        void message.success('Addon created');
      }
      setModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addon: ServiceAddon) => {
    modal.confirm({
      title: `Delete "${addon.name}"?`,
      content: 'This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axiosInstance.delete(`${API_URL}/products/addons/${addon.id}`);
          void message.success('Addon deleted');
          void fetchData();
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            void message.error(err.response?.data?.message ?? 'Delete failed');
          }
        }
      },
    });
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ color: '#F0F0F0', margin: 0, marginBottom: 2 }}>Service Addons</Title>
          <Text style={{ color: '#666', fontSize: 13 }}>Optional extras customers can add to their orders</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#FFDE58', borderColor: '#FFDE58', color: '#141414', fontWeight: 600 }}>
          New Addon
        </Button>
      </div>

      <div className="riders-table-section">
        <Table
          dataSource={addons}
          rowKey="id"
          size="middle"
          pagination={false}
          scroll={{ x: 640 }}
        >
          <Table.Column
            title="Name"
            width={200}
            render={(_: unknown, record: ServiceAddon) => (
              <div>
                <Text strong style={{ color: '#F0F0F0', display: 'block', fontSize: 13.5 }}>{record.name}</Text>
                {record.description && (
                  <Text style={{ color: '#666', fontSize: 11.5 }}>{record.description}</Text>
                )}
              </div>
            )}
          />
          <Table.Column
            title="Category"
            width={140}
            render={(_: unknown, record: ServiceAddon) => {
              if (!record.category_id) return <Tag style={{ background: '#1A1A1A', borderColor: '#333', color: '#808080' }}>All categories</Tag>;
              const cat = categories.find((c) => c.id === record.category_id);
              return <Tag style={{ background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0' }}>{cat?.name ?? record.category_id}</Tag>;
            }}
          />
          <Table.Column
            title="Price"
            width={120}
            render={(_: unknown, record: ServiceAddon) => (
              <div>
                <Text style={{ color: '#34d399', fontWeight: 600, display: 'block' }}>{formatCurrency(record.price)}</Text>
                <Text style={{ color: '#666', fontSize: 11 }}>{record.price_type === 'flat' ? 'flat fee' : 'per unit'}</Text>
              </div>
            )}
          />
          <Table.Column
            dataIndex="is_active"
            title="Active"
            width={80}
            render={(v: boolean, record: ServiceAddon) => (
              <Switch
                checked={v}
                size="small"
                onChange={async (checked) => {
                  try {
                    await axiosInstance.patch(`${API_URL}/products/addons/${record.id}`, { isActive: checked });
                    void fetchData();
                  } catch {
                    void message.error('Update failed');
                  }
                }}
              />
            )}
          />
          <Table.Column
            title=""
            width={80}
            render={(_: unknown, record: ServiceAddon) => (
              <Space size={4}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}
                  style={{ color: '#808080' }} />
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)}
                  style={{ color: '#555' }} />
              </Space>
            )}
          />
        </Table>
      </div>

      <Modal
        title={<Text style={{ color: '#F0F0F0' }}>{editTarget ? 'Edit Addon' : 'New Addon'}</Text>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        styles={{ content: { background: '#1E1E1E' }, header: { background: '#1E1E1E', borderBottom: '1px solid #2E2E2E' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Name</Text>} name="name" rules={[{ required: true }]}>
            <Input placeholder="Lamination" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Description</Text>} name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Category (leave blank for all)</Text>} name="categoryId">
            <Select allowClear placeholder="All categories">
              {categories.map((c) => (
                <Select.Option key={c.id} value={Number(c.id)}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Price (₱)</Text>} name="price" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={5} precision={2} style={{ width: '100%' }} prefix="₱" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Price Type</Text>} name="priceType" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="flat">Flat fee (once per order)</Select.Option>
              <Select.Option value="per_unit">Per unit</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Active</Text>} name="isActive" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sortOrder" initialValue={99}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Update `admin/src/App.tsx` to add new routes and resources**

Add imports at the top:

```typescript
import { ProductOptionsPage } from "@/pages/products/options";
import { AddonList } from "@/pages/products-addons/list";
```

Add to the `resources` array (after the existing `products` resource):

```tsx
{
  name: "products-addons",
  list: "/products-addons",
  meta: {
    label: "Addons",
    parent: "products",
    icon: <PlusSquareOutlined />,
  },
},
```

Add `PlusSquareOutlined` to the icon imports from `@ant-design/icons`.

Add to the Routes inside the authenticated layout:

```tsx
<Route path="/products">
  <Route index element={<ProductList />} />
  <Route path=":id/options" element={<ProductOptionsPage />} />
</Route>
<Route path="/products-addons" element={<AddonList />} />
```

Replace the existing flat `<Route path="/products" element={<ProductList />} />` with the block above.

- [ ] **Step 3: Run TypeScript check and build**

```bash
cd admin && npx tsc --noEmit 2>&1 | head -20 && npm run build 2>&1 | tail -5
```

Expected: no TS errors, build succeeds

- [ ] **Step 4: Full smoke test**

Start backend + admin:
```bash
# Terminal 1
cd server && npm run start:dev

# Terminal 2
cd admin && npm run dev
```

Verify:
1. `http://localhost:5173/products` — shows Paper Printing + 3D Printing cards
2. Click "Spec Options" on Paper Printing → navigates to `/products/1/options`
3. Spec options page shows tabs: paper_size, color_mode, binding, etc.
4. Edit a multiplier value (click, change, blur) — check network tab for PATCH request
5. Click "Add binding option" → modal opens, fill form, submit
6. `http://localhost:5173/products-addons` — shows addons table
7. Click "New Addon" → modal opens, fill form, submit
8. Toggle active switch on an addon — changes immediately

- [ ] **Step 5: Run all tests**

```bash
cd server && npm test -- --no-coverage 2>&1 | tail -10
```

Expected: all existing tests pass + 8 new products service tests pass

- [ ] **Step 6: Final commit**

```bash
git add admin/src/pages/products-addons/list.tsx admin/src/App.tsx
git commit -m "feat(admin): add addons page + wire all product routes in App.tsx"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 14 API endpoints implemented ✓, 3 admin pages ✓, seed data for all spec options ✓, service validation rules ✓
- [x] **Placeholders:** None — all code blocks are complete
- [x] **Type consistency:** `optionGroup` property used consistently throughout (entity, DTO, service, controller) ✓; `ServiceCategory.baseRate` / `base_rate` (snake_case in TS types, camelCase in entity) consistent with existing codebase patterns ✓
- [x] **Route ordering:** `options/reorder` declared before `options/:id` in controller ✓; React Router `/products-addons` is separate from `/products/:id` ✓
- [x] **Column naming:** `option_group` DB column avoids SQL reserved word `group` ✓
