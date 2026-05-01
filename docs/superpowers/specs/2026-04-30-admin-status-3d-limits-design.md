# Admin Manual Status + 3D Printer Limitations Design

**Date:** 2026-04-30
**Status:** Approved — ready for implementation plan
**Scope:** Two related features bundled in one spec.

---

## Goal

Two unrelated-but-related features for the GRID 3D-printing flow:

1. **Admin Manual Print Status** — admin can attach a free-text status note plus an optional estimated-completion timestamp to any order. Customers see the note as a banner on order detail with a live countdown. One push notification fires the first time admin attaches a status; subsequent edits update silently.
2. **3D Printer Limitations** — single admin-configurable printer profile (Bambu A1 Mini default: 180×180×180 mm, 200 MB) with server-side bounds detection on STL/OBJ/3MF uploads. Mobile shows an inline 3D preview, prints the printer's volume, hard-blocks oversize uploads from checkout, and offers a "Chat with us for personalization" CTA that opens admin chat with the file context pre-loaded.

---

## Architecture Summary

Backend gains a new singleton `PrinterProfile` entity, a new `Model3dAnalysisService` (STL/OBJ/3MF parsing), three new columns on `Order` for the manual status, and four new columns on `FileMetadata` for 3D bounds. `/files/:id/inspect` extends to include `modelBounds` + `printerLimits`. Two new admin endpoints: `PATCH /admin/orders/:id/manual-status` and `GET/PATCH /admin/printer-profile`.

Mobile gains a `Model3dPreview` widget (`flutter_3d_controller`), extends `upload_screen.dart` with the printer-limits warning card + inline preview matching the provided mockup, and adds an `_AdminStatusBanner` to `order_detail_screen.dart` with a live ticking countdown.

Admin gains a `Manual Print Status` card on the order show page and a new `/settings/printer` page with a CSS-cube build-volume preview.

---

## Data Model

### New entities

**`PrinterProfile`** — singleton, one row.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | always `1` |
| `name` | varchar(80) | "Bambu A1 Mini" |
| `buildVolumeWidthMm` | int | Default 180 |
| `buildVolumeDepthMm` | int | Default 180 |
| `buildVolumeHeightMm` | int | Default 180 |
| `maxFileSizeMb` | int | Default 200 |
| `updatedAt` | timestamp | TypeORM-managed |

Seeded as `Bambu A1 Mini`, 180×180×180 mm, 200 MB on first migrate.

### Modifications

**`Order`** adds:

| Column | Type | Notes |
|---|---|---|
| `adminStatusNote` | varchar(255) nullable | Free-text status |
| `estimatedCompletionAt` | timestamp nullable | Drives client-side countdown |
| `adminStatusSetAt` | timestamp nullable | First-set marker — used to fire one-time notification |

**`FileMetadata`** adds:

| Column | Type | Notes |
|---|---|---|
| `model3dWidthMm` | decimal(10,2) nullable | Bounding-box X extent |
| `model3dDepthMm` | decimal(10,2) nullable | Bounding-box Y extent |
| `model3dHeightMm` | decimal(10,2) nullable | Bounding-box Z extent |
| `model3dTriangleCount` | int nullable | For sanity / display |

---

## 3D Bounds Detection (Server)

**New service:** `Model3dAnalysisService` in `server/src/files/`. Pure parsing, picked by extension.

**Binary STL** (most common): 80-byte header + uint32 triangle count + N × 50-byte triangles. Each triangle = 3 normals + 3 vertices (9 floats) + 2-byte attribute. Min/max sweep on all vertex floats. Always mm per spec.

**ASCII STL** (rare): detect `solid ` prefix at byte 0 + missing binary triangle count. Regex `vertex (-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*)` on lines.

**OBJ**: text. Lines starting with `v ` are vertices. Same min/max sweep. Unitless by spec — assume mm (matches slicer convention).

**3MF**: zip with `3D/3dmodel.model` XML. Use `jszip` (already transitive via `pdf-lib`) to extract; regex `<vertex x="…" y="…" z="…"\s*/>` for vertices. Honor `<model unit="…">` attribute (`millimeter`/`micrometer`/`inch`/`foot`/`meter`) to convert to mm.

**Result type:**

```ts
interface Model3dBounds {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangleCount: number | null;
  unit: 'mm' | 'inch' | 'unknown';
}
```

`FileAnalysisService.analyze()` gets a new branch keyed on extension (`.stl`/`.obj`/`.3mf`) that returns model bounds in addition to / instead of the existing image+pdf inspection result.

**Edge cases:**
- Corrupt/truncated → returns `null`. Upload still succeeds; mobile shows a non-blocking "Couldn't analyze model — admin will verify size" warning.
- File over `printerProfile.maxFileSizeMb` (default 200 MB) → 400 at upload.

---

## Backend API

### Customer / shared

- `GET /printer-profile` — auth-required. Returns the singleton row. Mobile loads on upload screen mount.
- `GET /files/:id/inspect` — extended response when file is a 3D model:
  ```ts
  {
    // ...existing image+pdf fields preserved...
    modelBounds: { widthMm, depthMm, heightMm, triangleCount, unit } | null,
    printerLimits: {
      profileName: string,
      widthMm: number, depthMm: number, heightMm: number, maxFileSizeMb: number,
      fits: boolean,
      overflowAxes: ('width' | 'depth' | 'height')[]
    } | null,
  }
  ```
  `printerLimits` is non-null only when `modelBounds` is non-null.

### Admin

- `PATCH /admin/orders/:id/manual-status` — body `{ note: string | null, estimatedCompletionAt: ISO8601 | null }`.
  - Validates `note` ≤ 255 chars; `estimatedCompletionAt` must be future-dated when set.
  - Persists the trio (`adminStatusNote`, `estimatedCompletionAt`, `adminStatusSetAt`).
  - **One-time notification:** if `existing.adminStatusSetAt === null && dto.note != null`, fire push via existing `notifications` module.
  - Always emits the existing `orderUpdate` WS event so live UIs refresh.
  - Returns the updated `Order`.
- `GET /admin/printer-profile` — full row.
- `PATCH /admin/printer-profile` — body restricted via DTO: dimensions 1–500 mm, `maxFileSizeMb` 1–500.

### Server-side defense in depth

`OrdersService.createBatch()` and `OrdersService.create()` re-check 3D items against the live profile. Reject 400 `model_exceeds_build_volume` if any 3D item's `model3dWidth/Depth/HeightMm` exceeds the profile. Mobile blocking is the primary UX; this check stops sneaky API callers.

---

## Mobile (Flutter)

### New widget

**`Model3dPreview`** at `lib/features/customer/order/widgets/model_3d_preview.dart`:
- Wraps `flutter_3d_controller` (verified via context7 prior to lock-in).
- Fixed-aspect container, dark background, brand-yellow orbit indicator.
- Props: `fileUrl`, `mimeType`, optional `bounds`.
- Loading skeleton + error fallback with file icon.
- Native support for `.stl` and `.obj`. For `.3mf`: show generic 3D-cube placeholder with bounds + filename overlay (full 3MF preview deferred to Phase 2 — needs server-side GLB conversion).

### Upload screen extensions

After 3D upload + `/files/:id/inspect` returns bounds:

- **`File Preview` section** with filename + the new `Model3dPreview` (white-on-dark wireframe style matching mockup).
- **Printer-limits warning card** (yellow bordered, exactly mirroring the user's reference mockup):
  - Title: "Temporary 3D Printer Limitations"
  - Body: "Our printer can only print {W}×{D}×{H} cm ({Wmm}×{Dmm}×{Hmm}mm)"
  - Subline: "Your file: {modelW}×{modelD}×{modelH} cm"
- **Continue / Unavailable button:**
  - Fits → enabled brand-yellow "Continue"
  - Doesn't fit → disabled gray "Unavailable for Beta Testing" + secondary brand-yellow "Chat with us for personalization" button below
- **Chat CTA flow:** opens existing `ChatSelectScreen` with `type: admin` pre-selected and templated message: `"Hi! I'm uploading <filename> ({W}×{D}×{H} cm) but it exceeds the printer build volume — can you help with personalization?"`

### Order detail extensions

- New `_AdminStatusBanner` widget at the top of `order_detail_screen.dart` when `order.adminStatusNote != null`:
  - Yellow-tinted card with info icon
  - Note text in body weight
  - Live countdown when `estimatedCompletionAt` is set: `Timer.periodic(1 s)` ticking `~Xh Ymin remaining`. Flips to `"Awaiting completion"` after the timestamp passes. Disappears only when admin clears the note.

### Providers

- `printerProfileProvider` (FutureProvider, autoDispose) — fetched once per session, cached.

### Models

- New `PrinterProfile`.
- `FileInspection` extended with `modelBounds` and `printerLimits`.
- `Order` extended with `adminStatusNote`, `estimatedCompletionAt`, `adminStatusSetAt`.

---

## Admin (React)

### Order show page additions

New "Manual Print Status" card on `/admin/orders/:id`:
- Ant Design `TextArea` for note (255 char limit, with counter)
- `DatePicker` with time mode for `estimatedCompletionAt` (optional)
- "Save status" button → `PATCH /admin/orders/:id/manual-status`
- Inline preview: "Customer will see: {note} · ~Xh remaining"
- "Clear status" button → sets both fields to null

### New page

`/settings/printer` — sibling of the existing `/settings/delivery`:
- Form: name, width / depth / height (mm), max file size (MB)
- Validation: dimensions 1–500 mm, max size 1–500 MB
- Visual CSS-cube build-volume preview (three faces + dimension labels)
- Save → `PATCH /admin/printer-profile`

### Sidebar nav

Add `Printer Profile` entry under the existing `Delivery` parent in the sidebar (it's hardware/operations).

---

## Edge Cases

- **Profile changed mid-flight** — order keeps the bounds *as analyzed at upload time*. Profile change only affects new uploads; old verdicts stay valid.
- **Bounds detection fails** — non-blocking warning, customer can still proceed; admin will verify.
- **3MF preview unavailable in Phase 1** — generic cube placeholder with bounds + filename overlay.
- **Manual status edit after first push** — persists + WS-emits but does not re-push.
- **Countdown crosses zero** — UI flips to `"Awaiting completion"`; doesn't auto-clear.
- **Admin/beta override** — bounds check is enforced server-side too (defense in depth via 400 `model_exceeds_build_volume`).
- **Printer profile cache staleness on mobile** — autoDispose provider re-fetches on screen revisit. No WS push needed since admin edits are rare.

---

## Testing Strategy

### Backend (Jest)

**Unit:**
- `Model3dAnalysisService.analyzeBinaryStl(buffer)` — fixture file → expected bounds.
- `Model3dAnalysisService.analyzeAsciiStl(buffer)` — small ASCII fixture → bounds.
- `Model3dAnalysisService.analyzeObj(buffer)` — small fixture → bounds.
- `Model3dAnalysisService.analyze3mf(buffer)` — fixture including unit conversion (mm/inch).
- `Model3dAnalysisService.fits(bounds, profile)` — boundary cases: exact = fits; +1 mm = no fit.
- `OrdersService.updateManualStatus()` — first-set fires notification (verify mock); subsequent does NOT.
- `OrdersService.createBatch()` — rejects 3D item where bounds exceed profile.
- `PrinterProfileService.getProfile()` — returns singleton; creates default on empty DB.
- DTO validation — 255-char note limit, future-only completion timestamp, dimension/size bounds.

**Integration (real DB, supertest):**
- POST upload of small STL fixture → DB row has correct `model3dWidth/Depth/HeightMm`.
- Oversized STL → upload succeeds (analysis is informational), but order creation rejects with 400.
- `PATCH /admin/orders/:id/manual-status` — first call fires notification stub; second call does not.

### Mobile (Flutter)

**Provider tests:**
- `printerProfileProvider` fetches and caches.

**Widget tests:**
- `Model3dPreview` — renders for valid URL; error fallback for bad URL.
- `_AdminStatusBanner` — countdown ticks; flips to `"Awaiting completion"` after target time.
- Upload screen — oversized model disables Continue + shows Chat CTA; fitting model enables Continue.
- Chat CTA fires with the templated message.

### Admin (React + Vitest/RTL)

- Manual status form sends correct payload to PATCH endpoint.
- Printer profile form validates dimensions and shows live cube preview.
- Settings page renders dimensions correctly when reloaded.

### E2E smoke

- Upload an oversize STL on mobile → upload succeeds; UI shows warning + Chat CTA; checkout button is disabled.
- Admin sets manual status → mobile receives push + sees banner with countdown.
- Admin edits status → mobile silently re-renders banner without push.
- Edit printer profile dimensions → next mobile upload reflects new bounds.

---

## Decisions Recap

| Decision | Choice |
|---|---|
| Manual status structure | Free-text + optional `estimatedCompletionAt` (Q1 = A) |
| Printer profile | Single admin-configurable singleton (Q2 = B) |
| Bounds detection | Server-side, post-upload, extending `/files/:id/inspect` (Q3 = A) |
| 3D preview library | `flutter_3d_controller` (STL/OBJ native, 3MF placeholder) (Q4 = B) |
| Oversize handling | Hard block + chat CTA pre-loaded with file context (Q5 = A) |
| Customer status surface | Order detail banner + one-time notification on first set (Q6 = recommended) |

---

## Out of Scope (Phase 2)

- Multiple printer profiles (per-printer routing).
- Auto-scale-to-fit slider.
- Server-side 3MF → GLB conversion for in-app rendering.
- Manual admin override flag (force-allow oversize).
- Per-axis rotation suggestion (e.g., "rotate 90° to fit").
- Slicing-time estimate / material estimate.
