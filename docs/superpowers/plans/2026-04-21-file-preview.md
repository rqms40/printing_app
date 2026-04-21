# File Preview & My Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MinIO bucket private, add presigned-URL and my-uploads endpoints, fix the upload screen to show real progress and file thumbnails, add a My Uploads screen, and wire preview buttons into customer order detail, admin mobile order detail, and admin web OrderDetail.

**Architecture:** StorageService gains `getPresignedUrl()` and loses the public-read bucket policy. FilesController exposes `GET /files/my-uploads` and `GET /files/:id/presigned-url`, both JWT-guarded with ownership/admin checks. Mobile adds `FileTypeIcon`, `FilePreviewSheet`, and `MyUploadsScreen`. The upload screen replaces the fake timer animation with real Dio `onSendProgress`. Orders gain a nullable `fileMetadataId` FK so all three detail views can look up presigned URLs.

**Tech Stack:** NestJS, MinIO JS SDK, TypeORM, Flutter (`syncfusion_flutter_pdfviewer`, `cached_network_image`, `url_launcher` — last two already in pubspec), React + inline fetch (admin web)

---

## File Map

| Layer | File | Action |
|-------|------|--------|
| Server | `server/src/storage/storage.service.ts` | Remove public-read policy; add `getPresignedUrl()` |
| Server | `server/src/storage/storage.service.spec.ts` | Update existing test; add presigned URL test |
| Server | `server/src/files/files.service.ts` | Add `getPresignedUrl()` + `getMyUploads()` |
| Server | `server/src/files/files.service.spec.ts` | Add 6 new tests |
| Server | `server/src/files/files.controller.ts` | Add `my-uploads` + `:id/presigned-url` endpoints |
| Server | `server/src/files/dto/presigned-url.dto.ts` | CREATE — `{ url: string }` response DTO |
| Server | `server/src/orders/entities/order.entity.ts` | Add `fileMetadataId` nullable column |
| Server | `server/src/orders/dto/create-order.dto.ts` | Add optional `fileMetadataId` field |
| Mobile | `apps/mobile/pubspec.yaml` | Add `syncfusion_flutter_pdfviewer` |
| Mobile | `apps/mobile/lib/shared/widgets/file_type_icon.dart` | CREATE — icon keyed on mimeType |
| Mobile | `apps/mobile/lib/shared/widgets/file_preview_sheet.dart` | CREATE — bottom sheet with presigned URL fetch + render |
| Mobile | `apps/mobile/lib/shared/models/uploaded_file.dart` | CREATE — `UploadedFile` model |
| Mobile | `apps/mobile/lib/features/customer/order/providers/order_provider.dart` | Add `fileMetadataId` to state |
| Mobile | `apps/mobile/lib/shared/models/order.dart` | Add `fileMetadataId: int?` |
| Mobile | `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart` | Parse `fileMetadataId` + send in `addOrder` |
| Mobile | `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` | Real Dio progress; store `fileMetadataId`; remove fake timer |
| Mobile | `apps/mobile/lib/features/customer/order/widgets/file_upload_card.dart` | Add thumbnail/icon via new params |
| Mobile | `apps/mobile/lib/features/customer/uploads/providers/my_uploads_provider.dart` | CREATE — fetch + cache uploads list |
| Mobile | `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart` | CREATE — 2-column grid screen |
| Mobile | `apps/mobile/lib/config/routes/app_router.dart` | Register `/customer/uploads` route |
| Mobile | `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` | Add My Uploads row |
| Mobile | `apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart` | Add Preview button in file section |
| Mobile | `apps/mobile/lib/features/admin/queue/screens/admin_order_detail_screen.dart` | Add Preview button in file section |
| Admin web | `apps/admin-web/src/types/index.ts` | Add `fileMetadataId?: number` to Order |
| Admin web | `apps/admin-web/src/services/api.ts` | CREATE — `getPresignedUrl()` helper |
| Admin web | `apps/admin-web/src/views/OrderDetail.tsx` | Add preview button + modal |

---

## Task 1: Server — StorageService: private bucket + getPresignedUrl

**Files:**
- Modify: `server/src/storage/storage.service.ts`
- Modify: `server/src/storage/storage.service.spec.ts`

- [ ] **Step 1: Add `presignedGetObject` mock to the spec**

Open `server/src/storage/storage.service.spec.ts`. Change `mockMinioClient` to include the new method and update the existing bucket-creation test name:

```typescript
const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  setBucketPolicy: jest.fn(),
  putObject: jest.fn(),
  presignedGetObject: jest.fn(),
};
```

- [ ] **Step 2: Write the failing presigned-URL test**

Add inside `describe('StorageService')`, after the `upload` describe block:

```typescript
describe('getPresignedUrl', () => {
  it('calls presignedGetObject with correct bucket, key, expiry and returns URL', async () => {
    const fakeUrl = 'http://localhost:9000/test-bucket/uploads/general/2026/04/21/uuid.jpg?X-Amz-Signature=abc';
    mockMinioClient.presignedGetObject.mockResolvedValue(fakeUrl);

    const result = await service.getPresignedUrl('uploads/general/2026/04/21/uuid.jpg', 3600);

    expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
      'test-bucket',
      'uploads/general/2026/04/21/uuid.jpg',
      3600,
    );
    expect(result).toBe(fakeUrl);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
cd /home/jd/projects/printing_app/server
npx jest storage.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `service.getPresignedUrl is not a function`

- [ ] **Step 4: Implement `getPresignedUrl` + remove public-read policy in StorageService**

Replace the full contents of `server/src/storage/storage.service.ts`:

```typescript
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MINIO_CLIENT } from './storage.constants';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(MINIO_CLIENT) private readonly minioClient: Client,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    try {
      const exists = await this.minioClient.bucketExists(bucket);
      if (!exists) {
        await this.minioClient.makeBucket(bucket);
        this.logger.log(`Bucket '${bucket}' created (private)`);
      }
    } catch (err) {
      this.logger.error(`Failed to initialize MinIO bucket '${bucket}'`, err);
      throw err;
    }
  }

  async upload(
    buffer: Buffer,
    objectKey: string,
    mimeType: string,
  ): Promise<string> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    await this.minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const scheme = useSSL ? 'https' : 'http';
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.config.get<number>('MINIO_PORT', 9000);
    return `${scheme}://${endpoint}:${port}/${bucket}/${objectKey}`;
  }

  async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    return this.minioClient.presignedGetObject(bucket, objectKey, expirySeconds);
  }
}
```

- [ ] **Step 5: Update the existing bucket-creation test to NOT check setBucketPolicy**

In `storage.service.spec.ts`, update the test named `'creates bucket with public-read policy when it does not exist'`:

```typescript
it('creates bucket when it does not exist (no public-read policy)', async () => {
  mockMinioClient.bucketExists.mockResolvedValue(false);
  mockMinioClient.makeBucket.mockResolvedValue(undefined);
  await service.onModuleInit();
  expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
  expect(mockMinioClient.setBucketPolicy).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run all storage tests**

```bash
cd /home/jd/projects/printing_app/server
npx jest storage.service.spec --no-coverage 2>&1 | tail -20
```

Expected: `Tests: 4 passed, 4 total` (2 init + 2 upload + 1 presigned = 5 with new test)

- [ ] **Step 7: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/storage/storage.service.ts server/src/storage/storage.service.spec.ts
git commit -m "feat(server): make bucket private and add getPresignedUrl to StorageService"
```

---

## Task 2: Server — FilesService: getPresignedUrl + getMyUploads

**Files:**
- Modify: `server/src/files/files.service.ts`
- Modify: `server/src/files/files.service.spec.ts`

- [ ] **Step 1: Write failing tests first**

Open `server/src/files/files.service.spec.ts`. Add `getPresignedUrl: jest.fn()` to `mockStorageService`:

```typescript
const mockStorageService = {
  upload: jest.fn(),
  getPresignedUrl: jest.fn(),
};
```

Add a new `describe('getPresignedUrl')` block and a `describe('getMyUploads')` block after the existing `storeMetadata` tests:

```typescript
describe('getPresignedUrl', () => {
  const makeFileMeta = (overrides: Partial<any> = {}) => ({
    id: 1,
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    url: 'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg',
    objectKey: 'uploads/general/2026/04/21/uuid.jpg',
    uploadedBy: 42,
    createdAt: new Date(),
    ...overrides,
  });

  it('returns presigned URL when owner requests own file', async () => {
    const fileMeta = makeFileMeta();
    mockFileRepo.findOne.mockResolvedValue(fileMeta);
    mockStorageService.getPresignedUrl.mockResolvedValue('http://minio/presigned?sig=abc');

    const result = await service.getPresignedUrl(1, 42, false);

    expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
      'uploads/general/2026/04/21/uuid.jpg',
      3600,
    );
    expect(result).toBe('http://minio/presigned?sig=abc');
  });

  it('returns presigned URL when admin requests any file', async () => {
    const fileMeta = makeFileMeta({ uploadedBy: 99 });
    mockFileRepo.findOne.mockResolvedValue(fileMeta);
    mockStorageService.getPresignedUrl.mockResolvedValue('http://minio/presigned?sig=xyz');

    const result = await service.getPresignedUrl(1, 1, true);

    expect(result).toBe('http://minio/presigned?sig=xyz');
  });

  it('throws ForbiddenException when non-owner non-admin requests file', async () => {
    const fileMeta = makeFileMeta({ uploadedBy: 99 });
    mockFileRepo.findOne.mockResolvedValue(fileMeta);

    await expect(service.getPresignedUrl(1, 42, false)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when file does not exist', async () => {
    mockFileRepo.findOne.mockResolvedValue(null);

    await expect(service.getPresignedUrl(999, 42, false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when objectKey is null', async () => {
    mockFileRepo.findOne.mockResolvedValue(makeFileMeta({ objectKey: null }));

    await expect(service.getPresignedUrl(1, 42, false)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
  });
});

describe('getMyUploads', () => {
  it('returns files ordered by createdAt DESC for the given userId', async () => {
    const files = [
      { id: 2, uploadedBy: 42, createdAt: new Date('2026-04-21') },
      { id: 1, uploadedBy: 42, createdAt: new Date('2026-04-20') },
    ];
    mockFileRepo.find.mockResolvedValue(files);

    const result = await service.getMyUploads(42);

    expect(mockFileRepo.find).toHaveBeenCalledWith({
      where: { uploadedBy: 42 },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual(files);
  });
});
```

Add `ForbiddenException` to the import at top of the spec:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
```

Also add `find: jest.fn()` to `mockFileRepo`:

```typescript
const mockFileRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd /home/jd/projects/printing_app/server
npx jest files.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `service.getPresignedUrl is not a function`

- [ ] **Step 3: Implement the two new methods in FilesService**

Replace the full contents of `server/src/files/files.service.ts`:

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
import { Repository } from 'typeorm';
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
    if (!isAdmin && file.uploadedBy !== requestingUserId) {
      throw new ForbiddenException();
    }
    if (!file.objectKey) throw new NotFoundException('File has no storage key');
    return this.storageService.getPresignedUrl(file.objectKey, 3600);
  }

  async getMyUploads(userId: number): Promise<FileMetadata[]> {
    return this.fileRepo.find({
      where: { uploadedBy: userId },
      order: { createdAt: 'DESC' },
    });
  }
}
```

- [ ] **Step 4: Run all files service tests**

```bash
cd /home/jd/projects/printing_app/server
npx jest files.service.spec --no-coverage 2>&1 | tail -20
```

Expected: `Tests: 10 passed, 10 total`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/files/files.service.ts server/src/files/files.service.spec.ts
git commit -m "feat(server): add getPresignedUrl and getMyUploads to FilesService"
```

---

## Task 3: Server — FilesController: add endpoints + DTO

**Files:**
- Create: `server/src/files/dto/presigned-url.dto.ts`
- Modify: `server/src/files/files.controller.ts`

- [ ] **Step 1: Create PresignedUrlResponseDto**

Create `server/src/files/dto/presigned-url.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({ example: 'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg?X-Amz-Signature=...' })
  url: string;
}
```

- [ ] **Step 2: Add the two new endpoints to FilesController**

Replace the full contents of `server/src/files/files.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';
import { PresignedUrlResponseDto } from './dto/presigned-url.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    return this.filesService.storeMetadata(file, req.user?.sub);
  }

  // NOTE: 'my-uploads' must be declared before ':id' so the literal string
  // is not parsed as an integer by ParseIntPipe.
  @Get('my-uploads')
  getMyUploads(@Request() req: RequestWithUser) {
    return this.filesService.getMyUploads(req.user.sub);
  }

  @Get(':id/presigned-url')
  async getPresignedUrl(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ): Promise<PresignedUrlResponseDto> {
    const isAdmin = req.user.role === 'admin';
    const url = await this.filesService.getPresignedUrl(id, req.user.sub, isAdmin);
    return { url };
  }

  @Get(':id')
  getFile(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.findById(id);
  }
}
```

- [ ] **Step 3: Build and run all server tests**

```bash
cd /home/jd/projects/printing_app/server
npm run build 2>&1 | tail -10
npx jest --no-coverage 2>&1 | tail -20
```

Expected: build succeeds, all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/files/files.controller.ts server/src/files/dto/presigned-url.dto.ts
git commit -m "feat(server): add GET /files/my-uploads and GET /files/:id/presigned-url endpoints"
```

---

## Task 4: Server — Order entity + DTO: fileMetadataId

**Files:**
- Modify: `server/src/orders/entities/order.entity.ts`
- Modify: `server/src/orders/dto/create-order.dto.ts`

- [ ] **Step 1: Add fileMetadataId column to Order entity**

In `server/src/orders/entities/order.entity.ts`, add the new column after the `fileName` column (line 59):

```typescript
  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_metadata_id', nullable: true, type: 'int' })
  fileMetadataId: number | null;
```

- [ ] **Step 2: Add fileMetadataId to CreateOrderDto**

In `server/src/orders/dto/create-order.dto.ts`, add after the `fileUrl` field:

```typescript
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fileMetadataId?: number;
```

- [ ] **Step 3: Build to confirm no TypeScript errors**

```bash
cd /home/jd/projects/printing_app/server
npm run build 2>&1 | tail -10
```

Expected: `Successfully compiled`

TypeORM `synchronize: true` will add the `file_metadata_id` column automatically on next server restart — no migration needed for dev.

- [ ] **Step 4: Run full server test suite**

```bash
cd /home/jd/projects/printing_app/server
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/orders/entities/order.entity.ts server/src/orders/dto/create-order.dto.ts
git commit -m "feat(server): add nullable fileMetadataId FK to Order entity and DTO"
```

---

## Task 5: Mobile — pubspec.yaml + shared models/widgets

**Files:**
- Modify: `apps/mobile/pubspec.yaml`
- Create: `apps/mobile/lib/shared/models/uploaded_file.dart`
- Create: `apps/mobile/lib/shared/widgets/file_type_icon.dart`

- [ ] **Step 1: Add syncfusion_flutter_pdfviewer to pubspec.yaml**

In `apps/mobile/pubspec.yaml`, add under the `# File handling` section:

```yaml
  # File handling
  file_picker: ^8.1.6
  syncfusion_flutter_pdfviewer: ^28.1.33
```

Run:

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter pub get 2>&1 | tail -10
```

Expected: `Got dependencies!`

- [ ] **Step 2: Create the UploadedFile model**

Create `apps/mobile/lib/shared/models/uploaded_file.dart`:

```dart
class UploadedFile {
  const UploadedFile({
    required this.id,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.createdAt,
  });

  final int id;
  final String originalName;
  final String mimeType;
  final int size;
  final DateTime createdAt;

  factory UploadedFile.fromJson(Map<String, dynamic> json) {
    return UploadedFile(
      id: json['id'] as int,
      originalName: (json['originalName'] ?? json['original_name'] ?? '') as String,
      mimeType: (json['mimeType'] ?? json['mime_type'] ?? '') as String,
      size: (json['size'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(
        (json['createdAt'] ?? json['created_at'] ?? DateTime.now().toIso8601String()) as String,
      ),
    );
  }
}
```

- [ ] **Step 3: Create FileTypeIcon widget**

Create `apps/mobile/lib/shared/widgets/file_type_icon.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';

/// Displays a colored icon square representing a file type.
///
/// Used in file upload cards and My Uploads grid cells.
class FileTypeIcon extends StatelessWidget {
  const FileTypeIcon({
    super.key,
    required this.mimeType,
    this.size = 52,
  });

  final String? mimeType;
  final double size;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final (iconData, bgColor) = _resolve(mimeType, colors);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bgColor.withValues(alpha: 0.15),
        borderRadius: AppRadius.borderSm,
        border: Border.all(color: bgColor.withValues(alpha: 0.3)),
      ),
      child: Center(
        child: HugeIcon(icon: iconData, size: size * 0.5, color: bgColor),
      ),
    );
  }

  static (dynamic, Color) _resolve(String? mimeType, AppColorSet colors) {
    if (mimeType == null) {
      return (HugeIcons.strokeRoundedFile01, colors.onSurfaceDim);
    }
    if (mimeType.startsWith('image/')) {
      return (HugeIcons.strokeRoundedImage01, Colors.blue);
    }
    if (mimeType == 'application/pdf') {
      return (HugeIcons.strokeRoundedFile02, Colors.red);
    }
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return (HugeIcons.strokeRoundedDoc01, Colors.blue.shade700);
    }
    if (mimeType.contains('stl') || mimeType.contains('obj') || mimeType.contains('3mf')) {
      return (HugeIcons.strokeRoundedCube01, Colors.purple);
    }
    return (HugeIcons.strokeRoundedFile01, colors.onSurfaceDim);
  }
}
```

- [ ] **Step 4: Run analyze to verify no issues**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/shared/widgets/file_type_icon.dart lib/shared/models/uploaded_file.dart 2>&1
```

Expected: `No issues found!`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/pubspec.yaml apps/mobile/pubspec.lock apps/mobile/lib/shared/models/uploaded_file.dart apps/mobile/lib/shared/widgets/file_type_icon.dart
git commit -m "feat(mobile): add syncfusion_flutter_pdfviewer, UploadedFile model, FileTypeIcon widget"
```

---

## Task 6: Mobile — FilePreviewSheet widget

**Files:**
- Create: `apps/mobile/lib/shared/widgets/file_preview_sheet.dart`

- [ ] **Step 1: Create FilePreviewSheet**

Create `apps/mobile/lib/shared/widgets/file_preview_sheet.dart`:

```dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/utils/formatters.dart';

/// Displays a bottom sheet that fetches a presigned URL and renders the file.
///
/// Supports images (jpeg/png/webp), PDFs, and a fallback "Open in browser"
/// for unsupported types.
class FilePreviewSheet extends ConsumerStatefulWidget {
  const FilePreviewSheet({
    super.key,
    required this.fileId,
    required this.fileName,
    required this.mimeType,
    this.fileSize,
  });

  final int fileId;
  final String fileName;
  final String mimeType;
  final int? fileSize;

  /// Opens the sheet as a modal bottom sheet.
  static Future<void> show(
    BuildContext context, {
    required int fileId,
    required String fileName,
    required String mimeType,
    int? fileSize,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FilePreviewSheet(
        fileId: fileId,
        fileName: fileName,
        mimeType: mimeType,
        fileSize: fileSize,
      ),
    );
  }

  @override
  ConsumerState<FilePreviewSheet> createState() => _FilePreviewSheetState();
}

class _FilePreviewSheetState extends ConsumerState<FilePreviewSheet> {
  String? _presignedUrl;
  bool _loading = true;
  String? _error;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    _fetchPresignedUrl();
  }

  Future<void> _fetchPresignedUrl() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response =
          await ApiClient.instance.get('/files/${widget.fileId}/presigned-url');
      if (mounted) {
        setState(() {
          _presignedUrl = response.data['url'] as String?;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Couldn\'t load preview.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final height = MediaQuery.of(context).size.height * 0.85;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.outline,
              borderRadius: AppRadius.borderFull,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.fileName,
                        style: AppTypography.bodyBold
                            .copyWith(color: colors.onBackground),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (widget.fileSize != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          formatFileSize(widget.fileSize!),
                          style: AppTypography.caption
                              .copyWith(color: colors.onSurfaceDim),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, color: colors.onSurface),
                ),
              ],
            ),
          ),
          Divider(color: colors.outline, height: 1),
          Expanded(child: _buildContent(colors)),
        ],
      ),
    );
  }

  Widget _buildContent(AppColorSet colors) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null || _presignedUrl == null) {
      return _buildError(colors);
    }

    final url = _presignedUrl!;
    final mime = widget.mimeType;

    if (mime.startsWith('image/')) {
      return InteractiveViewer(
        child: Center(
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.contain,
            placeholder: (_, __) =>
                const Center(child: CircularProgressIndicator()),
            errorWidget: (_, __, ___) => _buildError(colors),
          ),
        ),
      );
    }

    if (mime == 'application/pdf') {
      return SfPdfViewer.network(url);
    }

    return _buildUnsupported(colors, url);
  }

  Widget _buildError(AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FileTypeIcon(mimeType: widget.mimeType, size: 64),
          const SizedBox(height: AppSpacing.lg),
          Text(
            _error ?? 'Preview unavailable',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          TextButton(
            onPressed: _fetchPresignedUrl,
            child: Text(
              'Retry',
              style: AppTypography.bodyBold.copyWith(color: colors.accent),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUnsupported(AppColorSet colors, String url) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FileTypeIcon(mimeType: widget.mimeType, size: 64),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Preview not available for this file type.',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: () => launchUrl(Uri.parse(url)),
            icon: const Icon(Icons.open_in_new_rounded, size: 16),
            label: const Text('Open in browser'),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Run analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/shared/widgets/file_preview_sheet.dart 2>&1
```

Expected: `No issues found!`

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/lib/shared/widgets/file_preview_sheet.dart
git commit -m "feat(mobile): add FilePreviewSheet widget with presigned URL fetch + image/PDF/fallback render"
```

---

## Task 7: Mobile — OrderFlowState + Order model + upload screen + file card

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/providers/order_provider.dart`
- Modify: `apps/mobile/lib/shared/models/order.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/file_upload_card.dart`

- [ ] **Step 1: Add fileMetadataId to OrderFlowState**

In `apps/mobile/lib/features/customer/order/providers/order_provider.dart`:

1. Add `this.fileMetadataId,` to the `OrderFlowState` constructor (after `this.deliveryFee = 0,`):

```dart
  const OrderFlowState({
    this.currentStep = 0,
    this.category,
    this.paperSpecs,
    this.threeDSpecs,
    this.fileName,
    this.filePath,
    this.fileSize,
    this.fileMetadataId,
    this.quantity = 1,
    this.pageCount = 1,
    this.deliveryOption = 'pickup',
    this.deliveryAddress,
    this.paymentMethod,
    this.totalPrice = 0,
    this.deliveryFee = 0,
  });
```

2. Add the field declaration (after `final int? fileSize;`):

```dart
  final int? fileMetadataId;
```

3. Add `int? fileMetadataId,` parameter to `copyWith` and update the return to include:

```dart
  OrderFlowState copyWith({
    // ... existing params ...
    int? fileMetadataId,
    bool clearFile = false,
    // ... rest of params ...
  }) {
    return OrderFlowState(
      // ... existing fields ...
      fileMetadataId: clearFile ? null : (fileMetadataId ?? this.fileMetadataId),
      // ... rest of fields ...
    );
  }
```

4. Add to `toMap()` (after `'fileSize': fileSize,`):

```dart
      'fileMetadataId': fileMetadataId,
```

5. Add to `fromMap()` constructor call (after `fileSize: map['fileSize'] as int?,`):

```dart
      fileMetadataId: map['fileMetadataId'] as int?,
```

6. Add `setFileMetadataId` method to `OrderFlowNotifier` (after `setFile`):

```dart
  void setFileMetadataId(int? id) {
    state = state.copyWith(fileMetadataId: id);
    _saveDraft();
  }
```

- [ ] **Step 2: Add fileMetadataId to Order model**

In `apps/mobile/lib/shared/models/order.dart`:

1. Add `this.fileMetadataId,` to constructor (after `this.fileName,`):

```dart
  const Order({
    // ... existing params ...
    this.fileMetadataId,
    // ...
  });
```

2. Add field declaration (after `final String? fileName;`):

```dart
  final int? fileMetadataId;
```

3. Add to `copyWith` parameter and return:

```dart
  Order copyWith({
    // ... existing params ...
    int? fileMetadataId,
    // ...
  }) {
    return Order(
      // ... existing fields ...
      fileMetadataId: fileMetadataId ?? this.fileMetadataId,
      // ...
    );
  }
```

- [ ] **Step 3: Parse + send fileMetadataId in orders_provider.dart**

In `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`:

1. In `_parseOrder`, add after `fileName:` line:

```dart
    fileMetadataId: (_readJsonValue(json, 'fileMetadataId', 'file_metadata_id') as num?)?.toInt(),
```

2. In `addOrder`, add `'fileMetadataId': order.fileMetadataId,` to the POST data map (after `'fileUrl': order.fileUrl,`):

```dart
        'fileUrl': order.fileUrl,
        'fileMetadataId': order.fileMetadataId,
```

- [ ] **Step 4: Add fileMetadataId to the Order created in payment_screen.dart**

In `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`, add `fileMetadataId: flowState.fileMetadataId,` to the `Order(...)` constructor call (after `fileUrl: flowState.filePath,`):

```dart
        fileUrl: flowState.filePath,
        fileMetadataId: flowState.fileMetadataId,
```

- [ ] **Step 5: Rewrite upload_screen.dart with real Dio progress**

Replace the full contents of `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`:

```dart
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/widgets/file_upload_card.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:printing_app/utils/formatters.dart';

/// Step 3/6 -- File upload with real Dio progress.
class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  static const routeName = '/order/upload';

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen>
    with SingleTickerProviderStateMixin {
  String? _fileName;
  String? _filePath;
  Uint8List? _fileBytes;
  String? _fileMimeType;
  int? _fileSize;
  int? _fileMetadataId;
  String? _errorText;
  bool _isUploading = false;
  double _uploadProgress = 0;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  List<String> get _allowedTypes {
    final state = ref.read(orderFlowProvider);
    return state.category == 'paper'
        ? AppConstants.paperTypes
        : AppConstants.threeDTypes;
  }

  int get _maxSizeMB {
    final state = ref.read(orderFlowProvider);
    return state.category == 'paper'
        ? AppConstants.paperMaxSizeMB
        : AppConstants.threeDMaxSizeMB;
  }

  String _mimeFromExtension(String ext) {
    switch (ext.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'stl':
        return 'model/stl';
      case 'obj':
        return 'model/obj';
      case '3mf':
        return 'model/3mf';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> _pickFile() async {
    FilePickerResult? result;
    bool nativeSucceeded = false;

    try {
      try {
        result = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: _allowedTypes,
          dialogTitle: 'Select file to print',
          withData: true,
        );
      } catch (_) {
        result = await FilePicker.platform.pickFiles(
          type: FileType.any,
          dialogTitle: 'Select file to print',
          withData: true,
        );
      }
      if (result != null && result.files.isNotEmpty) {
        nativeSucceeded = true;
      }
    } catch (_) {
      nativeSucceeded = false;
    }

    if (!nativeSucceeded || result == null) {
      _useMockFile();
      return;
    }

    final file = result.files.first;
    final extension = file.extension?.toLowerCase() ?? '';
    final sizeInBytes = file.size;
    final maxBytes = _maxSizeMB * 1024 * 1024;

    if (!_allowedTypes.contains(extension)) {
      setState(() {
        _errorText =
            'Invalid file type ".$extension". Allowed: ${_allowedTypes.map((e) => '.$e').join(', ')}';
        _fileName = null;
        _filePath = null;
        _fileBytes = null;
        _fileSize = null;
      });
      return;
    }

    if (sizeInBytes > maxBytes) {
      setState(() {
        _errorText =
            'File too large (${formatFileSize(sizeInBytes)}). Maximum: $_maxSizeMB MB';
        _fileName = null;
        _filePath = null;
        _fileBytes = null;
        _fileSize = null;
      });
      return;
    }

    setState(() {
      _errorText = null;
      _fileName = file.name;
      _filePath = file.path;
      _fileBytes = file.bytes;
      _fileMimeType = _mimeFromExtension(extension);
      _fileSize = sizeInBytes;
      _fileMetadataId = null;
      _isUploading = true;
      _uploadProgress = 0;
    });

    await _uploadFile(file);
  }

  void _useMockFile() {
    final category = ref.read(orderFlowProvider).category ?? 'paper';
    final mockFiles = category == 'paper'
        ? [
            ('Project_Report_Final.pdf', 2457600, 'application/pdf'),
            ('Thesis_Document.pdf', 1843200, 'application/pdf'),
            ('Event_Poster_A3.png', 5242880, 'image/png'),
            ('Business_Cards_Layout.pdf', 819200, 'application/pdf'),
          ]
        : [
            ('Prototype_Model_v2.stl', 8388608, 'model/stl'),
            ('Figurine_Base.obj', 4194304, 'model/obj'),
            ('Phone_Case_Design.3mf', 3145728, 'model/3mf'),
          ];

    final mock = mockFiles[DateTime.now().second % mockFiles.length];
    setState(() {
      _errorText = null;
      _fileName = mock.$1;
      _filePath = null;
      _fileBytes = null;
      _fileMimeType = mock.$3;
      _fileSize = mock.$2;
      _fileMetadataId = null;
      _isUploading = false;
      _uploadProgress = 0;
    });
  }

  Future<void> _uploadFile(PlatformFile file) async {
    try {
      final MultipartFile multipartFile;
      if (file.bytes != null) {
        multipartFile =
            MultipartFile.fromBytes(file.bytes!, filename: file.name);
      } else if (file.path != null) {
        multipartFile =
            await MultipartFile.fromFile(file.path!, filename: file.name);
      } else {
        setState(() {
          _isUploading = false;
        });
        return;
      }

      final formData = FormData.fromMap({'file': multipartFile});
      final response = await ApiClient.instance.dio.post(
        '/files/upload',
        data: formData,
        onSendProgress: (sent, total) {
          if (total > 0 && mounted) {
            setState(() => _uploadProgress = sent / total);
          }
        },
      );

      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 1.0;
          _filePath = (response.data['url'] as String?) ?? _filePath;
          _fileMetadataId = response.data['id'] as int?;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 0;
        });
      }
    }
  }

  bool get _canContinue =>
      _fileName != null && !_isUploading && _errorText == null;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Upload File',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.md),
                    const StepIndicator(totalSteps: 6, currentStep: 2),
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Upload Your File',
                      style: AppTypography.h1
                          .copyWith(color: colors.onBackground),
                    )
                        .animate()
                        .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                        .slideY(
                            begin: 0.03,
                            duration: 400.ms,
                            curve: Curves.easeOut),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Accepted: ${_allowedTypes.map((e) => '.$e').join(', ')} (max $_maxSizeMB MB)',
                      style: AppTypography.caption
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    FileUploadCard(
                      onTap: _pickFile,
                      fileName: _fileName,
                      fileSize: _fileSize,
                      errorText: _errorText,
                      isUploading: _isUploading,
                      uploadProgress: _uploadProgress,
                      localFilePath: _filePath,
                      localFileBytes: _fileBytes,
                      mimeType: _fileMimeType,
                    )
                        .animate()
                        .fadeIn(
                            duration: 400.ms,
                            delay: 60.ms,
                            curve: Curves.easeOut)
                        .slideY(
                            begin: 0.03,
                            duration: 400.ms,
                            delay: 60.ms,
                            curve: Curves.easeOut),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(
                  top: BorderSide(color: colors.outline, width: 0.5),
                ),
              ),
              child: AppButton(
                label: 'Continue',
                isFullWidth: true,
                isDisabled: !_canContinue,
                onTap: _canContinue ? _onContinue : null,
              ),
            )
                .animate()
                .fadeIn(
                    duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                .slideY(
                    begin: 0.03,
                    duration: 400.ms,
                    delay: 120.ms,
                    curve: Curves.easeOut),
          ],
        ),
      ),
    );
  }

  void _onContinue() {
    ref.read(orderFlowProvider.notifier).setFile(
          fileName: _fileName!,
          filePath: _filePath ?? '',
          fileSize: _fileSize ?? 0,
          fileMetadataId: _fileMetadataId,
        );
    ref.read(orderFlowProvider.notifier).nextStep();
    context.push('/customer/order/summary');
  }
}
```

- [ ] **Step 6: Update FileUploadCard to show thumbnail/icon**

Replace the full contents of `apps/mobile/lib/features/customer/order/widgets/file_upload_card.dart`:

```dart
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/utils/formatters.dart';

/// Dashed-border upload card for file selection.
class FileUploadCard extends StatelessWidget {
  const FileUploadCard({
    super.key,
    required this.onTap,
    this.fileName,
    this.fileSize,
    this.errorText,
    this.isUploading = false,
    this.uploadProgress = 0,
    this.localFilePath,
    this.localFileBytes,
    this.mimeType,
  });

  final VoidCallback onTap;
  final String? fileName;
  final int? fileSize;
  final String? errorText;
  final bool isUploading;
  final double uploadProgress;

  /// Local file path for image thumbnail (mobile/desktop).
  final String? localFilePath;

  /// In-memory bytes for image thumbnail (web).
  final Uint8List? localFileBytes;

  /// MIME type used to pick the correct FileTypeIcon.
  final String? mimeType;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final hasFile = fileName != null;
    final hasError = errorText != null && errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          onTap: isUploading ? null : onTap,
          child: CustomPaint(
            painter: _DashedBorderPainter(
              color: hasError ? colors.error : colors.outline,
              borderRadius: AppRadius.md,
            ),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.xl),
              decoration: BoxDecoration(
                color: colors.surfaceVariant.withValues(alpha: 0.3),
                borderRadius: AppRadius.borderMd,
              ),
              child: hasFile ? _buildFileInfo(colors) : _buildPrompt(colors),
            ),
          ),
        ),
        if (isUploading) ...[
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: AppRadius.borderSm,
            child: LinearProgressIndicator(
              value: uploadProgress,
              backgroundColor: colors.surfaceDim,
              valueColor: AlwaysStoppedAnimation(colors.accent),
              minHeight: 4,
            ),
          ),
        ],
        if (hasError) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            errorText!,
            style: AppTypography.caption.copyWith(color: colors.error),
          ),
        ],
      ],
    );
  }

  Widget _buildFilePreview(AppColorSet colors) {
    final isImage = mimeType != null && mimeType!.startsWith('image/');

    if (isImage) {
      if (localFileBytes != null) {
        return ClipRRect(
          borderRadius: AppRadius.borderSm,
          child: Image.memory(
            localFileBytes!,
            width: 52,
            height: 52,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                FileTypeIcon(mimeType: mimeType, size: 52),
          ),
        );
      }
      if (localFilePath != null) {
        return ClipRRect(
          borderRadius: AppRadius.borderSm,
          child: Image.file(
            File(localFilePath!),
            width: 52,
            height: 52,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                FileTypeIcon(mimeType: mimeType, size: 52),
          ),
        );
      }
    }

    return FileTypeIcon(mimeType: mimeType, size: 52);
  }

  Widget _buildPrompt(AppColorSet colors) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        HugeIcon(
            icon: HugeIcons.strokeRoundedFileUpload,
            size: 48,
            color: colors.onSurfaceDim),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Tap to select file',
          style: AppTypography.bodyLarge.copyWith(color: colors.onSurface),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Supported formats will be validated',
          style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        ),
      ],
    );
  }

  Widget _buildFileInfo(AppColorSet colors) {
    return Row(
      children: [
        _buildFilePreview(colors),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                fileName!,
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (fileSize != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  formatFileSize(fileSize!),
                  style: AppTypography.caption
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          'Change',
          style: AppTypography.bodyBold.copyWith(color: colors.accent),
        ),
      ],
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({
    required this.color,
    required this.borderRadius,
  });

  final Color color;
  final double borderRadius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(borderRadius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0;
      bool draw = true;
      while (distance < metric.length) {
        const dashLength = 8.0;
        const gapLength = 5.0;
        final length = draw ? dashLength : gapLength;
        final end = (distance + length).clamp(0.0, metric.length);
        if (draw) {
          final extractedPath = metric.extractPath(distance, end);
          canvas.drawPath(extractedPath, paint);
        }
        distance = end;
        draw = !draw;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      color != oldDelegate.color || borderRadius != oldDelegate.borderRadius;
}
```

- [ ] **Step 7: Run flutter analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/ lib/shared/models/ 2>&1
```

Expected: `No issues found!`

- [ ] **Step 8: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/lib/features/customer/order/providers/order_provider.dart \
        apps/mobile/lib/shared/models/order.dart \
        apps/mobile/lib/features/customer/orders/providers/orders_provider.dart \
        apps/mobile/lib/features/customer/order/screens/upload_screen.dart \
        apps/mobile/lib/features/customer/order/widgets/file_upload_card.dart \
        apps/mobile/lib/features/customer/order/screens/payment_screen.dart
git commit -m "feat(mobile): real upload progress, fileMetadataId in order flow, thumbnail in upload card"
```

---

## Task 8: Mobile — My Uploads: provider + screen + router + profile

**Files:**
- Create: `apps/mobile/lib/features/customer/uploads/providers/my_uploads_provider.dart`
- Create: `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`
- Modify: `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`

- [ ] **Step 1: Create MyUploadsProvider**

Create `apps/mobile/lib/features/customer/uploads/providers/my_uploads_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';
import 'package:printing_app/shared/services/api_client.dart';

class MyUploadsNotifier extends StateNotifier<AsyncValue<List<UploadedFile>>> {
  MyUploadsNotifier() : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final response = await ApiClient.instance.get('/files/my-uploads');
      final list = (response.data as List<dynamic>)
          .map((e) => UploadedFile.fromJson(e as Map<String, dynamic>))
          .toList();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final myUploadsProvider =
    StateNotifierProvider.autoDispose<MyUploadsNotifier, AsyncValue<List<UploadedFile>>>(
  (ref) => MyUploadsNotifier(),
);
```

- [ ] **Step 2: Create MyUploadsScreen**

Create `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/uploads/providers/my_uploads_provider.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/utils/formatters.dart';

/// Shows all files the current user has uploaded, in a 2-column grid.
class MyUploadsScreen extends ConsumerWidget {
  const MyUploadsScreen({super.key});

  static const routeName = '/customer/uploads';

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final state = ref.watch(myUploadsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'My Uploads',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: state.when(
        loading: () => _buildShimmer(colors),
        error: (_, __) => _buildError(ref, colors),
        data: (files) => files.isEmpty
            ? _buildEmpty(colors)
            : _buildGrid(context, files, colors, ref),
      ),
    );
  }

  Widget _buildGrid(
    BuildContext context,
    List<UploadedFile> files,
    AppColorSet colors,
    WidgetRef ref,
  ) {
    return RefreshIndicator(
      onRefresh: () => ref.read(myUploadsProvider.notifier).fetch(),
      child: GridView.builder(
        padding: const EdgeInsets.all(AppSpacing.lg),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          childAspectRatio: 0.85,
        ),
        itemCount: files.length,
        itemBuilder: (context, index) =>
            _UploadCard(file: files[index], colors: colors),
      ),
    );
  }

  Widget _buildShimmer(AppColorSet colors) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.lg),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.md,
        crossAxisSpacing: AppSpacing.md,
        childAspectRatio: 0.85,
      ),
      itemCount: 6,
      itemBuilder: (_, __) => Shimmer.fromColors(
        baseColor: colors.surfaceVariant,
        highlightColor: colors.surface,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: AppRadius.borderMd,
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty(AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.folder_outlined, size: 64, color: colors.onSurfaceDim),
          const SizedBox(height: AppSpacing.lg),
          Text(
            "You haven't uploaded any files yet.",
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildError(WidgetRef ref, AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "Couldn't load uploads.",
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          TextButton(
            onPressed: () => ref.read(myUploadsProvider.notifier).fetch(),
            child: Text(
              'Retry',
              style: AppTypography.bodyBold.copyWith(color: colors.accent),
            ),
          ),
        ],
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({required this.file, required this.colors});

  final UploadedFile file;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FilePreviewSheet.show(
        context,
        fileId: file.id,
        fileName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.size,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: colors.outline, width: 0.5),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: FileTypeIcon(mimeType: file.mimeType, size: 56),
            ),
            const Spacer(),
            Text(
              file.originalName,
              style: AppTypography.caption
                  .copyWith(color: colors.onBackground, fontWeight: FontWeight.w600),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              formatFileSize(file.size),
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
            Text(
              _formatDate(file.createdAt),
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${_month(dt.month)} ${dt.day}, ${dt.year}';
  }

  String _month(int m) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m];
}
```

- [ ] **Step 3: Register route in app_router.dart**

In `apps/mobile/lib/config/routes/app_router.dart`:

1. Add import at top (after the tam_survey_screen import):

```dart
import 'package:printing_app/features/customer/uploads/screens/my_uploads_screen.dart';
```

2. Add the route after the `/customer/profile/survey` route:

```dart
      GoRoute(
        path: '/customer/uploads',
        pageBuilder: (_, state) =>
            slideTransition(const MyUploadsScreen(), state),
      ),
```

- [ ] **Step 4: Add "My Uploads" row in profile_screen.dart**

In `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`, add the row after the `'Saved Addresses'` row under the ACCOUNT section:

```dart
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedFolder01,
            title: 'My Uploads',
            onTap: () => context.push('/customer/uploads'),
            colors: colors,
          ),
```

- [ ] **Step 5: Run flutter analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/uploads/ lib/config/routes/ lib/features/customer/profile/ 2>&1
```

Expected: `No issues found!`

- [ ] **Step 6: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/lib/features/customer/uploads/ \
        apps/mobile/lib/config/routes/app_router.dart \
        apps/mobile/lib/features/customer/profile/screens/profile_screen.dart
git commit -m "feat(mobile): add My Uploads screen with grid view and profile nav entry"
```

---

## Task 9: Mobile — Customer + admin order detail preview buttons

**Files:**
- Modify: `apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart`
- Modify: `apps/mobile/lib/features/admin/queue/screens/admin_order_detail_screen.dart`

- [ ] **Step 1: Add Preview button to customer OrderDetailScreen**

In `apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart`:

1. Add import at top:

```dart
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
```

2. Find the `_buildFileSection` method and update the card to include a Preview button when `order.fileMetadataId != null`:

```dart
  Widget _buildFileSection(Order order, AppColorSet colors) {
    final extension = order.fileName!.split('.').last.toUpperCase();
    final mimeType = _mimeFromExtension(order.fileName!.split('.').last.toLowerCase());

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: AppRadius.borderSm,
                ),
                child: Center(
                  child: Text(
                    extension,
                    style: AppTypography.caption.copyWith(
                      color: colors.accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  order.fileName!,
                  style: AppTypography.body.copyWith(color: colors.onSurface),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (order.fileMetadataId != null)
                TextButton.icon(
                  onPressed: () => FilePreviewSheet.show(
                    context,
                    fileId: order.fileMetadataId!,
                    fileName: order.fileName!,
                    mimeType: mimeType,
                  ),
                  icon: Icon(Icons.visibility_outlined,
                      size: 16, color: colors.accent),
                  label: Text(
                    'Preview',
                    style: AppTypography.caption
                        .copyWith(color: colors.accent),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _mimeFromExtension(String ext) {
    switch (ext) {
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'webp': return 'image/webp';
      case 'pdf': return 'application/pdf';
      case 'stl': return 'model/stl';
      case 'obj': return 'model/obj';
      case '3mf': return 'model/3mf';
      default: return 'application/octet-stream';
    }
  }
```

Also add `import 'package:printing_app/config/theme/app_radius.dart';` if not already present.

- [ ] **Step 2: Add Preview button to admin AdminOrderDetailScreen**

In `apps/mobile/lib/features/admin/queue/screens/admin_order_detail_screen.dart`:

1. Add imports:

```dart
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
```

2. Find the file info section (around line 152) and replace it:

```dart
          // File info
          if (order.fileName != null) ...[
            const SectionHeader(title: 'File Info'),
            AppCard(
              child: Row(
                children: [
                  HugeIcon(
                      icon: HugeIcons.strokeRoundedFile01,
                      size: 20,
                      color: colors.onSurfaceDim),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      order.fileName!,
                      style:
                          AppTypography.body.copyWith(color: colors.onSurface),
                    ),
                  ),
                  if (order.fileMetadataId != null)
                    TextButton.icon(
                      onPressed: () => FilePreviewSheet.show(
                        context,
                        fileId: order.fileMetadataId!,
                        fileName: order.fileName!,
                        mimeType: _mimeFromExtension(
                            order.fileName!.split('.').last.toLowerCase()),
                      ),
                      icon: Icon(Icons.visibility_outlined,
                          size: 16, color: colors.accent),
                      label: Text(
                        'Preview',
                        style: AppTypography.caption
                            .copyWith(color: colors.accent),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
```

3. Add the `_mimeFromExtension` helper method to `_AdminOrderDetailScreenState`:

```dart
  String _mimeFromExtension(String ext) {
    switch (ext) {
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'webp': return 'image/webp';
      case 'pdf': return 'application/pdf';
      case 'stl': return 'model/stl';
      case 'obj': return 'model/obj';
      case '3mf': return 'model/3mf';
      default: return 'application/octet-stream';
    }
  }
```

- [ ] **Step 3: Run flutter analyze**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/orders/ lib/features/admin/queue/ 2>&1
```

Expected: `No issues found!`

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart \
        apps/mobile/lib/features/admin/queue/screens/admin_order_detail_screen.dart
git commit -m "feat(mobile): add file Preview button to customer and admin order detail screens"
```

---

## Task 10: Admin web — types + api service + OrderDetail preview modal

**Files:**
- Modify: `apps/admin-web/src/types/index.ts`
- Create: `apps/admin-web/src/services/api.ts`
- Modify: `apps/admin-web/src/views/OrderDetail.tsx`

- [ ] **Step 1: Add fileMetadataId to Order type**

In `apps/admin-web/src/types/index.ts`, add to the `Order` interface:

```typescript
export interface Order {
  orderId: string;
  customerName: string;
  status: OrderStatus;
  date: string;
  price: number;
  deliveryFee: number;
  paymentLabel: string;
  fileName: string;
  fileMetadataId?: number;
  specs: OrderSpecs;
  quantity: number;
}
```

- [ ] **Step 2: Create api.ts service**

Create `apps/admin-web/src/services/api.ts`:

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('adminToken');
}

export async function getPresignedUrl(fileId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/files/${fileId}/presigned-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch presigned URL: ${res.status}`);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
```

- [ ] **Step 3: Add preview button + modal to OrderDetail.tsx**

In `apps/admin-web/src/views/OrderDetail.tsx`, add preview state and handler after the `currentStatus` state:

```typescript
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
```

Add the import at top:

```typescript
import { getPresignedUrl } from '../services/api';
```

Add the handler after the state declarations:

```typescript
  const handlePreview = async () => {
    if (!orderData.fileMetadataId) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const url = await getPresignedUrl(orderData.fileMetadataId);
      setPreviewUrl(url);
    } catch {
      setPreviewError('Preview unavailable. Ensure you are logged in as admin.');
    } finally {
      setPreviewLoading(false);
    }
  };
```

Update the **File Info** section to add the preview button:

```tsx
        {/* File Info */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>File Info</h2>
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <FileText size={20} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', flex: 1 }}>{orderData.fileName}</span>
            {orderData.fileMetadataId && (
              <button
                onClick={handlePreview}
                style={{
                  padding: '6px 12px', border: '1px solid var(--border-color)',
                  borderRadius: '6px', backgroundColor: 'transparent',
                  color: 'var(--text-primary)', fontSize: '0.8125rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                👁 Preview
              </button>
            )}
          </div>
        </section>
```

Add the preview modal just before the closing `</div>` of the main container:

```tsx
        {/* Preview Modal */}
        {previewOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '1rem',
            }}
            onClick={() => setPreviewOpen(false)}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-color)', borderRadius: '12px',
                width: '100%', maxWidth: '800px', maxHeight: '85vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{orderData.fileName}</span>
                <button onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                {previewLoading && <div>Loading preview...</div>}
                {previewError && <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{previewError}</div>}
                {!previewLoading && !previewError && previewUrl && (() => {
                  const ext = orderData.fileName.split('.').pop()?.toLowerCase() ?? '';
                  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
                    return <img src={previewUrl} alt={orderData.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />;
                  }
                  if (ext === 'pdf') {
                    return <iframe src={previewUrl} title={orderData.fileName} style={{ width: '100%', height: '65vh', border: 'none' }} />;
                  }
                  return (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Preview not available for this file type.</p>
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>Open file ↗</a>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Build admin web to confirm no TypeScript errors**

```bash
cd /home/jd/projects/printing_app/apps/admin-web
npm run build 2>&1 | tail -10
```

Expected: `built in X.Xs`

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app
git add apps/admin-web/src/types/index.ts \
        apps/admin-web/src/services/api.ts \
        apps/admin-web/src/views/OrderDetail.tsx
git commit -m "feat(admin-web): add file preview modal to OrderDetail with presigned URL"
```

---

## Task 11: Final verification — build + full test suite

- [ ] **Step 1: Run full server test suite**

```bash
cd /home/jd/projects/printing_app/server
npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass (no failures).

- [ ] **Step 2: Run flutter analyze on entire mobile app**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter analyze 2>&1 | tail -10
```

Expected: `No issues found!`

- [ ] **Step 3: Run flutter tests**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Build Flutter web**

```bash
cd /home/jd/projects/printing_app/apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -5
```

Expected: `✓ Built build/web`

- [ ] **Step 5: Build admin web**

```bash
cd /home/jd/projects/printing_app/apps/admin-web
npm run build 2>&1 | tail -5
```

Expected: `built in X.Xs`

- [ ] **Step 6: Restart server and confirm MinIO bucket goes private**

```bash
cd /home/jd/projects/printing_app/server
docker compose restart api
sleep 5
docker compose logs api --tail 20 2>&1 | grep -i minio
```

Expected log (if bucket already existed from before — no output means bucket was already created; if new: `Bucket 'grid-print' created (private)`). Confirm no public-read line in logs.
