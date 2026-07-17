# Home Feed Tile — admin-controlled bento content (design)

Date: 2026-07-17
Status: approved for implementation (user requested feature-complete replacement)
Surfaces: server, admin, mobile

## Problem

The customer home bento's "The Feed" tile renders TAM-survey community
feedback (`GET /tam-surveys/feed`). When no feedback exists the tile is a
dead box ("No community feedback yet." / previously a red "Failed to load
feed" under dev-bypass). Admins have no control over the slot.

## Goal

Admins choose what the tile shows — community feedback, a marketing/promo
card, or automatic (community when feedback exists, otherwise promo). The
choice propagates to customer home screens live (websocket), with normal
fetch-on-load as the fallback path. All resolution is server-authoritative;
clients only render.

## Server (`server/src/home-feed/`)

New module modeled on `daily-grid` (public WS gateway) and `beta-mode`
(single-row settings):

- **Entity** `home_feed_settings` (single row, lazily created):
  - `mode` enum: `auto` (default) | `community` | `promo`
  - `promo_title` varchar(80) nullable
  - `promo_body` varchar(220) nullable
  - `promo_cta_label` varchar(32) nullable
  - `promo_cta_target` varchar(255) nullable — in-app route (`/…`) or https URL
  - `promo_image_url` varchar(2048) nullable
  - `updated_at` timestamptz
- **Migration** adds the table; follow existing migration + spec conventions.
- **`GET /home-feed`** (JWT, any role): returns
  `{ mode, resolvedMode, promo, feedItems }`.
  - `feedItems`: same shape/source as `GET /tam-surveys/feed` (reuse
    TamSurveysService; no duplicate query logic).
  - `promo`: the promo fields, or `null` when not configured
    (configured = title AND body present).
  - `resolvedMode` (server-side): `community` | `promo` | `empty`.
    - `mode=community` → `community` (even with zero items; client shows
      invite state when list empty)
    - `mode=promo` → `promo` if configured else `empty`
    - `mode=auto` → `community` if feedItems non-empty, else `promo` if
      configured, else `empty`
- **`GET /home-feed/settings`**, **`PATCH /home-feed/settings`** (JWT +
  `@Roles(ADMIN)`): PATCH validates via DTO — mode enum; when
  `mode=promo`, `promoTitle` and `promoBody` required; `promoCtaLabel` and
  `promoCtaTarget` must be provided together; `promoCtaTarget` must start
  with `/` or `https://`; `promoImageUrl` optional URL.
- **Gateway** `HomeFeedGateway` at namespace `/ws/home-feed`, no auth
  (event carries no data, mirrors `/ws/daily-grid`), emits
  `homeFeedUpdated {}` after every successful PATCH.
- **Tests**: service spec (row lazy-create, resolution matrix, gateway
  called on update), controller authz (admin-only PATCH), DTO validation.

Out of scope (documented future work): emitting `homeFeedUpdated` when new
TAM feedback lands (auto-mode flip without re-fetch); image upload via
MinIO (admin pastes a hosted URL, same as the marketing composer).

## Admin (`admin/src/pages/daily-grid/`)

"Home feed tile" card at the top of the Daily Grid page (the home-screen
CMS surface):

- Segmented control: **Auto (recommended)** / **Community feed** /
  **Promo card**, bound to `GET/PATCH /home-feed/settings` via `apiClient`.
- Promo composer (visible for Auto + Promo): title, body, CTA label,
  CTA destination (select: Start printing `/customer/order/new`-equivalent
  route, Top up, The Data Grid, Custom URL) and image URL input
  (URL-paste, consistent with the marketing composer).
- Live preview replicating the mobile bento tile (dark tile, brand-yellow
  border, dot-grid motif) so admins see what customers will see.
- Helper copy: "Changes reach customer home screens instantly."
- Vitest coverage for mode switching + payload shape.

## Mobile (`apps/mobile/lib/features/customer/home/`)

- New `home_feed_provider.dart`: `homeFeedProvider`
  (`FutureProvider.autoDispose`) fetching `GET /home-feed` into
  `HomeFeedData { mode, resolvedMode, promo, feedItems }`; reuses the
  existing `FeedItem` model.
- `WebSocketService`: `connectHomeFeed(onUpdated)` / disconnect, mirroring
  the daily-grid namespace methods; home screen wires the callback to
  `ref.invalidate(homeFeedProvider)` so the tile switches live.
- `_FeedTile` rendering by `resolvedMode` (AnimatedSwitcher transition):
  - `community` + items: existing rating carousel unchanged.
  - `community` + empty / `empty`: designed invite state — dot-grid motif,
    "No community feedback yet." + "Reviews appear here after deliveries."
  - `promo`: branded promo card — subtitle switches to "News & offers.",
    optional image, title, body, CTA chip. CTA navigates in-app when the
    target starts with `/` and the route is known; https URLs open via the
    existing external-link helper if one exists, otherwise the CTA is
    hidden for unsupported targets.
  - error: quiet caption "Couldn't load the feed." + retry, no red text.
- Tests: provider parsing/resolution rendering, tile state widget tests.

## Rollout / compatibility

- No changes to `GET /tam-surveys/feed` (still used elsewhere/tests).
- Default `mode=auto` with no promo configured reproduces today's behavior
  (community feed; invite state when empty) — zero-config safe.
- Old app builds keep calling `/tam-surveys/feed` and simply ignore the
  new tile logic — no breaking API change.
