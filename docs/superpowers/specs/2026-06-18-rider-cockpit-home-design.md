# Rider Home — Cockpit Layout (map-majority + right stop rail + active stop)

**Date:** 2026-06-18
**Scope:** Re-lay out the rider home as a **cockpit**: greeting header → GRIDGO hero → a big map (the majority of the first screenful) with a **scrollable, collapsible numbered stop rail overlaid on its right edge** → an **Active Stop card** → then Today's Route + Recent Deliveries scrolling below. Theme-following (light + dark). No backend changes.

Reference: `screenshots-for-agents/home/riderHomeScreen.png` (the cockpit: hero, map-majority with right rail, Active Stop card at the bottom).

**Supersedes:** the v1.3.5 `RiderDeliveryStatusPanel` + `RiderRouteStatusSection` (deleted).
**Out of scope:** other rider tabs, active-delivery/detail screens, the customer home.

---

## Decisions (confirmed)

1. **Theme:** theme-following via `AppColors` (light + dark) — re-theme the cockpit pieces off `RiderTheme`.
2. **Right rail:** scrollable through all numbered stops; a `<<` chevron collapses the rail to a thin `>>` handle (tap to expand) to give the map full width. Prepared for many stops.
3. **Structure:** cockpit on top (header + hero + map + active stop), then Today's Route + Recent Deliveries scroll beneath — all in one scroll view.
4. **Header:** keep the greeting header (date + greeting + name + 🔔 bell) but **remove the online/offline pill**. The online toggle remains available via the FAB "Go Online" quick-action and the Profile tab.
5. **Drop the resume-active card** (redundant with the Active Stop card).
6. **Delete** the superseded `RiderDeliveryStatusPanel` + `RiderRouteStatusSection` (+ tests) and the now-unused `RiderOnlinePill` (+ test).

---

## Layout (scrollable Column inside the existing Stack with the chat FAB)

```
RiderHomeHeader: WEDS, JUNE 18 / Good evening, Juan        🔔   ← online pill removed
GRIDGO hero (.webp)                                              ← HeroBanner, unchanged
┌─────────────────────────────────────────────┐
│ 10:52 AM                              ✓        │  ← RiderCockpitMap (~380px tall)
│ Saturday                              │        │     base = RiderRouteMapTile
│              ①   ②                    2        │     (numbered markers, time label)
│     🚕  route + rider                 │        │     right = RiderStopRail
│                       ③               3        │       (✓ → 1 → 2 … scrollable)
│   "Optimizing your delivery sequence…"  <<     │       << collapse chevron
└─────────────────────────────────────────────┘
Active Stop                                                     ← RiderActiveStopCard
[ 👤 Maria · A3 Glossy, 3 Copies · #ORD-10005       ✉  📞 ]        (re-themed; tap → active)
──────────────── scroll ────────────────
Today's Route (carousel)                                        ← kept
Recent Deliveries (list)                                        ← kept
```

- The map block is a fixed ~380px so it dominates the first screenful; the page scrolls to reveal the Active Stop card and the two sections.
- Empty route → rail shows the check/idle only; Active Stop card shows "No active stop — check Orders for assignments."

---

## Components / files

### New
- **`rider_stop_rail.dart`** — `RiderStopRail` (StatefulWidget; holds collapsed state). Theme-following adaptation of the old `RiderStopTimeline` with two upgrades: (a) renders a node for **every** stop (no clamp to 5) inside a vertical scroll view so many stops scroll; (b) a `<<`/`>>` chevron toggles collapsed — collapsed shows only a small rounded `>>` handle at the map's right edge, expanded shows the full rail (top green check → numbered nodes connected by a vertical line → `<<` chevron). Props: `RiderStopRail({required int totalStops, required int completedCount, required int currentStopIndex})`. Node states: done (`n <= completedCount`, filled/check tint), current (`n == currentStopIndex`, bold brand border + brand text), upcoming (dim outline). Uses `AppColors`.
- **`rider_cockpit_map.dart`** — `RiderCockpitMap({required List<RiderAssignmentView> mapStops, required RiderAssignmentView? activeStop, required int completedCount, required int currentStopIndex, required VoidCallback onMapTap})`. A `Stack` composing `RiderRouteMapTile(stops: mapStops, activeStop: activeStop, onTap: onMapTap)` (fill) with a `Positioned(top: 12, right: 8, bottom: 36)` `RiderStopRail`. Single responsibility: overlay the rail on the map.

### Modified
- **`rider_active_stop_card.dart`** — re-theme from `RiderTheme` to `AppColors` (brightness-resolved). Keep the same API and visual structure (avatar, customer name in brand, "Category, N Copies", "#ORD-xxxx", message + call action icons, tap target). It is currently unused; this brings it back into use.
- **`rider_home_header.dart`** — remove the `RiderOnlinePill` (and its import + the trailing `SizedBox`); the header is now date + greeting + bell only.
- **`rider_home_screen.dart`** — replace the `RiderRouteStatusSection` block with: `SizedBox(height: 380, child: RiderCockpitMap(...))` then a conditional `RiderActiveStopCard` (when `activeDelivery != null`, else a compact "No active stop" line). Drop the resume-active card. Keep header, hero, Today's Route, Recent Deliveries, chat FAB. Derive `completedCount`/`currentStopIndex` (see Data).

### Deleted
- `rider_delivery_status_panel.dart` + `test/.../rider_delivery_status_panel_test.dart` (superseded).
- `rider_route_status_section.dart` + `test/.../rider_route_status_section_test.dart` (superseded).
- `rider_online_pill.dart` + `test/.../rider_online_pill_test.dart` (no longer used after the header change).

### Reused (unchanged)
- `RiderRouteMapTile` (base map with numbered markers, theme-following).

### Untouched
- The ancient dead `rider_route_map_panel.dart`, `rider_stop_timeline.dart`, `rider_branding_banner.dart` (already unused, `RiderTheme`-based) are left as-is — not part of this change.

---

## Data derivation (in `rider_home_screen.dart`, from `deliveriesProvider`)
- `delivered` = `completedAssignments.where((v) => v.status == DeliveryStatus.delivered)`.
- `active` = `activeDelivery`.
- `upcoming` = `routeStops.where((v) => v.id != active?.id)`.
- `mapStops` = `[...delivered, ?active, ...upcoming]`.
- `completedCount` = `delivered.length`.
- `currentStopIndex` = `active != null ? delivered.length + 1 : 0` (0 = none current).
- `totalStops` = `mapStops.length`.

Stop numbering is sequential (delivered → current → upcoming) and identical between the rail and the map markers, so rail node N ↔ map marker N.

---

## Right rail behavior (`RiderStopRail`)
- **Expanded:** `Column` = top green check node → `Expanded(SingleChildScrollView(Column of numbered nodes joined by a vertical brand line))` → `<<` chevron button (brand bg). Nodes scroll when they exceed the available height.
- **Collapsed:** only a small rounded `>>` handle (brand bg) at the top-right; tapping expands. Animated width/opacity transition (≈200ms).
- Width ≈ 44px expanded; handle ≈ 28px collapsed.
- Theme-following: surface/brand/onSurface/onSurfaceDim from `AppColors`; the green check uses `Color(0xFF75D35B)` (as the old timeline did).

---

## Error / empty / loading states
- Map routing still loading → `RiderRouteMapTile`'s existing `CircularProgressIndicator`.
- Empty route (`totalStops == 0`) → rail shows just the check node (idle); Active Stop card replaced by a compact muted "No active stop — check Orders for assignments." line.
- Offline/demo → inherited `ScaffoldWithNav` banners; `deliveriesProvider` mock fallback still populates stops.

---

## Testing
- `rider_stop_rail_test.dart`: given totalStops=7, completedCount=2, currentStopIndex=3, renders the check node + numbered nodes; tapping the chevron toggles collapsed (the `>>` handle appears / full rail hidden). Bounded-height host.
- `rider_cockpit_map_test.dart`: composes `RiderRouteMapTile` + `RiderStopRail` in a bounded box without overflow (use `runAsync` so the map settles; do not weaken production).
- `rider_active_stop_card_test.dart` (if not present, add): renders customer name, order summary, "#ORD-...", and message/call icons; theme-following.
- Update `rider_home_header_test.dart`: still asserts the greeting renders; assert the online pill is **absent** (`find.text('Online')` / `find.text('Offline')` → `findsNothing`).
- Update `rider_home_screen_test.dart`: assert `RiderCockpitMap` present (replace the `RiderRouteStatusSection` assertion); keep the runAsync/override approach.
- Delete the superseded panel/section/online-pill tests.
- Manual: `flutter analyze lib/`, `flutter test test/features/rider/home/`, `flutter build web --release --no-tree-shake-icons`.

---

## Success criteria
1. The rider home is a cockpit: greeting header (no online pill) → GRIDGO hero → big map (majority) with a right-side **scrollable, collapsible** numbered stop rail → Active Stop card → Today's Route + Recent Deliveries below.
2. Rail node numbers match the map's numbered markers; the `<<`/`>>` chevron collapses/expands the rail; many stops scroll.
3. Theme-following (light + dark); GRIDGO hero retains its `.webp`; standard nav unchanged.
4. Superseded v1.3.5 panel/section + the online pill are deleted with no dangling references.
5. `flutter analyze` clean, rider/home tests pass, web release build succeeds.
