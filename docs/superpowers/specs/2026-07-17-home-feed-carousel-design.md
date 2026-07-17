# Home Feed promo carousel + dedicated admin page (v2 design)

Date: 2026-07-17
Status: approved for implementation (follow-up to
`2026-07-17-home-feed-tile-design.md`; user asked for image-led,
multi-card marketing "like other mobile apps", admin-configurable, with
its own admin navigation)
Surfaces: server, admin, mobile

## Problem

v1 supports exactly one text-first promo configured inline on the Daily
Grid page. Real marketing surfaces (Grab/Shopee-style home banners) are
image-led, rotate several campaigns, and are managed as a list.

UX grounding (Baymard, NN/g, Mobbin carousel guidance): swipe with a
peeking next card is the strongest affordance; dots are secondary;
auto-advance must pause once the user interacts; put the best campaign
first; keep the set small (≤5).

## Server (`server/src/home-feed/`)

- **New table `home_feed_promo_cards`**: `id`, `title` varchar(80) NOT
  NULL, `body` varchar(220) NULL, `cta_label` varchar(32) NULL,
  `cta_target` varchar(255) NULL (route `/…` or https URL),
  `image_url` varchar(2048) NULL, `sort_order` int NOT NULL,
  `is_active` bool default true, `created_at`/`updated_at`.
- **Migration** creates the table and migrates the legacy single-promo
  columns from `home_feed_settings` (when `promo_title`+`promo_body`
  present, insert them as the first card), then drops the five
  `promo_*` columns from `home_feed_settings`. Follow existing
  migration/ownership conventions.
- **`GET /home-feed`** (JWT, any role) now returns
  `{ mode, resolvedMode, promoCards, feedItems }` where `promoCards` is
  the active cards ordered by `sort_order` (id tiebreak). `promo` field
  is dropped (no released client depends on it). Resolution:
  `community` → community; `promo` → `promo` if any active card else
  `empty`; `auto` → community if feedItems else promo if cards else
  empty.
- **Admin endpoints** (JWT + ADMIN), mirroring daily-grid conventions:
  - `GET /home-feed/promo-cards` (all cards incl. inactive, ordered)
  - `POST /home-feed/promo-cards` (validated DTO; sort_order appended)
  - `PATCH /home-feed/promo-cards/:id`
  - `DELETE /home-feed/promo-cards/:id`
  - `PATCH /home-feed/promo-cards/reorder` body `{ids: number[]}`
  - `POST /home-feed/admin/upload-image` — same FileInterceptor +
    StorageService pattern as `daily-grid.controller.ts` `upload-image`
    (5 MB, jpeg/png/webp, returns `{url}` via `MINIO_PUBLIC_URL`).
  - **Cap: max 5 active cards** — activating/creating a 6th active card
    is a 400 with a clear message.
- **WS**: emit `homeFeedUpdated {}` on the existing `/ws/home-feed`
  gateway after every successful settings PATCH or promo-card mutation.
- `GET/PATCH /home-feed/settings` keeps only `mode` (DTO simplified).
- Tests: resolution matrix with cards, CRUD authz, reorder, active cap,
  migration spec for the column move.

## Admin (`admin/src/pages/home-feed/`)

Dedicated **"Home Feed"** sider resource + route `/home-feed`
(registered in both the Refine `resources[]` list and the `<Routes>`
tree in `App.tsx`; placed next to Daily Grid). The v1 `HomeFeedCard` is
removed from the Daily Grid page (its mode control moves here).

Page layout (dense, consistent with existing pages):
- **Mode control**: Auto / Community feed / Promo cards segmented, with
  the same helper copy and instant-update note.
- **Campaign list**: one row per card — image thumbnail, title, body
  snippet, Live/Hidden toggle, ↑/↓ reorder, edit, delete
  (Popconfirm) — interaction grammar copied from the Daily Grid card
  list. "New campaign" button opens a Drawer form: title, body, CTA
  label + destination (same presets as v1 + custom), image URL input
  **plus Upload button** posting to `/home-feed/admin/upload-image`
  (mirrors the Daily Grid drawer exactly).
- **Phone preview**: right-hand mini carousel preview cycling the
  active cards, mirroring the mobile rendering (image with dark scrim
  and overlaid text, or brand-yellow text card when no image).
- Tests: normalizer, cap/reorder payloads, render with mocked API.

## Mobile (`home_feed_tile.dart` + provider)

- `HomeFeedData` gains `promoCards: List<HomeFeedPromo>` (replaces the
  single `promo`); `HomeFeedPromo` gains `imageUrl` prominence and
  optional `body`.
- Promo state renders a **carousel**:
  - `PageView` with `viewportFraction ≈ 0.92` so the next card peeks
    (research: continuity beats dots as the "more" cue).
  - Dot indicators under the cards (small, brand-accented active dot).
  - Auto-advance every 5 s **only while the user hasn't swiped**; any
    manual swipe cancels auto-advance for the session. Single card →
    no dots, no auto-advance.
  - Card rendering: with `imageUrl` → image fills the card,
    bottom-aligned dark gradient scrim, title (+ optional CTA chip)
    overlaid; without image → v1 brand-yellow text card. Whole card is
    tappable and navigates to `ctaTarget` (route or URL, v1 logic).
- WS + provider invalidation unchanged.
- Tests: parsing of `promoCards`, carousel renders N cards, single-card
  degenerate case, image-less fallback card.

## Dev-stack caveat (documented, not solved here)

`MINIO_PUBLIC_URL` derives from `GRIDGO_PUBLIC_HOST` (127.0.0.1 in the
default dev stack), so images uploaded through the admin are NOT
loadable from the Android emulator (which reaches the host as
10.0.2.2). Emulator demos should either use an externally hosted image
URL or start the stack with `GRIDGO_PUBLIC_HOST=10.0.2.2`. Production
uses a real public host, so this is dev-only.

## Out of scope (future)

Campaign scheduling (start/end dates), impression/tap analytics, image
cropping/aspect enforcement beyond the 5 MB/type limits.
