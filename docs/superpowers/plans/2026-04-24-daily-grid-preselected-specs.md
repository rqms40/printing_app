# Daily Grid Preselected Specs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a Daily Grid card routes the customer into the printing flow with specs pre-populated from admin-configured values, and gives admins a full CRUD UI to manage Daily Grid cards including image upload and spec presets.

**Architecture:** Two nullable JSONB columns added to `DailyGridCard` entity (TypeORM auto-sync handles schema in dev); DailyGridController gains a typed image-upload endpoint; existing admin `list.tsx` page is extended with image upload and conditional spec fields; Flutter `DailyGridItem` gains spec fields; `OrderFlowNotifier` gets two map-parse methods; the card tap handler resets flow, pre-populates specs, and pushes to the correct specs screen.

**Tech Stack:** NestJS + TypeORM (entity) · MinIO (StorageService — global) · React + Ant Design (admin) · Flutter + Riverpod (mobile)

---

## File Map

**Create:**
- `server/src/daily-grid/dto/create-daily-grid-card.dto.ts`
- `server/src/daily-grid/dto/update-daily-grid-card.dto.ts`
- `server/src/daily-grid/dto/create-daily-grid-card.dto.spec.ts`
- `apps/mobile/test/shared/models/daily_grid_item_test.dart`
- `apps/mobile/test/features/customer/order/providers/order_provider_specs_test.dart`

**Modify:**
- `server/src/daily-grid/entities/daily-grid-card.entity.ts` — add 2 JSONB columns
- `server/src/daily-grid/daily-grid.controller.ts` — typed DTOs + image upload endpoint
- `admin/src/pages/daily-grid/list.tsx` — spec fields + image file upload
- `apps/mobile/lib/shared/models/daily_grid_item.dart` — add spec fields
- `apps/mobile/lib/features/customer/order/providers/order_provider.dart` — add 2 notifier methods
- `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart` — update tap handler

---

## Task 1: Server — Add paperSpecs and threeDSpecs columns to entity

**Files:**
- Modify: `server/src/daily-grid/entities/daily-grid-card.entity.ts`

TypeORM is configured with `synchronize: true` in non-production environments (see `app.module.ts`), so adding columns to the entity is sufficient — no manual migration file is needed.

- [ ] **Step 1: Add the two JSONB columns**

Replace the full file content:

```typescript
// server/src/daily-grid/entities/daily-grid-card.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_grid_cards')
export class DailyGridCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'varchar' })
  subtitle: string | null;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl: string | null;

  /** 'paper' | '3d' — matches OrderFlowState.category */
  @Column({ default: 'paper' })
  category: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'paper_specs', type: 'jsonb', nullable: true })
  paperSpecs: {
    paperSize?: string;
    colorMode?: string;
    mediaType?: string;
    printSides?: string;
    binding?: string;
  } | null;

  @Column({ name: 'three_d_specs', type: 'jsonb', nullable: true })
  threeDSpecs: {
    fileFormat?: string;
    material?: string;
    color?: string;
    infillPercentage?: number;
    layerHeight?: number;
    supports?: boolean;
    notes?: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify server starts without errors**

```bash
cd server && npm run start:dev
```

Expected: TypeORM emits `ALTER TABLE "daily_grid_cards" ADD ...` lines — no errors. `Ctrl+C` to stop.

- [ ] **Step 3: Commit**

```bash
git add server/src/daily-grid/entities/daily-grid-card.entity.ts
git commit -m "feat: add paperSpecs and threeDSpecs JSONB columns to DailyGridCard entity"
```

---

## Task 2: Server — Typed DTOs + image upload endpoint

**Files:**
- Create: `server/src/daily-grid/dto/create-daily-grid-card.dto.ts`
- Create: `server/src/daily-grid/dto/update-daily-grid-card.dto.ts`
- Create: `server/src/daily-grid/dto/create-daily-grid-card.dto.spec.ts`
- Modify: `server/src/daily-grid/daily-grid.controller.ts`

StorageModule is `@Global()` — no import needed in DailyGridModule to use `StorageService`.

- [ ] **Step 1: Write failing DTO tests**

```typescript
// server/src/daily-grid/dto/create-daily-grid-card.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDailyGridCardDto } from './create-daily-grid-card.dto';

async function v(plain: object) {
  const dto = plainToInstance(CreateDailyGridCardDto, plain);
  return validate(dto);
}

describe('CreateDailyGridCardDto', () => {
  it('accepts minimal valid card', async () => {
    const errs = await v({ title: 'Bond A4', category: 'paper' });
    expect(errs).toHaveLength(0);
  });

  it('accepts valid paperSpecs object', async () => {
    const errs = await v({
      title: 'Bond A4',
      category: 'paper',
      paperSpecs: { paperSize: 'a4', colorMode: 'blackAndWhite' },
    });
    expect(errs).toHaveLength(0);
  });

  it('accepts valid threeDSpecs object', async () => {
    const errs = await v({
      title: '3D Print',
      category: '3d',
      threeDSpecs: { material: 'pla', infillPercentage: 20 },
    });
    expect(errs).toHaveLength(0);
  });

  it('rejects paperSpecs as a string', async () => {
    const errs = await v({
      title: 'Bond A4',
      category: 'paper',
      paperSpecs: 'not-an-object',
    });
    expect(errs.some((e) => e.property === 'paperSpecs')).toBe(true);
  });

  it('accepts card without specs', async () => {
    const errs = await v({ title: 'Bond A4', category: 'paper' });
    expect(errs).toHaveLength(0);
  });

  it('rejects missing title', async () => {
    const errs = await v({ category: 'paper' });
    expect(errs.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects invalid category', async () => {
    const errs = await v({ title: 'Test', category: 'laser' });
    expect(errs.some((e) => e.property === 'category')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest dto/create-daily-grid-card --no-coverage
```

Expected: FAIL — `CreateDailyGridCardDto` module not found.

- [ ] **Step 3: Create CreateDailyGridCardDto**

```typescript
// server/src/daily-grid/dto/create-daily-grid-card.dto.ts
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';

export class CreateDailyGridCardDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsIn(['paper', '3d'])
  category: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  paperSpecs?: {
    paperSize?: string;
    colorMode?: string;
    mediaType?: string;
    printSides?: string;
    binding?: string;
  };

  @IsOptional()
  @IsObject()
  threeDSpecs?: {
    fileFormat?: string;
    material?: string;
    color?: string;
    infillPercentage?: number;
    layerHeight?: number;
    supports?: boolean;
    notes?: string;
  };
}
```

- [ ] **Step 4: Create UpdateDailyGridCardDto**

```typescript
// server/src/daily-grid/dto/update-daily-grid-card.dto.ts
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsIn,
  ValidateIf,
} from 'class-validator';

export class UpdateDailyGridCardDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(['paper', '3d'])
  category?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.paperSpecs !== null)
  @IsObject()
  paperSpecs?: {
    paperSize?: string;
    colorMode?: string;
    mediaType?: string;
    printSides?: string;
    binding?: string;
  } | null;

  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.threeDSpecs !== null)
  @IsObject()
  threeDSpecs?: {
    fileFormat?: string;
    material?: string;
    color?: string;
    infillPercentage?: number;
    layerHeight?: number;
    supports?: boolean;
    notes?: string;
  } | null;
}
```

- [ ] **Step 5: Update controller with typed DTOs and image upload endpoint**

Replace the full file:

```typescript
// server/src/daily-grid/daily-grid.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DailyGridService } from './daily-grid.service';
import { CreateDailyGridCardDto } from './dto/create-daily-grid-card.dto';
import { UpdateDailyGridCardDto } from './dto/update-daily-grid-card.dto';
import { StorageService } from '../storage/storage.service';

@ApiTags('daily-grid')
@Controller('daily-grid')
export class DailyGridController {
  constructor(
    private readonly service: DailyGridService,
    private readonly storageService: StorageService,
  ) {}

  /** Public — customer home screen carousel. */
  @Get()
  findActive() {
    return this.service.findActive();
  }

  /** Admin — all cards including inactive. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  findAll() {
    return this.service.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin')
  create(@Body() dto: CreateDailyGridCardDto) {
    return this.service.create(dto);
  }

  /** Must be declared before :id to avoid route collision. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/reorder')
  reorder(@Body() body: { ids: number[] }) {
    return this.service.reorder(body.ids);
  }

  /** Must be declared before :id to avoid route collision. */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/upload-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided');
    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const objectKey = `daily-grid/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const url = await this.storageService.upload(
      file.buffer,
      objectKey,
      file.mimetype,
    );
    return { url };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDailyGridCardDto,
  ) {
    return this.service.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
```

- [ ] **Step 6: Run DTO tests to verify they pass**

```bash
cd server && npx jest dto/create-daily-grid-card --no-coverage
```

Expected: 7 tests PASS.

- [ ] **Step 7: Run full server test suite**

```bash
cd server && npx jest --no-coverage
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/daily-grid/dto/ server/src/daily-grid/daily-grid.controller.ts
git commit -m "feat: add typed DTOs and image upload endpoint to DailyGridController"
```

---

## Task 3: Admin UI — spec fields + image file upload in drawer

**Files:**
- Modify: `admin/src/pages/daily-grid/list.tsx`

The existing page has the card list, move controls, and a create/edit drawer. The drawer currently has: title, subtitle, imageUrl (text input), category (select), sortOrder, isActive. This task replaces the image URL text input with a real file upload and adds a conditional spec section.

**REQUIRED SUB-SKILL:** Invoke `frontend-design:frontend-design` for this task. Provide the following instructions:

> Extend the existing Daily Grid admin page at `admin/src/pages/daily-grid/list.tsx` (dark-themed React + Ant Design). The page manages carousel cards. Two changes needed in the Create/Edit Drawer:
>
> **1. Image upload** — Replace the current `imageUrl` text `<Input>` field with a drag-drop upload zone. On file drop/select: POST to `/daily-grid/admin/upload-image` as `multipart/form-data` with field name `file` using `apiClient.post(url, formData)`. On success, store the returned `{ url: string }` as the `imageUrl` form value and show the existing `CardPreview` with the uploaded image. Show an error toast if upload fails. Show a loading spinner during upload.
>
> **2. Spec section** — Below the category `<Select>` (which is already in the form), add a section that conditionally shows:
>
> - When category = `'paper'`: 5 `<Select>` dropdowns, all optional, each with `placeholder="Default"` (meaning "leave unset"):
>   - **Paper Size**: options `a4 / a3 / a5 / a2 / a1 / twentyByThirty / custom` (display: A4 / A3 / A5 / A2 / A1 / 20×30 / Custom)
>   - **Color Mode**: `blackAndWhite / fullColor` (display: B&W / Full Color)
>   - **Media Type**: `glossy / matte` (display: Glossy / Matte)
>   - **Print Sides**: `frontOnly / backToBack` (display: Front Only / Back to Back)
>   - **Binding**: `none / spiral / staple / premium` (display: None / Spiral / Staple / Premium)
>   - Store all 5 as form field `paperSpecs` (object with only the keys that were set by the user)
>
> - When category = `'3d'`: 7 fields, all optional:
>   - **File Format** `<Select>`: `stl / obj / threeMf` (STL / OBJ / 3MF)
>   - **Material** `<Select>`: `pla / abs / petg` (PLA / ABS / PETG)
>   - **Color** `<Input>` text field
>   - **Infill %** `<InputNumber>` 0–100
>   - **Layer Height** `<Select>`: `0.1 / 0.15 / 0.2 / 0.3` (0.10 mm / 0.15 mm / 0.20 mm / 0.30 mm)
>   - **Supports** `<Switch>`
>   - **Notes** `<Input.TextArea>`
>   - Store all as form field `threeDSpecs` (object with only the keys the user set)
>
> Update the `DailyGridCard` interface to include:
> ```typescript
> paperSpecs: Record<string, unknown> | null;
> threeDSpecs: Record<string, unknown> | null;
> ```
>
> In `openEdit`, populate `paperSpecs` and `threeDSpecs` into form values. In `handleSave`, include `paperSpecs: values.paperSpecs ?? null` and `threeDSpecs: values.threeDSpecs ?? null` in the payload. Keep the existing dark `#141414 / #0F0F0F` aesthetic. Use `apiClient` from `@/providers/api-client` for the image upload call.

After the `frontend-design` skill generates the updated component, integrate it into `list.tsx`.

- [ ] **Step 1: Invoke `frontend-design:frontend-design` with the instructions above**

Use: `Skill({ skill: 'frontend-design:frontend-design', args: '<full instructions above>' })`

- [ ] **Step 2: Apply the generated code to `admin/src/pages/daily-grid/list.tsx`**

Ensure these four things are present:
1. `DailyGridCard` interface has `paperSpecs: Record<string, unknown> | null` and `threeDSpecs: Record<string, unknown> | null`
2. `openEdit` sets form values for `paperSpecs` and `threeDSpecs`
3. `handleSave` sends `paperSpecs` and `threeDSpecs` in payload
4. Image upload POSTs to `/daily-grid/admin/upload-image` via `apiClient`

- [ ] **Step 3: Type-check the admin app**

```bash
cd admin && npm run type-check 2>/dev/null || npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Build admin app**

```bash
cd admin && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/daily-grid/list.tsx
git commit -m "feat: add spec fields and image upload to Daily Grid admin drawer"
```

---

## Task 4: Mobile — DailyGridItem model gains spec fields

**Files:**
- Modify: `apps/mobile/lib/shared/models/daily_grid_item.dart`
- Create: `apps/mobile/test/shared/models/daily_grid_item_test.dart`

- [ ] **Step 1: Write failing tests**

```dart
// apps/mobile/test/shared/models/daily_grid_item_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';

void main() {
  group('DailyGridItem.fromJson', () {
    test('parses paperSpecs correctly', () {
      final json = {
        'id': 1,
        'title': 'Bond A4',
        'category': 'paper',
        'sortOrder': 0,
        'paperSpecs': {'paperSize': 'a4', 'colorMode': 'blackAndWhite'},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.paperSpecs, {'paperSize': 'a4', 'colorMode': 'blackAndWhite'});
      expect(item.threeDSpecs, isNull);
    });

    test('parses threeDSpecs correctly', () {
      final json = {
        'id': 2,
        'title': '3D Print',
        'category': '3d',
        'sortOrder': 1,
        'threeDSpecs': {'material': 'pla', 'infillPercentage': 20},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.threeDSpecs, {'material': 'pla', 'infillPercentage': 20});
      expect(item.paperSpecs, isNull);
    });

    test('parses null specs when absent from JSON', () {
      final json = {
        'id': 3,
        'title': 'Card',
        'category': 'paper',
        'sortOrder': 0,
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.paperSpecs, isNull);
      expect(item.threeDSpecs, isNull);
    });
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/shared/models/daily_grid_item_test.dart
```

Expected: FAIL — `DailyGridItem` has no `paperSpecs` field.

- [ ] **Step 3: Update DailyGridItem model**

Replace the full file:

```dart
// apps/mobile/lib/shared/models/daily_grid_item.dart
class DailyGridItem {
  const DailyGridItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    required this.category,
    required this.sortOrder,
    this.paperSpecs,
    this.threeDSpecs,
  });

  final int id;
  final String title;
  final String? subtitle;
  final String? imageUrl;

  /// 'paper' or '3d' — matches OrderFlowState.category
  final String category;
  final int sortOrder;
  final Map<String, dynamic>? paperSpecs;
  final Map<String, dynamic>? threeDSpecs;

  factory DailyGridItem.fromJson(Map<String, dynamic> json) {
    return DailyGridItem(
      id: (json['id'] as num).toInt(),
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      imageUrl: json['imageUrl'] as String?,
      category: json['category'] as String? ?? 'paper',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      paperSpecs: (json['paperSpecs'] as Map?)?.cast<String, dynamic>(),
      threeDSpecs: (json['threeDSpecs'] as Map?)?.cast<String, dynamic>(),
    );
  }
}
```

The `const DailyGridItem(...)` fallback entries in `daily_grid_section.dart` do not pass `paperSpecs`/`threeDSpecs`, which is correct — they default to `null`.

- [ ] **Step 4: Run tests**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/shared/models/daily_grid_item_test.dart
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/shared/models/daily_grid_item.dart apps/mobile/test/shared/models/daily_grid_item_test.dart
git commit -m "feat: add paperSpecs and threeDSpecs fields to DailyGridItem model"
```

---

## Task 5: Mobile — OrderFlowNotifier spec-from-map methods

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/providers/order_provider.dart`
- Create: `apps/mobile/test/features/customer/order/providers/order_provider_specs_test.dart`

- [ ] **Step 1: Write failing tests**

```dart
// apps/mobile/test/features/customer/order/providers/order_provider_specs_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  late ProviderContainer container;
  late OrderFlowNotifier notifier;

  setUp(() {
    container = ProviderContainer();
    notifier = container.read(orderFlowProvider.notifier);
    notifier.reset();
  });

  tearDown(() => container.dispose());

  group('setPaperSpecsFromMap', () {
    test('sets all known paper fields from map', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({
        'paperSize': 'a4',
        'colorMode': 'blackAndWhite',
        'mediaType': 'glossy',
        'printSides': 'frontOnly',
        'binding': 'none',
      });
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a4);
      expect(specs.colorMode, ColorMode.blackAndWhite);
      expect(specs.mediaType, MediaType.glossy);
      expect(specs.printSides, PrintSides.frontOnly);
      expect(specs.binding, Binding.none);
    });

    test('uses defaults for missing fields', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({'paperSize': 'a3'});
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a3);
      expect(specs.colorMode, ColorMode.blackAndWhite);
    });

    test('ignores unknown keys without throwing', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({'paperSize': 'a4', 'unknownKey': 'x'});
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a4);
    });

    test('does not set specs when map is empty', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({});
      expect(container.read(orderFlowProvider).paperSpecs, isNull);
    });
  });

  group('setThreeDSpecsFromMap', () {
    test('sets all known 3D fields from map', () {
      notifier.setCategory('3d');
      notifier.setThreeDSpecsFromMap({
        'fileFormat': 'stl',
        'material': 'pla',
        'color': 'White',
        'infillPercentage': 20,
        'layerHeight': 0.2,
        'supports': true,
        'notes': 'Test notes',
      });
      final specs = container.read(orderFlowProvider).threeDSpecs!;
      expect(specs.fileFormat, FileFormat3D.stl);
      expect(specs.material, Material3D.pla);
      expect(specs.color, 'White');
      expect(specs.infillPercentage, 20);
      expect(specs.layerHeight, 0.2);
      expect(specs.supports, true);
      expect(specs.notes, 'Test notes');
    });

    test('does not set specs when map is empty', () {
      notifier.setCategory('3d');
      notifier.setThreeDSpecsFromMap({});
      expect(container.read(orderFlowProvider).threeDSpecs, isNull);
    });
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/providers/order_provider_specs_test.dart
```

Expected: FAIL — `setPaperSpecsFromMap` not found.

- [ ] **Step 3: Add methods to OrderFlowNotifier**

In `apps/mobile/lib/features/customer/order/providers/order_provider.dart`, add the following after the `setThreeDSpecs` method (around line 268) and before `setFile`:

```dart
  void setPaperSpecsFromMap(Map<String, dynamic> map) {
    if (map.isEmpty) return;
    final specs = PaperSpecs(
      paperSize: _parseEnum(PaperSize.values, map['paperSize'] as String?) ??
          PaperSize.a4,
      colorMode:
          _parseEnum(ColorMode.values, map['colorMode'] as String?) ??
              ColorMode.blackAndWhite,
      mediaType:
          _parseEnum(MediaType.values, map['mediaType'] as String?) ??
              MediaType.glossy,
      printSides:
          _parseEnum(PrintSides.values, map['printSides'] as String?) ??
              PrintSides.frontOnly,
      binding:
          _parseEnum(Binding.values, map['binding'] as String?) ?? Binding.none,
    );
    state = state.copyWith(paperSpecs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  void setThreeDSpecsFromMap(Map<String, dynamic> map) {
    if (map.isEmpty) return;
    final specs = ThreeDSpecs(
      fileFormat:
          _parseEnum(FileFormat3D.values, map['fileFormat'] as String?) ??
              FileFormat3D.stl,
      material:
          _parseEnum(Material3D.values, map['material'] as String?) ??
              Material3D.pla,
      color: map['color'] as String? ?? '',
      infillPercentage: (map['infillPercentage'] as num?)?.toInt() ?? 20,
      layerHeight: (map['layerHeight'] as num?)?.toDouble() ?? 0.20,
      supports: map['supports'] as bool? ?? false,
      notes: map['notes'] as String?,
    );
    state = state.copyWith(threeDSpecs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  static T? _parseEnum<T extends Enum>(List<T> values, String? name) {
    if (name == null) return null;
    try {
      return values.byName(name);
    } catch (_) {
      return null;
    }
  }
```

- [ ] **Step 4: Run tests**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/order/providers/order_provider_specs_test.dart
```

Expected: 6 tests PASS.

- [ ] **Step 5: Run full Flutter test suite**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/order/providers/order_provider.dart apps/mobile/test/features/customer/order/providers/order_provider_specs_test.dart
git commit -m "feat: add setPaperSpecsFromMap and setThreeDSpecsFromMap to OrderFlowNotifier"
```

---

## Task 6: Mobile — Tap handler pre-populates specs

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart`

- [ ] **Step 1: Replace _selectCategory with _onCardTap**

In `_DailyGridSectionState`, replace:

```dart
  void _selectCategory(BuildContext context, String category) {
    ref.read(orderFlowProvider.notifier).setCategory(category);
    ref.read(orderFlowProvider.notifier).goToStep(1);
    context.push(
      category == 'paper'
          ? '/customer/order/paper-specs'
          : '/customer/order/3d-specs',
    );
  }
```

With:

```dart
  void _onCardTap(BuildContext context, DailyGridItem card) {
    final notifier = ref.read(orderFlowProvider.notifier);
    notifier.reset();
    notifier.setCategory(card.category);
    if (card.category == 'paper' && card.paperSpecs != null) {
      notifier.setPaperSpecsFromMap(card.paperSpecs!);
    } else if (card.category == '3d' && card.threeDSpecs != null) {
      notifier.setThreeDSpecsFromMap(card.threeDSpecs!);
    }
    notifier.goToStep(1);
    context.push(
      card.category == 'paper'
          ? '/customer/order/paper-specs'
          : '/customer/order/3d-specs',
    );
  }
```

- [ ] **Step 2: Update the onTap call in _buildCarousel**

In `_buildCarousel`, replace:

```dart
                  onTap: () => _selectCategory(context, item.category),
```

With:

```dart
                  onTap: () => _onCardTap(context, item),
```

- [ ] **Step 3: Verify analyze**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze
```

Expected: no issues.

- [ ] **Step 4: Run full test suite**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: all pass.

- [ ] **Step 5: Rebuild mobile**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart
git commit -m "feat: pre-populate order specs when customer taps a Daily Grid card"
```

---

## Self-Review

**Spec coverage:**
- Entity JSONB columns: ✅ Task 1
- Migration: ✅ Handled by TypeORM `synchronize: true` in dev (no manual file needed)
- DTO changes (paperSpecs + threeDSpecs, IsObject validation): ✅ Task 2
- Image upload endpoint (`POST /daily-grid/admin/upload-image`): ✅ Task 2
- Public GET response (auto — entity columns): ✅ No controller change needed
- Admin route `/daily-grid`: ✅ Already in `App.tsx`
- Admin drawer spec fields (conditional paper/3D): ✅ Task 3 (via frontend-design)
- Admin image upload zone: ✅ Task 3 (via frontend-design)
- `DailyGridItem` model spec fields: ✅ Task 4
- `setPaperSpecsFromMap` / `setThreeDSpecsFromMap`: ✅ Task 5
- Tap handler pre-population: ✅ Task 6
- Error handling (null specs = navigate as today): ✅ `_onCardTap` only calls map methods when non-null

**Type consistency:**
- `setPaperSpecsFromMap` defined in Task 5, called in Task 6 ✅
- `setThreeDSpecsFromMap` defined in Task 5, called in Task 6 ✅
- `paperSpecs: Map<String, dynamic>?` in DailyGridItem (Task 4) matches usage in tap handler (Task 6) ✅
- `_parseEnum` helper defined once in Task 5, used only in Task 5 ✅
