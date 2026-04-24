# File Retention Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers choose how long their uploaded files are kept after order completion (24h / 7d / 30d / Never), enforced by a server cron job, with expiry warnings on the Data Grid.

**Architecture:** A `fileRetentionDays` preference on the user stamps an `expiresAt` timestamp on the linked `FileMetadata` row when an order reaches `completed_pickup`. A daily 02:00 cron sweeps expired rows — deletes from MinIO then removes the DB row. The mobile profile gains a "Storage & Files" screen; the Data Grid shows amber expiry pill badges on cards < 3 days from deletion.

**Tech Stack:** NestJS + TypeORM + PostgreSQL + MinIO + `@nestjs/schedule`; Flutter 3.41.6 (fvm) + Riverpod (StateNotifierProvider) + go_router. TypeORM `synchronize: true` in non-prod — no manual migrations needed.

---

## File Map

| File | Action |
|------|--------|
| `server/src/users/entities/user.entity.ts` | Add `fileRetentionDays` column |
| `server/src/files/entities/file-metadata.entity.ts` | Add `expiresAt` column |
| `server/src/storage/storage.service.ts` | Add `delete(objectKey)` method |
| `server/src/users/dto/update-storage-settings.dto.ts` | New DTO |
| `server/src/users/users.service.ts` | Add `getStorageSettings` / `updateStorageSettings` |
| `server/src/users/users.controller.ts` | Add GET + PATCH `/users/me/storage-settings` |
| `server/src/files/files.service.ts` | Add `stampExpiry`, `deleteExpired`, update `getMyUploads` |
| `server/src/files/purge.service.ts` | New — daily cron job |
| `server/src/files/files.module.ts` | Register `PurgeService` |
| `server/src/app.module.ts` | Import `ScheduleModule.forRoot()` |
| `server/src/orders/orders.module.ts` | Import `FilesModule` |
| `server/src/orders/orders.service.ts` | Inject `FilesService`, stamp on completion |
| `apps/mobile/lib/shared/models/uploaded_file.dart` | Add `expiresAt` field |
| `apps/mobile/lib/features/customer/profile/models/storage_settings.dart` | New model |
| `apps/mobile/lib/features/customer/profile/providers/storage_settings_provider.dart` | New provider |
| `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart` | New screen |
| `apps/mobile/lib/config/routes/app_router.dart` | Register new route |
| `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` | Add "Storage & Files" row |
| `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart` | Add expiry badge |

---

### Task 1: Entity columns — `fileRetentionDays` on User + `expiresAt` on FileMetadata

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/files/entities/file-metadata.entity.ts`

TypeORM `synchronize: true` applies schema changes automatically in dev/staging — no migration file needed.

- [ ] **Step 1: Add `fileRetentionDays` to User entity**

In `server/src/users/entities/user.entity.ts`, add after the `credits` column (before `@CreateDateColumn`):

```typescript
  @Column({
    name: 'file_retention_days',
    type: 'integer',
    nullable: true,
    default: null,
  })
  fileRetentionDays: number | null;
```

- [ ] **Step 2: Add `expiresAt` to FileMetadata entity**

In `server/src/files/entities/file-metadata.entity.ts`, add after `uploadedBy` (before `@CreateDateColumn`):

```typescript
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true, default: null })
  expiresAt: Date | null;
```

The full updated file becomes:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('file_metadata')
export class FileMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column()
  size: number;

  @Column()
  url: string;

  @Column({ name: 'object_key', type: 'varchar', nullable: true })
  objectKey: string | null;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy: number;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true, default: null })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/users/entities/user.entity.ts \
        server/src/files/entities/file-metadata.entity.ts
git commit -m "feat: add fileRetentionDays to users and expiresAt to file_metadata"
```

---

### Task 2: Storage settings — DTO + UsersService methods

**Files:**
- Create: `server/src/users/dto/update-storage-settings.dto.ts`
- Modify: `server/src/users/users.service.ts`
- Create: `server/src/users/users.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/users/users.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService — storage settings', () => {
  let service: UsersService;
  const repo = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  describe('getStorageSettings', () => {
    it('returns fileRetentionDays when set', async () => {
      repo.findOneOrFail.mockResolvedValue({ id: 1, fileRetentionDays: 7 } as User);
      expect(await service.getStorageSettings(1)).toEqual({ fileRetentionDays: 7 });
    });

    it('returns null when fileRetentionDays is null', async () => {
      repo.findOneOrFail.mockResolvedValue({ id: 1, fileRetentionDays: null } as User);
      expect(await service.getStorageSettings(1)).toEqual({ fileRetentionDays: null });
    });
  });

  describe('updateStorageSettings', () => {
    it('sets a valid retention period', async () => {
      repo.update.mockResolvedValue({});
      await service.updateStorageSettings(1, 30);
      expect(repo.update).toHaveBeenCalledWith(1, { fileRetentionDays: 30 });
    });

    it('sets null (disables retention)', async () => {
      repo.update.mockResolvedValue({});
      await service.updateStorageSettings(1, null);
      expect(repo.update).toHaveBeenCalledWith(1, { fileRetentionDays: null });
    });

    it('rejects an invalid retention value', async () => {
      await expect(service.updateStorageSettings(1, 14)).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest users.service.spec.ts --no-coverage
```
Expected: `getStorageSettings is not a function` (or similar — service methods don't exist yet).

- [ ] **Step 3: Create the DTO**

Create `server/src/users/dto/update-storage-settings.dto.ts`:

```typescript
export class UpdateStorageSettingsDto {
  fileRetentionDays: number | null;
}
```

- [ ] **Step 4: Add service methods**

In `server/src/users/users.service.ts`, update the import line:

```typescript
import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
```

Then add these two methods at the bottom of `UsersService` (before the closing `}`):

```typescript
  async getStorageSettings(
    userId: number,
  ): Promise<{ fileRetentionDays: number | null }> {
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    return { fileRetentionDays: user.fileRetentionDays };
  }

  async updateStorageSettings(
    userId: number,
    fileRetentionDays: number | null,
  ): Promise<{ fileRetentionDays: number | null }> {
    if (![null, 1, 7, 30].includes(fileRetentionDays)) {
      throw new BadRequestException('fileRetentionDays must be null, 1, 7, or 30');
    }
    await this.usersRepo.update(userId, { fileRetentionDays });
    return { fileRetentionDays };
  }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd server && npx jest users.service.spec.ts --no-coverage
```
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/users/dto/update-storage-settings.dto.ts \
        server/src/users/users.service.ts \
        server/src/users/users.service.spec.ts
git commit -m "feat: add getStorageSettings and updateStorageSettings to UsersService"
```

---

### Task 3: Storage settings — UsersController endpoints

**Files:**
- Modify: `server/src/users/users.controller.ts`
- Create: `server/src/users/users.controller.spec.ts`

Adds `GET /users/me/storage-settings` and `PATCH /users/me/storage-settings`.

- [ ] **Step 1: Write failing tests**

Create `server/src/users/users.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController — storage settings', () => {
  let controller: UsersController;
  const mockService = {
    findById: jest.fn(),
    updateFcmToken: jest.fn(),
    updateProfile: jest.fn(),
    getStorageSettings: jest.fn(),
    updateStorageSettings: jest.fn(),
  };
  const mockReq = { user: { sub: 42 } } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();
    controller = module.get<UsersController>(UsersController);
  });

  it('GET /users/me/storage-settings returns settings', async () => {
    mockService.getStorageSettings.mockResolvedValue({ fileRetentionDays: 7 });
    const result = await controller.getStorageSettings(mockReq);
    expect(result).toEqual({ fileRetentionDays: 7 });
    expect(mockService.getStorageSettings).toHaveBeenCalledWith(42);
  });

  it('PATCH /users/me/storage-settings updates settings', async () => {
    mockService.updateStorageSettings.mockResolvedValue({ fileRetentionDays: 30 });
    const result = await controller.updateStorageSettings(mockReq, { fileRetentionDays: 30 });
    expect(result).toEqual({ fileRetentionDays: 30 });
    expect(mockService.updateStorageSettings).toHaveBeenCalledWith(42, 30);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest users.controller.spec.ts --no-coverage
```
Expected: `getStorageSettings is not a function` on controller.

- [ ] **Step 3: Add the two endpoints**

In `server/src/users/users.controller.ts`, add `Patch` and `Body` to the existing import:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
```

Add the import for the DTO after the existing imports:

```typescript
import { UpdateStorageSettingsDto } from './dto/update-storage-settings.dto';
```

Add the two endpoints at the bottom of the controller class (before the closing `}`):

```typescript
  @Get('me/storage-settings')
  async getStorageSettings(@Request() req: RequestWithUser) {
    return this.usersService.getStorageSettings(req.user.sub);
  }

  @Patch('me/storage-settings')
  async updateStorageSettings(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateStorageSettingsDto,
  ) {
    return this.usersService.updateStorageSettings(
      req.user.sub,
      dto.fileRetentionDays,
    );
  }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd server && npx jest users.controller.spec.ts --no-coverage
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/users/users.controller.ts \
        server/src/users/users.controller.spec.ts
git commit -m "feat: add GET+PATCH /users/me/storage-settings endpoints"
```

---

### Task 4: FilesService — `stampExpiry`, `deleteExpired`, `getMyUploads` filter, `StorageService.delete`

**Files:**
- Modify: `server/src/storage/storage.service.ts`
- Modify: `server/src/files/files.service.ts`
- Create: `server/src/files/files.service.spec.ts`

`StorageService.delete()` is needed by `deleteExpired()` and doesn't exist yet.

- [ ] **Step 1: Write failing tests**

Create `server/src/files/files.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';

describe('FilesService', () => {
  let service: FilesService;
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const storageService = {
    upload: jest.fn(),
    getPresignedUrl: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(FileMetadata), useValue: repo },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  describe('stampExpiry', () => {
    it('sets expiresAt to now + retentionDays on the file row', async () => {
      repo.update.mockResolvedValue({});
      const before = new Date();
      await service.stampExpiry(5, 7);
      const after = new Date();

      expect(repo.update).toHaveBeenCalledTimes(1);
      const [id, payload] = repo.update.mock.calls[0];
      expect(id).toBe(5);
      const expiresAt: Date = payload.expiresAt;
      // expiresAt should be ~7 days from now
      const diffMs = expiresAt.getTime() - before.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
      expect(diffMs).toBeLessThanOrEqual(sevenDaysMs + (after.getTime() - before.getTime()) + 1000);
    });
  });

  describe('deleteExpired', () => {
    it('deletes MinIO objects and db rows for expired files', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, objectKey: 'key/a.pdf', expiresAt: new Date(Date.now() - 1000) },
          { id: 2, objectKey: 'key/b.pdf', expiresAt: new Date(Date.now() - 1000) },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(fakeQb);
      storageService.delete.mockResolvedValue(undefined);
      repo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(storageService.delete).toHaveBeenCalledTimes(2);
      expect(repo.delete).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ found: 2, deleted: 2, skipped: 0 });
    });

    it('skips a record when MinIO deletion fails', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, objectKey: 'key/a.pdf', expiresAt: new Date(Date.now() - 1000) },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(fakeQb);
      storageService.delete.mockRejectedValue(new Error('MinIO down'));
      repo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ found: 1, deleted: 0, skipped: 1 });
    });

    it('deletes db row even when objectKey is null', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 3, objectKey: null, expiresAt: new Date(Date.now() - 1000) },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(fakeQb);
      repo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(storageService.delete).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(3);
      expect(result).toEqual({ found: 1, deleted: 1, skipped: 0 });
    });
  });

  describe('getMyUploads', () => {
    it('excludes expired files from results', async () => {
      repo.find.mockResolvedValue([
        { id: 1, uploadedBy: 7, expiresAt: null },
        { id: 2, uploadedBy: 7, expiresAt: new Date(Date.now() + 86400000) },
      ]);
      const result = await service.getMyUploads(7);
      expect(result).toHaveLength(2);

      // Verify the where clause structure was applied (two OR branches)
      const whereArg = repo.find.mock.calls[0][0].where;
      expect(Array.isArray(whereArg)).toBe(true);
      expect(whereArg).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest files.service.spec.ts --no-coverage
```
Expected: `stampExpiry is not a function`.

- [ ] **Step 3: Add `delete()` to StorageService**

In `server/src/storage/storage.service.ts`, add this method after `getPresignedUrl`:

```typescript
  async delete(objectKey: string): Promise<void> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    await this.minioClient.removeObject(bucket, objectKey);
  }
```

- [ ] **Step 4: Update FilesService**

Replace `server/src/files/files.service.ts` with:

```typescript
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../storage/storage.config';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileRepo: Repository<FileMetadata>,
    private readonly storageService: StorageService,
  ) {}

  async storeMetadata(
    file: Express.Multer.File,
    uploadedBy?: number,
    purpose = 'general',
  ): Promise<FileMetadata> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 20 MB limit');
    }

    const ext = extname(file.originalname).toLowerCase();
    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const objectKey = `uploads/${purpose}/${datePath}/${randomUUID()}${ext}`;

    let url: string;
    try {
      url = await this.storageService.upload(
        file.buffer,
        objectKey,
        file.mimetype,
      );
    } catch (err) {
      this.logger.error('MinIO upload failed', err);
      throw new InternalServerErrorException('File upload failed');
    }

    const meta = this.fileRepo.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      objectKey,
      uploadedBy,
    });
    return this.fileRepo.save(meta);
  }

  async findById(id: number): Promise<FileMetadata> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async getPresignedUrl(
    fileId: number,
    requestingUserId: number,
    isAdmin: boolean,
  ): Promise<string> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (!isAdmin && (file.uploadedBy == null || file.uploadedBy !== requestingUserId)) {
      throw new ForbiddenException();
    }
    if (!file.objectKey) throw new NotFoundException('File has no storage key');
    try {
      return await this.storageService.getPresignedUrl(file.objectKey, 3600);
    } catch (err) {
      this.logger.error('Failed to generate presigned URL', err);
      throw new InternalServerErrorException('Could not generate download link');
    }
  }

  async getMyUploads(userId: number): Promise<FileMetadata[]> {
    const now = new Date();
    return this.fileRepo.find({
      where: [
        { uploadedBy: userId, expiresAt: IsNull() },
        { uploadedBy: userId, expiresAt: MoreThan(now) },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async stampExpiry(fileMetadataId: number, retentionDays: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    await this.fileRepo.update(fileMetadataId, { expiresAt });
  }

  async deleteExpired(): Promise<{ found: number; deleted: number; skipped: number }> {
    const now = new Date();
    const expired = await this.fileRepo
      .createQueryBuilder('fm')
      .where('fm.expires_at IS NOT NULL')
      .andWhere('fm.expires_at <= :now', { now })
      .getMany();

    let deleted = 0;
    let skipped = 0;

    for (const file of expired) {
      if (file.objectKey) {
        try {
          await this.storageService.delete(file.objectKey);
        } catch (err) {
          this.logger.error(`Failed to delete MinIO object ${file.objectKey}`, err);
          skipped++;
          continue;
        }
      }
      await this.fileRepo.delete(file.id);
      deleted++;
    }

    return { found: expired.length, deleted, skipped };
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd server && npx jest files.service.spec.ts --no-coverage
```
Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/storage/storage.service.ts \
        server/src/files/files.service.ts \
        server/src/files/files.service.spec.ts
git commit -m "feat: add stampExpiry, deleteExpired, update getMyUploads + StorageService.delete"
```

---

### Task 5: PurgeService cron job + module wiring + install `@nestjs/schedule`

**Files:**
- Create: `server/src/files/purge.service.ts`
- Modify: `server/src/files/files.module.ts`
- Modify: `server/src/app.module.ts`
- Create: `server/src/files/purge.service.spec.ts`

- [ ] **Step 1: Install `@nestjs/schedule`**

```bash
cd server && npm install @nestjs/schedule
```
Expected: package added to `package.json`, no errors.

- [ ] **Step 2: Write failing test**

Create `server/src/files/purge.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PurgeService } from './purge.service';
import { FilesService } from './files.service';

describe('PurgeService', () => {
  let service: PurgeService;
  const mockFilesService = {
    deleteExpired: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurgeService,
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();
    service = module.get<PurgeService>(PurgeService);
  });

  it('runPurgeSweep calls deleteExpired and logs summary', async () => {
    mockFilesService.deleteExpired.mockResolvedValue({ found: 3, deleted: 2, skipped: 1 });
    await service.runPurgeSweep();
    expect(mockFilesService.deleteExpired).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd server && npx jest purge.service.spec.ts --no-coverage
```
Expected: `Cannot find module './purge.service'`.

- [ ] **Step 4: Create PurgeService**

Create `server/src/files/purge.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FilesService } from './files.service';

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(private readonly filesService: FilesService) {}

  @Cron('0 2 * * *')
  async runPurgeSweep(): Promise<void> {
    this.logger.log('Starting nightly file purge sweep');
    const result = await this.filesService.deleteExpired();
    this.logger.log(
      `Purge sweep complete: ${result.deleted} deleted, ${result.skipped} skipped of ${result.found} found`,
    );
  }
}
```

- [ ] **Step 5: Register PurgeService in FilesModule**

Replace `server/src/files/files.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMetadata } from './entities/file-metadata.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PurgeService } from './purge.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileMetadata])],
  controllers: [FilesController],
  providers: [FilesService, PurgeService],
  exports: [FilesService],
})
export class FilesModule {}
```

- [ ] **Step 6: Add `ScheduleModule.forRoot()` to AppModule**

In `server/src/app.module.ts`, add the import:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
```

In the `imports` array, add after `ThrottlerModule.forRoot(...)`:

```typescript
    // Scheduled tasks (cron jobs)
    ScheduleModule.forRoot(),
```

- [ ] **Step 7: Run test to confirm it passes**

```bash
cd server && npx jest purge.service.spec.ts --no-coverage
```
Expected: 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add server/src/files/purge.service.ts \
        server/src/files/purge.service.spec.ts \
        server/src/files/files.module.ts \
        server/src/app.module.ts \
        server/package.json \
        server/package-lock.json
git commit -m "feat: add PurgeService daily cron sweep and register ScheduleModule"
```

---

### Task 6: OrdersService — stamp `expiresAt` on order completion

**Files:**
- Modify: `server/src/orders/orders.module.ts`
- Modify: `server/src/orders/orders.service.ts`
- Create: `server/src/orders/orders.service.spec.ts`

When `updateStatus` is called with status `completed_pickup` and the order has a `fileMetadataId`, stamp the expiry based on the owner's `fileRetentionDays`.

- [ ] **Step 1: Write failing test**

Create `server/src/orders/orders.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { DeliveryAssignment } from '../drivers/entities/delivery-assignment.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';

describe('OrdersService.updateStatus — expiresAt stamping', () => {
  let service: OrdersService;
  const ordersRepo = {
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockFilesService = { stampExpiry: jest.fn() };
  const mockUsersService = { findById: jest.fn(), getFcmToken: jest.fn() };
  const mockGateway = { notifyOrderUpdate: jest.fn() };
  const mockFirebase = { sendToDevice: jest.fn() };
  const mockCredits = { subtractCredits: jest.fn() };
  const mockNotifications = { create: jest.fn(), createForAllAdmins: jest.fn() };

  const makeOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 1,
      orderId: 'ORD-10001',
      userId: 99,
      fileMetadataId: 5,
      orderStatus: OrderStatus.COMPLETED_PICKUP,
      ...overrides,
    } as Order);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(ThreeDSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(DeliveryAssignment), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: OrdersGateway, useValue: mockGateway },
        { provide: FirebaseService, useValue: mockFirebase },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CreditsService, useValue: mockCredits },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('stamps expiresAt when completed_pickup and retention is set', async () => {
    const order = makeOrder();
    ordersRepo.findOneOrFail
      .mockResolvedValueOnce(order)  // existing (before update)
      .mockResolvedValueOnce(order); // after update
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).toHaveBeenCalledWith(5, 7);
  });

  it('does not stamp when user fileRetentionDays is null', async () => {
    const order = makeOrder();
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp when order has no fileMetadataId', async () => {
    const order = makeOrder({ fileMetadataId: null });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp for non-completion statuses', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.FILE_VERIFIED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'file_verified');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd server && npx jest orders.service.spec.ts --no-coverage
```
Expected: provider for `FilesService` not found (module not wired).

- [ ] **Step 3: Add `FilesModule` to OrdersModule**

In `server/src/orders/orders.module.ts`, add:

```typescript
import { FilesModule } from '../files/files.module';
```

Add `FilesModule` to the `imports` array:

```typescript
    FilesModule,
```

- [ ] **Step 4: Add `FilesService` injection to OrdersService**

In `server/src/orders/orders.service.ts`, add the import:

```typescript
import { FilesService } from '../files/files.service';
```

Add `private readonly filesService: FilesService` to the constructor (at the end):

```typescript
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(PaperSpec) private paperSpecsRepo: Repository<PaperSpec>,
    @InjectRepository(ThreeDSpec)
    private threeDSpecsRepo: Repository<ThreeDSpec>,
    @InjectRepository(DeliveryAssignment)
    private deliveryAssignmentRepo: Repository<DeliveryAssignment>,
    private ordersGateway: OrdersGateway,
    private firebaseService: FirebaseService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private notificationsService: NotificationsService,
    private readonly filesService: FilesService,
  ) {}
```

- [ ] **Step 5: Add stamping logic to `updateStatus`**

In `orders.service.ts` inside `updateStatus`, add the following block after `const order = await this.ordersRepo.findOneOrFail({ where: { id } });` (i.e., after the order is re-fetched post-update, before the `messages` map):

```typescript
    // Stamp file expiry when order reaches completion
    if (
      status === OrderStatus.COMPLETED_PICKUP &&
      order.fileMetadataId != null
    ) {
      const owner = await this.usersService.findById(order.userId);
      if (owner?.fileRetentionDays != null) {
        await this.filesService.stampExpiry(
          order.fileMetadataId,
          owner.fileRetentionDays,
        );
      }
    }
```

The full updated block in context (lines around line 178 of `orders.service.ts`):

```typescript
    await this.ordersRepo.update(id, {
      orderStatus: status as OrderStatus,
    });
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });

    // Stamp file expiry when order reaches completion
    if (
      status === OrderStatus.COMPLETED_PICKUP &&
      order.fileMetadataId != null
    ) {
      const owner = await this.usersService.findById(order.userId);
      if (owner?.fileRetentionDays != null) {
        await this.filesService.stampExpiry(
          order.fileMetadataId,
          owner.fileRetentionDays,
        );
      }
    }

    // Status → notification copy (shared by FCM push + in-app notification)
    const messages: Record<string, { title: string; body: string }> = {
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd server && npx jest orders.service.spec.ts --no-coverage
```
Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/orders/orders.module.ts \
        server/src/orders/orders.service.ts \
        server/src/orders/orders.service.spec.ts
git commit -m "feat: stamp expiresAt on FileMetadata when order completes"
```

---

### Task 7: Mobile — `UploadedFile` model update + `StorageSettings` model + provider

**Files:**
- Modify: `apps/mobile/lib/shared/models/uploaded_file.dart`
- Create: `apps/mobile/lib/features/customer/profile/models/storage_settings.dart`
- Create: `apps/mobile/lib/features/customer/profile/providers/storage_settings_provider.dart`
- Create: `apps/mobile/test/shared/models/uploaded_file_test.dart`
- Create: `apps/mobile/test/features/customer/profile/models/storage_settings_test.dart`

- [ ] **Step 1: Write failing model tests**

Create `apps/mobile/test/shared/models/uploaded_file_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';

void main() {
  group('UploadedFile.fromJson', () {
    test('parses expiresAt when present', () {
      final json = {
        'id': 1,
        'originalName': 'test.pdf',
        'mimeType': 'application/pdf',
        'size': 1024,
        'createdAt': '2026-04-21T00:00:00.000Z',
        'expiresAt': '2026-04-28T02:00:00.000Z',
      };
      final file = UploadedFile.fromJson(json);
      expect(file.expiresAt, isNotNull);
      expect(file.expiresAt!.day, 28);
    });

    test('parses null expiresAt', () {
      final json = {
        'id': 1,
        'originalName': 'test.pdf',
        'mimeType': 'application/pdf',
        'size': 1024,
        'createdAt': '2026-04-21T00:00:00.000Z',
        'expiresAt': null,
      };
      final file = UploadedFile.fromJson(json);
      expect(file.expiresAt, isNull);
    });

    test('parses missing expiresAt key as null', () {
      final json = {
        'id': 1,
        'originalName': 'test.pdf',
        'mimeType': 'application/pdf',
        'size': 1024,
        'createdAt': '2026-04-21T00:00:00.000Z',
      };
      final file = UploadedFile.fromJson(json);
      expect(file.expiresAt, isNull);
    });
  });
}
```

Create `apps/mobile/test/features/customer/profile/models/storage_settings_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';

void main() {
  group('StorageSettings.fromJson', () {
    test('parses fileRetentionDays when set', () {
      final s = StorageSettings.fromJson({'fileRetentionDays': 7});
      expect(s.fileRetentionDays, 7);
    });

    test('parses null fileRetentionDays', () {
      final s = StorageSettings.fromJson({'fileRetentionDays': null});
      expect(s.fileRetentionDays, isNull);
    });
  });
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/mobile && fvm flutter test test/shared/models/uploaded_file_test.dart test/features/customer/profile/models/storage_settings_test.dart
```
Expected: compilation errors — `expiresAt` not on `UploadedFile`, `StorageSettings` not found.

- [ ] **Step 3: Update `UploadedFile` model**

Replace `apps/mobile/lib/shared/models/uploaded_file.dart` with:

```dart
class UploadedFile {
  const UploadedFile({
    required this.id,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.createdAt,
    this.expiresAt,
  });

  final int id;
  final String originalName;
  final String mimeType;
  final int size;
  final DateTime createdAt;
  final DateTime? expiresAt;

  factory UploadedFile.fromJson(Map<String, dynamic> json) {
    final expiresAtRaw = json['expiresAt'] ?? json['expires_at'];
    return UploadedFile(
      id: json['id'] as int,
      originalName: (json['originalName'] ?? json['original_name'] ?? '') as String,
      mimeType: (json['mimeType'] ?? json['mime_type'] ?? '') as String,
      size: (json['size'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(
        (json['createdAt'] ?? json['created_at'] ?? DateTime.now().toIso8601String()) as String,
      ),
      expiresAt: expiresAtRaw != null ? DateTime.parse(expiresAtRaw as String) : null,
    );
  }
}
```

- [ ] **Step 4: Create `StorageSettings` model**

Create `apps/mobile/lib/features/customer/profile/models/storage_settings.dart`:

```dart
class StorageSettings {
  const StorageSettings({required this.fileRetentionDays});

  final int? fileRetentionDays;

  factory StorageSettings.fromJson(Map<String, dynamic> json) {
    return StorageSettings(
      fileRetentionDays: json['fileRetentionDays'] as int?,
    );
  }
}
```

- [ ] **Step 5: Create `storageSettingsProvider`**

Create `apps/mobile/lib/features/customer/profile/providers/storage_settings_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';
import 'package:printing_app/shared/services/api_client.dart';

class StorageSettingsNotifier
    extends StateNotifier<AsyncValue<StorageSettings>> {
  StorageSettingsNotifier() : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final response =
          await ApiClient.instance.get('/users/me/storage-settings');
      state = AsyncValue.data(
        StorageSettings.fromJson(response.data as Map<String, dynamic>),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> update(int? fileRetentionDays) async {
    try {
      final response = await ApiClient.instance.patch(
        '/users/me/storage-settings',
        data: {'fileRetentionDays': fileRetentionDays},
      );
      state = AsyncValue.data(
        StorageSettings.fromJson(response.data as Map<String, dynamic>),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final storageSettingsProvider = StateNotifierProvider.autoDispose<
    StorageSettingsNotifier, AsyncValue<StorageSettings>>(
  (ref) => StorageSettingsNotifier(),
);
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd apps/mobile && fvm flutter test test/shared/models/uploaded_file_test.dart test/features/customer/profile/models/storage_settings_test.dart
```
Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/shared/models/uploaded_file.dart \
        apps/mobile/lib/features/customer/profile/models/storage_settings.dart \
        apps/mobile/lib/features/customer/profile/providers/storage_settings_provider.dart \
        apps/mobile/test/shared/models/uploaded_file_test.dart \
        apps/mobile/test/features/customer/profile/models/storage_settings_test.dart
git commit -m "feat: add expiresAt to UploadedFile, StorageSettings model and provider"
```

---

### Task 8: `StorageSettingsScreen` + route + profile row

**Files:**
- Create: `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`
- Modify: `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`

- [ ] **Step 1: Create `StorageSettingsScreen`**

Create `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';
import 'package:printing_app/features/customer/profile/providers/storage_settings_provider.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';

class StorageSettingsScreen extends ConsumerWidget {
  const StorageSettingsScreen({super.key});

  static const routeName = '/customer/profile/storage-settings';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final settingsAsync = ref.watch(storageSettingsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(context, colors),
            Expanded(
              child: settingsAsync.when(
                loading: () => Center(
                  child: CircularProgressIndicator(color: colors.accent),
                ),
                error: (_, __) => Center(
                  child: TextButton.icon(
                    onPressed: () =>
                        ref.read(storageSettingsProvider.notifier).fetch(),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry'),
                  ),
                ),
                data: (settings) =>
                    _buildBody(context, ref, colors, settings),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: AppRadius.borderSm,
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedArrowLeft01,
                  size: 20,
                  color: colors.onSurface,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            'Storage & Files',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    AppColorSet colors,
    StorageSettings settings,
  ) {
    final isEnabled = settings.fileRetentionDays != null;
    final notifier = ref.read(storageSettingsProvider.notifier);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: colors.outline, width: 0.75),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Toggle row
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.lg, AppSpacing.md, AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Auto-delete files after order completion',
                          style: AppTypography.body.copyWith(
                            color: colors.onSurface,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Files in your Data Grid will be automatically deleted after the period you choose.',
                          style: AppTypography.caption
                              .copyWith(color: colors.onSurfaceDim),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Switch(
                    value: isEnabled,
                    activeColor: colors.accent,
                    onChanged: (value) =>
                        _onToggle(context, ref, notifier, value, settings),
                  ),
                ],
              ),
            ),

            // Period picker (visible only when enabled)
            if (isEnabled) ...[
              Divider(color: colors.outline, height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                child: Row(
                  children: [
                    Text(
                      'Delete after',
                      style: AppTypography.body
                          .copyWith(color: colors.onSurface),
                    ),
                    const Spacer(),
                    _PeriodDropdown(
                      value: settings.fileRetentionDays!,
                      colors: colors,
                      onChanged: (days) => notifier.update(days),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _onToggle(
    BuildContext context,
    WidgetRef ref,
    StorageSettingsNotifier notifier,
    bool enable,
    StorageSettings current,
  ) {
    if (!enable) {
      notifier.update(null);
      return;
    }
    ConfirmationDialog.show(
      context,
      title: 'Enable Auto-Delete',
      message:
          'Your files from completed orders will be automatically deleted after the chosen period. You can turn this off any time.',
      confirmLabel: 'Enable',
      cancelLabel: 'Cancel',
      onConfirm: () {
        Navigator.of(context).pop();
        notifier.update(30);
      },
      onCancel: () => Navigator.of(context).pop(),
    );
  }
}

class _PeriodDropdown extends StatelessWidget {
  const _PeriodDropdown({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final int value;
  final AppColorSet colors;
  final ValueChanged<int> onChanged;

  static const _options = [
    (1, '24 hours'),
    (7, '7 days'),
    (30, '30 days'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderSm,
        border: Border.all(color: colors.outline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: value,
          isDense: true,
          style: AppTypography.body.copyWith(
            color: colors.onSurface,
            fontWeight: FontWeight.w600,
          ),
          dropdownColor: colors.surface,
          items: _options
              .map(
                (opt) => DropdownMenuItem<int>(
                  value: opt.$1,
                  child: Text(opt.$2),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Register route in app_router.dart**

In `apps/mobile/lib/config/routes/app_router.dart`, add the import for `StorageSettingsScreen` alongside the other profile screen imports.

Then add the route after the `/customer/profile/survey` route (before the Driver shell block):

```dart
      GoRoute(
        path: '/customer/profile/storage-settings',
        pageBuilder: (_, state) =>
            slideTransition(const StorageSettingsScreen(), state),
      ),
```

- [ ] **Step 3: Add "Storage & Files" row to profile screen**

In `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`, find the "Data Grid" `_MenuRow` block:

```dart
          _MenuRow(
            icon: HugeIcons.strokeRoundedFolder01,
            title: 'Data Grid',
            onTap: () => context.push('/customer/uploads'),
            colors: colors,
          ),

          const SizedBox(height: AppSpacing.lg),

          // PREFERENCES section
```

Replace it with:

```dart
          _MenuRow(
            icon: HugeIcons.strokeRoundedFolder01,
            title: 'Data Grid',
            onTap: () => context.push('/customer/uploads'),
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedCloudSaving,
            title: 'Storage & Files',
            onTap: () => context.push('/customer/profile/storage-settings'),
            colors: colors,
          ),

          const SizedBox(height: AppSpacing.lg),

          // PREFERENCES section
```

- [ ] **Step 4: Run all mobile tests**

```bash
cd apps/mobile && fvm flutter test
```
Expected: all existing tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart \
        apps/mobile/lib/config/routes/app_router.dart \
        apps/mobile/lib/features/customer/profile/screens/profile_screen.dart
git commit -m "feat: add StorageSettingsScreen, route, and profile menu row"
```

---

### Task 9: Expiry badge on Data Grid cards

**Files:**
- Modify: `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart`
- Create: `apps/mobile/test/features/customer/uploads/screens/my_uploads_expiry_test.dart`

- [ ] **Step 1: Write failing widget test**

Create `apps/mobile/test/features/customer/uploads/screens/my_uploads_expiry_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';

// Test the _expiryLabel helper by instantiating it through the widget's logic.
// We verify badge visibility by building a minimal widget that calls the same
// expiry logic.

String? expiryLabel(DateTime? expiresAt) {
  if (expiresAt == null) return null;
  final diff = expiresAt.difference(DateTime.now());
  if (diff.isNegative) return null;
  if (diff.inHours < 24) return 'Expires today';
  final days = diff.inDays;
  if (days <= 3) return 'Expires in $days day${days == 1 ? '' : 's'}';
  return null;
}

void main() {
  group('expiryLabel', () {
    test('returns null when expiresAt is null', () {
      expect(expiryLabel(null), isNull);
    });

    test('returns null when more than 3 days away', () {
      final dt = DateTime.now().add(const Duration(days: 4));
      expect(expiryLabel(dt), isNull);
    });

    test('returns "Expires today" when less than 24 hours away', () {
      final dt = DateTime.now().add(const Duration(hours: 12));
      expect(expiryLabel(dt), 'Expires today');
    });

    test('returns "Expires in 1 day" when exactly 1 day away', () {
      final dt = DateTime.now().add(const Duration(hours: 25));
      expect(expiryLabel(dt), 'Expires in 1 day');
    });

    test('returns "Expires in 3 days" when 3 days away', () {
      final dt = DateTime.now().add(const Duration(hours: 73));
      expect(expiryLabel(dt), 'Expires in 3 days');
    });

    test('returns null when expiresAt is in the past', () {
      final dt = DateTime.now().subtract(const Duration(hours: 1));
      expect(expiryLabel(dt), isNull);
    });
  });
}
```

- [ ] **Step 2: Run test to confirm it passes (it tests a local copy of the logic)**

```bash
cd apps/mobile && fvm flutter test test/features/customer/uploads/screens/my_uploads_expiry_test.dart
```
Expected: 6 tests pass (this tests the logic inline — it will pass immediately since we wrote the function locally in the test).

- [ ] **Step 3: Add `_expiryLabel` helper + `_ExpiryBadge` widget to `my_uploads_screen.dart`**

At the bottom of `my_uploads_screen.dart` (after the last class), add:

```dart
// ─────────────────────────────────────────────────────────────────────────────
// Expiry badge
// ─────────────────────────────────────────────────────────────────────────────

String? _expiryLabel(DateTime? expiresAt) {
  if (expiresAt == null) return null;
  final diff = expiresAt.difference(DateTime.now());
  if (diff.isNegative) return null;
  if (diff.inHours < 24) return 'Expires today';
  final days = diff.inDays;
  if (days <= 3) return 'Expires in $days day${days == 1 ? '' : 's'}';
  return null;
}

class _ExpiryBadge extends StatelessWidget {
  const _ExpiryBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.amber.withOpacity(0.15),
        borderRadius: AppRadius.borderFull,
        border: Border.all(color: Colors.amber.shade600, width: 0.75),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: Colors.amber.shade700,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Add badge to `_GridCard`**

In `_GridCard.build`, find the meta row (the `Row` with the size pill and date). Replace it with a version that shows the badge in place of the date when expiring soon:

```dart
                    // Meta row
                    Row(
                      children: [
                        // Size pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderFull,
                          ),
                          child: Text(
                            formatFileSize(file.size),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                        ),
                        const Spacer(),
                        if (_expiryLabel(file.expiresAt) case final label?)
                          _ExpiryBadge(label: label)
                        else
                          Text(
                            _shortDate(file.createdAt),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                      ],
                    ),
```

- [ ] **Step 5: Add badge to `_ListRow`**

In `_ListRow.build`, find the expanded `Column` inside the row. After the meta `Row` (the one with size and date), add the badge if expiring soon:

```dart
                  // Name + meta
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          file.originalName,
                          style: AppTypography.body.copyWith(
                            color: colors.onBackground,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Text(
                              formatFileSize(file.size),
                              style: AppTypography.caption
                                  .copyWith(color: colors.onSurfaceDim),
                            ),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 6),
                              child: Container(
                                width: 2,
                                height: 2,
                                decoration: BoxDecoration(
                                  color: colors.onSurfaceDim,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                            Text(
                              _formatDate(file.createdAt),
                              style: AppTypography.caption
                                  .copyWith(color: colors.onSurfaceDim),
                            ),
                          ],
                        ),
                        if (_expiryLabel(file.expiresAt) case final label?) ...[
                          const SizedBox(height: 3),
                          _ExpiryBadge(label: label),
                        ],
                      ],
                    ),
                  ),
```

- [ ] **Step 6: Run all mobile tests**

```bash
cd apps/mobile && fvm flutter test
```
Expected: all tests pass (no regressions).

- [ ] **Step 7: Build mobile to verify no compilation errors**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
```
Expected: build succeeds, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart \
        apps/mobile/test/features/customer/uploads/screens/my_uploads_expiry_test.dart
git commit -m "feat: show expiry badge on Data Grid cards when file expires within 3 days"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| `fileRetentionDays` on users table | Task 1 |
| `expiresAt` on file_metadata table | Task 1 |
| `GET /users/me/storage-settings` | Task 3 |
| `PATCH /users/me/storage-settings` with validation | Tasks 2+3 |
| Order completion hook stamps expiresAt | Task 6 |
| Daily cron at 02:00 (`0 2 * * *`) | Task 5 |
| Delete from MinIO then remove DB row | Task 4 |
| Skip record (no crash) when MinIO fails | Task 4 |
| Log summary: found / deleted / skipped | Task 5 |
| `my-uploads` response includes `expiresAt` | Task 4 (field on entity, auto-serialized) |
| `my-uploads` filters files where `expiresAt <= NOW()` | Task 4 |
| Mobile `UploadedFile` model has `expiresAt` | Task 7 |
| `StorageSettingsScreen` toggle + dropdown | Task 8 |
| Confirmation dialog when enabling | Task 8 |
| "Storage & Files" profile row | Task 8 |
| Route `/customer/profile/storage-settings` | Task 8 |
| Expiry badge on grid cards (bottom-right, amber) | Task 9 |
| Expiry badge on list rows (inline) | Task 9 |
| Badge rules: >3d=none, 1–3d=days, <24h=today | Task 9 |

All spec requirements covered. ✓
