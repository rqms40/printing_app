# GRIDGO Catalog RFQ and Release 1.10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `GRIDGOv3` with `main`, replace the legacy Paper/3D order entry with four groups and seventeen seeded products, deliver a catalog-driven RFQ lifecycle, and release the verified result as `v1.10.0`.

**Architecture:** Keep `product_categories` as the leaf product table and add browsing-group metadata. Preserve the existing instant-priced Paper/3D API for historical compatibility, while new `quote_required` products use a dedicated RFQ endpoint that creates one independently matchable `Order` per product line. Supplier acceptance supplies the quote, customer acceptance selects the payment rail, and existing Operations payment authorization remains the production gate.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Jest, Flutter/Riverpod/GoRouter, React/Vite/Refine/Ant Design, Vitest, Playwright, Docker Compose, GitHub Actions.

## Global Constraints

- Product source: `docs/superpowers/specs/2026-08-10-catalog-rfq-release-1.10-design.md`.
- Release baseline: `origin/main` at `8ad8447` (`v1.9.1`) and local `GRIDGOv3` containing `a16f9ec` plus approved docs.
- Four browsing groups and exactly seventeen active orderable products; legacy `paper` and `3d` are inactive for new orders but remain readable.
- RFQs never display a fabricated zero price and cannot expose payment controls before supplier quote and customer acceptance.
- Money is stored in PHP minor units; suppliers never see artwork before Operations approval.
- Each RFQ line is independently matchable, even when submitted in one batch.
- Production still requires existing Operations/Super Admin payment authorization.
- Client quote acceptance is not payment authorization.
- All catalog rules, required specifications, and upload policies are server-owned.
- Mobile and Admin must never coerce unknown leaf slugs to Paper or 3D.
- Preserve unrelated user changes and both parents' behavior during integration.
- Version target: mobile `1.10.0+26`, app metadata `1.10.0` / build `26`, tag `v1.10.0`.
- Tag only the exact verified commit on `main`; the release workflow must publish the signed APK and GitHub release.

---

## Planned File Structure

### Backend catalog and persistence

- Create `server/src/products/catalog-v1-10.definition.ts`: immutable four-group/seventeen-product definition and reusable specification templates.
- Create `server/src/products/catalog-v1-10.definition.spec.ts`: definition invariants.
- Create `server/src/products/catalog-v1-10.persistence.ts`: catalog upsert/deactivation helper shared by migration and seed.
- Create `server/src/products/catalog-v1-10.persistence.spec.ts`: idempotent persistence tests.
- Create `server/migrations/1784334500000-catalog-rfq-v1-10.ts`: group, RFQ, upload binding, requirement-date, and capability schema migration plus catalog upsert.
- Create `server/src/database/catalog-rfq-v1-10-migration.spec.ts`: migration contract.
- Modify catalog entities/DTOs/services/controllers under `server/src/products/`.
- Modify `server/src/seed.ts`; delete `server/add-cats.ts`.

### Backend RFQ, quote, matching, and uploads

- Create `server/src/orders/dto/submit-rfq.dto.ts`: RFQ batch contract.
- Create `server/src/orders/dto/accept-quote.dto.ts`: owner quote-acceptance contract.
- Modify `server/src/orders/entities/order.entity.ts`, `order-item.entity.ts`, `orders.service.ts`, `orders.controller.ts`, `orders.module.ts`, state-transition and authorization tests.
- Create `server/src/files/catalog-upload-policy.service.ts` and its spec.
- Create `server/src/files/dto/catalog-upload.dto.ts`; modify file metadata/controller/service/module and storage MIME configuration.
- Modify supplier capability, matching, supplier-job acceptance, payments, and admin API projections.

### Flutter mobile

- Modify catalog model/provider and replace two-choice fallback with a v1.10 snapshot plus server-authority state.
- Create group/product browsing screens and cards.
- Create one generic catalog requirements screen and dynamic field widget.
- Make cart/review/submission nullable-price aware and add the RFQ API call.
- Add dynamic order pricing models, quote card, and customer quote-acceptance action.
- Preserve explicit legacy Paper/3D rendering paths.

### React Admin

- Extend catalog and order types/normalizers.
- Group the existing Products page by catalog group and support `quote_required` fields.
- Create reusable dynamic product/specification/price renderers for Orders and QA.
- Align the existing supplier price/date acceptance UI with RFQ pricing state.

### Integration and release

- Update marketplace and beta Playwright contracts, add catalog visual evidence, and include the marketplace contract in CI.
- Update mobile version metadata.
- Verify locally, through the pull request, on merged `main`, and through exact-SHA visual evidence before tagging.

---

### Task 1: Integrate `GRIDGOv3` into a release branch and capture a baseline

**Files:**
- Create: `docs/superpowers/specs/2026-08-10-v1.10-integration-baseline.md`
- Review: the 19 dual-edited paths listed below

**Interfaces:**
- Consumes: `origin/main`, local `GRIDGOv3` with approved design and plan commits.
- Produces: `release/v1.10.0-catalog` containing both histories and an evidence-backed pre-feature baseline.

- [ ] **Step 1: Refresh remote state and prove the expected ancestry**

Run:

```bash
git fetch origin --prune --tags
git status --short --branch
git rev-list --left-right --count origin/main...GRIDGOv3
git merge-base origin/main GRIDGOv3
```

Expected: clean tree; local `GRIDGOv3` is ahead only by approved docs; no unreviewed remote movement. If `origin/main` or `origin/GRIDGOv3` moved, repeat the read-only comparison before branching.

- [ ] **Step 2: Create the integration branch and preserve both histories**

Run:

```bash
git switch -c release/v1.10.0-catalog origin/main
git merge --no-ff GRIDGOv3 -m "merge: integrate GRIDGOv3 for release 1.10"
```

Expected: a merge commit. `git merge-tree` predicts no textual conflicts; do not squash or rebase.

- [ ] **Step 3: Semantically review every dual-edited file**

Review these exact paths with `git diff $(git merge-base origin/main GRIDGOv3)..HEAD -- <path>`:

```text
apps/mobile/lib/config/routes/app_router.dart
apps/mobile/lib/features/auth/providers/auth_provider.dart
apps/mobile/lib/features/customer/chat/screens/conversation_screen.dart
apps/mobile/lib/features/customer/home/screens/home_screen.dart
apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart
apps/mobile/lib/features/customer/order/screens/checkout_screen.dart
apps/mobile/lib/features/customer/order/sheets/payment_method_sheet.dart
apps/mobile/lib/features/customer/orders/providers/orders_provider.dart
apps/mobile/lib/features/rider/active_delivery/screens/active_delivery_screen.dart
apps/mobile/lib/features/rider/deliveries/screens/delivery_detail_screen.dart
apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart
apps/mobile/lib/features/rider/profile/screens/rider_profile_screen.dart
apps/mobile/lib/features/rider/shared/widgets/proof_of_delivery_sheet.dart
apps/mobile/test/features/customer/home/screens/home_screen_test.dart
apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart
server/src/app.module.ts
server/src/chat/chat.gateway.spec.ts
server/src/chat/chat.gateway.ts
server/src/chat/chat.service.ts
```

Preserve v1.9.1 accessibility/tutorial, home/checkout, rider UX, and chat acknowledgement fixes together with GRIDGOv3 marketplace roles, supplier flows, payment gates, OTP/proof controls, and module registrations.

- [ ] **Step 4: Run the smallest merged-baseline gates**

Run:

```bash
cd server && npm ci && npm run lint:check && npm run build && npm test -- --runInBand
cd ../admin && npm ci && npx tsc --noEmit && npm test && npm run build
cd ../apps/mobile && fvm flutter pub get && fvm flutter analyze lib/ && fvm flutter test
cd ../../e2e/mobile-web && npm ci && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts tests/marketplace-workflow.spec.ts
```

Expected: pass, or a failure reproduced independently on one parent and documented as pre-existing.

- [ ] **Step 5: Record and commit the integration baseline**

Write the exact parent SHAs, merge SHA, commands, pass/fail counts, and parent-reproduction evidence to `docs/superpowers/specs/2026-08-10-v1.10-integration-baseline.md`.

```bash
git add docs/superpowers/specs/2026-08-10-v1.10-integration-baseline.md
git commit -m "docs: record v1.10 integration baseline"
```

---

### Task 2: Define and migrate the canonical v1.10 catalog

**Files:**
- Create: `server/src/products/catalog-v1-10.definition.ts`
- Create: `server/src/products/catalog-v1-10.definition.spec.ts`
- Create: `server/migrations/1784334500000-catalog-rfq-v1-10.ts`
- Create: `server/src/database/catalog-rfq-v1-10-migration.spec.ts`
- Modify: `server/src/products/enums/catalog.enums.ts`
- Modify: `server/src/products/entities/product-category.entity.ts`
- Modify: `server/src/orders/entities/order.entity.ts`
- Modify: `server/src/orders/entities/order-item.entity.ts`
- Modify: `server/src/files/entities/file-metadata.entity.ts`
- Modify: `server/src/suppliers/entities/supplier-capability.entity.ts`
- Modify: `server/src/database/data-source.ts`

**Interfaces:**
- Produces: `CATALOG_VERSION`, `CATALOG_V1_10_GROUPS`, `PricingModel.QUOTE_REQUIRED`, `PricingStatus`, and schema fields consumed by every later task.
- Exact wire fields: `groupSlug`, `groupName`, `groupDescription`, `groupSortOrder`, `pricingStatus`, `quotedTotalMinor`, `quotedAt`, `quoteAcceptedAt`, `quotedByUserId`, `promisedCompletionAt`, `requiredAt`, `catalogProductSlug`.
- Mapping rules: DTO `requiredDate` persists as `OrderItem.requiredAt`; `promisedCompletionAt` is written alongside the existing `estimatedCompletionAt` compatibility field; `quotedTotalMinor` is the final customer total (supplier goods quote plus authoritative delivery fee), while `SupplierAssignment.finalPriceMinor` remains the goods-only supplier quote.

- [ ] **Step 1: Write the catalog-definition invariant test**

```ts
import { CATALOG_V1_10_GROUPS } from './catalog-v1-10.definition';

it('defines four groups and seventeen unique RFQ products', () => {
  const products = CATALOG_V1_10_GROUPS.flatMap((group) => group.products);
  expect(CATALOG_V1_10_GROUPS.map((group) => group.slug)).toEqual([
    'marketing-promo',
    'corporate-merch',
    'awards-signages',
    'specialized-prototyping',
  ]);
  expect(products).toHaveLength(17);
  expect(new Set(products.map((product) => product.slug)).size).toBe(17);
  expect(products.every((product) => product.pricingModel === 'quote_required')).toBe(true);
  expect(products.every((product) => product.specs.length > 0)).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify the missing definition fails**

Run: `cd server && npm test -- --runInBand src/products/catalog-v1-10.definition.spec.ts`  
Expected: FAIL because `catalog-v1-10.definition.ts` does not exist.

- [ ] **Step 3: Implement the immutable definition and reusable templates**

Define these exact leaf slugs in group order:

```ts
export const CATALOG_VERSION = '1.10' as const;

export const CATALOG_V1_10_GROUPS = [
  { slug: 'marketing-promo', products: [
    'flyers', 'brochures', 'posters-standees', 'business-cards',
    'stickers-packaging-labels', 'tarpaulins-outdoor-banners',
  ] },
  { slug: 'corporate-merch', products: [
    'lanyards-id-accessories', 'custom-apparel', 'drinkware',
    'corporate-giveaways',
  ] },
  { slug: 'awards-signages', products: [
    'certificates-diplomas', 'plaques-trophies', 'medals-ribbons',
    'business-store-signages',
  ] },
  { slug: 'specialized-prototyping', products: [
    '3d-printing-scale-models', 'blueprint-cad-plotting',
    'packaging-box-production',
  ] },
] as const;
```

Expand every entry to the full names, descriptions, examples, sort orders, file-processing type, quantity unit, 100 MB general/200 MB 3D limit, allowed extensions, and specification template from the approved design. Use validated text/number fields where no enumerated product option was approved. Do not invent supplier coverage.

- [ ] **Step 4: Write migration metadata tests before entity changes**

Assert the new migration source includes:

```ts
expect(source).toContain('group_slug');
expect(source).toContain('pricing_status');
expect(source).toContain('quoted_total_minor');
expect(source).toContain('required_at');
expect(source).toContain('catalog_product_slug');
expect(source).toContain('uq_supplier_capability_product');
```

Also add entity metadata assertions for nullable quote fields, `PricingStatus` enum, and the unique supplier/product capability pair.

- [ ] **Step 5: Run the migration/entity tests and verify failure**

Run: `cd server && npm test -- --runInBand src/database/catalog-rfq-v1-10-migration.spec.ts src/products/entities/entity-column-metadata.spec.ts`  
Expected: FAIL on missing migration and columns.

- [ ] **Step 6: Implement the additive migration and entities**

Add group columns to `product_categories`; RFQ columns and `PricingStatus` to `orders`; `required_at` to `order_items`; `catalog_product_slug` to `file_metadata`; `is_active` and unique `(supplier_id, product_family)` to `supplier_capabilities`. Widen `order_item_spec_values.value` and `display_value` from 120 to 1000 characters for personalization. Backfill existing orders to `pricing_status='accepted'`, then make the field non-null with default `accepted`. Mark `paper`/`3d` inactive without deleting them.

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
cd server
npm test -- --runInBand src/products/catalog-v1-10.definition.spec.ts src/database/catalog-rfq-v1-10-migration.spec.ts src/products/entities/entity-column-metadata.spec.ts
npm run build
```

```bash
git add server/src/products server/src/orders/entities server/src/files/entities server/src/suppliers/entities server/src/database server/migrations/1784334500000-catalog-rfq-v1-10.ts
git commit -m "feat(catalog): define and migrate v1.10 RFQ products"
```

---

### Task 3: Make migration and fresh seed produce the exact catalog

**Files:**
- Create: `server/src/products/catalog-v1-10.persistence.ts`
- Create: `server/src/products/catalog-v1-10.persistence.spec.ts`
- Modify: `server/migrations/1784334500000-catalog-rfq-v1-10.ts`
- Modify: `server/src/seed.ts`
- Modify: `server/src/seed.spec.ts`
- Modify: `server/test/migration-lifecycle.e2e-spec.ts`
- Delete: `server/add-cats.ts`

**Interfaces:**
- Produces: `upsertCatalogV110(executor: CatalogSqlExecutor): Promise<void>`.
- Consumes: `CATALOG_V1_10_GROUPS` and the migrated schema.

- [ ] **Step 1: Write persistence and seed contract tests**

Test the pure definition-to-SQL persistence with a recording executor, then add an isolated database assertion:

```ts
expect(await countDistinct('group_slug', 'product_categories', 'is_active = true')).toBe(4);
expect(await countRows('product_categories', "is_active = true AND pricing_model = 'quote_required'")).toBe(17);
expect(await countRows('product_categories', "slug IN ('paper','3d') AND is_active = true")).toBe(0);
```

Run the persistence function twice and assert category/spec/option counts remain unchanged.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd server && npm test -- --runInBand src/products/catalog-v1-10.persistence.spec.ts src/seed.spec.ts`  
Expected: FAIL because persistence still lives in ad hoc Paper/3D seed SQL.

- [ ] **Step 3: Implement the versioned upsert**

Define:

```ts
export interface CatalogSqlExecutor {
  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T>;
}

export async function upsertCatalogV110(
  executor: CatalogSqlExecutor,
): Promise<void>;
```

For every leaf: upsert by `slug`; update group/name/descriptions/policy/order; upsert specs by `(category_id,key)` and options by `(spec_definition_id,value)`; deactivate removed v1.10 specs/options; never delete historical categories.

- [ ] **Step 4: Replace Paper/3D seed code and remove the dormant script**

After the existing destructive fresh-seed truncation, call `upsertCatalogV110(ds)`. Remove legacy category/spec/addon inserts and `server/add-cats.ts`. Keep only catalog-independent addons or rebind them to a specific active leaf when product ownership is explicit.

- [ ] **Step 5: Prove empty migration, seed, and reseed behavior**

Against an isolated PostgreSQL database with synchronization disabled:

```bash
cd server
npm run migration:run
npm run seed
npm run seed
npm run migration:run
npm run test:e2e -- --runInBand test/migration-lifecycle.e2e-spec.ts
```

Expected: four distinct active groups, seventeen active leaf products, no duplicates, no pending migration, API starts.

- [ ] **Step 6: Commit**

```bash
git add server/src/products/catalog-v1-10.persistence.* server/src/seed.ts server/src/seed.spec.ts server/test/migration-lifecycle.e2e-spec.ts server/migrations/1784334500000-catalog-rfq-v1-10.ts server/add-cats.ts
git commit -m "feat(seed): seed four groups and seventeen RFQ products"
```

---

### Task 4: Expose grouped catalog data and pending-price quote semantics

**Files:**
- Modify: `server/src/products/catalog-read.service.ts`
- Modify: `server/src/products/catalog-pricing.service.ts`
- Modify: `server/src/products/catalog-pricing.service.spec.ts`
- Modify: `server/src/products/products.service.ts`
- Modify: `server/src/products/products.service.spec.ts`
- Modify: `server/src/products/products.controller.ts`
- Modify: `server/src/products/products.module.ts`
- Modify: `server/src/products/dto/create-category.dto.ts`
- Modify: `server/src/products/dto/update-category.dto.ts`

**Interfaces:**
- Produces: `CatalogResponse { version:'1.10'; groups:CatalogGroup[]; categories:CatalogCategory[] }`.
- Produces discriminated quote results: numeric legacy quote or pending RFQ quote with `subtotal:null`, `total:null`, and `printSubtotal:null`.

- [ ] **Step 1: Write grouped response and pending-price tests**

```ts
expect(catalog.groups).toHaveLength(4);
expect(catalog.groups.flatMap((group) => group.products)).toHaveLength(17);
expect(rfqQuote).toMatchObject({ pricingStatus: 'pending_quote', subtotal: null, total: null });
expect(rfqQuote.items[0].printSubtotal).toBeNull();
```

Also assert invalid or missing required specs still fail before the pending quote is returned.

- [ ] **Step 2: Run tests and verify current instant-pricing behavior fails them**

Run: `cd server && npm test -- --runInBand src/products/catalog-pricing.service.spec.ts src/products/products.service.spec.ts`.

- [ ] **Step 3: Implement grouped read and discriminated quote types**

Sort groups by `groupSortOrder`, products by `sortOrder`, and retain `categories` for old clients. Add `QUOTE_REQUIRED` handling after `CatalogValidationService.validateSpecs()` without adding monetary values.

- [ ] **Step 4: Extend catalog CRUD**

Accept and return group fields and `quote_required`. For RFQ products, permit `baseRate=0` internally but render pricing as pending; reject missing group metadata for new active RFQ products.

- [ ] **Step 5: Run and commit**

```bash
cd server && npm test -- --runInBand src/products && npm run build
git add server/src/products
git commit -m "feat(catalog): expose grouped RFQ catalog"
```

---

### Task 5: Enforce product-aware artwork uploads

**Files:**
- Create: `server/src/files/catalog-upload-policy.service.ts`
- Create: `server/src/files/catalog-upload-policy.service.spec.ts`
- Create: `server/src/files/dto/catalog-upload.dto.ts`
- Modify: `server/src/files/entities/file-metadata.entity.ts`
- Modify: `server/src/files/files.controller.ts`
- Modify: `server/src/files/files.controller.spec.ts`
- Modify: `server/src/files/files.service.ts`
- Modify: `server/src/files/files.service.spec.ts`
- Modify: `server/src/files/files.module.ts`
- Modify: `server/src/storage/storage.config.ts`

**Interfaces:**
- Produces: `CatalogUploadPolicyService.validate(category, file): void`.
- Changes: `FilesService.storeMetadata(file, uploadedBy, purpose, productSlug?)`.
- Upload form fields: `purpose=catalog_artwork`, `productSlug=<leaf slug>`.

- [ ] **Step 1: Write the policy matrix tests**

Cover PDF/PNG/JPEG/TIFF/AI/PSD general artwork, STL/OBJ/3MF/GLB/GLTF/STEP/STP models, PDF/DWG/DXF CAD, 100 MB general and 200 MB 3D limits, executable rejection, MIME-extension mismatch, inactive product, and wrong product binding.

```ts
expect(() => policy.validate(flyers, pdfFile)).not.toThrow();
expect(() => policy.validate(blueprints, stlFile)).toThrow('File type not allowed');
expect(() => policy.validate(model, oversizedModel)).toThrow('200 MB');
```

- [ ] **Step 2: Run tests and verify the global policy fails them**

Run: `cd server && npm test -- --runInBand src/files/catalog-upload-policy.service.spec.ts src/files/files.controller.spec.ts`.

- [ ] **Step 3: Implement upload binding and server validation**

Require an active leaf for `catalog_artwork`; validate configured extension, MIME, size, ownership, and stored object; save `catalogProductSlug` in metadata. Keep delivery proof and beta testimonial policies isolated and unchanged.

- [ ] **Step 4: Add defense-in-depth validation for order submission**

Expose a service method that accepts a `FileMetadata` plus selected `ProductCategory` and rejects metadata whose purpose or `catalogProductSlug` does not match, even if the upload endpoint was bypassed.

- [ ] **Step 5: Run and commit**

```bash
cd server && npm test -- --runInBand src/files && npm run build
git add server/src/files server/src/storage/storage.config.ts
git commit -m "feat(files): validate artwork by catalog product"
```

---

### Task 6: Add per-line RFQ batch submission

**Files:**
- Create: `server/src/orders/dto/submit-rfq.dto.ts`
- Create: `server/src/orders/dto/submit-rfq.dto.spec.ts`
- Modify: `server/src/orders/orders.controller.ts`
- Modify: `server/src/orders/orders.controller.spec.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `server/src/orders/entities/order-item.entity.ts`

**Interfaces:**
- Produces: `OrdersService.submitRfq(userId:number, dto:SubmitRfqDto): Promise<CreateBatchResult>`.
- Endpoint: `POST /orders/requests/batch`.
- Item contract: `{ categorySlug, quantity, requiredDate, fileMetadataId, specs, specialInstructions?, destinationIndex? }`.
- Batch contract: `{ items, deliveryOption, deliveryAddressId?, temporaryAddress?, destinations? }`.

- [ ] **Step 1: Write DTO and service tests first**

Test one item → one order/one item; two unlike products → two independently matchable orders sharing one batch; all begin pending; no credits/COD/payment mutation occurs.

```ts
expect(result.orders).toHaveLength(2);
expect(new Set(result.orders.map((order) => order.batchOrderId)).size).toBe(1);
expect(result.orders.map((order) => order.category)).toEqual(['flyers', 'custom-apparel']);
expect(result.orders.every((order) => order.pricingStatus === PricingStatus.PENDING_QUOTE)).toBe(true);
expect(creditsService.subtractCredits).not.toHaveBeenCalled();
```

Also reject inactive products, missing specs, past required dates, foreign files, wrong-product files, and missing delivery address for delivery.

- [ ] **Step 2: Run tests and verify there is no RFQ endpoint**

Run: `cd server && npm test -- --runInBand src/orders/dto/submit-rfq.dto.spec.ts src/orders/orders.service.spec.ts src/orders/orders.controller.spec.ts`.

- [ ] **Step 3: Implement DTO validation and reference allocation**

Add `nextBatchReferences(manager, orderCount): Promise<{ batchRef:string; orderRefs:string[] }>` and validate ISO `requiredDate` as future calendar input.

- [ ] **Step 4: Implement transactional RFQ persistence**

Create one `BatchOrder` with compatibility totals `0`; create one `Order` per line with `totalPrice=0`, `finalTotalMinor=null`, `paymentMethod='pending_quote'`, `paymentStatus='pending_quote'`, `pricingStatus=pending_quote`; create one `OrderItem` and spec snapshots per order. Reuse existing address/zone validation to persist the authoritative delivery fee without charging it. RFQ v1.10 does not offer client-selected speed or slot booking; the supplier's promised completion and the existing Operations dispatch flow determine timing. API serialization must expose product price and total as `null`, not the compatibility zero.

- [ ] **Step 5: Preserve legacy `createBatch()` unchanged**

Keep instant-priced Paper/3D checkout tests passing. Do not route RFQ items through credit/COD, slot booking, speed fees, or `CatalogPricingService` monetary summation.

- [ ] **Step 6: Run and commit**

```bash
cd server && npm test -- --runInBand src/orders && npm run build
git add server/src/orders
git commit -m "feat(orders): submit independently matchable RFQs"
```

---

### Task 7: Match RFQs by active leaf capability only

**Files:**
- Modify: `server/src/suppliers/entities/supplier-capability.entity.ts`
- Modify: `server/src/suppliers/dto/create-supplier-capability.dto.ts`
- Modify: `server/src/suppliers/suppliers.service.ts`
- Modify: `server/src/suppliers/suppliers.service.spec.ts`
- Modify: `server/src/matching/matching.ranking.ts`
- Modify: `server/src/matching/matching.ranking.spec.ts`
- Modify: `server/src/matching/matching.service.ts`
- Modify: `server/src/matching/matching.service.spec.ts`

**Interfaces:**
- `SuppliersService.addCapability()` accepts only an active leaf product slug and prevents duplicates.
- Matching candidate capability must satisfy `isActive && productFamily === order.category` after normalization.

- [ ] **Step 1: Write capability and unmet-coverage tests**

Assert invalid group slugs, inactive legacy slugs, duplicates, inactive capabilities, unverified suppliers, and manual non-candidate assignment are rejected. Assert a verified supplier with the exact leaf succeeds.

- [ ] **Step 2: Run tests and verify free-form/manual behavior fails them**

Run: `cd server && npm test -- --runInBand src/suppliers/suppliers.service.spec.ts src/matching`.

- [ ] **Step 3: Implement catalog-backed capability validation and matching**

Normalize only case/whitespace, not synonyms. Remove `buildOpsOverrideCandidate()` as an eligibility bypass; return a structured `no_eligible_supplier` result for Operations.

- [ ] **Step 4: Run and commit**

```bash
cd server && npm test -- --runInBand src/suppliers src/matching && npm run build
git add server/src/suppliers server/src/matching
git commit -m "feat(matching): match active catalog capabilities"
```

---

### Task 8: Freeze supplier quotes and require customer acceptance

**Files:**
- Create: `server/src/orders/dto/accept-quote.dto.ts`
- Modify: `server/src/suppliers/supplier-jobs.service.ts`
- Modify: `server/src/suppliers/supplier-jobs.service.spec.ts`
- Modify: `server/src/orders/orders.controller.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`
- Modify: `server/src/orders/order-status-transition.ts`
- Modify: `server/src/orders/order-status-transition.spec.ts`
- Modify: `server/src/payments/payments.service.ts`
- Modify: `server/src/payments/payments.service.spec.ts`

**Interfaces:**
- Endpoint: `POST /orders/:id/accept-quote`.
- Body: `{ supplierAssignmentId:number, paymentMethod:'pilot_credit'|'cod' }`.
- Produces: `OrdersService.acceptQuote(orderId,userId,dto): Promise<Order>`.

- [ ] **Step 1: Write supplier quote tests**

After `SupplierJobsService.acceptJob()`, assert positive price/future date, `pricingStatus=quoted`, quote actor/time/total/promised fields, and `supplier_accepted`. Re-quote via a superseding assignment must not mutate an accepted immutable quote.

- [ ] **Step 2: Write customer acceptance tests**

Cover owner-only, accepted-current-assignment requirement, same assignment/payment idempotency, superseded assignment `stale_quote`, missing terms, COD eligibility, and transition to `awaiting_payment + pricingStatus=accepted`.

- [ ] **Step 3: Run tests and verify missing acceptance fails**

Run: `cd server && npm test -- --runInBand src/suppliers/supplier-jobs.service.spec.ts src/orders/orders.service.spec.ts src/orders/order-status-transition.spec.ts`.

- [ ] **Step 4: Implement transactional quote and acceptance writes**

Use pessimistic locks on assignment and order. Supplier acceptance writes both existing assignment terms and order quote metadata. Customer acceptance verifies ownership/current assignment, sets payment method, acceptance time/status, and history/audit events.

- [ ] **Step 5: Tighten payment authorization**

For RFQ orders, `authorizePayment()` must require `orderStatus=awaiting_payment` and `pricingStatus=accepted`; use `SupplierAssignment.finalPriceMinor` for the authorization snapshot's goods amount and `quotedTotalMinor` for its final customer total. Preserve existing legacy authorization behavior only for pre-v1.10 orders already backfilled as accepted. Never authorize directly from a new RFQ's `supplier_accepted` state.

- [ ] **Step 6: Run and commit**

```bash
cd server && npm test -- --runInBand src/suppliers/supplier-jobs.service.spec.ts src/orders src/payments && npm run build
git add server/src/suppliers/supplier-jobs.service* server/src/orders server/src/payments
git commit -m "feat(rfq): require customer quote acceptance"
```

---

### Task 9: Publish dynamic RFQ API projections and backend E2E coverage

**Files:**
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/admin/admin.controller.spec.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/test/migration-lifecycle.e2e-spec.ts`
- Create: `server/test/catalog-rfq.e2e-spec.ts`

**Interfaces:**
- Customer/Admin order JSON includes snake_case and existing camel-case aliases where current normalizers require them: pricing state, nullable quote total, quote times/actor, promised completion, dynamic category snapshot, spec display values, and unmet coverage.

- [ ] **Step 1: Write projection tests that reject Paper/3D coercion**

```ts
expect(projected.items[0]).toMatchObject({
  category_slug: 'business-store-signages',
  category_name: 'Business & Store Signages',
});
expect(projected.pricing_status).toBe('pending_quote');
expect(projected.quoted_total_minor).toBeNull();
```

- [ ] **Step 2: Write end-to-end RFQ lifecycle coverage**

Use a migrated/seeded isolated database: upload product-bound artwork; submit two-product RFQ; QA approve; create eligible capability; match; supplier quote; customer accept; Operations authorize; assert audit/history/snapshots and no premature charge.

- [ ] **Step 3: Run tests and verify failure**

Run: `cd server && npm test -- --runInBand src/admin/admin.controller.spec.ts && npm run test:e2e -- --runInBand test/catalog-rfq.e2e-spec.ts`.

- [ ] **Step 4: Implement projections and pass E2E**

Keep explicit legacy Paper/3D compatibility branches only when the saved slug is exactly `paper` or `3d`. Unknown slugs remain unchanged.

- [ ] **Step 5: Run the backend gate and commit**

```bash
cd server
npm run lint:check
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
git add server
git commit -m "test(rfq): cover catalog request lifecycle"
```

---

### Task 10: Build the mobile catalog contract and group/product browsing

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/models/product_catalog.dart`
- Modify: `apps/mobile/lib/features/customer/order/providers/product_catalog_provider.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/category_screen.dart`
- Create: `apps/mobile/lib/features/customer/order/screens/product_screen.dart`
- Create: `apps/mobile/lib/features/customer/order/widgets/catalog_group_card.dart`
- Create: `apps/mobile/lib/features/customer/order/widgets/catalog_product_card.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`
- Modify: `apps/mobile/test/features/customer/order/models/product_catalog_test.dart`
- Create: `apps/mobile/test/features/customer/order/providers/product_catalog_provider_test.dart`
- Modify: `apps/mobile/test/features/customer/order/screens/category_screen_add_mode_test.dart`
- Create: `apps/mobile/test/features/customer/order/screens/product_screen_test.dart`

**Interfaces:**
- Produces: `ProductGroup`, `ProductCatalog.activeGroups`, `groupBySlug`, `productBySlug`, `ProductCatalogState`, and retryable `ProductCatalogNotifier`.
- Routes: `/customer/order/groups/:groupSlug` and `/customer/order/products/:productSlug/requirements`.

- [ ] **Step 1: Write exact catalog parsing and authority-state tests**

Assert four groups, seventeen leaves, snake/camel group fields, stable order, inactive legacy exclusion, v1.10 snapshot parity, failed API browse-with-warning state, `canSubmit=false`, successful retry, and `canSubmit=true` only for server data.

- [ ] **Step 2: Run tests and verify two-item fallback failure**

Run: `cd apps/mobile && fvm flutter test test/features/customer/order/models/product_catalog_test.dart test/features/customer/order/providers/product_catalog_provider_test.dart`.

- [ ] **Step 3: Implement catalog models and provider**

```dart
class ProductCatalogState {
  const ProductCatalogState({required this.catalog, required this.isServerBacked, this.error});
  final ProductCatalog catalog;
  final bool isServerBacked;
  final Object? error;
  bool get canSubmit => isServerBacked && error == null;
}
```

The snapshot is browse-only; it must match all four groups/seventeen products and never silently authorize submission.

- [ ] **Step 4: Write group/product widget tests before UI**

Assert supplied names/descriptions/examples, group counts 6/4/4/3, no Paper/3D top-level cards, semantic buttons at least 44×44, retry banner, Light/Dark rendering, and product navigation.

- [ ] **Step 5: Implement group/product screens and routes**

Use theme tokens, Hugeicons, one yellow primary action per context, and product examples from the API. Keep legacy Paper/3D routes for saved drafts only; new navigation never uses them.

- [ ] **Step 6: Run and commit**

```bash
cd apps/mobile && fvm flutter test test/features/customer/order/models/product_catalog_test.dart test/features/customer/order/providers/product_catalog_provider_test.dart test/features/customer/order/screens/category_screen_add_mode_test.dart test/features/customer/order/screens/product_screen_test.dart
git add apps/mobile/lib/features/customer/order apps/mobile/lib/config/routes/app_router.dart apps/mobile/test/features/customer/order
git commit -m "feat(mobile): browse four catalog groups"
```

---

### Task 11: Build generic mobile requirements, upload, and RFQ review/submission

**Files:**
- Create: `apps/mobile/lib/features/customer/order/screens/catalog_requirements_screen.dart`
- Create: `apps/mobile/lib/features/customer/order/widgets/dynamic_spec_field.dart`
- Create: `apps/mobile/lib/features/customer/order/widgets/rfq_review_card.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/spec_selector.dart`
- Modify: `apps/mobile/lib/features/customer/order/providers/order_provider.dart`
- Modify: `apps/mobile/lib/features/customer/cart/models/cart_item.dart`
- Modify: `apps/mobile/lib/features/customer/order/models/checkout_state.dart`
- Modify: `apps/mobile/lib/features/customer/order/providers/checkout_provider.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_summary_card.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_footer.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_speed_card.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Create: `apps/mobile/test/features/customer/order/screens/catalog_requirements_screen_test.dart`
- Create: `apps/mobile/test/features/customer/order/widgets/dynamic_spec_field_test.dart`
- Modify: `apps/mobile/test/features/customer/order/providers/order_provider_specs_test.dart`
- Modify: `apps/mobile/test/features/customer/order/providers/checkout_provider_test.dart`
- Modify: `apps/mobile/test/features/customer/order/screens/upload_screen_test.dart`
- Modify: `apps/mobile/test/features/customer/order/screens/checkout_screen_test.dart`
- Modify: `apps/mobile/test/features/customer/order/widgets/checkout_items_card_test.dart`
- Modify: `apps/mobile/test/features/customer/order/widgets/checkout_summary_card_test.dart`
- Modify: `apps/mobile/test/features/customer/order/widgets/checkout_footer_test.dart`
- Modify: `apps/mobile/test/features/customer/orders/providers/orders_provider_place_checkout_test.dart`

**Interfaces:**
- `OrderFlowState`: `groupSlug`, `productSlug`, `productName`, `requiredDate`, `quoteRequired`, `catalogServerBacked`.
- `CartItem`: leaf identity, `quoteRequired`, nullable `unitPrice`/subtotal.
- `OrdersNotifier.submitRfq()` posts to `/orders/requests/batch`.

- [ ] **Step 1: Write generic field and form validation tests**

Cover select/number/boolean/text, required/default/help/min/max, quantity, future required date, delivery address, notes, and API-owned labels/options.

- [ ] **Step 2: Run tests and verify the Paper/3D forms cannot satisfy them**

Run: `cd apps/mobile && fvm flutter test test/features/customer/order/screens/catalog_requirements_screen_test.dart test/features/customer/order/widgets/dynamic_spec_field_test.dart`.

- [ ] **Step 3: Implement the generic requirements screen**

Render active `ProductSpecDefinition`s and write selections to `OrderFlowNotifier.setCatalogSpecs()`. Preserve Paper/3D model mapping only for legacy draft routes.

- [ ] **Step 4: Write product-aware upload tests**

Assert product extensions/limits, `purpose=catalog_artwork`, `productSlug`, no cross-product fallback, 100/200 MB copy, failed upload preservation, and catalog-authority submission gate.

- [ ] **Step 5: Implement upload and nullable-price cart state**

Remove the `paper|3d` and positive-total requirements for RFQ items; still require active leaf, required specs/date, uploaded metadata, and positive quantity. Never turn `null` into displayed `0`.

- [ ] **Step 6: Write RFQ review/submission tests**

Assert pending-price copy, no payment/speed/numeric total controls, dynamic specs, independently serialized leaf items, and correct endpoint/payload. Keep legacy checkout tests green.

- [ ] **Step 7: Implement review and `submitRfq()`**

Branch the existing checkout screen on `hasPendingQuoteItems`; mixed legacy/RFQ carts are rejected with a clear instruction to submit separately. On success, clear only submitted draft/cart state.

- [ ] **Step 8: Run and commit**

```bash
cd apps/mobile
fvm flutter test test/features/customer/order
fvm flutter test test/features/customer/orders/providers/orders_provider_place_checkout_test.dart
fvm flutter analyze lib/
git add apps/mobile/lib/features/customer apps/mobile/test/features/customer
git commit -m "feat(mobile): submit structured catalog RFQs"
```

---

### Task 12: Render dynamic mobile orders and accept quotes

**Files:**
- Modify: `apps/mobile/lib/shared/models/order.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/customer/orders/screens/order_detail_screen.dart`
- Modify: `apps/mobile/lib/features/customer/orders/widgets/order_card.dart`
- Modify: `apps/mobile/lib/features/customer/orders/widgets/marketplace_order_actions.dart`
- Create: `apps/mobile/lib/features/customer/orders/widgets/quote_card.dart`
- Modify: `apps/mobile/lib/features/tutorial/providers/pipeline_tutorial_provider.dart`
- Modify: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`
- Modify: `apps/mobile/test/shared/models/order_test.dart`
- Modify: `apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart`
- Modify: `apps/mobile/test/features/customer/orders/screens/order_detail_screen_test.dart`
- Modify: `apps/mobile/test/features/customer/orders/widgets/order_card_test.dart`
- Modify: `apps/mobile/test/features/customer/orders/widgets/marketplace_order_actions_test.dart`
- Create: `apps/mobile/test/features/customer/orders/widgets/quote_card_test.dart`
- Modify: `apps/mobile/test/features/tutorial/pipeline_tutorial_provider_test.dart`

**Interfaces:**
- `PricingStatus { pendingQuote, quoted, accepted }`.
- `OrdersNotifier.acceptQuote(orderId, supplierAssignmentId, paymentMethod)` posts `/orders/:id/accept-quote`.

- [ ] **Step 1: Write parsing and dynamic-rendering tests**

Assert leaf names/spec snapshots survive parsing, unknown slugs are unchanged, pending price never shows ₱0, quoted amount/date display only when present, and exact legacy `paper`/`3d` fixtures still render.

- [ ] **Step 2: Run tests and verify coercion/current amount rendering fails**

Run: `cd apps/mobile && fvm flutter test test/shared/models/order_test.dart test/features/customer/orders`.

- [ ] **Step 3: Implement pricing models and focused quote UI**

`QuoteCard` has pending, quoted, and accepted states. The quoted state shows one primary acceptance action and payment selection; the pending state exposes no payment action.

- [ ] **Step 4: Write provider/action tests for acceptance**

Assert endpoint/body, owner-visible action, successful refresh, replay suppression, `stale_quote` refresh prompt, and preserved quote/form state after errors.

- [ ] **Step 5: Implement quote acceptance and tutorial updates**

Rename tutorial steps to catalog group/product/requirements semantics. Remove hard-coded 3D icons for unknown products. Keep explicit historical icons for `paper` and `3d`.

- [ ] **Step 6: Run and commit**

```bash
cd apps/mobile && fvm flutter test test/features/customer/orders test/shared/models/order_test.dart test/features/tutorial && fvm flutter analyze lib/
git add apps/mobile/lib apps/mobile/test
git commit -m "feat(mobile): review and accept supplier quotes"
```

---

### Task 13: Update Admin catalog, Operations, QA, and supplier views

**Files:**
- Modify: `admin/src/types/products.ts`
- Modify: `admin/src/types/order.ts`
- Modify: `admin/src/utils/api-normalizers.ts`
- Modify: `admin/src/utils/api-normalizers.test.ts`
- Create: `admin/src/pages/products/catalog-groups.ts`
- Create: `admin/src/pages/products/catalog-groups.test.ts`
- Modify: `admin/src/pages/products/list.tsx`
- Create: `admin/src/pages/products/list.test.tsx`
- Modify: `admin/src/pages/products/options.tsx`
- Create: `admin/src/pages/products/options.test.tsx`
- Create: `admin/src/pages/orders/components/order-product-label.tsx`
- Create: `admin/src/pages/orders/components/order-specifications.tsx`
- Create: `admin/src/pages/orders/components/order-price.tsx`
- Modify: `admin/src/pages/orders/list.tsx` and tests
- Modify: `admin/src/pages/orders/show.tsx` and tests
- Modify: `admin/src/pages/qa/queue.tsx`
- Modify: `admin/src/pages/qa/workspace.tsx`
- Modify: `admin/src/services/supplierJobsApi.ts`
- Modify: `admin/src/pages/supplier/job-show.tsx`
- Create: `admin/src/pages/supplier/job-show.test.tsx`

**Interfaces:**
- `ProductPricingModel` includes `quote_required`.
- `ServiceCategory` includes snake-case group metadata.
- `PricingStatus` and nullable quote fields mirror backend output.

- [ ] **Step 1: Write normalizer tests before widening types**

Assert group fields, quote-required mode, dynamic leaf slug/name/spec values, nullable pending price, quoted/accepted values, and explicit-only legacy fallback.

- [ ] **Step 2: Run and verify type/normalizer failure**

Run: `cd admin && npm test -- src/utils/api-normalizers.test.ts`.

- [ ] **Step 3: Implement types, normalizers, and grouping utility**

```ts
export type ProductPricingModel =
  | 'per_page_modifiers'
  | 'base_plus_material_estimate'
  | 'quote_required';

export type PricingStatus = 'pending_quote' | 'quoted' | 'accepted';
```

Unknown leaf slugs remain their saved value.

- [ ] **Step 4: Write and implement grouped product administration**

Test four sections/seventeen records, group fields in create/edit payloads, activation/order/upload policies, quote-required copy without a formatted base rate, retry on API failure, and spec/options CRUD.

- [ ] **Step 5: Write and implement reusable Operations order renderers**

Test leaf name/spec snapshot, pending/quoted/accepted price, multi-product batch, unmet coverage, and legacy rows. Use the renderers in Orders list/detail and QA queue/workspace.

- [ ] **Step 6: Align supplier acceptance UI**

Keep `finalPriceMinor` and `promisedDate` mandatory, preserve form state on API errors, display dynamic product/spec names, and show success as `pricing_status=quoted`; production controls remain payment-gated.

- [ ] **Step 7: Run and commit**

```bash
cd admin
npx tsc --noEmit
npm test
npm run build
git add admin/src
git commit -m "feat(admin): manage and operate RFQ catalog"
```

---

### Task 14: Add cross-surface contracts, visual evidence, CI coverage, and version metadata

**Files:**
- Modify: `e2e/mobile-web/tests/marketplace-workflow.spec.ts`
- Modify: `e2e/mobile-web/tests/beta-workflow-visual.spec.ts`
- Create: `e2e/mobile-web/tests/catalog-rfq-visual.spec.ts`
- Modify: `e2e/mobile-web/playwright.config.ts`
- Modify: `.github/workflows/ci-mobile-web-e2e.yml`
- Modify: `.github/workflows/visual-evidence.yml`
- Modify: `apps/mobile/pubspec.yaml`
- Modify: `apps/mobile/lib/shared/app_version.dart`
- Modify: `apps/mobile/test/shared/app_version_test.dart` only if the existing parity assertion needs no behavior change.

**Interfaces:**
- New visual opt-in flag: `GRIDGO_RUN_CATALOG_RFQ_VISUAL=1`.
- Marketplace contract includes customer quote acceptance between supplier quote and Operations payment authorization.

- [ ] **Step 1: Update the non-mutating marketplace contract first**

Assert four groups/seventeen products, RFQ pending state, leaf matching, supplier quote, customer acceptance, and payment authorization order. Add this spec to `ci-mobile-web-e2e.yml`; it currently is not a CI gate.

- [ ] **Step 2: Run the contract and verify current hard-coded assumptions fail**

Run:

```bash
cd e2e/mobile-web
MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts tests/marketplace-workflow.spec.ts
```

- [ ] **Step 3: Add catalog screenshot evidence**

Capture and assert: group grid Light/Dark, product list/examples, requirements, RFQ review with no payment/₱0, quoted order acceptance, grouped Admin catalog, and dynamic Admin order/spec/price. Store artifacts outside committed source using existing sanitized manifest/hash conventions.

- [ ] **Step 4: Adapt beta visual selectors without weakening beta behavior**

Replace the old Paper tutorial selector with the new catalog flow while preserving all existing privacy, proof, survey, and held-user assertions.

- [ ] **Step 5: Update release version metadata**

Set:

```yaml
version: 1.10.0+26
```

```dart
static const version = '1.10.0';
static const buildNumber = '26';
```

- [ ] **Step 6: Run and commit**

```bash
cd e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts tests/marketplace-workflow.spec.ts
cd ../../apps/mobile && fvm flutter test test/shared/app_version_test.dart
git add e2e/mobile-web .github/workflows/ci-mobile-web-e2e.yml .github/workflows/visual-evidence.yml apps/mobile/pubspec.yaml apps/mobile/lib/shared/app_version.dart apps/mobile/test/shared/app_version_test.dart
git commit -m "release: prepare GRIDGO 1.10.0"
```

---

### Task 15: Verify, merge to `main`, and publish `v1.10.0`

**Files:**
- No new production files unless verification finds a scoped defect.
- Update the PR description and GitHub release notes through the GitHub workflow.

**Interfaces:**
- Produces: green pull request, verified merged `main` SHA, accepted exact-SHA visual evidence, annotated `v1.10.0` tag, signed APK release.

- [ ] **Step 1: Run every local release gate**

```bash
cd server && npm run lint:check && npm run build && npm test -- --runInBand && npm run test:e2e -- --runInBand
cd ../admin && npx tsc --noEmit && npm test && npm run build
cd ../apps/mobile && fvm flutter analyze lib/ && fvm flutter test && fvm flutter build web --release --no-tree-shake-icons --dart-define=GRIDGO_REAL_FLOW=true
cd ../Landing-page && npm run lint && npm run test:community-cta && npm run test:video && npm run test:support-copy && npm run build
cd ../../e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts tests/marketplace-workflow.spec.ts
```

Run the isolated fresh-compose migration, seed, API, mobile, admin, landing, beta live preflight, catalog RFQ E2E, and destructive beta workflow only against disposable loopback-bound data.

- [ ] **Step 2: Review the final diff and working tree**

Run:

```bash
git diff --check origin/main...HEAD
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

List changed files, test results, and any unavailable checks. Do not carry unexplained whitespace errors or ignored release failures.

- [ ] **Step 3: Push the release branch and open a pull request**

Use the `github:yeet` workflow. PR base is `main`; title: `release: GRIDGO 1.10.0 catalog RFQ`; body includes four groups/seventeen products, migration/seed evidence, RFQ lifecycle, integration parents, and exact local test results.

- [ ] **Step 4: Wait for and fix every required PR check**

Required workflows/jobs:

```text
ci-server.yml: Server, Migration
ci-admin.yml: Admin
ci-mobile.yml: Mobile
ci-landing.yml: Landing
ci-mobile-web-e2e.yml: Mobile Web E2E
ci-fresh-stack.yml: Fresh Stack
```

Address review comments and CI failures on the branch; rerun the relevant local gate before each push.

- [ ] **Step 5: Merge the PR and verify merged `main`**

Merge only after all required checks are green. Then:

```bash
git switch main
git pull --ff-only origin main
release_sha=$(git rev-parse HEAD)
git status --short --branch
```

Confirm `release_sha` equals the GitHub `main` SHA and rerun release-critical server/mobile/catalog/migration tests against this exact commit.

- [ ] **Step 6: Produce and approve exact-SHA visual evidence**

Dispatch `.github/workflows/visual-evidence.yml` for the exact 40-character merged `main` SHA. Require both `Visual Evidence` and environment-approved `Evidence Accepted`, including the catalog RFQ views and the existing 29-step beta evidence contract.

- [ ] **Step 7: Create and push the release tag**

```bash
git tag -a v1.10.0 "$release_sha" -m "GRIDGO 1.10.0"
git push origin v1.10.0
```

Expected: `release-apk.yml` validates tag ↔ `1.10.0+26` ↔ exact current `main`, waits for all six green exact-SHA workflows and accepted evidence, builds signed `GRIDGO-v1.10.0.apk` and `GRIDGO-latest.apk`, then publishes the GitHub release.

- [ ] **Step 8: Verify the published release**

Use `gh run watch`/`gh release view v1.10.0` to confirm the workflow succeeded, the release is marked latest, generated notes exist, and both APK assets are present. Report the merged main SHA, tag, release URL, workflow conclusions, and final `git status --short --branch`.

---

## Plan Self-Review Checklist

- Every design requirement maps to Tasks 2–15.
- Four groups/seventeen products and seed/migration idempotency map to Tasks 2–3.
- Pending RFQ, per-line matching, quote acceptance, and payment gating map to Tasks 4–9.
- Product-aware uploads map to Task 5.
- Mobile group/product/requirements/RFQ/quote flows map to Tasks 10–12.
- Admin catalog/Operations/QA/supplier views map to Task 13.
- Legacy Paper/3D compatibility is asserted in Tasks 2, 6, 8, 9, 11, 12, and 13.
- Main/GRIDGOv3 integration, exact-SHA checks, visual approval, tag, and release map to Tasks 1, 14, and 15.
- Interface names are consistent: leaf identity is `categorySlug` in backend DTOs and `productSlug` in mobile state; saved database/API identity remains category slug for backward compatibility.
