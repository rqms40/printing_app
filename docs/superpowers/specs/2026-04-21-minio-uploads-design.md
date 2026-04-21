# MinIO-Backed File Storage for Uploads — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mock URL upload flow with real MinIO-backed object storage, persisting file bytes in MinIO and metadata in the database, ready for production hardening later.

**Architecture:** A new global `StorageModule` wraps the MinIO client and exposes an `upload()` method. `FilesModule` imports `StorageModule` and calls it from `FilesService`. A single DB migration adds `object_key` to `file_metadata`. MinIO runs as a new docker-compose service.

**Tech Stack:** NestJS, MinIO JS SDK (`minio` npm package), TypeORM migration, Docker Compose, Jest

---

## 1. Architecture

```
POST /api/files/upload
        │
        ▼
FilesController  (JWT guard, FileInterceptor multipart)
        │
        ▼
FilesService  (validates MIME + size → calls StorageService → saves FileMetadata)
        │                    │
        ▼                    ▼
file_metadata table    StorageService  (MinIO client, bucket init on startup, putObject)
                               │
                               ▼
                          MinIO  (docker-compose service, single bucket)
```

**Object key format:** `uploads/{purpose}/{YYYY}/{MM}/{DD}/{uuid}.{ext}`

Example: `uploads/payments/2026/04/21/f3a8b2c1.jpg`

`purpose` defaults to `"general"`. Callers can pass `"payments"`, `"printfiles"`, etc.

---

## 2. New Files

| File | Responsibility |
|------|---------------|
| `server/src/storage/storage.module.ts` | Global NestJS module, exports `StorageService` |
| `server/src/storage/storage.service.ts` | MinIO client setup, bucket init, `upload()` method |
| `server/src/storage/storage.config.ts` | `ALLOWED_MIME_TYPES` array, `MAX_FILE_SIZE_BYTES` constant |
| `server/src/storage/storage.service.spec.ts` | Unit tests for `StorageService` with mocked MinIO client |

## 3. Modified Files

| File | Change |
|------|--------|
| `server/src/files/files.service.ts` | Add MIME/size validation, call `StorageService.upload()`, persist `objectKey` |
| `server/src/files/entities/file-metadata.entity.ts` | Add `objectKey` column (`nullable: true`) |
| `server/src/files/files.service.spec.ts` | Add/update tests for success, invalid MIME, MinIO failure |
| `server/docker-compose.yml` | Add `minio` service + `miniodata` volume |
| `server/.env.example` | Add MinIO env vars (uncomment and fill existing commented block) |
| `server/src/app.module.ts` | Import `StorageModule` (one-time import; `@Global()` makes it available everywhere) |

## 4. Database Migration

**Migration name:** `AddObjectKeyToFileMetadata{timestamp}`

```sql
ALTER TABLE file_metadata ADD COLUMN object_key TEXT;
```

`nullable: true` — existing mock-URL rows are unaffected. All new rows have `object_key` populated.

No data backfill for existing rows.

---

## 5. StorageService Interface

```typescript
// storage.service.ts
class StorageService implements OnModuleInit {
  async onModuleInit(): Promise<void>
  // Checks if MINIO_BUCKET exists; creates it with public-read policy if not.

  async upload(buffer: Buffer, objectKey: string, mimeType: string): Promise<string>
  // Calls minioClient.putObject(bucket, objectKey, buffer, size, { 'Content-Type': mimeType })
  // Returns: `http://${endpoint}:${port}/${bucket}/${objectKey}`  (dev public URL)

  // Future (not in this task):
  // async getPresignedUrl(objectKey: string, expirySeconds: number): Promise<string>
}
```

`StorageModule` is decorated `@Global()` — any future module gets `StorageService` without re-importing.

---

## 6. File Validation Config

```typescript
// storage.config.ts
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
```

Adding new types later = one line in `ALLOWED_MIME_TYPES`.

Validation happens in `FilesService.storeMetadata()` **before** any MinIO call:
- Wrong MIME → `BadRequestException('File type not allowed')`
- Over size → `BadRequestException('File exceeds 20 MB limit')`

---

## 7. FilesService Upload Flow

```typescript
async storeMetadata(file: Express.Multer.File, uploadedBy?: number, purpose = 'general'): Promise<FileMetadata> {
  // 1. Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) throw new BadRequestException('File type not allowed');

  // 2. Validate size
  if (file.size > MAX_FILE_SIZE_BYTES) throw new BadRequestException('File exceeds 20 MB limit');

  // 3. Build object key
  const ext = extname(file.originalname).toLowerCase();
  const now = new Date();
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const objectKey = `uploads/${purpose}/${datePath}/${randomUUID()}${ext}`;

  // 4. Upload to MinIO
  let url: string;
  try {
    url = await this.storageService.upload(file.buffer, objectKey, file.mimetype);
  } catch (err) {
    this.logger.error('MinIO upload failed', err);
    throw new InternalServerErrorException('File upload failed');
  }

  // 5. Persist metadata
  const meta = this.repo.create({ originalName: file.originalname, mimeType: file.mimetype, size: file.size, url, objectKey, uploadedBy });
  return this.repo.save(meta);
}
```

---

## 8. Docker Compose Addition

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports:
    - '127.0.0.1:9000:9000'   # S3-compatible API
    - '127.0.0.1:9001:9001'   # Web console at http://localhost:9001
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  volumes:
    - miniodata:/data

volumes:
  miniodata:
```

---

## 9. Environment Variables

Added to `.env.example` (replacing the existing commented block):

```
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=grid-print
MINIO_USE_SSL=false
```

---

## 10. Error Handling

| Failure | Handling |
|---------|----------|
| Invalid MIME type | `BadRequestException` before any MinIO call |
| File over size limit | `BadRequestException` before any MinIO call |
| MinIO network error | Log raw error server-side; throw `InternalServerErrorException` |
| DB save failure after successful upload | Object stays in MinIO (orphan); acceptable for now — future cleanup job can reconcile |

---

## 11. Access Strategy

- **Dev:** Public bucket policy. URL stored in `file_metadata.url` is a direct public URL: `http://localhost:9000/grid-print/{objectKey}`
- **Production path (not in this task):** Add `GET /files/:id/url` endpoint that calls `StorageService.getPresignedUrl(objectKey, 3600)`. The `objectKey` column is the stable identifier — the `url` column becomes a fallback.

---

## 12. Tests

### `storage.service.spec.ts`
- Bucket exists on init → no create call
- Bucket missing on init → bucket is created
- `upload()` success → returns correct public URL
- `upload()` throws → error propagates

### `files.service.spec.ts`
- Upload success → returned metadata has correct `objectKey`, `url`, `mimeType`, `size`
- Invalid MIME type → `BadRequestException`, `StorageService.upload` never called
- MinIO failure → `InternalServerErrorException`, DB save never called

---

## 13. Manual Verification Steps

1. `docker compose up -d` — confirm MinIO starts, console accessible at `http://localhost:9001`
2. Upload a JPEG via `POST /api/files/upload` with valid JWT
3. Assert response contains `objectKey` and a public URL
4. Open MinIO console → `grid-print` bucket → confirm object exists at the key
5. Assert DB row in `file_metadata` has `object_key` populated
6. Upload a `.mp4` file → assert `400 Bad Request`
7. Upload a file > 20 MB → assert `400 Bad Request`
