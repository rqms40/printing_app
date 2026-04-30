# Admin Manual Status + 3D Printer Limitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-attached free-text print status (with optional countdown) on orders, plus a single admin-configurable printer profile that drives server-side 3D bounds validation, mobile inline 3D preview, and a hard-block + chat-CTA flow when an upload exceeds the printer's build volume.

**Architecture:** New `PrinterProfile` singleton entity + `Model3dAnalysisService` (STL/OBJ/3MF parser) on the backend. `Order` and `FileMetadata` extended with new columns. `/files/:id/inspect` extended with `modelBounds` + `printerLimits`. Mobile gains a `Model3dPreview` widget (`flutter_3d_controller`), a printer-limits warning card on the upload screen, and an `AdminStatusBanner` on the order detail screen. Admin gains a Manual Print Status card on the order show page and a `/settings/printer` configuration page.

**Tech Stack:** NestJS + TypeORM (Postgres) backend, Flutter + Riverpod mobile, React + Refine + Ant Design admin, `flutter_3d_controller` for 3D rendering, `jszip` for 3MF parsing.

**Spec:** `docs/superpowers/specs/2026-04-30-admin-status-3d-limits-design.md`

**Commit policy:** Each task ends with a commit. Implementer subagents commit per task — pre-approved by the user as part of plan execution.

---

## File Structure

### Backend — new files

| Path | Purpose |
|---|---|
| `server/src/printer-profile/printer-profile.module.ts` | Module |
| `server/src/printer-profile/entities/printer-profile.entity.ts` | Singleton entity |
| `server/src/printer-profile/dto/update-printer-profile.dto.ts` | PATCH payload |
| `server/src/printer-profile/printer-profile.service.ts` | `getProfile()`, `updateProfile()` |
| `server/src/printer-profile/printer-profile.controller.ts` | `GET /printer-profile`, `GET/PATCH /admin/printer-profile` |
| `server/src/files/model-3d-analysis.service.ts` | STL/OBJ/3MF parsers |
| `server/src/orders/dto/update-manual-status.dto.ts` | `PATCH /admin/orders/:id/manual-status` payload |

### Backend — modified files

| Path | Change |
|---|---|
| `server/src/orders/entities/order.entity.ts` | Add `adminStatusNote`, `estimatedCompletionAt`, `adminStatusSetAt` |
| `server/src/files/entities/file-metadata.entity.ts` | Add `model3dWidthMm`, `model3dDepthMm`, `model3dHeightMm`, `model3dTriangleCount` |
| `server/src/files/file-analysis.service.ts` | Branch to `Model3dAnalysisService` for `.stl`/`.obj`/`.3mf` |
| `server/src/files/files.service.ts` | Persist 3D-bounds columns when analysis returns them |
| `server/src/files/files.controller.ts` | Extend `/inspect` with `modelBounds` + `printerLimits` |
| `server/src/files/files.module.ts` | Register `Model3dAnalysisService`; import `PrinterProfileModule` |
| `server/src/orders/orders.service.ts` | Add `updateManualStatus()`; reject oversize 3D items in `createBatch` / `create` |
| `server/src/orders/orders.controller.ts` | Add `PATCH /admin/orders/:id/manual-status` |
| `server/src/orders/orders.module.ts` | Import `PrinterProfileModule` |
| `server/src/app.module.ts` | Import `PrinterProfileModule` |
| `server/src/seed.ts` | Seed default `PrinterProfile` row |

### Mobile — new files

| Path | Purpose |
|---|---|
| `apps/mobile/lib/features/customer/order/models/printer_profile.dart` | DTO |
| `apps/mobile/lib/features/customer/order/providers/printer_profile_provider.dart` | FutureProvider |
| `apps/mobile/lib/features/customer/order/widgets/model_3d_preview.dart` | 3D preview widget |
| `apps/mobile/lib/features/customer/order/widgets/printer_limits_card.dart` | Yellow warning card |
| `apps/mobile/lib/features/customer/orders/widgets/admin_status_banner.dart` | Live-countdown banner |

### Mobile — modified files

| Path | Change |
|---|---|
| `apps/mobile/pubspec.yaml` | Add `flutter_3d_controller` |
| `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` | Embed preview + limits card + chat CTA |
| `apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart` | Render `AdminStatusBanner` when note set |
| `apps/mobile/lib/shared/models/order.dart` | Add `adminStatusNote`, `estimatedCompletionAt`, `adminStatusSetAt` |

### Admin — new files

| Path | Purpose |
|---|---|
| `admin/src/types/printer-profile.ts` | TS types |
| `admin/src/pages/admin-settings/printer.tsx` | Settings page with CSS-cube preview |
| `admin/src/pages/orders/components/manual-status-card.tsx` | Card rendered inside order show |

### Admin — modified files

| Path | Change |
|---|---|
| `admin/src/pages/orders/show.tsx` | Mount `<ManualStatusCard />` |
| `admin/src/App.tsx` | Register `/settings/printer` resource + route |

---

## Phase A — Backend (Tasks 1–14)

### Task 1: PrinterProfile entity

**Files:**
- Create: `server/src/printer-profile/entities/printer-profile.entity.ts`
- Test: `server/src/printer-profile/entities/printer-profile.entity.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/printer-profile/entities/printer-profile.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { PrinterProfile } from './printer-profile.entity';

describe('PrinterProfile entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(PrinterProfile)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'name',
      'buildVolumeWidthMm',
      'buildVolumeDepthMm',
      'buildVolumeHeightMm',
      'maxFileSizeMb',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest printer-profile.entity.spec --no-coverage`

- [ ] **Step 3: Implement entity**

```typescript
// server/src/printer-profile/entities/printer-profile.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('printer_profiles')
export class PrinterProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'build_volume_width_mm', type: 'int', default: 180 })
  buildVolumeWidthMm: number;

  @Column({ name: 'build_volume_depth_mm', type: 'int', default: 180 })
  buildVolumeDepthMm: number;

  @Column({ name: 'build_volume_height_mm', type: 'int', default: 180 })
  buildVolumeHeightMm: number;

  @Column({ name: 'max_file_size_mb', type: 'int', default: 200 })
  maxFileSizeMb: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest printer-profile.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/printer-profile/entities/printer-profile.entity.ts server/src/printer-profile/entities/printer-profile.entity.spec.ts && git commit -m "feat(printer-profile): add PrinterProfile singleton entity"
```

---

### Task 2: PrinterProfile DTO

**Files:**
- Create: `server/src/printer-profile/dto/update-printer-profile.dto.ts`

- [ ] **Step 1: Implement DTO**

```typescript
// server/src/printer-profile/dto/update-printer-profile.dto.ts
import { IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class UpdatePrinterProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  buildVolumeWidthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  buildVolumeDepthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  buildVolumeHeightMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxFileSizeMb?: number;
}
```

- [ ] **Step 2: Verify compile**

Run: `cd server && npx tsc --noEmit 2>&1 | grep printer-profile || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/printer-profile/dto/update-printer-profile.dto.ts && git commit -m "feat(printer-profile): add UpdatePrinterProfileDto"
```

---

### Task 3: PrinterProfileService

**Files:**
- Create: `server/src/printer-profile/printer-profile.service.ts`
- Test: `server/src/printer-profile/printer-profile.service.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/printer-profile/printer-profile.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PrinterProfile } from './entities/printer-profile.entity';
import { PrinterProfileService } from './printer-profile.service';

describe('PrinterProfileService', () => {
  let svc: PrinterProfileService;
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        PrinterProfileService,
        { provide: getRepositoryToken(PrinterProfile), useValue: repo },
      ],
    }).compile();
    svc = mod.get(PrinterProfileService);
  });

  it('returns existing profile when present', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      name: 'Bambu A1 Mini',
      buildVolumeWidthMm: 180,
      buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180,
      maxFileSizeMb: 200,
    });
    const out = await svc.getProfile();
    expect(out.name).toBe('Bambu A1 Mini');
  });

  it('seeds default profile when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockImplementation(async (p) => p);
    const out = await svc.getProfile();
    expect(out.name).toBe('Bambu A1 Mini');
    expect(out.buildVolumeWidthMm).toBe(180);
  });

  it('updateProfile patches and saves', async () => {
    repo.findOne.mockResolvedValue({
      id: 1, name: 'Old', buildVolumeWidthMm: 100,
      buildVolumeDepthMm: 100, buildVolumeHeightMm: 100, maxFileSizeMb: 50,
    });
    repo.save.mockImplementation(async (p) => p);
    const out = await svc.updateProfile({ name: 'New', buildVolumeWidthMm: 256 });
    expect(out.name).toBe('New');
    expect(out.buildVolumeWidthMm).toBe(256);
    expect(out.buildVolumeDepthMm).toBe(100);
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest printer-profile.service.spec --no-coverage`

- [ ] **Step 3: Implement service**

```typescript
// server/src/printer-profile/printer-profile.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrinterProfile } from './entities/printer-profile.entity';
import { UpdatePrinterProfileDto } from './dto/update-printer-profile.dto';

@Injectable()
export class PrinterProfileService {
  constructor(
    @InjectRepository(PrinterProfile)
    private readonly repo: Repository<PrinterProfile>,
  ) {}

  async getProfile(): Promise<PrinterProfile> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.repo.save(
      this.repo.create({
        id: 1,
        name: 'Bambu A1 Mini',
        buildVolumeWidthMm: 180,
        buildVolumeDepthMm: 180,
        buildVolumeHeightMm: 180,
        maxFileSizeMb: 200,
      }),
    );
  }

  async updateProfile(
    patch: UpdatePrinterProfileDto,
  ): Promise<PrinterProfile> {
    const current = await this.getProfile();
    Object.assign(current, patch);
    return this.repo.save(current);
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest printer-profile.service.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/printer-profile/printer-profile.service.ts server/src/printer-profile/printer-profile.service.spec.ts && git commit -m "feat(printer-profile): add PrinterProfileService with default seed"
```

---

### Task 4: PrinterProfileController

**Files:**
- Create: `server/src/printer-profile/printer-profile.controller.ts`
- Test: `server/src/printer-profile/printer-profile.controller.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/printer-profile/printer-profile.controller.spec.ts
import { Test } from '@nestjs/testing';
import { PrinterProfileController } from './printer-profile.controller';
import { PrinterProfileService } from './printer-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('PrinterProfileController', () => {
  let ctrl: PrinterProfileController;
  const service = { getProfile: jest.fn(), updateProfile: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [PrinterProfileController],
      providers: [{ provide: PrinterProfileService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = mod.get(PrinterProfileController);
  });

  it('GET /printer-profile returns the profile', async () => {
    service.getProfile.mockResolvedValue({ id: 1, name: 'Bambu A1 Mini' });
    expect(await ctrl.getCustomer()).toEqual({ id: 1, name: 'Bambu A1 Mini' });
  });

  it('PATCH /admin/printer-profile updates', async () => {
    service.updateProfile.mockResolvedValue({ id: 1, name: 'New' });
    expect(await ctrl.adminUpdate({ name: 'New' })).toEqual({ id: 1, name: 'New' });
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest printer-profile.controller.spec --no-coverage`

- [ ] **Step 3: Implement controller**

```typescript
// server/src/printer-profile/printer-profile.controller.ts
import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { PrinterProfileService } from './printer-profile.service';
import { UpdatePrinterProfileDto } from './dto/update-printer-profile.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PrinterProfileController {
  constructor(private readonly service: PrinterProfileService) {}

  @Get('printer-profile')
  getCustomer() {
    return this.service.getProfile();
  }

  @Get('admin/printer-profile')
  @UseGuards(RolesGuard)
  @Roles('admin')
  adminGet() {
    return this.service.getProfile();
  }

  @Patch('admin/printer-profile')
  @UseGuards(RolesGuard)
  @Roles('admin')
  adminUpdate(@Body() dto: UpdatePrinterProfileDto) {
    return this.service.updateProfile(dto);
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest printer-profile.controller.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/printer-profile/printer-profile.controller.ts server/src/printer-profile/printer-profile.controller.spec.ts && git commit -m "feat(printer-profile): add controller with customer + admin routes"
```

---

### Task 5: PrinterProfileModule + AppModule wiring

**Files:**
- Create: `server/src/printer-profile/printer-profile.module.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: Create module**

```typescript
// server/src/printer-profile/printer-profile.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterProfile } from './entities/printer-profile.entity';
import { PrinterProfileService } from './printer-profile.service';
import { PrinterProfileController } from './printer-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterProfile])],
  providers: [PrinterProfileService],
  controllers: [PrinterProfileController],
  exports: [PrinterProfileService, TypeOrmModule],
})
export class PrinterProfileModule {}
```

- [ ] **Step 2: Register in AppModule**

In `server/src/app.module.ts`, add at the top with other module imports:

```typescript
import { PrinterProfileModule } from './printer-profile/printer-profile.module';
```

And add `PrinterProfileModule` to the `imports` array (alongside the existing modules).

- [ ] **Step 3: Verify type-check**

Run: `cd server && npx tsc --noEmit 2>&1 | grep printer-profile || echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/printer-profile/printer-profile.module.ts server/src/app.module.ts && git commit -m "feat(printer-profile): wire module into AppModule"
```

---

### Task 6: Extend FileMetadata with 3D-bounds columns

**Files:**
- Modify: `server/src/files/entities/file-metadata.entity.ts`
- Test: `server/src/files/entities/file-metadata.entity.spec.ts` (new)

- [ ] **Step 1: Write failing test**

```typescript
// server/src/files/entities/file-metadata.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { FileMetadata } from './file-metadata.entity';

describe('FileMetadata 3D columns', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(FileMetadata)
    .map((c) => c.propertyName);

  it('has 3D-bounds columns', () => {
    for (const name of [
      'model3dWidthMm',
      'model3dDepthMm',
      'model3dHeightMm',
      'model3dTriangleCount',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest file-metadata.entity.spec --no-coverage`

- [ ] **Step 3: Add columns to entity**

In `server/src/files/entities/file-metadata.entity.ts`, append before the final closing brace:

```typescript
  @Column({
    name: 'model_3d_width_mm',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  model3dWidthMm: number | null;

  @Column({
    name: 'model_3d_depth_mm',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  model3dDepthMm: number | null;

  @Column({
    name: 'model_3d_height_mm',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  model3dHeightMm: number | null;

  @Column({
    name: 'model_3d_triangle_count',
    type: 'int',
    nullable: true,
  })
  model3dTriangleCount: number | null;
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest file-metadata.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/files/entities/file-metadata.entity.ts server/src/files/entities/file-metadata.entity.spec.ts && git commit -m "feat(files): add 3D-bounds columns to FileMetadata"
```

---

### Task 7: Model3dAnalysisService — STL parser

**Files:**
- Create: `server/src/files/model-3d-analysis.service.ts`
- Test: `server/src/files/model-3d-analysis.service.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/files/model-3d-analysis.service.spec.ts
import { Model3dAnalysisService } from './model-3d-analysis.service';

function buildBinaryStl(triangles: number[][][]): Buffer {
  const header = Buffer.alloc(80);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(triangles.length, 0);
  const body = Buffer.concat(
    triangles.map((tri) => {
      const buf = Buffer.alloc(50);
      buf.writeFloatLE(0, 0); buf.writeFloatLE(0, 4); buf.writeFloatLE(1, 8); // normal
      let off = 12;
      for (const v of tri) {
        buf.writeFloatLE(v[0], off); off += 4;
        buf.writeFloatLE(v[1], off); off += 4;
        buf.writeFloatLE(v[2], off); off += 4;
      }
      return buf;
    }),
  );
  return Buffer.concat([header, count, body]);
}

describe('Model3dAnalysisService — STL', () => {
  const svc = new Model3dAnalysisService();

  it('parses binary STL bounds', async () => {
    const buf = buildBinaryStl([
      [[0, 0, 0], [10, 0, 0], [0, 5, 2]],
      [[10, 0, 0], [10, 5, 0], [0, 5, 2]],
    ]);
    const out = await svc.analyze(buf, 'model.stl');
    expect(out!.widthMm).toBe(10);
    expect(out!.depthMm).toBe(5);
    expect(out!.heightMm).toBe(2);
    expect(out!.triangleCount).toBe(2);
    expect(out!.unit).toBe('mm');
  });

  it('returns null on truncated STL', async () => {
    const buf = Buffer.alloc(50); // too small
    expect(await svc.analyze(buf, 'broken.stl')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest model-3d-analysis.service.spec --no-coverage`

- [ ] **Step 3: Implement STL parser**

```typescript
// server/src/files/model-3d-analysis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';

export interface Model3dBounds {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangleCount: number | null;
  unit: 'mm' | 'inch' | 'unknown';
}

const UNIT_TO_MM: Record<string, number> = {
  millimeter: 1,
  micrometer: 0.001,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

@Injectable()
export class Model3dAnalysisService {
  private readonly logger = new Logger(Model3dAnalysisService.name);

  async analyze(
    buffer: Buffer,
    filename: string,
  ): Promise<Model3dBounds | null> {
    const ext = extname(filename).toLowerCase();
    try {
      if (ext === '.stl') return this.analyzeStl(buffer);
      if (ext === '.obj') return this.analyzeObj(buffer);
      if (ext === '.3mf') return await this.analyze3mf(buffer);
      return null;
    } catch (err) {
      this.logger.warn(`3D parse failed for ${filename}: ${err}`);
      return null;
    }
  }

  private analyzeStl(buffer: Buffer): Model3dBounds | null {
    if (buffer.length < 84) return null;
    const triangleCount = buffer.readUInt32LE(80);
    const expectedSize = 84 + triangleCount * 50;
    if (buffer.length < expectedSize) {
      // Maybe ASCII?
      return this.analyzeStlAscii(buffer);
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < triangleCount; i++) {
      const base = 84 + i * 50 + 12;
      for (let v = 0; v < 3; v++) {
        const x = buffer.readFloatLE(base + v * 12);
        const y = buffer.readFloatLE(base + v * 12 + 4);
        const z = buffer.readFloatLE(base + v * 12 + 8);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
    if (!isFinite(minX)) return null;
    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount,
      unit: 'mm',
    };
  }

  private analyzeStlAscii(buffer: Buffer): Model3dBounds | null {
    const text = buffer.toString('utf8');
    const re = /vertex\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      const z = parseFloat(m[3]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
      count++;
    }
    if (!isFinite(minX)) return null;
    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount: Math.floor(count / 3),
      unit: 'mm',
    };
  }

  private analyzeObj(buffer: Buffer): Model3dBounds | null {
    const text = buffer.toString('utf8');
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const line of text.split('\n')) {
      if (!line.startsWith('v ')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX)) return null;
    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount: null,
      unit: 'mm',
    };
  }

  private async analyze3mf(buffer: Buffer): Promise<Model3dBounds | null> {
    // Lazy require — keeps cold-start cheap and avoids hard dep at module load.
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file(/3D\/3dmodel\.model$/i)[0];
    if (!entry) return null;
    const xml = await entry.async('string');
    const unitMatch = xml.match(/<model[^>]*\sunit="([^"]+)"/i);
    const unitName = (unitMatch?.[1] ?? 'millimeter').toLowerCase();
    const scale = UNIT_TO_MM[unitName] ?? 1;
    const re = /<vertex\s+x="(-?\d+(?:\.\d+)?)"\s+y="(-?\d+(?:\.\d+)?)"\s+z="(-?\d+(?:\.\d+)?)"/g;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      const z = parseFloat(m[3]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX)) return null;
    const inferredUnit: Model3dBounds['unit'] =
      unitName === 'inch' ? 'inch' : unitName === 'millimeter' ? 'mm' : 'unknown';
    return {
      widthMm: (maxX - minX) * scale,
      depthMm: (maxY - minY) * scale,
      heightMm: (maxZ - minZ) * scale,
      triangleCount: null,
      unit: inferredUnit,
    };
  }
}
```

- [ ] **Step 4: Install jszip**

```bash
cd /home/jd/projects/printing_app/server && npm install jszip
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd server && npx jest model-3d-analysis.service.spec --no-coverage`

- [ ] **Step 6: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/files/model-3d-analysis.service.ts server/src/files/model-3d-analysis.service.spec.ts server/package.json server/package-lock.json && git commit -m "feat(files): add Model3dAnalysisService with STL/OBJ/3MF parsers"
```

---

### Task 8: Model3dAnalysisService — OBJ + 3MF tests

**Files:**
- Modify: `server/src/files/model-3d-analysis.service.spec.ts`

- [ ] **Step 1: Append OBJ + 3MF tests**

Append to the existing spec file, inside the `describe('Model3dAnalysisService — STL', ...)` block (rename the describe to drop "— STL"):

```typescript
  it('parses OBJ vertices', async () => {
    const obj = `
v 0 0 0
v 10 0 0
v 0 5 2
v 10 5 2
f 1 2 3
`;
    const out = await svc.analyze(Buffer.from(obj), 'box.obj');
    expect(out!.widthMm).toBe(10);
    expect(out!.depthMm).toBe(5);
    expect(out!.heightMm).toBe(2);
  });

  it('parses 3MF and converts inch to mm', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(
      '3D/3dmodel.model',
      `<?xml version="1.0"?>
<model unit="inch" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="0" y="1" z="0"/>
          <vertex x="0" y="0" z="1"/>
        </vertices>
      </mesh>
    </object>
  </resources>
</model>`,
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const out = await svc.analyze(buffer, 'cube.3mf');
    expect(out!.unit).toBe('inch');
    // 1 inch = 25.4 mm
    expect(out!.widthMm).toBeCloseTo(25.4, 2);
    expect(out!.depthMm).toBeCloseTo(25.4, 2);
    expect(out!.heightMm).toBeCloseTo(25.4, 2);
  });
```

- [ ] **Step 2: Run tests, confirm pass**

Run: `cd server && npx jest model-3d-analysis.service.spec --no-coverage`

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/files/model-3d-analysis.service.spec.ts && git commit -m "test(files): cover OBJ + 3MF parsers"
```

---

### Task 9: Wire Model3dAnalysisService into FileAnalysisService

**Files:**
- Modify: `server/src/files/file-analysis.service.ts`
- Modify: `server/src/files/files.module.ts`
- Modify: `server/src/files/files.service.ts`
- Modify: `server/src/files/files.service.spec.ts`

- [ ] **Step 1: Failing test for files.service persisting 3D bounds**

Append to `server/src/files/files.service.spec.ts`:

```typescript
  it('persists 3D bounds when analyzer returns model3d result', async () => {
    const file = makeFile({
      mimetype: 'application/octet-stream',
      originalname: 'thing.stl',
    });
    mockStorageService.upload.mockResolvedValue('http://x/y');
    mockAnalysisService.analyze.mockResolvedValue({
      widthPt: null, heightPt: null, widthPx: null, heightPx: null,
      colorSpace: null, pageCount: null, dpi: null,
      model3dWidthMm: 50, model3dDepthMm: 60, model3dHeightMm: 70,
      model3dTriangleCount: 12,
    });
    mockFileRepo.create.mockReturnValue({ id: 1 });
    mockFileRepo.save.mockResolvedValue({ id: 1 });

    await service.storeMetadata(file, 1);

    expect(mockFileRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model3dWidthMm: 50,
        model3dDepthMm: 60,
        model3dHeightMm: 70,
        model3dTriangleCount: 12,
      }),
    );
  });
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd server && npx jest files.service.spec --no-coverage`

- [ ] **Step 3: Update file-analysis.service.ts**

Replace the existing `analyze()` method body so it dispatches to model-3d analysis when the filename has a 3D extension. The result type widens to include 3D fields. Replace `server/src/files/file-analysis.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { Model3dAnalysisService } from './model-3d-analysis.service';

export interface FileAnalysisResult {
  widthPt: number | null;
  heightPt: number | null;
  widthPx: number | null;
  heightPx: number | null;
  colorSpace: string | null;
  pageCount: number | null;
  dpi: number | null;
  model3dWidthMm: number | null;
  model3dDepthMm: number | null;
  model3dHeightMm: number | null;
  model3dTriangleCount: number | null;
}

const EMPTY: FileAnalysisResult = {
  widthPt: null, heightPt: null,
  widthPx: null, heightPx: null,
  colorSpace: null, pageCount: null, dpi: null,
  model3dWidthMm: null, model3dDepthMm: null, model3dHeightMm: null,
  model3dTriangleCount: null,
};

@Injectable()
export class FileAnalysisService {
  constructor(private readonly model3d: Model3dAnalysisService) {}

  async analyze(
    buffer: Buffer,
    mimeType: string,
    filename = '',
  ): Promise<FileAnalysisResult | null> {
    try {
      const ext = extname(filename).toLowerCase();
      if (['.stl', '.obj', '.3mf'].includes(ext)) {
        const bounds = await this.model3d.analyze(buffer, filename);
        if (!bounds) return EMPTY;
        return {
          ...EMPTY,
          model3dWidthMm: bounds.widthMm,
          model3dDepthMm: bounds.depthMm,
          model3dHeightMm: bounds.heightMm,
          model3dTriangleCount: bounds.triangleCount,
        };
      }
      if (mimeType === 'application/pdf') return this.analyzePdf(buffer);
      if (mimeType.startsWith('image/')) return this.analyzeImage(buffer);
      return null;
    } catch {
      return null;
    }
  }

  private async analyzePdf(buffer: Buffer): Promise<FileAnalysisResult | null> {
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pageCount = pdf.getPageCount();
      if (pageCount === 0) return null;
      const page = pdf.getPage(0);
      const { width, height } = page.getSize();
      // Heuristic CMYK detection: scan raw buffer for /DeviceCMYK
      const colorSpace = buffer.includes(Buffer.from('/DeviceCMYK')) ? 'cmyk' : 'rgb';
      return {
        ...EMPTY,
        widthPt: width,
        heightPt: height,
        pageCount,
        colorSpace,
      };
    } catch {
      return null;
    }
  }

  private async analyzeImage(buffer: Buffer): Promise<FileAnalysisResult | null> {
    try {
      const meta = await sharp(buffer).metadata();
      return {
        ...EMPTY,
        widthPx: meta.width ?? null,
        heightPx: meta.height ?? null,
        colorSpace: meta.space ?? null,
        dpi: meta.density ?? null,
      };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Update files.module.ts to provide Model3dAnalysisService**

In `server/src/files/files.module.ts`, add to the `providers` array:

```typescript
import { Model3dAnalysisService } from './model-3d-analysis.service';
// ...
providers: [
  // ... existing ...
  Model3dAnalysisService,
],
```

- [ ] **Step 5: Update files.service.ts to persist 3D fields**

In `server/src/files/files.service.ts`, modify the `storeMetadata` call to `analysisService.analyze`:

```typescript
const analysis = await this.analysisService.analyze(
  file.buffer,
  file.mimetype,
  file.originalname,
);
```

And extend the `meta = this.fileRepo.create({...})` block to include:

```typescript
  model3dWidthMm: analysis?.model3dWidthMm ?? null,
  model3dDepthMm: analysis?.model3dDepthMm ?? null,
  model3dHeightMm: analysis?.model3dHeightMm ?? null,
  model3dTriangleCount: analysis?.model3dTriangleCount ?? null,
```

- [ ] **Step 6: Run tests, confirm all pass**

Run: `cd server && npx jest files --no-coverage`

- [ ] **Step 7: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/files/file-analysis.service.ts server/src/files/files.module.ts server/src/files/files.service.ts server/src/files/files.service.spec.ts && git commit -m "feat(files): wire Model3dAnalysisService into upload flow"
```

---

### Task 10: Extend `/files/:id/inspect` with modelBounds + printerLimits

**Files:**
- Modify: `server/src/files/files.controller.ts`
- Modify: `server/src/files/dto/file-inspection.dto.ts`
- Modify: `server/src/files/files.module.ts`
- Test: `server/src/files/files.controller.spec.ts`

- [ ] **Step 1: Failing test**

Append to `server/src/files/files.controller.spec.ts`:

```typescript
  it('inspect returns modelBounds + printerLimits for a 3D file', async () => {
    mockFilesService.findById.mockResolvedValue({
      id: 9,
      uploadedBy: 1,
      mimeType: 'application/octet-stream',
      originalName: 'm.stl',
      model3dWidthMm: '50.00',
      model3dDepthMm: '60.00',
      model3dHeightMm: '70.00',
      model3dTriangleCount: 12,
      widthPt: null, heightPt: null,
      widthPx: null, heightPx: null,
      colorSpace: null, pageCount: null, dpi: null,
    });
    mockPrinterProfileService.getProfile.mockResolvedValue({
      name: 'Bambu A1 Mini',
      buildVolumeWidthMm: 180, buildVolumeDepthMm: 180, buildVolumeHeightMm: 180,
      maxFileSizeMb: 200,
    });
    const out = await controller.inspect(9, { user: { sub: 1, role: 'customer' } } as any);
    expect(out.modelBounds).toEqual(expect.objectContaining({
      widthMm: 50, depthMm: 60, heightMm: 70, triangleCount: 12, unit: 'mm',
    }));
    expect(out.printerLimits).toEqual(expect.objectContaining({
      profileName: 'Bambu A1 Mini', fits: true, overflowAxes: [],
    }));
  });

  it('inspect flags overflow axes when bounds exceed', async () => {
    mockFilesService.findById.mockResolvedValue({
      id: 10, uploadedBy: 1, mimeType: 'application/octet-stream', originalName: 'b.stl',
      model3dWidthMm: '200.00', model3dDepthMm: '60.00', model3dHeightMm: '210.00',
      model3dTriangleCount: 1,
      widthPt: null, heightPt: null, widthPx: null, heightPx: null,
      colorSpace: null, pageCount: null, dpi: null,
    });
    mockPrinterProfileService.getProfile.mockResolvedValue({
      name: 'X', buildVolumeWidthMm: 180, buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180, maxFileSizeMb: 200,
    });
    const out = await controller.inspect(10, { user: { sub: 1, role: 'customer' } } as any);
    expect(out.printerLimits!.fits).toBe(false);
    expect(out.printerLimits!.overflowAxes.sort()).toEqual(['height', 'width']);
  });
```

In the existing `beforeEach`, add a mock for `PrinterProfileService` and inject it.

- [ ] **Step 2: Update files.controller.ts**

Inside the existing inspect handler, after retrieving the file, add:

```typescript
const printerProfile = await this.printerProfileService.getProfile();

const has3d =
  file.model3dWidthMm != null &&
  file.model3dDepthMm != null &&
  file.model3dHeightMm != null;

const modelBounds = has3d
  ? {
      widthMm: Number(file.model3dWidthMm),
      depthMm: Number(file.model3dDepthMm),
      heightMm: Number(file.model3dHeightMm),
      triangleCount: file.model3dTriangleCount ?? null,
      unit: 'mm' as const,
    }
  : null;

const printerLimits = modelBounds
  ? {
      profileName: printerProfile.name,
      widthMm: printerProfile.buildVolumeWidthMm,
      depthMm: printerProfile.buildVolumeDepthMm,
      heightMm: printerProfile.buildVolumeHeightMm,
      maxFileSizeMb: printerProfile.maxFileSizeMb,
      fits:
        modelBounds.widthMm <= printerProfile.buildVolumeWidthMm &&
        modelBounds.depthMm <= printerProfile.buildVolumeDepthMm &&
        modelBounds.heightMm <= printerProfile.buildVolumeHeightMm,
      overflowAxes: ([
        modelBounds.widthMm > printerProfile.buildVolumeWidthMm ? 'width' : null,
        modelBounds.depthMm > printerProfile.buildVolumeDepthMm ? 'depth' : null,
        modelBounds.heightMm > printerProfile.buildVolumeHeightMm ? 'height' : null,
      ].filter(Boolean) as ('width' | 'depth' | 'height')[]),
    }
  : null;
```

Inject `PrinterProfileService` in the constructor; merge `modelBounds` and `printerLimits` into the response object.

- [ ] **Step 3: Update files.module.ts to import PrinterProfileModule**

```typescript
import { PrinterProfileModule } from '../printer-profile/printer-profile.module';
// ...
imports: [
  // ... existing ...
  PrinterProfileModule,
],
```

- [ ] **Step 4: Update file-inspection.dto.ts**

Append:

```typescript
export interface ModelBoundsDto {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangleCount: number | null;
  unit: 'mm' | 'inch' | 'unknown';
}

export interface PrinterLimitsDto {
  profileName: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  maxFileSizeMb: number;
  fits: boolean;
  overflowAxes: ('width' | 'depth' | 'height')[];
}
```

And extend `FileInspectionDto` to include:

```typescript
  modelBounds: ModelBoundsDto | null;
  printerLimits: PrinterLimitsDto | null;
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd server && npx jest files.controller.spec --no-coverage`

- [ ] **Step 6: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/files/ server/src/files/dto/ && git commit -m "feat(files): include modelBounds + printerLimits in /inspect response"
```

---

### Task 11: Extend Order entity with manual-status columns

**Files:**
- Modify: `server/src/orders/entities/order.entity.ts`
- Test: append to existing `server/src/orders/entities/batch-order.entity.spec.ts`

- [ ] **Step 1: Failing test**

Append to `server/src/orders/entities/batch-order.entity.spec.ts`:

```typescript
describe('Order manual-status columns', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(Order)
    .map((c) => c.propertyName);

  it('has admin-status columns', () => {
    for (const name of ['adminStatusNote', 'estimatedCompletionAt', 'adminStatusSetAt']) {
      expect(cols).toContain(name);
    }
  });
});
```

(The file already imports `Order`.)

- [ ] **Step 2: Run test, confirm fail**

Run: `cd server && npx jest batch-order.entity.spec --no-coverage`

- [ ] **Step 3: Add columns to order.entity.ts**

Insert next to the existing nullable-string columns:

```typescript
  @Column({ name: 'admin_status_note', type: 'varchar', length: 255, nullable: true })
  adminStatusNote: string | null;

  @Column({ name: 'estimated_completion_at', type: 'timestamp', nullable: true })
  estimatedCompletionAt: Date | null;

  @Column({ name: 'admin_status_set_at', type: 'timestamp', nullable: true })
  adminStatusSetAt: Date | null;
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx jest batch-order.entity.spec --no-coverage`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/orders/entities/order.entity.ts server/src/orders/entities/batch-order.entity.spec.ts && git commit -m "feat(orders): extend Order with admin manual-status columns"
```

---

### Task 12: Manual-status DTO + service method

**Files:**
- Create: `server/src/orders/dto/update-manual-status.dto.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Create DTO**

```typescript
// server/src/orders/dto/update-manual-status.dto.ts
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateManualStatusDto {
  @ValidateIf((o) => o.note !== null)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note: string | null;

  @ValidateIf((o) => o.estimatedCompletionAt !== null)
  @IsOptional()
  @IsDateString()
  estimatedCompletionAt: string | null;
}
```

- [ ] **Step 2: Failing test**

Append to `server/src/orders/orders.service.spec.ts`:

```typescript
describe('updateManualStatus', () => {
  it('fires notification on first set', async () => {
    batchOrdersRepo.findOneOrFail.mockResolvedValue(undefined);
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 5, userId: 7, adminStatusNote: null, adminStatusSetAt: null,
    });
    ordersRepo.save.mockImplementation(async (o) => o);
    await ordersService.updateManualStatus(5, {
      note: 'Reprinting', estimatedCompletionAt: '2026-05-01T08:00:00Z',
    });
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
    );
  });

  it('does NOT fire notification on subsequent edit', async () => {
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 5, userId: 7, adminStatusNote: 'Old', adminStatusSetAt: new Date(),
    });
    ordersRepo.save.mockImplementation(async (o) => o);
    await ordersService.updateManualStatus(5, {
      note: 'Newer', estimatedCompletionAt: null,
    });
    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});
```

(Adjust `notificationsService.create` to whatever the existing `NotificationsService` API is — if it's `notify` or `send`, use that name; the implementer must match the existing pattern.)

- [ ] **Step 3: Run, confirm fail**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 4: Implement updateManualStatus**

Append to `OrdersService`:

```typescript
async updateManualStatus(
  orderId: number,
  dto: UpdateManualStatusDto,
): Promise<Order> {
  const order = await this.ordersRepo.findOneOrFail({ where: { id: orderId } });
  const wasFirstSet = order.adminStatusSetAt === null && dto.note !== null;
  order.adminStatusNote = dto.note;
  order.estimatedCompletionAt = dto.estimatedCompletionAt
    ? new Date(dto.estimatedCompletionAt)
    : null;
  if (dto.note !== null && order.adminStatusSetAt === null) {
    order.adminStatusSetAt = new Date();
  }
  const saved = await this.ordersRepo.save(order);
  if (wasFirstSet) {
    await this.notificationsService.create({
      userId: order.userId,
      title: `Order #ORD-${order.id} update`,
      body: dto.note ?? '',
      deeplink: `/customer/orders/${order.id}`,
    });
  }
  this.ordersGateway?.emitOrderUpdate?.(saved);
  return saved;
}
```

(If `NotificationsService.create` is named differently, swap to the existing method. If `OrdersGateway` doesn't yet expose `emitOrderUpdate`, use whatever existing emit method it provides.)

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 6: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/orders/ && git commit -m "feat(orders): updateManualStatus fires one-time notification on first set"
```

---

### Task 13: Manual-status admin endpoint

**Files:**
- Modify: `server/src/orders/orders.controller.ts`

- [ ] **Step 1: Add endpoint**

Append to `OrdersController`:

```typescript
@Patch('admin/orders/:id/manual-status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async updateManualStatus(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateManualStatusDto,
) {
  return this.ordersService.updateManualStatus(id, dto);
}
```

Add the import for `UpdateManualStatusDto`. If `RolesGuard`, `Roles`, `ParseIntPipe` aren't imported yet, add them.

Note: this controller is `@Controller('orders')` so the actual route is `/orders/admin/orders/:id/manual-status`. Per the existing app convention (see batch-delivery's external-deliveries split), if you want `/admin/orders/:id/manual-status`, create a dedicated `AdminOrdersController` with `@Controller()` and move the endpoint there. **For Phase 1 use the OrdersController route** (matches existing admin batch endpoints in this controller). Update mobile/admin clients to call `/orders/admin/orders/:id/manual-status` instead.

- [ ] **Step 2: Verify type-check**

Run: `cd server && npx tsc --noEmit 2>&1 | grep orders.controller || echo OK`

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/orders/orders.controller.ts && git commit -m "feat(orders): PATCH /orders/admin/orders/:id/manual-status"
```

---

### Task 14: Defense-in-depth — reject oversize 3D items at order creation

**Files:**
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.module.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Failing test**

Append to `server/src/orders/orders.service.spec.ts`:

```typescript
describe('createBatch — 3D bounds enforcement', () => {
  it('rejects when any 3D item exceeds the printer profile', async () => {
    printerProfileService.getProfile.mockResolvedValue({
      buildVolumeWidthMm: 180, buildVolumeDepthMm: 180, buildVolumeHeightMm: 180, name: 'X', maxFileSizeMb: 200,
    });
    fileRepo.findOneOrFail.mockResolvedValue({
      id: 1, model3dWidthMm: '200', model3dDepthMm: '50', model3dHeightMm: '50',
    });
    await expect(ordersService.createBatch(99, {
      items: [{ category: '3d', fileMetadataId: 1, quantity: 1, threeDSpecs: {} as any }],
      paymentMethod: 'cash', deliveryOption: 'delivery',
    } as any)).rejects.toThrow(/build volume/);
  });
});
```

(Add `printerProfileService` and `fileRepo` to the test module providers if not already present.)

- [ ] **Step 2: Run, confirm fail**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 3: Update createBatch**

Inside `createBatch`, before saving the BatchOrder, after items are loaded:

```typescript
const profile = await this.printerProfileService.getProfile();
for (const item of dto.items) {
  if (item.category !== '3d') continue;
  const meta = await this.fileRepo.findOneOrFail({ where: { id: item.fileMetadataId } });
  if (meta.model3dWidthMm == null) continue;
  const w = Number(meta.model3dWidthMm);
  const d = Number(meta.model3dDepthMm);
  const h = Number(meta.model3dHeightMm);
  if (
    w > profile.buildVolumeWidthMm ||
    d > profile.buildVolumeDepthMm ||
    h > profile.buildVolumeHeightMm
  ) {
    throw new BadRequestException({
      message: `Model exceeds printer build volume (${w}×${d}×${h}mm vs ${profile.buildVolumeWidthMm}×${profile.buildVolumeDepthMm}×${profile.buildVolumeHeightMm}mm)`,
      code: 'model_exceeds_build_volume',
    });
  }
}
```

Inject `PrinterProfileService` and `Repository<FileMetadata>` (`@InjectRepository(FileMetadata)`) into `OrdersService` constructor.

- [ ] **Step 4: Update orders.module.ts**

Import `PrinterProfileModule` (already imported via DeliverySlotsModule? — verify; if not, add it). Add `FileMetadata` to the `TypeOrmModule.forFeature([...])` array.

```typescript
import { PrinterProfileModule } from '../printer-profile/printer-profile.module';
import { FileMetadata } from '../files/entities/file-metadata.entity';
// ...
imports: [
  TypeOrmModule.forFeature([..., FileMetadata]),
  // ... existing ...
  PrinterProfileModule,
],
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd server && npx jest orders.service.spec --no-coverage`

- [ ] **Step 6: Seed default printer profile**

Append to `server/src/seed.ts` after the existing seeders:

```typescript
const printerProfileRepo = dataSource.getRepository(
  require('./printer-profile/entities/printer-profile.entity').PrinterProfile,
);
const profileExists = await printerProfileRepo.findOne({ where: { id: 1 } });
if (!profileExists) {
  await printerProfileRepo.save({
    id: 1,
    name: 'Bambu A1 Mini',
    buildVolumeWidthMm: 180,
    buildVolumeDepthMm: 180,
    buildVolumeHeightMm: 180,
    maxFileSizeMb: 200,
  });
  console.log('✅ Printer profile seeded (Bambu A1 Mini)');
}
```

- [ ] **Step 7: Run fresh seed**

```bash
docker exec server-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'grid_print' AND pid <> pg_backend_pid();" 2>&1 | tail -3
docker exec server-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS grid_print;"
docker exec server-postgres-1 psql -U postgres -c "CREATE DATABASE grid_print;"
cd /home/jd/projects/printing_app/server && npm run seed 2>&1 | tail -10
```

Expect: "✅ Printer profile seeded (Bambu A1 Mini)".

- [ ] **Step 8: Commit**

```bash
cd /home/jd/projects/printing_app && git add server/src/orders/ server/src/seed.ts && git commit -m "feat(orders): reject oversize 3D items + seed default printer profile"
```

---

## Phase B — Mobile (Tasks 15–22)

### Task 15: Add flutter_3d_controller dependency

**Files:**
- Modify: `apps/mobile/pubspec.yaml`

- [ ] **Step 1: Add to pubspec.yaml**

Append to the `dependencies:` block (after the existing UI deps):

```yaml
  # 3D model preview
  flutter_3d_controller: ^2.2.0
```

- [ ] **Step 2: Install**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter pub get 2>&1 | tail -3
```

- [ ] **Step 3: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/pubspec.yaml apps/mobile/pubspec.lock && git commit -m "feat(mobile): add flutter_3d_controller for 3D preview"
```

---

### Task 16: PrinterProfile model + provider

**Files:**
- Create: `apps/mobile/lib/features/customer/order/models/printer_profile.dart`
- Create: `apps/mobile/lib/features/customer/order/providers/printer_profile_provider.dart`

- [ ] **Step 1: Implement model**

```dart
// apps/mobile/lib/features/customer/order/models/printer_profile.dart
class PrinterProfile {
  const PrinterProfile({
    required this.name,
    required this.buildVolumeWidthMm,
    required this.buildVolumeDepthMm,
    required this.buildVolumeHeightMm,
    required this.maxFileSizeMb,
  });

  final String name;
  final int buildVolumeWidthMm;
  final int buildVolumeDepthMm;
  final int buildVolumeHeightMm;
  final int maxFileSizeMb;

  factory PrinterProfile.fromJson(Map<String, dynamic> json) => PrinterProfile(
        name: json['name'] as String,
        buildVolumeWidthMm: (json['buildVolumeWidthMm'] as num).toInt(),
        buildVolumeDepthMm: (json['buildVolumeDepthMm'] as num).toInt(),
        buildVolumeHeightMm: (json['buildVolumeHeightMm'] as num).toInt(),
        maxFileSizeMb: (json['maxFileSizeMb'] as num).toInt(),
      );
}
```

- [ ] **Step 2: Implement provider**

```dart
// apps/mobile/lib/features/customer/order/providers/printer_profile_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/printer_profile.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

final printerProfileProvider =
    FutureProvider.autoDispose<PrinterProfile?>((ref) async {
  final dio = ref.read(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/printer-profile');
    if (res.data == null) return null;
    return PrinterProfile.fromJson(res.data!);
  } catch (_) {
    return null;
  }
});
```

- [ ] **Step 3: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/models lib/features/customer/order/providers 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/features/customer/order/models/printer_profile.dart apps/mobile/lib/features/customer/order/providers/printer_profile_provider.dart && git commit -m "feat(mobile): add PrinterProfile model + provider"
```

---

### Task 17: Model3dPreview widget

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/model_3d_preview.dart`

- [ ] **Step 1: Implement widget**

```dart
// apps/mobile/lib/features/customer/order/widgets/model_3d_preview.dart
import 'package:flutter/material.dart';
import 'package:flutter_3d_controller/flutter_3d_controller.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class Model3dPreview extends StatefulWidget {
  const Model3dPreview({
    super.key,
    required this.fileUrl,
    required this.filename,
  });

  final String fileUrl;
  final String filename;

  bool get _isSupported {
    final lower = filename.toLowerCase();
    return lower.endsWith('.stl') || lower.endsWith('.obj');
  }

  @override
  State<Model3dPreview> createState() => _Model3dPreviewState();
}

class _Model3dPreviewState extends State<Model3dPreview> {
  late final Flutter3DController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Flutter3DController();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (!widget._isSupported) {
      return _Placeholder(colors: colors, filename: widget.filename);
    }

    return Container(
      height: 300,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Flutter3DViewer(
        controller: _controller,
        src: widget.fileUrl,
        progressBarColor: colors.brand,
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.colors, required this.filename});
  final AppColorSet colors;
  final String filename;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedCubic,
            size: 64,
            color: colors.brand,
          ),
          const SizedBox(height: 12),
          Text(
            filename,
            style: AppTypography.body.copyWith(color: colors.onBackground),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            '3D preview not available for this format',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }
}
```

If `HugeIcons.strokeRoundedCubic` doesn't exist, use `HugeIcons.strokeRoundedCube` or any available cube icon.

- [ ] **Step 2: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/widgets/model_3d_preview.dart 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/features/customer/order/widgets/model_3d_preview.dart && git commit -m "feat(mobile): add Model3dPreview widget for STL/OBJ inline render"
```

---

### Task 18: PrinterLimitsCard widget

**Files:**
- Create: `apps/mobile/lib/features/customer/order/widgets/printer_limits_card.dart`

- [ ] **Step 1: Implement**

```dart
// apps/mobile/lib/features/customer/order/widgets/printer_limits_card.dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class PrinterLimitsCard extends StatelessWidget {
  const PrinterLimitsCard({
    super.key,
    required this.printerName,
    required this.widthMm,
    required this.depthMm,
    required this.heightMm,
    this.modelWidthMm,
    this.modelDepthMm,
    this.modelHeightMm,
    required this.fits,
  });

  final String printerName;
  final int widthMm;
  final int depthMm;
  final int heightMm;
  final double? modelWidthMm;
  final double? modelDepthMm;
  final double? modelHeightMm;
  final bool fits;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final widthCm = (widthMm / 10).toStringAsFixed(0);
    final depthCm = (depthMm / 10).toStringAsFixed(0);
    final heightCm = (heightMm / 10).toStringAsFixed(0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.brand, width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedPrinter,
            size: 28,
            color: colors.brand,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Temporary',
                  style: AppTypography.caption.copyWith(
                    color: colors.brand,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '3D Printer Limitations',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Our printer can only print $widthCm × $depthCm × $heightCm cm '
                  '($widthMm × $depthMm × $heightMm mm).',
                  style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
                ),
                if (modelWidthMm != null &&
                    modelDepthMm != null &&
                    modelHeightMm != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Your file: ${(modelWidthMm! / 10).toStringAsFixed(1)} × '
                    '${(modelDepthMm! / 10).toStringAsFixed(1)} × '
                    '${(modelHeightMm! / 10).toStringAsFixed(1)} cm',
                    style: AppTypography.caption.copyWith(
                      color: fits ? colors.success : colors.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

If `HugeIcons.strokeRoundedPrinter` doesn't exist, fall back to a similar icon (e.g., `strokeRoundedAlertCircle`).

- [ ] **Step 2: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/widgets/printer_limits_card.dart 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/features/customer/order/widgets/printer_limits_card.dart && git commit -m "feat(mobile): add PrinterLimitsCard warning card"
```

---

### Task 19: Wire 3D preview + limits card into upload screen

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`

- [ ] **Step 1: Read existing upload_screen.dart**

Find:
- Where the upload-success state is rendered (file shown after upload completes).
- Where `_inspection: Map<String, dynamic>?` is currently consumed (paper-size validation chips).
- The category check (`category == '3d'`).

- [ ] **Step 2: Wire in the 3D-only branch**

After the inspection result is populated, when `category == '3d'`:

1. Read `printerProfileProvider`.
2. Extract from `_inspection`:
   - `modelBounds = _inspection?['modelBounds']` (Map or null)
   - `printerLimits = _inspection?['printerLimits']` (Map or null)
3. If `modelBounds != null` and `printerLimits != null`:
   - Show a heading "File Preview" + filename.
   - Embed `Model3dPreview(fileUrl: _filePath!, filename: <name>)`.
   - Below it, embed `PrinterLimitsCard(...)` with values from `printerLimits` and the model's bounds.
4. Continue button:
   - If `printerLimits['fits'] == true`, render the existing primary CTA.
   - Else, render disabled "Unavailable for Beta Testing" + a secondary brand-yellow "Chat with us for personalization" button.

Concrete diff fragment to insert (adapt to actual existing code structure):

```dart
if (category == '3d' && _inspection != null) ...[
  const SizedBox(height: 16),
  Text('File Preview', style: AppTypography.h3.copyWith(color: colors.onBackground)),
  const SizedBox(height: 4),
  Text(_fileName ?? '', style: AppTypography.caption.copyWith(color: colors.onSurfaceDim)),
  const SizedBox(height: 12),
  Model3dPreview(
    fileUrl: _filePath ?? '',
    filename: _fileName ?? '',
  ),
  if (_inspection!['printerLimits'] != null) ...[
    const SizedBox(height: 16),
    PrinterLimitsCard(
      printerName: (_inspection!['printerLimits']['profileName'] as String?) ?? 'Printer',
      widthMm: (_inspection!['printerLimits']['widthMm'] as num).toInt(),
      depthMm: (_inspection!['printerLimits']['depthMm'] as num).toInt(),
      heightMm: (_inspection!['printerLimits']['heightMm'] as num).toInt(),
      modelWidthMm: (_inspection!['modelBounds']?['widthMm'] as num?)?.toDouble(),
      modelDepthMm: (_inspection!['modelBounds']?['depthMm'] as num?)?.toDouble(),
      modelHeightMm: (_inspection!['modelBounds']?['heightMm'] as num?)?.toDouble(),
      fits: _inspection!['printerLimits']['fits'] as bool,
    ),
  ],
],
```

For the chat CTA when oversize:

```dart
if (category == '3d' &&
    _inspection?['printerLimits']?['fits'] == false) ...[
  const SizedBox(height: 12),
  AppButton(
    label: 'Unavailable for Beta Testing',
    variant: AppButtonVariant.disabled,
    isFullWidth: true,
    onTap: null,
  ),
  const SizedBox(height: 8),
  AppButton(
    label: 'Chat with us for personalization',
    variant: AppButtonVariant.brand,
    isFullWidth: true,
    onTap: () => _openOversizedChat(),
  ),
] else ...[
  // existing Continue button
]
```

Add the helper method:

```dart
void _openOversizedChat() {
  final w = (_inspection?['modelBounds']?['widthMm'] as num?)?.toStringAsFixed(0) ?? '?';
  final d = (_inspection?['modelBounds']?['depthMm'] as num?)?.toStringAsFixed(0) ?? '?';
  final h = (_inspection?['modelBounds']?['heightMm'] as num?)?.toStringAsFixed(0) ?? '?';
  final filename = _fileName ?? 'my model';
  final draftMessage = "Hi! I'm uploading $filename ($w×$d×$h mm) but it exceeds the printer build volume — can you help with personalization?";
  context.push('/customer/chat/new?type=admin&draft=${Uri.encodeComponent(draftMessage)}');
}
```

(The chat-select screen will need to honor a `draft` query param; see Task 20.)

- [ ] **Step 3: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/screens/upload_screen.dart 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/features/customer/order/screens/upload_screen.dart && git commit -m "feat(mobile): wire 3D preview + printer-limits card + chat CTA into upload"
```

---

### Task 20: Chat draft-message support

**Files:**
- Modify: `apps/mobile/lib/features/customer/chat/screens/chat_select_screen.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`

- [ ] **Step 1: Update ChatSelectScreen to accept draft + auto-send on chat creation**

In the existing `ChatSelectScreen`, accept a `draft` query param and pass it through to the conversation create-and-redirect flow. After `conv` is created, if `draft != null`, also send the draft as the first message.

Adapt the existing `_startChat` method:

```dart
Future<void> _startChat(ConversationType type) async {
  setState(() => _isCreating = true);
  final conv = await ref.read(chatProvider.notifier).createConversation(type, orderId: widget.orderId);
  if (!mounted) return;
  setState(() => _isCreating = false);
  if (conv != null) {
    if (widget.draftMessage != null && widget.draftMessage!.isNotEmpty) {
      // Fire-and-forget; conversation screen will show the message once WS replays it.
      ref.read(conversationProvider(conv.id).notifier).initialize().then((_) {
        ref.read(conversationProvider(conv.id).notifier).sendMessage(widget.draftMessage!);
      });
    }
    context.pushReplacement('/customer/chat/${conv.id}?type=${type.name}');
  }
}
```

Update the constructor:

```dart
const ChatSelectScreen({super.key, this.orderId, this.draftMessage});
final int? orderId;
final String? draftMessage;
```

- [ ] **Step 2: Update router to pass draft**

In `app_router.dart`, find the `/customer/chat/new` route. Update it:

```dart
GoRoute(
  path: '/customer/chat/new',
  builder: (_, state) => ChatSelectScreen(
    orderId: int.tryParse(state.uri.queryParameters['orderId'] ?? ''),
    draftMessage: state.uri.queryParameters['draft'],
  ),
),
```

- [ ] **Step 3: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/chat lib/config/routes/app_router.dart 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/features/customer/chat/screens/chat_select_screen.dart apps/mobile/lib/config/routes/app_router.dart && git commit -m "feat(mobile): chat-select accepts draft message for oversized 3D handoff"
```

---

### Task 21: Extend Order model with admin-status fields

**Files:**
- Modify: `apps/mobile/lib/shared/models/order.dart`

- [ ] **Step 1: Add fields**

Add to the existing `Order` class:

```dart
final String? adminStatusNote;
final DateTime? estimatedCompletionAt;
final DateTime? adminStatusSetAt;
```

Update the constructor (named params), `copyWith`, and `fromJson` to include these. Example fromJson additions:

```dart
adminStatusNote: json['adminStatusNote'] as String?,
estimatedCompletionAt: json['estimatedCompletionAt'] != null
    ? DateTime.parse(json['estimatedCompletionAt'] as String)
    : null,
adminStatusSetAt: json['adminStatusSetAt'] != null
    ? DateTime.parse(json['adminStatusSetAt'] as String)
    : null,
```

- [ ] **Step 2: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/shared/models/order.dart 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/shared/models/order.dart && git commit -m "feat(mobile): extend Order model with admin manual-status fields"
```

---

### Task 22: AdminStatusBanner with live countdown

**Files:**
- Create: `apps/mobile/lib/features/customer/orders/widgets/admin_status_banner.dart`
- Modify: `apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart`

- [ ] **Step 1: Implement banner**

```dart
// apps/mobile/lib/features/customer/orders/widgets/admin_status_banner.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class AdminStatusBanner extends StatefulWidget {
  const AdminStatusBanner({
    super.key,
    required this.note,
    this.estimatedCompletionAt,
  });

  final String note;
  final DateTime? estimatedCompletionAt;

  @override
  State<AdminStatusBanner> createState() => _AdminStatusBannerState();
}

class _AdminStatusBannerState extends State<AdminStatusBanner> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    if (widget.estimatedCompletionAt != null) {
      _ticker = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _countdown(DateTime target) {
    final diff = target.difference(DateTime.now());
    if (diff.isNegative) return 'Awaiting completion';
    final h = diff.inHours;
    final m = diff.inMinutes.remainder(60);
    if (h > 0) return '~${h}h ${m}m remaining';
    return '~${m}m remaining';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.brand.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.brand.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedInformationCircle,
            size: 20,
            color: colors.brand,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.note,
                  style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
                ),
                if (widget.estimatedCompletionAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _countdown(widget.estimatedCompletionAt!),
                    style: AppTypography.caption.copyWith(color: colors.brand),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Mount in order_detail_screen.dart**

Find the existing `OrderDetailScreen` build method. At the top of the order body content (above the existing fee/status sections), add:

```dart
if (order.adminStatusNote != null) ...[
  AdminStatusBanner(
    note: order.adminStatusNote!,
    estimatedCompletionAt: order.estimatedCompletionAt,
  ),
  const SizedBox(height: 16),
],
```

Add the import.

- [ ] **Step 3: Verify analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/orders 2>&1 | tail -5
```

- [ ] **Step 4: Build web release**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -5
```

Expect: `✓ Built build/web`.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app && git add apps/mobile/lib/features/customer/orders/widgets/admin_status_banner.dart apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart && git commit -m "feat(mobile): admin-status banner with live countdown on order detail"
```

---

## Phase C — Admin (Tasks 23–27)

### Task 23: Admin types

**Files:**
- Create: `admin/src/types/printer-profile.ts`

- [ ] **Step 1: Implement**

```typescript
// admin/src/types/printer-profile.ts
export interface PrinterProfile {
  id: number;
  name: string;
  buildVolumeWidthMm: number;
  buildVolumeDepthMm: number;
  buildVolumeHeightMm: number;
  maxFileSizeMb: number;
  updatedAt: string;
}

export interface ManualStatusPayload {
  note: string | null;
  estimatedCompletionAt: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/jd/projects/printing_app && git add admin/src/types/printer-profile.ts && git commit -m "feat(admin): printer-profile + manual-status types"
```

---

### Task 24: ManualStatusCard component

**Files:**
- Create: `admin/src/pages/orders/components/manual-status-card.tsx`
- Modify: `admin/src/pages/orders/show.tsx`

- [ ] **Step 1: Implement card**

```tsx
// admin/src/pages/orders/components/manual-status-card.tsx
import { useState } from "react";
import { Card, Form, Input, DatePicker, Button, Space, App } from "antd";
import dayjs from "dayjs";
import { apiClient } from "@/providers/api-client";

interface Props {
  orderId: number;
  initialNote: string | null;
  initialCompletionAt: string | null;
  onUpdated: () => void;
}

export function ManualStatusCard({
  orderId,
  initialNote,
  initialCompletionAt,
  onUpdated,
}: Props) {
  const { message } = App.useApp();
  const [note, setNote] = useState(initialNote ?? "");
  const [completionAt, setCompletionAt] = useState(
    initialCompletionAt ? dayjs(initialCompletionAt) : null,
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/orders/admin/orders/${orderId}/manual-status`, {
        note: note.trim() === "" ? null : note.trim(),
        estimatedCompletionAt: completionAt ? completionAt.toISOString() : null,
      });
      message.success("Manual status updated");
      onUpdated();
    } catch {
      message.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/orders/admin/orders/${orderId}/manual-status`, {
        note: null,
        estimatedCompletionAt: null,
      });
      setNote("");
      setCompletionAt(null);
      message.success("Manual status cleared");
      onUpdated();
    } catch {
      message.error("Clear failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Manual Print Status"
      extra={
        <Button danger size="small" onClick={clear} disabled={saving || (!note && !completionAt)}>
          Clear
        </Button>
      }
      style={{ marginTop: 16 }}
    >
      <Form layout="vertical">
        <Form.Item label="Status note (visible to customer)">
          <Input.TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
            showCount
            rows={3}
            placeholder='e.g., "Reprinting due to layer shift"'
          />
        </Form.Item>
        <Form.Item label="Estimated completion (optional)">
          <DatePicker
            showTime
            value={completionAt}
            onChange={(d) => setCompletionAt(d)}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Space>
          <Button type="primary" loading={saving} onClick={save}>
            Save status
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
```

- [ ] **Step 2: Mount in orders show**

In `admin/src/pages/orders/show.tsx`, import `ManualStatusCard` and render it inside the order detail body:

```tsx
import { ManualStatusCard } from "./components/manual-status-card";
// ... inside the show body, after the existing sections:
<ManualStatusCard
  orderId={record.id}
  initialNote={record.adminStatusNote ?? null}
  initialCompletionAt={record.estimatedCompletionAt ?? null}
  onUpdated={() => queryResult.refetch?.()}
/>
```

(The exact prop names — `record`, `queryResult` — depend on the existing show structure. Implementer reads the file and adapts.)

- [ ] **Step 3: Verify build**

```bash
cd /home/jd/projects/printing_app/admin && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app && git add admin/src/pages/orders/ && git commit -m "feat(admin): ManualStatusCard on order detail with save + clear"
```

---

### Task 25: Printer settings page

**Files:**
- Create: `admin/src/pages/admin-settings/printer.tsx`

- [ ] **Step 1: Implement page**

```tsx
// admin/src/pages/admin-settings/printer.tsx
import { useEffect, useState } from "react";
import { Card, Form, Input, InputNumber, Button, Spin, App, Row, Col, Typography, Divider } from "antd";
import { apiClient } from "@/providers/api-client";
import type { PrinterProfile } from "@/types/printer-profile";

const { Title, Text } = Typography;

export function PrinterProfilePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState({ w: 180, d: 180, h: 180 });

  useEffect(() => {
    apiClient.get<PrinterProfile>("/admin/printer-profile").then((res) => {
      form.setFieldsValue({
        name: res.data.name,
        buildVolumeWidthMm: res.data.buildVolumeWidthMm,
        buildVolumeDepthMm: res.data.buildVolumeDepthMm,
        buildVolumeHeightMm: res.data.buildVolumeHeightMm,
        maxFileSizeMb: res.data.maxFileSizeMb,
      });
      setDims({
        w: res.data.buildVolumeWidthMm,
        d: res.data.buildVolumeDepthMm,
        h: res.data.buildVolumeHeightMm,
      });
      setLoading(false);
    });
  }, []);

  const onSave = async (values: any) => {
    setSaving(true);
    try {
      await apiClient.patch("/admin/printer-profile", values);
      message.success("Printer profile saved");
    } catch {
      message.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" />;

  // Normalize to 200px max for the visualizer
  const max = Math.max(dims.w, dims.d, dims.h);
  const scale = 180 / max;
  const W = dims.w * scale;
  const D = dims.d * scale;
  const H = dims.h * scale;

  return (
    <div style={{ maxWidth: 1100 }}>
      <Title level={3}>Printer Profile</Title>
      <Text type="secondary">
        The active printer's build volume. Customer 3D uploads exceeding these
        dimensions are blocked from checkout.
      </Text>
      <Form form={form} layout="vertical" onFinish={onSave} onValuesChange={(_, v) => setDims({
        w: v.buildVolumeWidthMm ?? dims.w,
        d: v.buildVolumeDepthMm ?? dims.d,
        h: v.buildVolumeHeightMm ?? dims.h,
      })} style={{ marginTop: 24 }}>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card title="Build Volume" style={{ borderRadius: 12, marginBottom: 16 }}>
              <Form.Item name="name" label="Printer model" rules={[{ required: true, max: 80 }]}>
                <Input placeholder="Bambu A1 Mini" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="buildVolumeWidthMm" label="Width (mm)" rules={[{ required: true, type: "number", min: 1, max: 500 }]}>
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="buildVolumeDepthMm" label="Depth (mm)" rules={[{ required: true, type: "number", min: 1, max: 500 }]}>
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="buildVolumeHeightMm" label="Height (mm)" rules={[{ required: true, type: "number", min: 1, max: 500 }]}>
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="File Limits" style={{ borderRadius: 12 }}>
              <Form.Item name="maxFileSizeMb" label="Max file size (MB)" rules={[{ required: true, type: "number", min: 1, max: 500 }]}>
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
            </Card>

            <Divider />
            <Button type="primary" htmlType="submit" loading={saving} size="large" block>
              Save profile
            </Button>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Build Volume Preview" style={{ borderRadius: 12 }}>
              <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", perspective: 800 }}>
                <div
                  style={{
                    transform: "rotateX(-20deg) rotateY(-25deg)",
                    transformStyle: "preserve-3d",
                    width: W,
                    height: H,
                  }}
                >
                  {/* Front face */}
                  <div style={{
                    position: "absolute", width: W, height: H,
                    border: "2px solid #FFDE58", background: "rgba(255,222,88,0.08)",
                    transform: `translateZ(${D / 2}px)`,
                  }} />
                  {/* Back face */}
                  <div style={{
                    position: "absolute", width: W, height: H,
                    border: "2px solid #FFDE5880", background: "rgba(255,222,88,0.04)",
                    transform: `translateZ(-${D / 2}px) rotateY(180deg)`,
                  }} />
                  {/* Right face */}
                  <div style={{
                    position: "absolute", width: D, height: H, left: W - D / 2,
                    border: "2px solid #FFDE58", background: "rgba(255,222,88,0.06)",
                    transform: `rotateY(90deg) translateZ(${D / 2}px)`,
                  }} />
                  {/* Top face */}
                  <div style={{
                    position: "absolute", width: W, height: D, top: -D / 2,
                    border: "2px dashed #FFDE5880",
                    transform: `rotateX(90deg) translateZ(${D / 2}px)`,
                  }} />
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 12, fontFamily: "monospace", color: "#FFDE58", fontWeight: 700 }}>
                {dims.w} × {dims.d} × {dims.h} mm
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/jd/projects/printing_app/admin && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add admin/src/pages/admin-settings/printer.tsx && git commit -m "feat(admin): printer profile page with CSS-cube preview"
```

---

### Task 26: Register admin route + sidebar entry

**Files:**
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Register resource + route**

Add to the `resources` array, under the existing `delivery-slots` group (or as a sibling under a new `3d-printing` parent):

```tsx
{
  name: 'printer-profile',
  list: '/settings/printer',
  meta: { label: 'Printer Profile', parent: 'delivery-slots', icon: <PrinterOutlined /> },
},
```

Import `PrinterOutlined` from `@ant-design/icons` if needed.

Add the matching `<Route>`:

```tsx
<Route path="/settings/printer" element={<PrinterProfilePage />} />
```

Import `PrinterProfilePage`.

- [ ] **Step 2: Verify build**

```bash
cd /home/jd/projects/printing_app/admin && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app && git add admin/src/App.tsx && git commit -m "feat(admin): wire printer-profile resource + route"
```

---

### Task 27: End-to-end verification

- [ ] **Step 1: Fresh DB seed**

```bash
docker exec server-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'grid_print' AND pid <> pg_backend_pid();" 2>&1 | tail -3
docker exec server-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS grid_print;"
docker exec server-postgres-1 psql -U postgres -c "CREATE DATABASE grid_print;"
cd /home/jd/projects/printing_app/server && npm run seed 2>&1 | tail -10
```

Expect: includes `✅ Printer profile seeded (Bambu A1 Mini)`.

- [ ] **Step 2: Run server tests**

```bash
cd /home/jd/projects/printing_app/server && npx jest --testPathPatterns="printer-profile|files|orders" --silent 2>&1 | tail -8
```

Expect: all suites pass.

- [ ] **Step 3: Type-check backend**

```bash
cd /home/jd/projects/printing_app/server && npx tsc --noEmit 2>&1 | grep -vE "spec\.ts" | head -10
```

Expect: no production errors.

- [ ] **Step 4: Mobile build**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -3
```

- [ ] **Step 5: Admin build**

```bash
cd /home/jd/projects/printing_app/admin && npm run build 2>&1 | tail -3
```

- [ ] **Step 6: Manual smoke**

- Login as customer, upload a small `.stl` (under 18cm bounds) → see preview + green "Your file: …" subline + Continue button enabled.
- Upload a large `.stl` (over 18cm) → see preview + red subline + "Unavailable for Beta Testing" disabled + "Chat with us for personalization" enabled.
- Tap chat CTA → opens chat-select with admin pre-selected; once you choose Human Support, the templated message appears in the new conversation.
- Login as admin → open the customer's order on `/orders/show/:id` → fill in "Reprinting due to layer shift" + a future timestamp → Save.
- Customer mobile receives push (or in-app if dev disabled push) and order detail shows the yellow banner + countdown.
- Admin edits the note → no second push, banner refreshes silently.
- Open admin → Delivery → Printer Profile → adjust width to 200, save → next mobile upload of a 19cm model should now pass.

If anything breaks, write a failing test, fix it.

---

## Self-Review Notes

**Spec coverage:** Every requirement in the spec maps to a task above (entity columns → Tasks 1, 6, 11; service → 3, 12; analyzer → 7-8; controller → 4, 13; defense-in-depth → 14; mobile preview/limits/banner → 15-22; admin pages → 23-26).

**Placeholder scan:** No `TBD` / `FIXME` / "implement later" / "Similar to Task N" markers in implementation steps. Phase-2 references in the spec (3MF preview placeholder) are intentional product scope, not plan gaps.

**Type consistency:** `Model3dBounds`, `FileAnalysisResult`, `PrinterProfile`, `ManualStatusPayload` are used identically across files. Method names: `getProfile()`, `updateProfile()`, `analyze()`, `updateManualStatus()` — match across the plan.

**Out of scope (Phase 2):** Server-side 3MF → GLB rendering conversion, multi-printer profiles, auto-scale-to-fit slider, manual admin override flag. Documented in the spec.
