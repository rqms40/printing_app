# Products & Pricing Schema Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Dynamic product/pricing system for GRID — NestJS backend module + admin Refine UI full CRUD

---

## Problem

All pricing data is hardcoded in the Flutter app (`AppConstants`, `PricingEngine`). The admin cannot change a base rate, add a new paper size, or introduce a new 3D material without a code change and app release. The admin products page shows 10 static mock entries with no backend persistence.

## Approach: Hybrid Dynamic Pricing

Keep the existing formula-based pricing engine. Move every **input** to the formula (base rates, multipliers, fixed fees, estimated grams, file constraints) into the database so admins can manage them through the dashboard. The Flutter `PricingEngine` fetches config from the API instead of reading `AppConstants`.

This allows:
- Adding new paper sizes, materials, binding types without code changes
- Adjusting pricing multipliers instantly
- Toggling options on/off (e.g., temporarily disable premium binding)
- Editing file size limits and allowed extensions per category

---

## Database Schema

### Table: `service_categories`

Represents top-level service types (Paper Printing, 3D Printing, future: Laser Cutting).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| name | varchar(100) | NOT NULL | "Paper Printing" |
| slug | varchar(50) | UNIQUE NOT NULL | "paper", "3d" |
| description | text | nullable | |
| icon | varchar(50) | nullable | Ant Design icon name |
| base_rate | decimal(10,2) | NOT NULL | ₱2.00 paper, ₱50.00 3D |
| max_file_size_mb | int | NOT NULL default 50 | |
| allowed_extensions | text | NOT NULL | JSON array string |
| is_active | boolean | default true | |
| sort_order | int | default 0 | |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### Table: `spec_options`

One row per chooseable option within a spec group (e.g., "A4" in "paper_size" group). Holds all the pricing weights for that option.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| category_id | int | FK → service_categories NOT NULL | |
| group | varchar(50) | NOT NULL | "paper_size", "color_mode", "media_type", "print_sides", "binding", "material", "file_format", "infill", "layer_height" |
| label | varchar(100) | NOT NULL | Display name: "A4", "Full Color" |
| value | varchar(50) | NOT NULL | API/code slug: "a4", "full_color" |
| multiplier | decimal(6,3) | default 1.000 | Pricing multiplier (>0) |
| fixed_fee | decimal(10,2) | default 0.00 | Additive fee in ₱ (bindings) |
| unit_cost | decimal(10,2) | default 0.00 | Per-unit cost in ₱ (₱/gram for materials) |
| estimated_grams | int | nullable | For infill options: rough gram weight |
| is_default | boolean | default false | Pre-selected in order flow UI |
| is_active | boolean | default true | |
| sort_order | int | default 0 | |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |
| **UNIQUE** | | (category_id, group, value) | No duplicate slugs per group |

**Validation rules:**
- `multiplier` must be > 0
- `fixed_fee`, `unit_cost` must be >= 0
- At least one option per group must remain `is_active = true` (enforced in service layer)
- Cannot delete a category that has existing orders

### Table: `service_addons`

Optional extras that can be added to an order (lamination, rush processing, etc.).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| category_id | int | FK nullable | null = applies to all categories |
| name | varchar(100) | NOT NULL | "Lamination", "Rush Processing" |
| description | text | nullable | |
| price | decimal(10,2) | NOT NULL | |
| price_type | varchar(20) | NOT NULL | "flat" or "per_unit" |
| is_active | boolean | default true | |
| sort_order | int | default 0 | |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### Seed Data

Migrates all current hardcoded values from `AppConstants` and `PricingEngine` into the database.

**Paper Printing category** (base_rate=2.00, max_file_size_mb=50, extensions=["pdf","png","jpg","jpeg","docx"]):

| group | label | value | multiplier | fixed_fee |
|-------|-------|-------|-----------|-----------|
| paper_size | A5 | a5 | 0.800 | 0 |
| paper_size | A4 | a4 | 1.000 | 0 | ← default |
| paper_size | A3 | a3 | 1.500 | 0 |
| paper_size | A2 | a2 | 2.500 | 0 |
| paper_size | A1 | a1 | 4.000 | 0 |
| paper_size | 20×30in | twenty_by_thirty | 3.000 | 0 |
| paper_size | Custom | custom | 2.000 | 0 |
| color_mode | Black & White | black_and_white | 1.000 | 0 | ← default |
| color_mode | Full Color | full_color | 2.500 | 0 |
| media_type | Matte | matte | 1.000 | 0 | ← default |
| media_type | Glossy | glossy | 1.300 | 0 |
| print_sides | Front Only | front_only | 1.000 | 0 | ← default |
| print_sides | Back-to-Back | back_to_back | 1.800 | 0 |
| binding | None | none | 1.000 | 0.00 | ← default |
| binding | Staple | staple | 1.000 | 10.00 |
| binding | Spiral | spiral | 1.000 | 25.00 |
| binding | Premium | premium | 1.000 | 50.00 |

**3D Printing category** (base_rate=50.00, max_file_size_mb=200, extensions=["stl","obj","3mf"]):

| group | label | value | multiplier | unit_cost | estimated_grams |
|-------|-------|-------|-----------|-----------|-----------------|
| file_format | STL | stl | 1.000 | 0 | null | ← default |
| file_format | OBJ | obj | 1.000 | 0 | null |
| file_format | 3MF | three_mf | 1.000 | 0 | null |
| material | PLA | pla | 1.000 | 3.00 | null | ← default |
| material | ABS | abs | 1.000 | 3.00 | null |
| material | PETG | petg | 1.000 | 4.00 | null |
| infill | 10% | infill_10 | 1.000 | 0 | 20 | ← default |
| infill | 20% | infill_20 | 1.000 | 0 | 40 |
| infill | 50% | infill_50 | 1.000 | 0 | 100 |
| infill | 100% | infill_100 | 1.000 | 0 | 200 |
| layer_height | 0.1mm | layer_01 | 1.000 | 0 | null |
| layer_height | 0.2mm | layer_02 | 1.000 | 0 | null | ← default |
| layer_height | 0.3mm | layer_03 | 1.000 | 0 | null |

---

## Pricing Formulas (unchanged, inputs now from DB)

**Paper:**
```
price = (base_rate × size.multiplier × color.multiplier × media.multiplier × sides.multiplier
         + binding.fixed_fee) × quantity
```

**3D:**
```
price = (base_rate + infill.estimated_grams × material.unit_cost) × quantity
```

The mobile `PricingEngine` fetches config once per session from `/api/products/categories/:slug/pricing` and caches it. Falls back to `AppConstants` if offline.

---

## NestJS Backend

### Module: `server/src/products/`

```
products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── dto/
│   ├── create-category.dto.ts
│   ├── update-category.dto.ts
│   ├── create-spec-option.dto.ts
│   ├── update-spec-option.dto.ts
│   ├── reorder-options.dto.ts
│   ├── create-addon.dto.ts
│   └── update-addon.dto.ts
└── entities/
    ├── service-category.entity.ts
    ├── spec-option.entity.ts
    └── service-addon.entity.ts
```

### Endpoints

All write endpoints require `JwtAuthGuard` + `@Roles('admin')`.

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/products/categories` | public | List all active categories |
| GET | `/api/products/categories/:id` | public | Get category with options + addons |
| GET | `/api/products/categories/:slug/pricing` | public | Full pricing config for mobile app |
| POST | `/api/products/categories` | admin | Create category |
| PATCH | `/api/products/categories/:id` | admin | Update category |
| DELETE | `/api/products/categories/:id` | admin | Soft-delete (set is_active=false) |
| GET | `/api/products/options` | public | List options (filter: category_id, group) |
| POST | `/api/products/options` | admin | Create spec option |
| PATCH | `/api/products/options/reorder` | admin | Batch update sort_order — **must be declared before `:id` route** |
| PATCH | `/api/products/options/:id` | admin | Update spec option |
| DELETE | `/api/products/options/:id` | admin | Delete spec option |
| GET | `/api/products/addons` | public | List addons (filter: category_id) |
| POST | `/api/products/addons` | admin | Create addon |
| PATCH | `/api/products/addons/:id` | admin | Update addon |
| DELETE | `/api/products/addons/:id` | admin | Delete addon |

### Service-layer validations

- Deleting a category with linked orders → 409 Conflict
- Disabling the last active option in a group → 400 Bad Request
- Duplicate (category_id, group, value) → 409 Conflict
- multiplier ≤ 0 → 400 Bad Request

---

## Admin Dashboard UI

### Routes (Refine)

| Route | Page | Purpose |
|-------|------|---------|
| `/admin/products` | Categories overview | Cards for each service category |
| `/admin/products/:id/options` | Spec options | Tabbed view by group, inline editing |
| `/admin/products-addons` | Addons | Table with full CRUD |

> Note: Addons uses `/admin/products-addons` (not `/admin/products/addons`) to avoid React Router matching "addons" as the `:id` param.

### Page 1: `/admin/products` — Categories Overview

- Card per category: name, slug badge, base_rate, file limits, active toggle
- "Edit" opens a side drawer with all fields
- "Manage Specs" button → navigates to `/admin/products/:id/options`
- "Manage Addons" button → navigates to `/admin/products/addons?category_id=:id`
- "New Category" button for future service types

### Page 2: `/admin/products/:id/options` — Spec Options

- Breadcrumb: Products → [Category Name] → Spec Options
- Ant Design `Tabs` — one tab per spec group
- Each tab: sortable list (drag-handle + sort_order), columns: label, value, multiplier, fixed_fee, unit_cost, estimated_grams (only visible for relevant groups), is_default radio, is_active toggle
- Inline editing: click a cell to edit, saves on Enter/blur
- "Add Option" button per tab → small form modal
- Delete icon per row (disabled if last active option in group)

### Page 3: `/admin/products/addons` — Addons

- Ant Design `Table` with columns: name, category, price, price_type, is_active, actions
- Create/Edit via `Modal` form
- Delete with confirmation

### Data fallback

All three pages fall back to current mock data if the API is unreachable, same pattern as orders and drivers pages.

---

## Mobile App Changes

### `PricingConfigProvider` (new Riverpod provider)

- Fetches `/api/products/categories/:slug/pricing` once per session
- Caches in memory; retries on network restore
- Fallback: returns hardcoded `AppConstants` values if offline

### `PricingEngine` changes

- Constructor accepts `PricingConfig` instead of reading `AppConstants` directly
- Existing formula logic unchanged
- `SpecOptionsNotifier` — new provider for each order flow screen that reads available options from pricing config instead of hardcoded enum lists

### `AppConstants` (unchanged)

Kept as offline fallback values only. Not used when API is available.

---

## Implementation Order

1. **NestJS entities + migration** — create 3 tables, seed data
2. **NestJS service + controller** — all 14 endpoints with validation
3. **Admin UI** — 3 pages with real API connection
4. **Mobile `PricingConfigProvider`** — fetch + cache pricing config
5. **Mobile order flow** — wire spec selectors to dynamic options
6. **Mobile `PricingEngine`** — accept config instead of constants

Steps 1–3 (backend + admin) are fully independent of 4–6 (mobile). Steps 4–6 are sequential.

---

## Out of Scope

- Promotional pricing / discount codes
- Volume pricing tiers
- Customer-facing product catalog page
- Product images/media upload
- Historical pricing for old orders (orders store computed price, not spec_option IDs)
