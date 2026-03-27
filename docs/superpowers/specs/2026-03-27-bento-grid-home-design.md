# Bento Grid Home Screen Design

## Overview

Replace the current hero banner + service cards on the customer home screen with a mobile bento grid layout, and fix the recent orders carousel alignment so cards are flush-left instead of centered.

## Scope

- **In scope:** Bento grid with 5 tiles, carousel alignment fix, existing design system tokens
- **Out of scope:** Backend wiring, new routes, new dependencies beyond `flutter_staggered_grid_view`

## Package

`flutter_staggered_grid_view` — using `StaggeredGrid.count` for the quilted bento layout.

## Bento Grid Layout

### Grid Config

- `crossAxisCount: 4`
- `mainAxisSpacing: AppSpacing.md` (16px)
- `crossAxisSpacing: AppSpacing.md` (16px)

### Tile Definitions

| Tile | Cross Cells | Main Cells | Content | Tap Action |
|------|-------------|------------|---------|------------|
| Hero | 2 | 2 | Editorial tagline "Professional printing, delivered." + subtle printer illustration at 7% opacity | None (decorative) |
| Paper Printing | 2 | 1 | Icon (`HugeIcons.strokeRoundedFile02`) + "Paper Printing" title + short description | `/customer/order/new` |
| 3D Printing | 2 | 1 | Icon (`HugeIcons.strokeRoundedPackageDelivered`) + "3D Printing" title + short description | `/customer/order/new` |
| Quick Stats | 2 | 1 | Active order count (e.g. "3 active orders"), icon | `/customer/orders` |
| Promo | 2 | 1 | Seasonal/featured text (e.g. "20% off large format"), accent-tinted background | None (static for MVP) |

### Visual Layout (4-column grid)

```
┌──────────────┬───────┐
│              │ Paper │
│  Hero/Promo  │  2x1  │
│    2x2       ├───────┤
│              │  3D   │
│              │  2x1  │
├──────────────┼───────┤
│  Quick Stats │ Promo │
│    2x1       │  2x1  │
└──────────────┴───────┘
```

### Tile Styling

- Container with `AppRadius.borderLg` rounded corners
- Background: `colors.surface` for most tiles, `colors.surfaceVariant` for hero and promo
- Shadow: `AppShadows.subtle` in light mode, none in dark mode
- Typography: `AppTypography.h3` for tile titles, `AppTypography.caption` for descriptions
- Hero tile uses `AppTypography.display` for the tagline
- Promo tile gets a subtle accent tint: `colors.accent.withValues(alpha: 0.06)` background

### Animations

Stagger entrance animations per tile, matching existing pattern:
- `fadeIn(duration: 400.ms, delay: N.ms, curve: Curves.easeOut)`
- `slideY(begin: 0.03, duration: 400.ms, delay: N.ms, curve: Curves.easeOut)`
- Delays: 0ms, 60ms, 120ms, 180ms, 240ms for tiles 1-5

## Carousel Fix (Recent Orders)

### Problem

`PageController(viewportFraction: 0.85)` centers cards, leaving blank space on both sides.

### Solution

- Set `padEnds: false` on the `PageController`
- Adjust `viewportFraction` to `0.88`
- First card aligns flush-left with the screen content padding
- Subsequent cards peek from the right edge, indicating swipeability
- Small gap between cards via existing horizontal padding (`AppSpacing.xs`)

## Home Screen Structure (top to bottom)

1. **Greeting** — "Good morning," / "Hello, Maria" (unchanged)
2. **Bento Grid** — 5 tiles replacing hero banner + service cards
3. **Recent Orders** — section header + fixed carousel + dot indicators

## Files Changed

| File | Action |
|------|--------|
| `pubspec.yaml` | Add `flutter_staggered_grid_view` dependency |
| `lib/features/customer/home/widgets/bento_grid.dart` | New — bento grid widget with 5 tiles |
| `lib/features/customer/home/widgets/bento_tile.dart` | New — individual tile widget variants |
| `lib/features/customer/home/screens/home_screen.dart` | Modify — replace hero + service cards with BentoGrid, remove ServiceCard imports |
| `lib/features/customer/home/widgets/recent_orders_section.dart` | Modify — fix PageController padEnds + viewportFraction |
| `lib/features/customer/home/widgets/hero_banner.dart` | Delete or keep unused (hero content moves into bento tile) |
| `lib/features/customer/home/widgets/service_card.dart` | Keep (may be used elsewhere), just remove from home screen |

## Design Tokens Used

All from existing config — no new tokens introduced:
- `AppColors.light` / `AppColors.dark`
- `AppSpacing.xs`, `.sm`, `.md`, `.lg`, `.xl`, `.xxl`
- `AppTypography.display`, `.h3`, `.body`, `.caption`
- `AppRadius.borderLg`, `.borderXl`
- `AppShadows.subtle`, `.none`
