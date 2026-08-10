# GRIDGO Catalog RFQ and Release 1.10 Design

**Date:** 2026-08-10  
**Status:** Approved for implementation planning  
**Release:** `v1.10.0`  
**Implementation baseline:** `GRIDGOv3` at `a16f9ec`  
**Product sources:** `GRIDGO.png`, root `PRD.md`, and `felycia123/GRIDGO-TINKER`

## Goal

Replace the customer order entry point's legacy Paper Printing and 3D Printing choices with a four-group, seventeen-product catalog. Each selected product starts a structured request-for-quote (RFQ) workflow. GRIDGO Operations and an eligible supplier confirm feasibility, final price, and turnaround before the customer authorizes payment.

Release the integrated marketplace and catalog work as `v1.10.0` only after the latest `GRIDGOv3` and current `main` histories are reconciled, the fresh database migration and seed contracts pass, all required repository checks are green, and the exact release commit is present on `main`.

## Approved Product Decisions

- The four named categories are browsing groups, not orderable line items.
- The seventeen named products are the orderable catalog records.
- New catalog products use RFQ pricing. The application must not show a zero price as a quote.
- Legacy `paper` and `3d` catalog records remain readable for historical orders but are inactive for new ordering.
- Products without current verified supplier coverage remain discoverable. Their UI says availability will be confirmed during review; it never guarantees fulfillment.
- The catalog is configurable through the existing Super Admin product surface. Mobile behavior is driven by the API catalog rather than a hard-coded paper/3D branch.
- Existing marketplace rules remain authoritative: Operations artwork QA is mandatory, suppliers never see unapproved artwork, matching uses verified capabilities, and production remains payment-gated.

## Catalog Definition

### Group 1: Marketing & Promotional Collateral

**Slug:** `marketing-promo`  
**Best for:** Businesses, startups, and events looking to promote services or distribute physical marketing material.

| Product | Slug | Examples |
| --- | --- | --- |
| Flyers | `flyers` | Single sheets, event promos, product announcements |
| Brochures | `brochures` | Bi-fold, tri-fold, company profiles |
| Posters & Standees | `posters-standees` | Indoor event posters, pull-up banners, x-stands |
| Business Cards | `business-cards` | Standard, matte, glossy, textured, QR-code enabled |
| Stickers & Packaging Labels | `stickers-packaging-labels` | Die-cut product labels, vinyl stickers, sheet stickers |
| Tarpaulins & Outdoor Banners | `tarpaulins-outdoor-banners` | Event banners, billboards, temporary roadside signs |

### Group 2: Corporate & Event Merchandise

**Slug:** `corporate-merch`  
**Best for:** Student organizations, HR teams, event organizers, and corporate branding.

| Product | Slug | Examples |
| --- | --- | --- |
| Lanyards & ID Accessories | `lanyards-id-accessories` | Sublimation lanyards, custom ID laces, badge holders |
| Custom Apparel | `custom-apparel` | T-shirts, hoodies, polo shirts, tote bags |
| Drinkware | `drinkware` | Sublimation mugs, laser-engraved tumblers, water bottles |
| Corporate Giveaways | `corporate-giveaways` | Eco-bags, umbrellas, customized pens, keychains, notebooks |

### Group 3: Recognition, Awards & Signage

**Slug:** `awards-signages`  
**Best for:** Competitions, graduations, guest speakers, store branding, and office spaces.

| Product | Slug | Examples |
| --- | --- | --- |
| Certificates & Diplomas | `certificates-diplomas` | Specialty paper, foil-stamped, embossed |
| Plaques & Trophies | `plaques-trophies` | Custom acrylic cuts, wooden plaques, 3D-printed awards |
| Medals & Ribbons | `medals-ribbons` | Metal or acrylic medals with custom sublimation ribbons |
| Business & Store Signages | `business-store-signages` | Acrylic build-up letters, Panaflex lightboxes, LED neon flex |

### Group 4: Specialized & Prototyping Services

**Slug:** `specialized-prototyping`  
**Best for:** Architecture students, engineers, industrial designers, and specialized builds.

| Product | Slug | Examples |
| --- | --- | --- |
| 3D Printing & Scale Models | `3d-printing-scale-models` | Rapid prototyping, architectural scale models, custom parts |
| Blueprint & CAD Plotting | `blueprint-cad-plotting` | Large-format architectural and engineering plans |
| Packaging & Box Production | `packaging-box-production` | Custom product boxes, mailer boxes, food-grade packaging |

## Data Model and Migration

The existing `product_categories` table remains the leaf-level orderable product table. Add group metadata to each product category:

- `group_slug`
- `group_name`
- `group_description`
- `group_sort_order`

Add `quote_required` to `PricingModel`. Add order pricing metadata that separates a pending RFQ from a confirmed amount:

- `pricing_status`: `pending_quote`, `quoted`, or `accepted`
- `quoted_total_minor`: nullable PHP minor-unit amount
- `quoted_at`: nullable timestamp
- `quote_accepted_at`: nullable timestamp
- `quoted_by_user_id`: nullable actor reference
- `promised_completion_at`: nullable timestamp

Existing instant-priced and historical orders keep their current monetary snapshots. New RFQs begin with `pricing_status=pending_quote` and `quoted_total_minor=null`. API serializers return a pending-price state, never a fabricated zero total.

The migration is additive and non-destructive:

1. Add the new catalog grouping and RFQ columns/enums.
2. Insert or update the seventeen v1.10 product records and their specification definitions.
3. Mark `paper` and `3d` inactive without deleting them.
4. Leave historical order snapshots and foreign keys intact.
5. Remove the unregistered `server/add-cats.ts` script after its intent is replaced by the migration and canonical catalog definition.

## Fresh Seed Contract

`server/src/seed.ts` must seed the v1.10 catalog through a versioned, deterministic catalog definition rather than ad hoc SQL spread across the seed.

A fresh seed must produce:

- exactly four active browsing groups;
- exactly seventeen active orderable products;
- zero active legacy Paper Printing or 3D Printing top-level choices;
- stable group and product sort order matching this document;
- product specification definitions, upload policies, quantity units, and RFQ pricing mode;
- supplier capability rows for verified seeded suppliers where coverage is known;
- no duplicate products or specifications when the seed is rerun.

Contract tests verify slugs, counts, group membership, active flags, descriptions, and idempotency. Migration lifecycle tests verify the same catalog on an empty database with schema synchronization disabled.

## Structured Requirement Templates

All products receive common fields:

- quantity;
- required date;
- delivery address;
- artwork or reference upload;
- optional notes.

Product specifications use the existing catalog specification definitions and are grouped into reusable templates:

| Template | Products | Required configuration |
| --- | --- | --- |
| Print collateral | Flyers, brochures, posters/standees, business cards, stickers/labels, tarpaulins/banners | dimensions or standard size, stock/material, color, sides, finish, quantity |
| Merchandise | Lanyards/ID accessories, apparel, drinkware, giveaways | item subtype, variant/size, color, branding method, artwork placement, quantity |
| Awards and signage | Certificates, plaques/trophies, medals/ribbons, business/store signage | dimensions, material, finish, personalization text, mounting or lighting when applicable, quantity |
| 3D fabrication | 3D printing/scale models | dimensions or scale, material, color, layer/infill preference, quantity |
| CAD plotting | Blueprint/CAD plotting | sheet size, drawing scale, color mode, folding/binding, copy count |
| Packaging | Packaging/box production | box style, internal dimensions, material, finish, food-grade requirement, quantity |

The API owns required fields and valid options. Mobile and Admin render the returned definitions rather than maintaining independent product rules.

## Upload Policy

- Collateral, merchandise, awards, signage, and packaging accept configured artwork/reference formats such as PDF, PNG, JPEG, TIFF, AI, or PSD where supported.
- 3D fabrication accepts configured model formats such as STL, OBJ, or 3MF.
- CAD plotting accepts PDF and configured CAD formats such as DWG or DXF.
- General artwork uploads use a 100 MB product limit; 3D model uploads use the existing supported 200 MB limit.
- The server validates the selected product, ownership, extension, MIME type, purpose, and size. Executable or mismatched content is rejected.
- The client validates early for usability, but server validation remains authoritative.

## Customer Experience

The new customer path is:

```text
New Order
→ choose one of four groups
→ choose a product
→ enter product-specific requirements
→ upload artwork/reference files
→ review request
→ submit RFQ
```

The group screen follows GRIDGO's yellow/black visual language while retaining Light and Dark Mode parity, semantic theme tokens, accessible contrast, 44×44 minimum targets, and one primary yellow action per context. Each group card shows its name, audience description, product count, and icon. Each product card shows the supplied examples.

The current six-step Paper/3D branch becomes a generic catalog-driven order flow. The obsolete compiled fallback is replaced by a v1.10 catalog snapshot that matches the API. A catalog request failure presents retry UI; submission stays disabled until the client has a current server-backed catalog.

Existing orders continue to display their saved product/category snapshots. Customer order details show `Price and turnaround pending review` until a quote exists.

## RFQ and Marketplace Lifecycle

The lifecycle uses the existing marketplace order status model plus pricing metadata:

```text
draft
→ submitted
→ needs_qa
→ client_correction | proof_approval
→ approved_for_matching
→ supplier_assigned
→ supplier_accepted + pricing_status=quoted
→ customer accepts quote
→ awaiting_payment + pricing_status=accepted
→ payment_authorized
→ production and existing fulfillment lifecycle
```

Supplier acceptance includes final PHP minor-unit price and promised completion time. The customer must explicitly accept that quote before Pilot Credits or eligible COD becomes available. Production remains blocked until payment authorization.

Multi-product carts remain supported. Each product line becomes an independently matchable order under the existing batch relationship so unlike products can be assigned to different qualified suppliers.

## Operations, Supplier, and Super Admin

- Super Admin product management supports group metadata, leaf products, specification definitions, ordering, activation, RFQ pricing mode, and upload policy.
- Operations order screens display dynamic product names and specification snapshots rather than coercing products to Paper or 3D.
- Supplier capabilities reference leaf product slugs, not broad group slugs.
- Matching ranks only verified, active supplier services that cover the requested leaf product.
- When no eligible supplier exists, Operations sees a clear unmet-coverage state; the client continues to see availability pending rather than a false match.
- Supplier mobile remains limited to time-sensitive job actions. Catalog editing stays in the web portal/Super Admin surface.

## Error Handling and Compatibility

- A pending RFQ never exposes checkout or payment controls.
- A missing quote amount or promised completion date prevents supplier quote submission.
- Quote acceptance is idempotent and rejects stale or superseded quotes.
- Inactive products remain readable through order snapshots but cannot start new requests.
- Failed catalog, upload, submission, matching, or quote actions preserve the last durable state and provide a retry path.
- Existing Paper and 3D order parsing remains covered until all historical data has aged out; no migration rewrites historical product identity.

## Integration Strategy

At design approval time, `origin/main` is `8ad8447` (`v1.9.1`) and `origin/GRIDGOv3` is `a16f9ec`. The histories have diverged: main has 22 unique commits and GRIDGOv3 has 60 unique commits.

Implementation uses an integration branch created from `origin/main`:

1. Create `release/v1.10.0-catalog` from current `origin/main`.
2. Merge the synchronized `GRIDGOv3` history into that branch.
3. Resolve conflicts by preserving both the v1.9.1 fixes and the marketplace behavior from GRIDGOv3.
4. Run a baseline check before catalog implementation so merge regressions are separated from feature regressions.
5. Implement the catalog/RFQ work in small commits on the integration branch.
6. Open a pull request to `main` and require repository checks to pass.
7. Merge only after local and GitHub verification.

No direct force push or history rewrite is permitted. The existing `GRIDGOv3` remote branch remains available as integration evidence.

## Verification Gates

### Backend

- `npm run lint:check`
- `npm run build`
- `npm test`
- `npm run test:e2e -- --runInBand`
- empty-database migration lifecycle
- fresh-seed and reseed catalog contract
- RFQ pricing, quote acceptance, authorization, matching, and upload-policy tests

### Admin

- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- product administration and dynamic order rendering tests

### Mobile

- `fvm flutter analyze lib/`
- `fvm flutter test`
- `fvm flutter build web --release --no-tree-shake-icons`
- widget/provider tests for four groups, seventeen products, dynamic requirements, upload errors, RFQ submission, quote acceptance, and legacy order rendering

### Landing and integration

- Landing lint, content checks, and production build
- non-mutating beta workflow contract
- marketplace workflow contract
- isolated fresh-compose startup with migrations and seed
- opt-in destructive workflow only against the isolated local stack
- GitHub required checks on the exact pull-request head and merged `main` commit

Failures introduced by the integration or catalog work are fixed before release. Any unrelated pre-existing failure must be reproduced on both parent baselines, documented with evidence, and either resolved in scope or tracked explicitly; it cannot be silently ignored while claiming the release is green.

## Release 1.10 Contract

- Update mobile version from `1.9.1+25` to `1.10.0+26` on the release branch.
- Merge the reviewed release PR into `main` only when required checks are green.
- Pull and verify the exact merged `main` commit locally.
- Rerun the release-critical checks against that commit.
- Create annotated tag `v1.10.0` only from the verified `main` commit.
- Push the tag and wait for the tag/release workflow to pass.
- Publish the GitHub release with generated notes and the repository's normal release assets.
- Mark `v1.10.0` as latest only after the release workflow succeeds.

## Acceptance Criteria

Release `v1.10.0` is complete only when:

1. A fresh database migrates and seeds four groups and seventeen active products.
2. New Order displays the four groups instead of Paper Printing and 3D Printing.
3. Every supplied product can be selected and submitted as a structured RFQ.
4. Pending RFQs never show a fake or zero quote.
5. Operations can QA and match the leaf product to a verified supplier capability.
6. A supplier can submit price and turnaround, and the customer can accept before payment.
7. Historical Paper/3D orders remain readable.
8. Admin product and order views render the dynamic catalog correctly.
9. The integrated main/GRIDGOv3 code passes all release gates.
10. The verified main commit is tagged and published as `v1.10.0`.

## Non-Goals

- Automatic instant pricing for the seventeen heterogeneous products.
- Open supplier browsing or bidding.
- Graphic design services or silent artwork edits.
- Nationwide or multi-city fulfillment.
- Supplier catalog editing from the mobile app.
- A framework or platform rewrite.
