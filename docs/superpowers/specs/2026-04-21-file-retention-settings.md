# File Retention Settings — Design Spec

**Date:** 2026-04-21  
**Status:** Approved  
**Scope:** Per-user auto-delete setting for uploaded files, enforced by a server cron job, surfaced in the Data Grid screen with expiry warnings.

---

## Goal

Let customers control how long their uploaded files are kept after an order is completed. Default is Never (files kept indefinitely). When auto-delete is enabled, files are purged from storage and the database automatically after the chosen period.

---

## Data Model

### `users` table — one new column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `fileRetentionDays` | `integer \| null` | `null` | `null` = Never; `1` = 24 h; `7` = 7 days; `30` = 30 days |

### `file_metadata` table — one new column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `expiresAt` | `timestamp \| null` | `null` | Set when linked order is marked Completed. `null` = never expires. Read by cron and mobile badge. |

No soft-delete. When a file is purged it is deleted from MinIO and its `file_metadata` row is removed.

---

## Server

### 1. User preference endpoints

`GET /users/me/storage-settings`  
Returns `{ fileRetentionDays: number | null }`.

`PATCH /users/me/storage-settings`  
Body: `{ fileRetentionDays: number | null }`. Validates that value is one of `[null, 1, 7, 30]`. Updates the authenticated user's record.

### 2. Order completion hook

Location: `OrdersService` — when an order transitions to `Completed` status.

If the order has a non-null `fileMetadataId`:
1. Fetch the order owner's `fileRetentionDays`.
2. If `fileRetentionDays` is not null, set `FileMetadata.expiresAt = new Date() + fileRetentionDays days` (using the timestamp at the moment the completion handler runs).
3. If `fileRetentionDays` is null, leave `expiresAt` as null.

Runs in the same request handler as the status update (after the order row is saved).

### 3. Cron job — daily purge sweep

- Library: `@nestjs/schedule`
- Schedule: daily at 02:00 server time (`0 2 * * *`)
- Query: `SELECT * FROM file_metadata WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
- For each record: delete from MinIO via `StorageService.delete(objectKey)`, then delete the DB row.
- If MinIO deletion fails for a record: log the error and skip that record (do not crash the sweep).
- Log summary: total found, total deleted, total skipped.

### 4. `GET /files/my-uploads` response change

Add `expiresAt: string | null` (ISO 8601) to each record in the response. No additional query — it comes directly from the `file_metadata` row.

The query also filters out records where `expiresAt IS NOT NULL AND expiresAt <= NOW()` — so files that have already passed their expiry are never returned even if the nightly cron has not yet run.

---

## Mobile

### New screen — `StorageSettingsScreen`

**Route:** `/customer/profile/storage-settings`  
**File:** `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart`  
**Provider:** `storageSettingsProvider` — `AsyncNotifier<StorageSettings>` backed by `GET /users/me/storage-settings` and `PATCH /users/me/storage-settings`.

Layout:

```
┌─ Storage & Files ─────────────────────────────────┐
│                                                    │
│  Auto-delete files after order completion   [OFF] │
│  Files in your Data Grid will be automatically    │
│  deleted after the period you choose.             │
│                                                    │
│  ── (visible only when toggle is ON) ──           │
│  Delete after         [ 30 days  ▾ ]              │
│                                                    │
└────────────────────────────────────────────────────┘
```

- Toggle OFF → `fileRetentionDays = null`. No confirmation needed.
- Toggle ON (from OFF) → show confirmation dialog: *"Your files from completed orders will be automatically deleted after the chosen period. You can turn this off any time."* → on confirm, enable and default to 30 days.
- Changing the dropdown period → `PATCH` fires immediately, no separate Save button.
- Retention options: 24 hours, 7 days, 30 days.

### Profile screen change

Add a new `_MenuRow` between the existing "Data Grid" row and the "Support" row:

```
🗂  Storage & Files    →
```

Navigates to `/customer/profile/storage-settings`.

### Data Grid (My Uploads) changes

**`UploadedFile` model** — add `expiresAt: DateTime?` parsed from the API response.

**Expiry badge** — shown on file cards in both grid and list view when `expiresAt` is not null:

| Time until expiry | Badge text | Badge color |
|-------------------|-----------|-------------|
| > 3 days | no badge | — |
| 1–3 days | "Expires in N days" | amber |
| < 24 hours (but > 0) | "Expires today" | amber |

Badge is a small pill chip rendered in the bottom-right of the grid card / inline in the list row. Files whose `expiresAt` is already past do not appear (deleted server-side before the list is returned).

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `server/src/users/entities/user.entity.ts` | Add `fileRetentionDays` column |
| `server/src/files/entities/file-metadata.entity.ts` | Add `expiresAt` column |
| `server/src/users/users.service.ts` | Add `getStorageSettings` / `updateStorageSettings` |
| `server/src/users/users.controller.ts` | Add GET + PATCH `/users/me/storage-settings` |
| `server/src/users/dto/update-storage-settings.dto.ts` | New DTO |
| `server/src/orders/orders.service.ts` | Stamp `expiresAt` on completion |
| `server/src/files/files.service.ts` | Add `deleteExpired()` batch method |
| `server/src/files/files.controller.ts` | Add `expiresAt` to `my-uploads` response |
| `server/src/files/files.module.ts` | Register `ScheduleModule` if needed |
| `server/src/app.module.ts` | Import `ScheduleModule.forRoot()` |
| `server/src/files/purge.service.ts` | New — cron job service |
| `apps/mobile/lib/shared/models/uploaded_file.dart` | Add `expiresAt` field |
| `apps/mobile/lib/features/customer/uploads/screens/my_uploads_screen.dart` | Add expiry badge to cards |
| `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart` | New screen |
| `apps/mobile/lib/features/customer/profile/providers/storage_settings_provider.dart` | New provider |
| `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` | Add "Storage & Files" row |
| `apps/mobile/lib/config/router.dart` | Register new route |

---

## Out of Scope

- Admin override of per-user retention — not built.
- Notification before expiry (push/email) — not built; the in-app badge is the only warning.
- Manual delete button from the Data Grid — not built in this feature.
- Retroactive expiry for files from orders completed before this feature ships — `expiresAt` stays null for all existing records; they are never auto-deleted.
