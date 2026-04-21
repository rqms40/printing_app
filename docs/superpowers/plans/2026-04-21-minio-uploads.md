# MinIO-Backed File Storage for Uploads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock URL upload flow in `FilesService` with real MinIO-backed object storage — file bytes go to MinIO, metadata (including `objectKey`) is persisted in the database.

**Architecture:** A new `@Global() StorageModule` injects a MinIO `Client` via a custom `MINIO_CLIENT` token. `StorageService` handles bucket auto-init on startup and exposes `upload()`. `FilesService` validates MIME/size, calls `StorageService`, and saves `objectKey` + URL to `file_metadata`. MinIO runs as a docker-compose service.

**Tech Stack:** NestJS, `minio` npm package (v8.x), TypeORM `synchronize` (auto-adds column in dev), Docker Compose, Jest

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `server/src/storage/storage.config.ts` | `ALLOWED_MIME_TYPES` + `MAX_FILE_SIZE_BYTES` constants |
| Create | `server/src/storage/storage.service.ts` | MinIO client wrapper: `onModuleInit` (bucket init) + `upload()` |
| Create | `server/src/storage/storage.module.ts` | `@Global()` NestJS module + `MINIO_CLIENT` injection token factory |
| Create | `server/src/storage/storage.service.spec.ts` | Unit tests for `StorageService` with mocked MinIO client |
| Create | `server/src/files/files.service.spec.ts` | Unit tests for `FilesService` |
| Modify | `server/src/files/entities/file-metadata.entity.ts` | Add `objectKey` column (`nullable: true`) |
| Modify | `server/src/files/files.service.ts` | Validate MIME/size, call `StorageService.upload()`, persist `objectKey` |
| Modify | `server/src/app.module.ts` | Import `StorageModule` |
| Modify | `server/docker-compose.yml` | Add `minio` service + `miniodata` volume |
| Modify | `server/.env.example` | Replace commented S3 block with populated MinIO vars |

---

### Task 1: Add MinIO to docker-compose and .env.example

**Files:**
- Modify: `server/docker-compose.yml`
- Modify: `server/.env.example`

- [ ] **Step 1: Update docker-compose.yml**

Replace the full contents of `server/docker-compose.yml` with:

```yaml

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: grid_print
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '127.0.0.1:6379:6379'

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - '127.0.0.1:9000:9000'
      - '127.0.0.1:9001:9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - miniodata:/data

  api:
    build: .
    ports:
      - '3000:3000'
    environment:
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: grid_print
      DATABASE_USER: postgres
      DATABASE_PASSWORD: postgres
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      NODE_ENV: production
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 2: Update .env.example**

In `server/.env.example`, replace this block:
```
# --- File Storage (S3 / Cloudflare R2 / MinIO) ---
# S3_ENDPOINT=http://localhost:9000
# S3_BUCKET=grid-print-files
# S3_ACCESS_KEY=minioadmin
# S3_SECRET_KEY=minioadmin
```
With:
```
# --- File Storage (MinIO — local dev; swap endpoint/keys for S3/R2 in production) ---
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=grid-print
MINIO_USE_SSL=false
```

- [ ] **Step 3: Add MinIO vars to your local .env**

Append to `server/.env` (do not overwrite existing content):
```
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=grid-print
MINIO_USE_SSL=false
```

- [ ] **Step 4: Start MinIO and verify**

```bash
cd server
docker compose up -d minio
```

Then confirm MinIO is healthy:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live
```
Expected: `200`

Open `http://localhost:9001` in a browser → MinIO console login page. Login: `minioadmin` / `minioadmin`.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/docker-compose.yml server/.env.example
git commit -m "feat: add MinIO service to docker-compose and document env vars"
```

---

### Task 2: Install minio package and create storage.config.ts

**Files:**
- Create: `server/src/storage/storage.config.ts`

- [ ] **Step 1: Install the minio npm package**

```bash
cd server
npm install minio
```

Expected output ends with: `added N packages` with no errors. Verify:
```bash
node -e "require('minio'); console.log('minio ok')"
```
Expected: `minio ok`

- [ ] **Step 2: Create storage.config.ts**

Create `server/src/storage/storage.config.ts`:

```typescript
export const ALLOWED_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/package.json server/package-lock.json server/src/storage/storage.config.ts
git commit -m "feat: install minio package and add file validation config"
```

---

### Task 3: StorageService — TDD

**Files:**
- Create: `server/src/storage/storage.service.spec.ts`
- Create: `server/src/storage/storage.module.ts`
- Create: `server/src/storage/storage.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/storage/storage.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { MINIO_CLIENT } from './storage.module';

const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  setBucketPolicy: jest.fn(),
  putObject: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal?: unknown) => {
    const vals: Record<string, unknown> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_BUCKET: 'test-bucket',
      MINIO_USE_SSL: 'false',
    };
    return vals[key] ?? defaultVal;
  }),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: MINIO_CLIENT, useValue: mockMinioClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<StorageService>(StorageService);
  });

  describe('onModuleInit', () => {
    it('does not create bucket when it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      await service.onModuleInit();
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('creates bucket with public-read policy when it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);
      mockMinioClient.setBucketPolicy.mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledWith(
        'test-bucket',
        expect.stringContaining('"Effect":"Allow"'),
      );
    });
  });

  describe('upload', () => {
    it('returns public URL on successful upload', async () => {
      mockMinioClient.putObject.mockResolvedValue({ etag: 'abc', versionId: null });
      const buffer = Buffer.from('test-image-data');
      const key = 'uploads/general/2026/04/21/test.jpg';

      const url = await service.upload(buffer, key, 'image/jpeg');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        key,
        buffer,
        buffer.length,
        { 'Content-Type': 'image/jpeg' },
      );
      expect(url).toBe(`http://localhost:9000/test-bucket/${key}`);
    });

    it('propagates error when putObject throws', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('MinIO unavailable'));
      await expect(
        service.upload(Buffer.from('x'), 'key', 'image/png'),
      ).rejects.toThrow('MinIO unavailable');
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server
npx jest src/storage/storage.service.spec.ts --no-coverage
```
Expected: FAIL — `Cannot find module './storage.service'` or `Cannot find module './storage.module'`.

- [ ] **Step 3: Create storage.module.ts**

Create `server/src/storage/storage.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageService } from './storage.service';

export const MINIO_CLIENT = 'MINIO_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Client({
          endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
          port: config.get<number>('MINIO_PORT', 9000),
          useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
          accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
          secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
```

- [ ] **Step 4: Create storage.service.ts**

Create `server/src/storage/storage.service.ts`:

```typescript
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MINIO_CLIENT } from './storage.module';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(MINIO_CLIENT) private readonly minioClient: Client,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    const exists = await this.minioClient.bucketExists(bucket);
    if (!exists) {
      await this.minioClient.makeBucket(bucket);
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      };
      await this.minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
      this.logger.log(`Bucket '${bucket}' created with public-read policy`);
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
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.config.get<number>('MINIO_PORT', 9000);
    return `http://${endpoint}:${port}/${bucket}/${objectKey}`;
  }
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd server
npx jest src/storage/storage.service.spec.ts --no-coverage
```
Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/storage/
git commit -m "feat: add StorageService with MinIO client and bucket auto-init"
```

---

### Task 4: Register StorageModule in AppModule

**Files:**
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: Import StorageModule**

In `server/src/app.module.ts`, add the import at the top of the file:

```typescript
import { StorageModule } from './storage/storage.module';
```

Then add `StorageModule` to the `imports` array, after `FirebaseModule` and before the feature modules:

```typescript
    // Firebase (global — push notifications)
    FirebaseModule,

    // Storage (global — MinIO object storage)
    StorageModule,

    // Feature modules
    AuthModule,
```

- [ ] **Step 2: Verify full test suite still passes**

```bash
cd server
npx jest --no-coverage
```
Expected: all pre-existing tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/app.module.ts
git commit -m "feat: register global StorageModule in AppModule"
```

---

### Task 5: Add objectKey column to FileMetadata entity

**Files:**
- Modify: `server/src/files/entities/file-metadata.entity.ts`

> The app uses `synchronize: true` in non-production mode (configured in `app.module.ts` TypeORM setup). TypeORM will auto-add the `object_key` column when the server restarts in development — no manual migration needed.

- [ ] **Step 1: Add objectKey column**

Replace the full contents of `server/src/files/entities/file-metadata.entity.ts` with:

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

  @Column({ name: 'object_key', nullable: true })
  objectKey: string;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/files/entities/file-metadata.entity.ts
git commit -m "feat: add object_key column to FileMetadata entity"
```

---

### Task 6: Rewrite FilesService with MinIO upload — TDD

**Files:**
- Create: `server/src/files/files.service.spec.ts`
- Modify: `server/src/files/files.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/files/files.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';

const mockFileRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
};

const makeFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'photo.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('fake-image-data'),
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
  ...overrides,
});

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(FileMetadata), useValue: mockFileRepo },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  describe('storeMetadata', () => {
    it('uploads file to MinIO and returns metadata with objectKey and url', async () => {
      const file = makeFile();
      const fakeUrl =
        'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg';
      mockStorageService.upload.mockResolvedValue(fakeUrl);
      const savedMeta = {
        id: 1,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: fakeUrl,
        objectKey: 'uploads/general/2026/04/21/some-uuid.jpg',
        uploadedBy: 42,
      };
      mockFileRepo.create.mockReturnValue(savedMeta);
      mockFileRepo.save.mockResolvedValue(savedMeta);

      const result = await service.storeMetadata(file, 42);

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(
          /^uploads\/general\/\d{4}\/\d{2}\/\d{2}\/.+\.jpg$/,
        ),
        'image/jpeg',
      );
      expect(mockFileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          url: fakeUrl,
          uploadedBy: 42,
        }),
      );
      expect(result).toEqual(savedMeta);
    });

    it('throws BadRequestException for disallowed MIME type without calling StorageService', async () => {
      const file = makeFile({ mimetype: 'video/mp4' });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File type not allowed'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for file over 20 MB without calling StorageService', async () => {
      const file = makeFile({ size: 21 * 1024 * 1024 });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File exceeds 20 MB limit'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when MinIO fails without saving to DB', async () => {
      const file = makeFile();
      mockStorageService.upload.mockRejectedValue(new Error('MinIO unavailable'));
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockFileRepo.save).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server
npx jest src/files/files.service.spec.ts --no-coverage
```
Expected: FAIL — injection error because `FilesService` doesn't yet inject `StorageService`.

- [ ] **Step 3: Rewrite files.service.ts**

Replace the full contents of `server/src/files/files.service.ts` with:

```typescript
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
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
      url = await this.storageService.upload(file.buffer, objectKey, file.mimetype);
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
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd server
npx jest src/files/files.service.spec.ts --no-coverage
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Run full test suite — no regressions**

```bash
cd server
npx jest --no-coverage
```
Expected: all tests pass.

- [ ] **Step 6: Run lint**

```bash
cd server
npx eslint src/storage/ src/files/files.service.ts src/files/files.service.spec.ts --max-warnings 0
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/jd/projects/printing_app
git add server/src/files/files.service.ts server/src/files/files.service.spec.ts
git commit -m "feat: wire FilesService to StorageService with MIME/size validation"
```

---

### Task 7: Manual end-to-end verification

> No code changes — verification only. All services must be running.

- [ ] **Step 1: Start services**

```bash
cd server
docker compose up -d
npm run start:dev
```

Wait until you see: `[NestApplication] Nest application successfully started`

- [ ] **Step 2: Confirm bucket auto-created**

Open `http://localhost:9001` → log in (`minioadmin` / `minioadmin`) → confirm `grid-print` bucket exists. You should see a public access indicator.

- [ ] **Step 3: Get a JWT**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' | python3 -m json.tool
```

Copy the `accessToken` value.

- [ ] **Step 4: Upload a JPEG**

```bash
curl -s -X POST http://localhost:3000/files/upload \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -F "file=@/path/to/test.jpg" | python3 -m json.tool
```

Expected response shape:
```json
{
  "id": 1,
  "originalName": "test.jpg",
  "mimeType": "image/jpeg",
  "size": 12345,
  "url": "http://localhost:9000/grid-print/uploads/general/2026/04/21/<uuid>.jpg",
  "objectKey": "uploads/general/2026/04/21/<uuid>.jpg",
  "uploadedBy": 1,
  "createdAt": "2026-04-21T..."
}
```

- [ ] **Step 5: Confirm object in MinIO**

In the MinIO console, go to `grid-print` bucket and confirm the object exists at the path shown in `objectKey`. Click it → it should be publicly accessible via the URL.

- [ ] **Step 6: Confirm DB row has object_key**

```bash
docker exec server-postgres-1 psql -U postgres -d grid_print \
  -c "SELECT id, original_name, object_key, url FROM file_metadata ORDER BY id DESC LIMIT 1;"
```

Expected: `object_key` column is populated (not null).

- [ ] **Step 7: Test MIME type rejection**

```bash
curl -s -X POST http://localhost:3000/files/upload \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -F "file=@/path/to/video.mp4" | python3 -m json.tool
```
Expected: `{"statusCode": 400, "message": "File type not allowed"}`

- [ ] **Step 8: Test size rejection**

Create a >20 MB dummy file and upload it:
```bash
dd if=/dev/zero bs=1M count=21 | base64 > /tmp/bigfile.txt
curl -s -X POST http://localhost:3000/files/upload \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -F "file=@/tmp/bigfile.txt" | python3 -m json.tool
```
Expected: `{"statusCode": 400, "message": "File exceeds 20 MB limit"}`

- [ ] **Step 9: Final commit**

```bash
cd /home/jd/projects/printing_app
git add .
git commit -m "chore: MinIO upload end-to-end verified"
```

---

## Post-Implementation Notes

**Production swap:** Change `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, and set `MINIO_USE_SSL=true` in the production environment. No code changes needed — the same `StorageService` works with any S3-compatible provider (AWS S3, Cloudflare R2, etc.).

**Presigned URLs (future):** Add this method to `StorageService`:
```typescript
async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
  return this.minioClient.presignedGetObject(bucket, objectKey, expirySeconds);
}
```
Then add `GET /files/:id/url` to `FilesController` that reads `objectKey` from the DB and returns a presigned URL.

**Orphan cleanup:** If the DB save fails after a successful MinIO upload, the object stays in MinIO. A future reconciliation job can compare `file_metadata.object_key` values against the bucket listing to find and delete orphans.
