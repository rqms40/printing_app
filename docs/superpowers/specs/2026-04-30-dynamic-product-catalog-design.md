# Dynamic Product Catalog Design

**Date:** 2026-04-30  
**Status:** Approved for implementation planning  
**Scope:** Fresh-migration design for server-driven product categories, specifications, options, pricing, admin management, and mobile rendering.

---

## Summary

GRID currently has two product categories in the mobile app: Paper Printing and 3D Printing. Their categories, specification fields, option values, file limits, and pricing are hardcoded in Flutter. The server and admin already have an early `ProductsModule` with `service_categories`, `spec_options`, and `service_addons`, but mobile does not use it and server order creation trusts client-provided totals.

This design replaces the loose option-group model with a structured, generic catalog:

- Admin manages categories, spec definitions, options, active flags, defaults, sort order, and pricing metadata.
- Mobile renders categories/spec screens from catalog data instead of Dart enums.
- Server validates active categories/specs/options and recomputes final pricing for quotes and orders.
- Orders snapshot the selected catalog labels/values/pricing so historical orders survive future catalog edits.

Fresh migration is allowed, so the design prioritizes the cleanest scalable schema over compatibility with the current product tables.

---

## Research Findings

### Mobile

Current flow is:

`/customer/order/new -> category -> paper-specs or 3d-specs -> upload -> checkout`

Important hardcoded values:

- Paper fields: paper size, color mode, media type, print sides, binding.
- Paper options: A1, A2, A3, A4, A5, 20x30, Custom; Black & White, Full Color; Glossy, Matte; Front Only, Back to Back; None, Spiral, Staple, Premium.
- 3D fields: file format, material, color, infill percentage, layer height, supports, notes.
- 3D options: STL, OBJ, 3MF; PLA, ABS, PETG; 10%, 20%, 50%, 100%; 0.1mm, 0.2mm, 0.3mm; supports yes/no.
- Upload limits are hardcoded: paper 50 MB with `pdf/png/jpg/jpeg/tif/tiff/docx`; 3D 200 MB with `stl/obj/3mf/glb/gltf`.
- Pricing is hardcoded in `apps/mobile/lib/utils/pricing_engine.dart`.

### Server

The existing `server/src/products` module already exposes categories, options, and addons. It uses loose `optionGroup` strings and returns inconsistent raw/camel/snake shapes. The orders module does not import products, and order create/batch accepts client totals/spec strings.

### Admin

`admin/src/pages/products` uses the product endpoints directly, not Refine CRUD hooks. It can manage categories, loose option groups, and addons, but cannot create empty spec groups, cannot manage spec definitions as first-class records, and hardcodes group behavior such as `binding`, `material`, and `infill`.

### Context7 Guidance Applied

- NestJS: keep controllers thin, use DTO validation, services for business logic, and module-scoped TypeORM repositories.
- TypeORM: model relations explicitly, use unique constraints for stable catalog keys, query active public views with ordered relations, and avoid eager-loading everything by default.
- Refine/Ant Design: use list/create/edit patterns and dynamic forms for CRUD-heavy admin pages.
- Riverpod: expose catalog and quote state as async providers/notifiers with explicit loading/error states and invalidation.

---

## Goals

- Let admins disable a spec or option, such as A4, and have mobile stop showing it.
- Let admins add/edit options for paper and 3D without a mobile release.
- Let mobile render current paper/3D behavior from database-backed schema.
- Make server pricing authoritative for quotes and final order creation.
- Keep the system flexible enough for future service types without adding a new table per category.
- Keep pricing understandable and rule-based, not arbitrary code stored in the database.

## Non-Goals

- No arbitrary formula editor in admin.
- No marketplace/product inventory system.
- No preservation of old product-table data beyond reseeding current paper/3D behavior.
- No full redesign of checkout, delivery, payments, or file analysis.

---

## Recommended Approach

Use a generic catalog with first-class spec definitions and options.

The database stores:

- What categories exist.
- What fields each category asks the customer to configure.
- What options each select field supports.
- Which categories/specs/options are active.
- Pricing metadata for the two current pricing models.

The server owns pricing. Mobile can call quote endpoints to display a live estimate, but the final order endpoint recomputes everything.

---

## Data Model

Use integer primary keys to match the existing TypeORM style and current admin/mobile expectations. Use `jsonb` for structured arrays/metadata where PostgreSQL supports it.

### `product_categories`

Top-level services shown on mobile.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial PK | |
| `name` | varchar(100) | Example: Paper Printing |
| `slug` | varchar(50) unique | Example: `paper`, `3d` |
| `description` | text nullable | Customer/admin display |
| `mobile_description` | varchar(160) nullable | Short category-card copy |
| `icon` | varchar(50) nullable | Icon key understood by clients |
| `file_processing_type` | varchar(30) | `document`, `model_3d`, `generic_file` |
| `pricing_model` | varchar(50) | `per_page_modifiers`, `base_plus_material_estimate` |
| `base_rate` | decimal(10,2) | Formula input |
| `quantity_unit` | varchar(30) | `copy`, `page`, `model` |
| `max_file_size_mb` | int | File picker/upload limit |
| `allowed_extensions` | jsonb | `["pdf","png"]` |
| `is_active` | boolean | Public visibility |
| `sort_order` | int | Public/admin ordering |
| `created_at` / `updated_at` | timestamp | |

### `product_spec_definitions`

One row per configurable field in a category.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial PK | |
| `category_id` | FK -> `product_categories.id` | Cascade on category delete during fresh migration |
| `key` | varchar(50) | Stable API key, unique per category |
| `label` | varchar(100) | Example: Paper Size |
| `help_text` | text nullable | Optional admin/customer hint |
| `input_type` | varchar(30) | `select`, `boolean`, `text`, `number` |
| `value_type` | varchar(30) | `string`, `integer`, `decimal`, `boolean` |
| `is_required` | boolean | Required before quote/order |
| `is_active` | boolean | If false, hidden from mobile |
| `default_value` | varchar(100) nullable | For text/number/boolean or fallback |
| `pricing_role` | varchar(40) | `none`, `multiplier`, `fixed_fee`, `unit_cost`, `estimated_quantity` |
| `unit_label` | varchar(20) nullable | Example: `%`, `mm`, `g` |
| `placeholder` | varchar(120) nullable | Text/number input placeholder |
| `min_value` | decimal nullable | Numeric validation |
| `max_value` | decimal nullable | Numeric validation |
| `step_value` | decimal nullable | Numeric UI step |
| `sort_order` | int | Screen order |
| `metadata` | jsonb nullable | Small client hints only |
| `created_at` / `updated_at` | timestamp | |

Constraints:

- Unique `(category_id, key)`.
- `input_type = select` requires at least one active option before public use.
- Required active select specs should have exactly one active default option.

### `product_spec_options`

Selectable values for `select` specs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial PK | |
| `spec_definition_id` | FK -> `product_spec_definitions.id` | Cascade on spec delete |
| `label` | varchar(100) | Example: A4, PLA, 20% |
| `value` | varchar(50) | Stable canonical value, snake_case |
| `multiplier` | decimal(8,3) | Default `1.000` |
| `fixed_fee` | decimal(10,2) | Default `0.00` |
| `unit_cost` | decimal(10,2) | Example: material cost per gram |
| `estimated_quantity` | decimal(10,2) nullable | Example: estimated grams |
| `is_default` | boolean | Default selection |
| `is_active` | boolean | Public visibility |
| `sort_order` | int | Option order |
| `metadata` | jsonb nullable | UI hints, color swatches later |
| `created_at` / `updated_at` | timestamp | |

Constraints:

- Unique `(spec_definition_id, value)`.
- Cannot disable/delete the last active option for an active required select spec.

### `service_addons`

Keep the addon concept, but point it at `product_categories`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial PK | |
| `category_id` | FK nullable | Null means global addon |
| `name` | varchar(100) | |
| `description` | text nullable | |
| `price` | decimal(10,2) | |
| `price_type` | varchar(20) | `flat`, `per_unit` |
| `is_active` | boolean | |
| `sort_order` | int | |
| `created_at` / `updated_at` | timestamp | |

### Order Snapshots

Replace category-specific order spec tables with generic snapshots.

#### `order_items`

Add:

- `category_id` nullable FK.
- `category_slug` varchar(50) not null.
- `category_name` varchar(100) not null.
- `pricing_model` varchar(50) not null.
- Keep file, quantity, and total price fields.

#### `order_item_spec_values`

One row per selected spec.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial PK | |
| `order_item_id` | FK -> `order_items.id` | Cascade |
| `spec_definition_id` | int nullable | Null if definition later removed |
| `spec_key` | varchar(50) | Snapshot |
| `spec_label` | varchar(100) | Snapshot |
| `input_type` | varchar(30) | Snapshot |
| `value` | varchar(120) | Canonical submitted value |
| `display_value` | varchar(120) | Label shown in history |
| `option_id` | int nullable | Selected option if select |
| `option_label` | varchar(100) nullable | Snapshot |
| `multiplier` | decimal(8,3) | Snapshot |
| `fixed_fee` | decimal(10,2) | Snapshot |
| `unit_cost` | decimal(10,2) | Snapshot |
| `estimated_quantity` | decimal(10,2) nullable | Snapshot |

This replaces `paper_specs` and `three_d_specs` in fresh databases. Existing admin/mobile order display should read these generic rows and format the common paper/3D keys nicely.

---

## Seed Catalog

Seed current mobile behavior with canonical snake_case values.

### Paper Printing

Category:

- `slug`: `paper`
- `file_processing_type`: `document`
- `pricing_model`: `per_page_modifiers`
- `base_rate`: `2.00`
- `max_file_size_mb`: `50`
- `allowed_extensions`: `pdf`, `png`, `jpg`, `jpeg`, `tif`, `tiff`, `docx`

Spec definitions:

- `paper_size`, select, required, pricing role `multiplier`
- `color_mode`, select, required, pricing role `multiplier`
- `media_type`, select, required, pricing role `multiplier`
- `print_sides`, select, required, pricing role `multiplier`
- `binding`, select, required, pricing role `fixed_fee`
- `page_count`, number, required, no pricing role as a spec option because the formula uses it directly

Options:

- `paper_size`: A1 `a1` 4.000, A2 `a2` 2.500, A3 `a3` 1.500, A4 `a4` 1.000 default, A5 `a5` 0.800, 20x30 `twenty_by_thirty` 3.000, Custom `custom` 2.000.
- `color_mode`: Black & White `black_and_white` 1.000 default, Full Color `full_color` 2.500.
- `media_type`: Matte `matte` 1.000 default, Glossy `glossy` 1.300.
- `print_sides`: Front Only `front_only` 1.000 default, Back to Back `back_to_back` 1.800.
- `binding`: None `none` fixed fee 0 default, Staple `staple` 10, Spiral `spiral` 25, Premium `premium` 50.

### 3D Printing

Category:

- `slug`: `3d`
- `file_processing_type`: `model_3d`
- `pricing_model`: `base_plus_material_estimate`
- `base_rate`: `50.00`
- `max_file_size_mb`: `200`
- `allowed_extensions`: `stl`, `obj`, `3mf`, `glb`, `gltf`

Spec definitions:

- `file_format`, select, required, pricing role `none`
- `material`, select, required, pricing role `unit_cost`
- `color`, text, required, pricing role `none`, default `White`
- `infill_percentage`, select, required, pricing role `estimated_quantity`
- `layer_height`, select, required, pricing role `none`
- `supports`, boolean, required, pricing role `none` with default false
- `notes`, text, optional, pricing role `none`

Options:

- `file_format`: STL `stl` default, OBJ `obj`, 3MF `3mf`.
- `material`: PLA `pla` unit cost 3 default, ABS `abs` unit cost 3, PETG `petg` unit cost 4.
- `infill_percentage`: 10% `10` estimated 20g, 20% `20` estimated 40g default, 50% `50` estimated 100g, 100% `100` estimated 200g.
- `layer_height`: 0.1mm `0.1`, 0.2mm `0.2` default, 0.3mm `0.3`.

For `supports`, the definition stores boolean labels/default. It does not need option rows unless admin later needs priced boolean variants.

---

## Pricing Rules

Pricing is rule-based in server code. Database values are inputs to known formulas.

### Paper: `per_page_modifiers`

Inputs:

- `base_rate`
- `page_count`
- active selected options with multipliers
- active selected options with fixed fees
- quantity
- addons

Formula:

```text
printSubtotal = (baseRate * pageCount * selectedMultipliers + fixedFees + addonFees) * quantity
```

### 3D: `base_plus_material_estimate`

Inputs:

- `base_rate`
- selected material `unit_cost`
- selected infill `estimated_quantity`
- selected option multipliers/fixed fees if configured later
- quantity
- addons

Formula:

```text
printSubtotal = (baseRate + estimatedQuantity * unitCost + fixedFees + addonFees) * quantity
```

If a future 3D file analysis provides actual grams, the quote service can prefer actual grams over the infill estimate while keeping the same pricing model.

---

## Server API

All routes keep the existing `/api` prefix.

### Public Catalog

#### `GET /products/catalog`

Returns active categories with active spec definitions, active options, active addons, file limits, defaults, and pricing metadata.

Use this for mobile category and spec rendering.

#### `GET /products/categories/:slug/catalog`

Returns the same structure for one category.

Use this when entering a category-specific flow or refreshing stale local catalog data.

### Quote

#### `POST /orders/quote`

Request:

```json
{
  "items": [
    {
      "categorySlug": "paper",
      "quantity": 1,
      "specs": {
        "paper_size": "a4",
        "color_mode": "black_and_white",
        "media_type": "matte",
        "print_sides": "front_only",
        "binding": "none",
        "page_count": 1
      },
      "addonIds": []
    }
  ],
  "deliveryOption": "pickup",
  "speedTier": "standard"
}
```

Response:

```json
{
  "items": [
    {
      "categorySlug": "paper",
      "printSubtotal": 2,
      "pricingBreakdown": [
        { "label": "Base", "amount": 2 },
        { "label": "A4", "amount": 0 },
        { "label": "Binding", "amount": 0 }
      ]
    }
  ],
  "subtotal": 2,
  "deliveryFee": 0,
  "serviceFee": 0,
  "total": 2
}
```

Quote validation:

- Category must exist and be active.
- Required active specs must be present.
- Unknown spec keys are rejected.
- Disabled specs/options are rejected if submitted.
- Select values must match active options.
- Number/text/boolean specs must match configured type and constraints.
- Addons must be active and either global or scoped to the selected category.

### Order Creation

`POST /orders/batch` should accept generic item specs and reuse the same pricing service as `/orders/quote`.

Client-provided item totals become optional hints only. The server recomputes and persists the real totals. If a client hint differs materially from server pricing, return a structured error or include a refreshed quote depending on product decision. The safer first behavior is to reject with `PRICE_CHANGED` and the new quote.

### Admin Catalog

Admin routes:

- `GET/POST/PATCH/DELETE /products/categories`
- `GET/POST/PATCH/DELETE /products/spec-definitions`
- `GET/POST/PATCH/DELETE /products/spec-options`
- `PATCH /products/spec-definitions/reorder`
- `PATCH /products/spec-options/reorder`
- `GET/POST/PATCH/DELETE /products/addons`

Delete should usually mean soft-disable for records that may be referenced by order history. Hard delete is acceptable only for never-used records in a fresh/admin-only state.

---

## Server Components

### `ProductsModule`

Owns catalog CRUD and public catalog reads.

Key services:

- `ProductsService`: CRUD and validation for categories/specs/options/addons.
- `CatalogReadService`: builds public active catalog payloads.
- `CatalogValidationService`: validates selected specs/options/addons.
- `CatalogPricingService`: computes quotes and order item snapshots.

### `OrdersModule`

Imports `ProductsModule` or a dedicated exported pricing service.

Changes:

- `CreateBatchOrderDto` accepts generic `specs: Record<string, unknown>` and `addonIds`.
- Order creation calls `CatalogPricingService` inside the transaction.
- Order item/spec snapshot rows are created from the pricing result.
- Existing delivery slot, 3D bounds, payment, credits, and notification behavior remains.

---

## Mobile Design

### Catalog State

Add Riverpod providers under a catalog/order feature boundary:

- `catalogProvider`: fetches `GET /products/catalog`.
- `categoryCatalogProvider(slug)`: fetches one category, with catalog cache fallback.
- `quoteProvider` or `QuoteNotifier`: posts `/orders/quote` after selected specs change.

State handling:

- Loading: show skeleton/progress.
- Error: show services unavailable with retry.
- Refresh: invalidate catalog after app resume or checkout price mismatch.

Do not fall back to hardcoded orderable products. A stale hardcoded fallback can let customers order disabled services.

### Category Screen

Render active categories sorted by `sort_order`.

Use catalog icon keys with a small client-side icon mapping. Unknown icons use a generic service icon.

### Spec Screen

Replace `PaperSpecsScreen` and `ThreeDSpecsScreen` internals with schema-driven rendering. The route may stay category-specific at first, but the UI should consume a `ProductCategoryCatalog`.

Input mapping:

- `select`: chip selector from active options.
- `boolean`: segmented yes/no or switch.
- `text`: text field.
- `number`: numeric input with min/max/step.

Defaults come from active default options or spec `default_value`.

Category-specific behavior remains by key:

- Paper upload inspection passes selected `paper_size`.
- 3D upload inspection and preview still use `file_processing_type = model_3d`.
- `color` and `notes` remain normal text specs.

### Cart And Checkout

Replace enum-specific `PaperSpecs` and `ThreeDSpecs` on `CartItem` with:

```dart
Map<String, CatalogSelectedSpec> selectedSpecs
```

Each selected spec stores:

- `specKey`
- `value`
- `displayValue`
- `specLabel`
- optional `optionId`

Checkout displays specs from this generic list. It can have formatting helpers for paper/3D, but should not need enums.

Price preview is the latest server quote. When editing item specs in checkout, request a new quote and update item subtotal from the quote.

### Upload

Allowed extensions and max size come from selected category catalog.

The current file analysis routes remain:

- `/files/:id/inspect?paperSize=a4` for paper-like document processing.
- `/files/:id/inspect` for 3D model processing.

MIME helpers should align with catalog extensions, including `docx`, `tif`, `tiff`, `glb`, and `gltf`.

---

## Admin Design

### Products Page

Show category cards/table with:

- Name, slug, description.
- Active switch.
- Sort order.
- File processing type.
- Pricing model.
- Base rate.
- Max file size.
- Allowed extensions.
- Spec count and active option count.

Create/edit drawer includes all category fields, including active flag.

### Category Detail Page

Replace loose option-group tabs with spec-definition management.

Spec definition rows show:

- Label/key.
- Input type.
- Required/active.
- Default.
- Pricing role.
- Sort order.
- Option count for select specs.

For each spec:

- Select specs expose nested option CRUD.
- Boolean specs expose labels/default and optional fixed fee later.
- Number/text specs expose constraints/placeholder/default.

Options show:

- Label/value.
- Active/default.
- Sort order.
- Pricing fields based on the parent spec pricing role.

Pricing field display should be driven by `pricing_role`, not hardcoded names like `binding`, `material`, or `infill`.

### Addons Page

Keep the current addon page but point it at the new category table and expose active flag in create/edit forms.

### Mock Fallback

Remove silent mock fallback for product admin pages. If the API fails, show an error and retry action. Silent fallback makes admins believe changes are saved when they are not.

---

## Validation And Error Handling

### Admin

- Reject duplicate category slugs.
- Reject duplicate spec keys within a category.
- Reject duplicate option values within a spec.
- Reject invalid JSON/extension input before save.
- Prevent disabling the last active option for an active required select spec.
- Warn when disabling a required spec that existing mobile flows depend on.

### Mobile

- If quote returns inactive/missing selection, clear the invalid selection and ask the user to choose again.
- If final order returns `PRICE_CHANGED`, refresh quote and require the user to place order again.
- If catalog is unavailable, block new ordering and show retry.

### Server

- Treat catalog validation errors as `400 Bad Request` with structured codes.
- Treat inactive category/spec/option as stale client state.
- Treat missing required specs as validation errors.
- Treat price mismatch as `409 Conflict` or `400 Bad Request` with a refreshed quote payload.

Suggested error codes:

- `CATEGORY_INACTIVE`
- `SPEC_REQUIRED`
- `SPEC_INACTIVE`
- `OPTION_INACTIVE`
- `OPTION_INVALID`
- `ADDON_INVALID`
- `PRICE_CHANGED`

---

## Migration Plan

Because fresh migration is acceptable:

1. Drop or stop using old product catalog tables: `service_categories`, `spec_options`, `service_addons`.
2. Drop or stop using category-specific spec tables: `paper_specs`, `three_d_specs`.
3. Create the new catalog and generic order spec snapshot tables.
4. Update seed data to insert the paper and 3D catalog described above.
5. Update order seed data to use generic `order_item_spec_values`.
6. Remove old DTO/entity references after consumers are migrated.

If production historical data needs to be preserved later, create a separate backfill plan before running this migration in production. This spec assumes a fresh reset is allowed.

---

## Testing Plan

### Server

- Catalog seed tests verify paper and 3D categories, specs, defaults, active flags, allowed extensions, and pricing metadata.
- `CatalogPricingService` unit tests cover:
  - Paper A4 black-and-white matte front-only no binding.
  - Paper full color / binding fixed fees.
  - 3D PLA 20% infill.
  - Inactive category/spec/option rejection.
  - Missing required spec rejection.
  - Addon pricing.
- Order service tests verify:
  - Client totals are ignored/recomputed.
  - Snapshot rows are persisted.
  - `PRICE_CHANGED` behavior when client quote is stale.
- Controller tests cover `/products/catalog`, `/products/categories/:slug/catalog`, `/orders/quote`, and `/orders/batch`.

### Mobile

- Catalog model parsing tests.
- Spec selection reducer/notifier tests.
- Quote request/response tests.
- Category screen provider-state tests.
- Schema-driven spec widget tests for select, boolean, text, and number inputs.
- Upload tests verify file limits/extensions come from catalog.
- Checkout edit tests verify price recalculates after spec edits.

### Admin

- Normalizer tests for category/spec/option/addon payloads.
- Product category form tests for active/file/pricing fields.
- Spec definition create/edit tests.
- Option pricing-field visibility tests driven by `pricing_role`.
- Error-state tests for failed product API calls without mock fallback.

---

## Implementation Order

1. Server schema/entities/migration/seed.
2. Server catalog read, validation, and pricing services.
3. Server quote endpoint and order creation integration.
4. Admin category/spec/option/addon management.
5. Mobile catalog models/providers and category screen.
6. Mobile schema-driven spec screen and quote preview.
7. Mobile cart/checkout generic spec values and order submission.
8. Cleanup old enums/pricing paths and remove compatibility code.

This order keeps the source of truth available before mobile depends on it.

---

## Open Decisions Resolved

- Server is the source of truth for pricing and active catalog validation.
- Fresh migration is acceptable.
- The design supports future category types, but first seed and verify paper and 3D.
- Pricing remains code-defined and database-parameterized.
- Mobile does not use stale hardcoded product fallback for orderable services.
