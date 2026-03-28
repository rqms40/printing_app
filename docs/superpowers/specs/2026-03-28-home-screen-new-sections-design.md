# Home Screen — New Sections Design Spec

**Date:** 2026-03-28
**Scope:** Add Quick Actions strip and Popular Prints carousel below existing Recent Orders section on the customer home screen.

## Context

The current home screen has: greeting header, bento grid (5 tiles), and recent orders carousel. The user wants more content below — graphical, catchy, minimal text. Two sections were selected from 8 candidates.

## Section 1: Quick Actions Strip

**Position:** Directly below Recent Orders section.

**Layout:** Horizontal scrollable row (`ListView.builder`, `scrollDirection: Axis.horizontal`). Each item is a column of circular icon + 2-line label.

**Items (5 actions):**

| Label | Icon (HugeIcons) | Action | Style |
|-------|-------------------|--------|-------|
| New Order | `add-01` (or `plus-sign`) | Navigate `/customer/order/new` | **Yellow filled circle** (#FFDE58 bg, black icon) — primary CTA |
| Reprint Last | `edit-02` | Navigate `/customer/order/new` (pre-fill last order specs) | Grey outline circle (#141414 bg, #222 border) |
| Upload File | `upload-03` | Navigate `/customer/order/new` then trigger file picker | Grey outline circle |
| Scan QR | `qr-code` | Placeholder — show "Coming Soon" snackbar | Grey outline circle |
| Track Order | `search-01` | Navigate `/customer/orders` | Grey outline circle |

**Dimensions:**
- Circle: 56×56, border-radius: full (9999)
- Icon size: 22
- Label: caption style (Satoshi 12px), color grey (#999 dark / #666 light), centered, max 2 lines
- Item width: 72px
- Gap between items: 16px
- Section has `SectionHeader` with title "Quick Actions" (no "See All")

**Animation:** Staggered fade-in + slideY (matching bento grid pattern). Each item delayed by 50ms from previous. Base delay offset after recent orders animations complete.

## Section 2: Popular Prints Carousel

**Position:** Below Quick Actions strip.

**Layout:** Horizontal scrollable row (`ListView.builder`, `scrollDirection: Axis.horizontal`). Each item is a card with visual preview area + text body.

**Items (6 print types):**

| Title | Price Label | Visual | Tap Action |
|-------|-------------|--------|------------|
| Documents | from ₱3 / page | Stacked paper sheets illustration (white rectangles on dark blue gradient) | Navigate `/customer/order/new` |
| ID Photos | from ₱15 / set | Landscape photo frame (gradient with sun/mountain shapes) | Navigate `/customer/order/new` |
| Posters | from ₱45 / pc | Framed poster with "A2" text (purple gradient) | Navigate `/customer/order/new` |
| Thesis Bind | from ₱120 / copy | Book spine illustration (brown leather tones, gold lines) | Navigate `/customer/order/new` |
| 3D Prints | from ₱150 / model | Rotated cube with shadow (teal gradient, yellow cube) | Navigate `/customer/order/new` |
| Stickers | from ₱25 / sheet | Cluster of colored circles (red, yellow, green on pink gradient) | Navigate `/customer/order/new` |

**Card Dimensions:**
- Card width: 150px (fixed)
- Image area height: 100px
- Card border-radius: lg (12px)
- Background: surface color (#141414 dark / #FFFFFF light)
- Border: 1px solid subtle (#1a1a1a dark / #E8E8E8 light)
- Gap between cards: 12px
- Body padding: 10px horizontal, 12px bottom

**Card Body:**
- Title: h3-like but smaller (13px, Satoshi SemiBold, primary text color)
- Price: 11px, Satoshi SemiBold, brand yellow (#FFDE58 dark / #D4A017 light)
- Unit suffix: 11px, grey (#666), normal weight

**Section Header:** `SectionHeader` with title "Popular Prints" and "See All" action (navigates `/customer/order/new`).

**Visuals:** Each card's image area uses a CSS-like gradient background with simple geometric shapes built from `Container`, `DecoratedBox`, and `Transform` widgets. No external images or assets required — pure Flutter painting. This keeps it lightweight and theme-aware.

**Animation:** Same staggered pattern as Quick Actions. Each card fades in + slides up with 80ms stagger delay.

## Design System Compliance

- **Colors:** Greyscale-dominant. Yellow (#FFDE58 dark / #D4A017 light) ONLY on: "New Order" quick action circle and price labels in popular prints.
- **Typography:** All text uses Satoshi (body/caption weights). No Instrument Serif in these sections.
- **Spacing:** 24px (lg) vertical gap between sections. 16px (md) horizontal padding matches existing content.
- **Dark/Light mode:** All colors reference AppColors from theme. Illustrations use theme-aware gradients.
- **Animations:** Uses `flutter_animate` with `.fadeIn()` and `.slideY()` matching existing bento grid pattern.

## File Structure

```
lib/features/customer/home/
├── screens/
│   └── home_screen.dart          (modified — add new sections to column)
└── widgets/
    ├── bento_grid.dart            (unchanged)
    ├── hero_banner.dart           (unchanged)
    ├── recent_orders_section.dart (unchanged)
    ├── service_card.dart          (unchanged)
    ├── quick_actions_strip.dart   (NEW)
    └── popular_prints_section.dart (NEW)
```

Two new widget files. Home screen modified to include them in its scrollable column below `RecentOrdersSection`.

## Mock Data

Both sections use hardcoded data initially (no provider needed). Quick action items and popular print items are defined as simple lists within their respective widget files. This matches the existing pattern where bento grid tiles are hardcoded.

## Out of Scope

- "Reprint Last" pre-fill logic (shows snackbar "Coming soon" for now)
- "Scan QR" functionality (shows snackbar "Coming soon" for now)
- Backend integration for dynamic popular prints / pricing
- Analytics tracking on quick action taps
