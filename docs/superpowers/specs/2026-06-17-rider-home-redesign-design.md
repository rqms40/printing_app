# Rider Home Redesign — Design Spec

**Date:** 2026-06-17
**Scope:** Redesign the rider Home cockpit (`/rider/home`) to mirror the customer home's layout language, with rider-appropriate content. Switch the rider bottom nav to match the customer nav exactly. Make the rider shell theme-following (light + dark) instead of dark-only.

**Out of scope (this pass):** Orders/deliveries list, Alerts, Profile, active-delivery, and delivery-detail screens. The design is structured so those tabs can follow the same pattern in later passes.

---

## Goal

Riders currently see a bespoke pure-black "cockpit" (`screenshots-for-agents/rider-UI.png`). The customer home (`screenshots-for-agents/customerUI.png`) has a refined, recognizable layout: greeting header + status chip, a GRIDGO hero, a two-column bento (map + stacked tiles), a horizontal carousel, and a recent-items list, over a nav bar with a circular yellow "+" FAB.

We want the rider Home to adopt **the customer's layout structure and nav**, populated with **rider content** — not a literal copy of either screenshot.

---

## Decisions (confirmed with user)

1. **Palette:** Support light + dark, mirroring the customer exactly. Retire `RiderTheme`'s pure-black constants in favor of `AppColors.light` / `AppColors.dark` tokens. The rider shell must **stop force-wrapping in `AppTheme.dark`** (`app_router.dart:539-540`) and instead respect the global theme toggle like the customer shell.
2. **Nav bar:** Match the customer nav exactly — `AppBottomNavStyle.standard`, `showFab: true`, circular yellow "+" FAB, accent-pill active-tab highlight, customer-style quick-action panel populated with `kRiderQuickActions`.
3. **Status chip:** The credits-chip slot in the header becomes an **Online/Offline toggle** (green when online), tapping toggles rider availability.
4. **Hero:** Reuse the existing `HeroBanner` widget as-is, retaining the `bentobox.webp` animation and the GRIDGO dot-matrix logo/wordmark. No rider hero variant.

---

## Layout mapping (customer slot → rider counterpart)

| # | Customer slot | Rider counterpart | Data source |
|---|---|---|---|
| 1 | Header: date overline + "Good evening, {name}" + 🔔 bell + 💰 credits chip | Same header. Bell → `/rider/alerts`. **Credits chip → Online/Offline status pill** (green/grey, taps to toggle availability). | `authProvider`, `riderProfileProvider` |
| 2 | Resume-queue card (conditional) | **"Resume active delivery"** card (conditional): order ref + stop count, taps into the active-delivery screen. Hidden when no active delivery. | `deliveriesProvider.activeDelivery` |
| 3 | GRIDGO hero banner | **Reuse `HeroBanner` unchanged** (`.webp` + GRIDGO logo). | — |
| 4 | Two-column row (h≈290): map tile (left 50%) + 3 stacked tiles (right 50%) | **Left:** live route-map tile (rider stops/route; tap → navigate/active). **Right ① "Active Stop"** (customer name + order ref; primary; tap → active delivery) **② "My Deliveries"** (assignment count; tap → `/rider/deliveries`) **③ "Earnings"** rotating stat tile (today/week/month; mirrors the bordered rotating Feed tile). | `deliveriesProvider`, `earningsProvider` |
| 5 | Daily Grid carousel | **"Today's Route" carousel** — horizontal stop cards (order ref, customer, short address, status badge); tap → delivery detail. Empty-state when no stops. | `deliveriesProvider.routeStops` |
| 6 | Recent Orders list | **"Recent Deliveries" list** — recently completed deliveries. | `deliveriesProvider` history / `earningsProvider` |
| 7 | Floating chat button | Contextual floating chat → opens the **active delivery's conversation** when one exists; hidden otherwise. | `chatProvider`, `deliveriesProvider.activeDelivery` |

No backend changes are required; all data is already exposed by existing providers.

---

## Components / files

New rider home widgets under `apps/mobile/lib/features/rider/home/widgets/`, each a focused widget that parallels its customer counterpart and reuses customer patterns (`_YellowBorderTile`, section headers, animation timings, `AppSpacing`/`AppRadius`/`AppTypography`):

- `rider_home_header.dart` — date + greeting + bell + online-status pill
- `rider_online_pill.dart` — Online/Offline toggle (calls availability mutation)
- `rider_resume_active_card.dart` — conditional resume-active-delivery card
- `rider_route_map_tile.dart` — left bento map tile (route/stops)
- `rider_bento_tiles.dart` — Active Stop / My Deliveries / Earnings tiles (yellow-border style)
- `rider_today_route_section.dart` — horizontal "Today's Route" carousel
- `rider_recent_deliveries_section.dart` — recent completed deliveries list

`rider_home_screen.dart` is rewritten to compose these in the customer home's `SingleChildScrollView` + `Column` structure (`Stack` with floating chat button overlay), using `AppColors` tokens via `Theme.of(context).brightness`.

**Retired:** `RiderTheme` pure-black constants (and the home widgets that depended on them: `rider_branding_banner.dart`, `rider_route_map_panel.dart`, `rider_active_stop_card.dart`, `rider_stop_timeline.dart` for the Home screen). Where the existing route-map/active-stop logic is reusable, extract it into the new theme-following widgets rather than referencing `RiderTheme`. Note: `RiderTheme` may still be referenced by out-of-scope screens (active delivery, detail) — those keep compiling; we only stop using it on Home. A follow-up pass migrates the rest.

**Router change (`app_router.dart`):** rider `StatefulShellRoute` builder drops the `Theme(data: AppTheme.dark)` wrapper and sets `navStyle: AppBottomNavStyle.standard`. The 4 tabs (Home · Orders ·(+)· Alerts · Profile) and `kRiderQuickActions` are retained.

---

## Theme handling

- All new widgets resolve colors via `Theme.of(context).brightness == Brightness.dark ? AppColors.dark : AppColors.light`, identical to the customer home.
- `HeroBanner` is intentionally always-dark (black card) in both themes — same as on the customer home — so it looks consistent across both.
- The online-status pill uses a success/green accent when online and `surfaceVariant`/`onSurfaceDim` when offline, sized like the customer credits chip (38px height, `borderMd`).

---

## Error / empty / loading states

- No active delivery → resume card hidden; "Active Stop" tile shows an idle "No active stop" state; floating chat hidden.
- Empty route → "Today's Route" carousel shows an empty-state message (mirrors Daily Grid empty state).
- Earnings/deliveries loading → small `CircularProgressIndicator` in brand color (matches customer Feed tile loading).
- Offline/demo mode → existing `ScaffoldWithNav` banners already cover this; no per-widget handling needed.

---

## Testing

- Widget test: rider home renders header, hero, bento, carousel, and recent sections without overflow in both light and dark themes.
- Widget test: online pill toggles availability (mocked `riderProfileProvider`).
- Widget test: resume-active card appears only when `activeDelivery != null`.
- Manual: run `flutter build web --release --no-tree-shake-icons` after changes (per project convention) and visually verify against the customer home layout in both themes.

---

## Success criteria

1. `/rider/home` visually matches the customer home's structure (header, hero, two-column bento, carousel, recent list) in both light and dark.
2. The rider bottom nav is the standard customer nav (circular yellow FAB, accent-pill highlight, rider quick actions).
3. The GRIDGO hero retains its `bentobox.webp` animation.
4. Rider content (online status, active stop, route, earnings, recent deliveries) is wired to existing providers with no backend changes.
5. App compiles and the web release build succeeds.
