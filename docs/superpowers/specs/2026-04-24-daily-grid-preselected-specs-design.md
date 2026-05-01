# Daily Grid Preselected Specs Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tapping a Daily Grid card routes the customer into the printing flow with specs pre-populated from admin-configured values, and gives admins a full CRUD UI to manage Daily Grid cards including image upload and spec presets.

**Architecture:** Two nullable JSON columns added to `daily_grid_cards` carry per-card spec presets. Admin React app gets a new `/daily-grid` management page (built with frontend-design skill). Mobile tap handler reads card specs and pre-populates `OrderFlowState` before navigating to the specs screen.

**Tech Stack:** NestJS + TypeORM (migration) · MinIO (image upload) · React + Ant Design (admin) · Flutter + Riverpod (mobile)

---

## Subsystems

This feature spans three independent subsystems delivered in order:

1. **Server** — entity + migration + DTO + image upload endpoint
2. **Admin UI** — Daily Grid management page with frontend-design
3. **Mobile** — model update + tap handler pre-population

---

## Section 1: Server

### Entity changes

`DailyGridCard` entity (`server/src/daily-grid/entities/daily-grid-card.entity.ts`) gains two new columns:

```typescript
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
```

### Migration

One TypeORM migration adds both nullable JSONB columns to `daily_grid_cards`. Existing rows get `NULL` for both columns.

### DTO changes

`CreateDailyGridCardDto` and `UpdateDailyGridCardDto` gain optional `paperSpecs` and `threeDSpecs` fields:

```typescript
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
```

### Image upload endpoint

New endpoint on `DailyGridController`:

```
POST /daily-grid/admin/upload-image
Auth: admin JWT
Body: multipart/form-data, field name: "file"
Response: { url: string }
```

Uses `StorageService` (`server/src/storage/storage.service.ts`) to upload to MinIO private bucket and return a presigned URL stored in the card's `imageUrl`. Returns `{ url: string }` on success.

### Public GET response

`GET /daily-grid` already returns all card fields — `paperSpecs` and `threeDSpecs` are included automatically since they are entity columns. No controller change needed.

---

## Section 2: Admin UI

### Route

New route `/daily-grid` added to `admin/src/App.tsx`. Linked from the main navigation sidebar.

### Page layout

Built using the `frontend-design` skill. Distinctive admin aesthetic — not generic. Two parts:

**Card list (left/main area)**
- Displays all cards (active + inactive) in sort order
- Each row: image thumbnail (40×40px), title, category badge (Paper / 3D), active toggle (inline switch), Edit button, Delete button
- Drag-to-reorder: on drop fires `PATCH /daily-grid/admin/reorder` with new ID array
- "Add Card" button at top right opens the drawer in create mode

**Create/Edit drawer (right side, 480px)**

Fields in order:
1. **Title** — text input, required
2. **Subtitle** — text input, optional
3. **Category** — segmented control: `Paper` / `3D` — determines which spec section renders
4. **Active** — toggle switch
5. **Image** — drag-drop upload zone; on file select calls `POST /daily-grid/admin/upload-image`, shows preview on success. Displays existing image URL if editing.
6. **Spec section** (conditional on category):

   *Paper specs* (all dropdowns, all optional — show placeholder "Default" when unset):
   - Paper Size: A4 / A3 / Letter / Legal
   - Color Mode: B&W / Full Color
   - Media Type: Bond / Glossy / Matte
   - Print Sides: Single / Double
   - Binding: None / Spiral / Staple

   *3D specs* (all optional):
   - File Format: STL / OBJ / 3MF (dropdown)
   - Material: PLA / ABS / PETG (dropdown)
   - Color: text input
   - Infill %: number input 0–100
   - Layer Height: 0.10 / 0.15 / 0.20 / 0.30 mm (dropdown)
   - Supports: toggle
   - Notes: textarea

Save button calls `POST /daily-grid/admin` (create) or `PATCH /daily-grid/admin/:id` (update). Delete shows confirmation popconfirm then calls `DELETE /daily-grid/admin/:id`.

### API service

`admin/src/services/dailyGridApi.ts` — typed functions:
- `getAdminCards()` → `GET /daily-grid/admin`
- `createCard(dto)` → `POST /daily-grid/admin`
- `updateCard(id, dto)` → `PATCH /daily-grid/admin/:id`
- `deleteCard(id)` → `DELETE /daily-grid/admin/:id`
- `reorderCards(ids)` → `PATCH /daily-grid/admin/reorder`
- `uploadImage(file)` → `POST /daily-grid/admin/upload-image`

---

## Section 3: Mobile

### Model update

`DailyGridItem` (`apps/mobile/lib/shared/models/daily_grid_item.dart`) gains:

```dart
final Map<String, dynamic>? paperSpecs;
final Map<String, dynamic>? threeDSpecs;
```

Parsed from `fromJson`:
```dart
paperSpecs: json['paperSpecs'] as Map<String, dynamic>?,
threeDSpecs: json['threeDSpecs'] as Map<String, dynamic>?,
```

### Tap handler update

In `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart`, the `_selectCategory` method (or equivalent tap callback) is updated:

```dart
void _onCardTap(BuildContext context, WidgetRef ref, DailyGridItem card) {
  final notifier = ref.read(orderFlowProvider.notifier);
  // 1. Reset flow and set category
  notifier.reset();
  notifier.setCategory(card.category);
  // 2. Pre-populate specs from card if present
  if (card.category == 'paper' && card.paperSpecs != null) {
    notifier.setPaperSpecsFromMap(card.paperSpecs!);
  } else if (card.category == '3d' && card.threeDSpecs != null) {
    notifier.setThreeDSpecsFromMap(card.threeDSpecs!);
  }
  // 3. Advance to specs screen (step 1)
  notifier.goToStep(1);
  if (card.category == 'paper') {
    context.push('/customer/order/paper-specs');
  } else {
    context.push('/customer/order/3d-specs');
  }
}
```

### OrderFlowNotifier additions

Two new methods on `OrderFlowNotifier`:

```dart
void setPaperSpecsFromMap(Map<String, dynamic> map) {
  // Merges map values over existing defaults
  // Only sets fields that are non-null in the map
}

void setThreeDSpecsFromMap(Map<String, dynamic> map) {
  // Same pattern for 3D specs
}
```

The specs screens already read from `OrderFlowState` — pre-populated values appear automatically.

---

## Data Flow

```
Admin sets specs on card (PATCH /daily-grid/admin/:id)
  ↓
daily_grid_cards.paper_specs / three_d_specs saved as JSONB
  ↓
GET /daily-grid returns specs in card payload
  ↓
Mobile DailyGridItem.fromJson parses specs
  ↓
User taps card → _onCardTap
  ↓
notifier.setPaperSpecsFromMap / setThreeDSpecsFromMap
  ↓
OrderFlowState updated with preset specs
  ↓
context.push('/customer/order/paper-specs')
  ↓
PaperSpecsScreen reads OrderFlowState → fields pre-filled
  ↓
User reviews/adjusts → continues to upload
```

---

## Error Handling

- Image upload failure: show error toast in admin drawer, field stays empty
- Card save failure: show error message in drawer, drawer stays open
- Mobile: if card has no specs (`paperSpecs == null`), tap behaves as today — navigates to specs screen with defaults unchanged
- 3D card with paper specs set (or vice versa): only the matching specs object is applied; the mismatched one is ignored

---

## Testing

**Server:**
- Unit: `DailyGridService` saves/returns `paperSpecs` and `threeDSpecs` correctly
- Unit: DTOs accept valid spec objects and reject non-objects
- Unit: image upload endpoint returns `{ url }` and delegates to storage service

**Admin:**
- Component test: drawer shows paper spec fields when category=Paper, 3D fields when category=3D
- Component test: image upload triggers API call and shows preview

**Mobile:**
- Unit: `DailyGridItem.fromJson` parses `paperSpecs` and `threeDSpecs` correctly
- Unit: `setPaperSpecsFromMap` sets only non-null fields in `OrderFlowState`
- Widget test: tapping a card with `paperSpecs` pre-fills the paper specs screen fields
