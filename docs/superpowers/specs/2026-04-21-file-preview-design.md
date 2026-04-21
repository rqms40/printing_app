# File Preview & My Uploads — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the upload flow to show real file previews (not placeholder icons), add a "My Uploads" screen for customers, and let both customers and admins preview uploaded files securely via presigned MinIO URLs.

**Architecture:** Make the MinIO bucket private. Add a presigned-URL endpoint (`GET /files/:id/presigned-url`) protected by JWT + ownership/admin check. Mobile fetches a presigned URL on demand and renders it inline; admin does the same from OrderDetail. A new `GET /files/my-uploads` endpoint powers the customer's My Uploads screen. Orders gain a nullable `fileMetadataId` FK so both mobile and admin can look up preview URLs for any order.

**Tech Stack:** NestJS, MinIO JS SDK (`minio`), TypeORM, Flutter (`syncfusion_flutter_pdfviewer`, `cached_network_image`, `url_launcher`), React + Tailwind (admin)

**Dependencies to add:**
- `pubspec.yaml`: `syncfusion_flutter_pdfviewer`, `cached_network_image` (if not present), `url_launcher` (if not present)

---

## 1. Architecture

```
Customer / Admin (JWT)
        │
        ▼
GET /files/:id/presigned-url
        ├─ 401 if no JWT
        ├─ 403 if not owner AND not admin
        └─ 200 { url: "http://minio/...?X-Amz-Signature=...&Expires=3600" }
                │
                ▼
        Image.network(url) / SfPdfViewer.network(url) / <img> / <iframe>

GET /files/my-uploads  (JWT, customer)
        └─ FileMetadata[] where uploadedBy = me

Order entity
        └─ fileMetadataId?: number  (nullable FK → file_metadata.id)
```

---

## 2. New Files

| File | Responsibility |
|------|---------------|
| `server/src/files/dto/presigned-url.dto.ts` | Response DTO: `{ url: string }` |
| `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart` | My Uploads grid screen |
| `apps/mobile/lib/features/customer/uploads/providers/my_uploads_provider.dart` | Riverpod: fetch + cache uploads list |
| `apps/mobile/lib/shared/widgets/file_preview_sheet.dart` | Reusable bottom sheet: fetch presigned URL + render |
| `apps/mobile/lib/shared/widgets/file_type_icon.dart` | Icon widget keyed on mimeType / extension |

## 3. Modified Files

| File | Change |
|------|--------|
| `server/src/storage/storage.service.ts` | Remove public-read bucket policy; add `getPresignedUrl(objectKey, expiry)` |
| `server/src/files/files.service.ts` | Add `getPresignedUrl(fileId, userId, userRole)` + `getMyUploads(userId)` |
| `server/src/files/files.controller.ts` | Add `GET /files/my-uploads` + `GET /files/:id/presigned-url` endpoints |
| `server/src/orders/entities/order.entity.ts` | Add `fileMetadataId?: number` column (nullable) |
| `server/src/orders/dto/create-order.dto.ts` | Add optional `fileMetadataId?: number` |
| `server/src/orders/orders.service.ts` | Persist `fileMetadataId` when creating order |
| `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` | Real Dio progress; show thumbnail/icon after pick; store fileMetadataId |
| `apps/mobile/lib/features/customer/order/providers/order_provider.dart` | Add `fileMetadataId` to `OrderFlowState` |
| `apps/mobile/lib/features/customer/order/widgets/file_upload_card.dart` | Render image thumbnail or typed icon instead of generic placeholder |
| `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` | Add "My Uploads" navigation row |
| `apps/mobile/lib/shared/models/order.dart` | Add `fileMetadataId: int?` field |
| `apps/admin-web/src/views/OrderDetail.tsx` | Add preview button + modal |
| `apps/admin-web/src/types/index.ts` | Add `fileMetadataId?: number` to Order type |
| `apps/admin-web/src/services/api.ts` | Add `getPresignedUrl(fileId)` call |

---

## 4. Server Changes

### 4a. StorageService — make bucket private + add presigned URL

```typescript
// Remove public-read policy from onModuleInit (just makeBucket, no setBucketPolicy)

async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
  return this.minioClient.presignedGetObject(bucket, objectKey, expirySeconds);
}
```

### 4b. FilesService — new methods

```typescript
async getPresignedUrl(fileId: number, requestingUserId: number, isAdmin: boolean): Promise<string> {
  const file = await this.fileRepo.findOne({ where: { id: fileId } });
  if (!file) throw new NotFoundException('File not found');
  if (!isAdmin && file.uploadedBy !== requestingUserId) throw new ForbiddenException();
  if (!file.objectKey) throw new NotFoundException('File has no storage key');
  return this.storageService.getPresignedUrl(file.objectKey, 3600);
}

async getMyUploads(userId: number): Promise<FileMetadata[]> {
  return this.fileRepo.find({
    where: { uploadedBy: userId },
    order: { createdAt: 'DESC' },
  });
}
```

### 4c. FilesController — new endpoints

```typescript
@Get('my-uploads')
@UseGuards(JwtAuthGuard)
getMyUploads(@Request() req): Promise<FileMetadata[]> {
  return this.filesService.getMyUploads(req.user.sub);
}

@Get(':id/presigned-url')
@UseGuards(JwtAuthGuard)
async getPresignedUrl(@Param('id', ParseIntPipe) id: number, @Request() req): Promise<{ url: string }> {
  const isAdmin = req.user.role === 'admin';
  const url = await this.filesService.getPresignedUrl(id, req.user.sub, isAdmin);
  return { url };
}
```

**Route order matters:** `my-uploads` must be declared before `:id` to avoid ParseIntPipe treating `"my-uploads"` as an integer.

### 4d. Order entity — add fileMetadataId

```typescript
@Column({ name: 'file_metadata_id', nullable: true })
fileMetadataId: number | null;
```

TypeORM `synchronize: true` adds the column automatically on next restart.

---

## 5. Mobile Changes

### 5a. Upload screen — real progress + thumbnail

Replace simulated progress with Dio `onSendProgress`:

```dart
await ApiClient.instance.dio.post(
  '/files/upload',
  data: formData,
  onSendProgress: (sent, total) {
    if (total > 0) setState(() => _uploadProgress = sent / total);
  },
);
```

After upload succeeds, store `fileMetadataId` from response:
```dart
final fileId = response.data['id'] as int?;
ref.read(orderFlowProvider.notifier).setFileMetadataId(fileId);
```

File upload card — show real content instead of placeholder:
- Image (jpeg/png/webp): `Image.file(File(localPath))` thumbnail before upload, `CachedNetworkImage(presignedUrl)` after
- PDF / STL / other: `FileTypeIcon(mimeType: file.mimeType)` (icon + colored background)

### 5b. FilePreviewSheet widget

```dart
class FilePreviewSheet extends ConsumerStatefulWidget {
  final int fileId;
  final String fileName;
  final String mimeType;
}
```

Internal flow:
1. `initState` → call `GET /files/$fileId/presigned-url`
2. Loading → `CircularProgressIndicator`
3. Image mime → `InteractiveViewer(child: CachedNetworkImage(url))`
4. PDF mime → `SfPdfViewer.network(url)` (syncfusion_flutter_pdfviewer package)
5. Other → file icon + `[ Open in browser ]` button (launches URL via `url_launcher`)
6. Error → "Preview unavailable" + retry button

### 5c. My Uploads screen

Route: `/my-uploads`

```
GET /files/my-uploads  →  List<FileMetadata>
```

Grid layout (2 columns, `GridView.builder`):

Each card:
- All files: `FileTypeIcon` + colored background (no per-card API calls on load)
- File name (truncated), size, date
- Presigned URL only fetched when user taps to open `FilePreviewSheet`

Tap → `FilePreviewSheet(fileId: file.id, ...)`

States:
- Loading: shimmer grid placeholders
- Empty: icon + "You haven't uploaded any files yet."
- Error: "Couldn't load uploads. Pull to retry."

Navigation: profile screen → "My Uploads" row with `Icons.folder_outlined`

### 5d. OrderFlowState — add fileMetadataId

```dart
class OrderFlowState {
  // existing fields...
  final int? fileMetadataId;
}
```

`setFileMetadataId(int? id)` notifier method. Persisted in draft alongside `filePath`.

---

## 6. Admin Changes

### 6a. types/index.ts

```typescript
interface Order {
  // existing fields...
  fileMetadataId?: number;
}
```

### 6b. api.ts

```typescript
export async function getPresignedUrl(fileId: number): Promise<string> {
  const res = await apiClient.get<{ url: string }>(`/files/${fileId}/presigned-url`);
  return res.data.url;
}
```

### 6c. OrderDetail.tsx — preview button + modal

File row (only rendered when `order.fileMetadataId` is set):

```tsx
<div className="flex items-center justify-between">
  <span>{order.fileName}</span>
  {order.fileMetadataId && (
    <button onClick={handlePreview}>👁 Preview</button>
  )}
</div>
```

`handlePreview`:
1. Set `previewLoading = true`, open modal
2. `await getPresignedUrl(order.fileMetadataId)`
3. Determine type from `order.fileName` extension
4. Render `<img src={url}>` or `<iframe src={url}>` or "Open file ↗" link
5. On error: "Preview unavailable"

Modal: full-width, scrollable, max-height 80vh, close button top-right.

---

## 7. Error Handling

| Scenario | Server | Mobile | Admin |
|----------|--------|--------|-------|
| File not found in DB | `404 Not Found` | "Preview unavailable" | "—" |
| Requester not owner or admin | `403 Forbidden` | "You don't have access to this file" | Hidden (button not shown) |
| objectKey null (old mock rows) | `404 Not Found` | "Preview unavailable" | "—" |
| MinIO presign fails | `500 Internal Server Error` | "Couldn't load preview. Retry." | Toast |
| Network error on mobile | — | "Couldn't load preview. Retry." | Toast |
| Unsupported MIME type | — | icon + "Open in browser" | "Open file ↗" link |
| No fileMetadataId (old orders) | — | "Preview unavailable" | Button hidden |

---

## 8. Tests

### Server (`files.service.spec.ts` additions)
- `getPresignedUrl` — owner can fetch → returns URL
- `getPresignedUrl` — admin can fetch any file → returns URL
- `getPresignedUrl` — non-owner non-admin → throws `ForbiddenException`
- `getPresignedUrl` — file not found → throws `NotFoundException`
- `getPresignedUrl` — null objectKey → throws `NotFoundException`
- `getMyUploads` — returns only files for that userId, ordered DESC

### Server (`storage.service.spec.ts` additions)
- `getPresignedUrl` → calls `minioClient.presignedGetObject` with correct bucket, key, expiry
- Returns the URL string from MinIO

### Mobile (widget tests)
- `FilePreviewSheet` loading state → shows spinner
- `FilePreviewSheet` image mime → shows `CachedNetworkImage`
- `FilePreviewSheet` PDF mime → shows SfPdfViewer
- `FilePreviewSheet` unknown mime → shows "Open in browser" button
- `FilePreviewSheet` API error → shows retry button
- `MyUploadsScreen` empty state → shows empty message
- `MyUploadsScreen` loaded → shows grid with correct file count

---

## 9. Manual Verification Steps

1. Upload a JPEG → progress bar moves with real bytes (not simulated) → thumbnail shown immediately after
2. Tap "Preview" on upload screen → sheet opens → image renders
3. Profile → My Uploads → grid shows all past uploads → tap → preview sheet opens
4. Create order with uploaded file → order detail shows file name with Preview button
5. Tap Preview in order detail → presigned URL fetched → image/PDF renders
6. Admin order detail → Preview button visible for orders with `fileMetadataId` → modal opens
7. Admin JWT, non-owner file → `403` returned → "You don't have access" shown
8. Old order (no fileMetadataId) → no Preview button shown on admin; "Preview unavailable" on mobile
9. Upload `.stl` → My Uploads shows 3D icon → tap → "Open in browser" button shown
