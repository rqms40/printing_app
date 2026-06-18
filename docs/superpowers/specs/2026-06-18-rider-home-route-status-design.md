# Rider Home — Route Status + Big Map Redesign

**Date:** 2026-06-18
**Scope:** Replace the rider home's two-column bento section (map tile + 3 stacked tiles) with a full-width **Delivery Status panel + big always-on route map**, modeled on the customer `_DeliveryStatusAndMapLayout` but with rider route semantics. The GRIDGO hero, header/online pill, resume-active card, Today's Route carousel, Recent Deliveries list, and the standard nav are unchanged.

Reference: `screenshots-for-agents/withDispatch.png` (the customer delivery-status + map layout the user wants the rider section to resemble).

**Out of scope:** Other rider tabs (Orders, Alerts, Profile), active-delivery and detail screens, the customer home.

---

## Decisions (confirmed)

1. **Checklist:** per-stop checklist — delivered stops show a green check, the current stop is highlighted with its number ("You are at Stop N · {customer}"), upcoming stops are dimmed.
2. **Map:** always-on big route map (route polyline + numbered stop markers + rider position); tap → active delivery if any, else deliveries list.
3. **Bento tiles dropped:** Active Stop / My Deliveries / Earnings tiles are removed; `rider_bento_tiles.dart` + its test are deleted. Active stop now lives in the status panel; deliveries are covered by the Today's Route carousel + Recent Deliveries list; earnings remain accessible via the History/Profile tab.
4. **Section height:** the section is a fixed ~440px (taller than the old 290 bento) so the map reads as "big". The status panel takes its content height (capped); the map fills the remainder with a minimum height.
5. **Resume-active card:** kept (a small conditional one-tap CTA above the hero).

No backend changes — all data comes from existing providers.

---

## Layout

A new `RiderRouteStatusSection` replaces the old `SizedBox(height: 290, child: Row[map tile + Column of 3 tiles])` in `rider_home_screen.dart`, placed directly below `const HeroBanner()`.

It is a `LayoutBuilder`-driven `Column`:

```
┌─────────────────────────────────────────┐
│ Delivery Status                          │  ← status panel (content height, capped)
│ Route · 3/7                 [▓▓▓▓░░░] 43% │
│ ✓  Stop 1 · Maria Santos                 │
│ ✓  Stop 2 · Juan Cruz                    │
│ ⦿3 You are at Stop 3 · Ana Lim   (hilite)│
│ ○4 Stop 4 · Office Tower                 │
│    View all stops →   (if > cap)         │
├─────────────────────────────────────────┤  ← gap
│            [ big route map ]             │  ← map panel (remaining height, min ~240)
│   numbered stop markers + route + rider  │
│   LIVE badge / "Tap to navigate"         │
└─────────────────────────────────────────┘
```

**Height split** (mirrors the customer `_DeliveryStatusAndMapLayout` math): given the section's `maxHeight` (~440), the status panel height = its content height clamped to `maxHeight - gap - minMapHeight` (minMapHeight ≈ 240). The map gets the remainder. This guarantees the map stays big even with several checklist rows; excess stops collapse behind "View all stops".

---

## Components / files

### New
- **`features/rider/home/widgets/rider_route_status_section.dart`** — `RiderRouteStatusSection({required List<RiderAssignmentView> deliveredStops, required RiderAssignmentView? currentStop, required List<RiderAssignmentView> upcomingStops, required List<RiderAssignmentView> mapStops, required VoidCallback onMapTap, required void Function(RiderAssignmentView) onTapStop})`. Owns the `LayoutBuilder` height split; composes the status panel + the map tile.
- **`features/rider/home/widgets/rider_delivery_status_panel.dart`** — the "Delivery Status" header + progress bar + per-stop checklist. Contains a private `_StopCheckRow` (check / current-number / dim-number variants) and a "View all stops" bottom sheet for overflow. Theme-following via `AppColors`.

### Modified
- **`features/rider/home/widgets/rider_route_map_tile.dart`** — render **numbered stop markers** for every stop in `stops` (1..N), not just a single destination pin. Keep theme-following, the loading state, the route polyline, and the tap. Add a small "LIVE"/"Tap to navigate" affordance. The widget remains usable to fill a parent box.
- **`features/rider/home/screens/rider_home_screen.dart`** — remove the bento `SizedBox(290, Row[...])` and the three tile widgets; insert `RiderRouteStatusSection` inside a `SizedBox(height: 440, ...)` with the same `.animate().fadeIn(delay: 100ms)` entrance. Derive the stop lists from `deliveriesProvider` (see Data). Remove the now-unused imports of `rider_bento_tiles.dart`.

### Deleted
- **`features/rider/home/widgets/rider_bento_tiles.dart`** and **`test/features/rider/home/rider_bento_tiles_test.dart`** — the 3 tiles + their shared `RiderBorderTile` are no longer used anywhere (only the screen referenced them; confirm with grep before deleting).

---

## Data derivation (from `deliveriesProvider` `DeliveriesState`)

- **deliveredStops** = `completedAssignments.where((v) => v.status == DeliveryStatus.delivered)` (ordered by `routePosition` when present, else insertion order).
- **currentStop** = `activeDelivery` (first in-progress) — may be null.
- **upcomingStops** = `routeStops` minus the current stop (the not-yet-started stops; `routeStops` already = inProgress + new, ≤5).
- **mapStops** = the ordered union used for numbered markers = `[...deliveredStops, currentStop?, ...upcomingStops]` filtered to those with `order.destination?.latLng != null`, capped at a sensible marker count (≤8).
- **progress ratio** = `deliveredStops.length / max(1, deliveredStops.length + remainingCount)` where `remainingCount = (currentStop != null ? 1 : 0) + upcomingStops.length`. Label: `"Route · {delivered}/{total}"` + percent.
- Empty route (no delivered, no current, no upcoming): the panel shows "No active route — check Orders for assignments." and the map shows the idle base map.

`RiderAssignmentView` fields used: `id`, `status`, `routePosition`, `order.customerName`, `order.destination?.shortLabel`, `order.destination?.latLng`.

---

## Checklist row states (`_StopCheckRow`)
- **Delivered:** 26px green circle (`Color(0xFF78EC75)`, matching the customer `_StatusLine`) with a black check; title "Stop {n} · {customer}", subtitle "Delivered".
- **Current:** brand-colored circle with the stop number in black; title "You are at Stop {n}", subtitle "{customer} · {short address}"; row faintly highlighted (`colors.brand.withValues(alpha: 0.08)` background).
- **Upcoming:** outlined/dim circle with the stop number (`onSurfaceDim`); title "Stop {n} · {customer}", subtitle short address; muted colors.
- Rows are capped (default 4 visible, current always included). If total > cap, a "View all stops" `TextButton` opens a bottom sheet listing every stop (reusing `_StopCheckRow`).

---

## Map markers (`rider_route_map_tile.dart`)
- For each `mapStops[i]` with coordinates, render a numbered marker (reuse the visual style of the existing `rider_route_map_panel.dart` `_numberedStopMarker`, re-themed to `AppColors`): a small circle with the stop number, brand-outlined.
- Keep the route polyline (brand color) toward the current/first stop and the rider position marker.
- Camera fits all markers.
- Tap behavior unchanged (passed in via `onTap`).

---

## Error / empty / loading states
- Routing still loading → existing `CircularProgressIndicator` in the map.
- No stops → status panel "No active route…" message; map shows idle base map (no markers).
- Offline/demo mode → inherited `ScaffoldWithNav` banners; `deliveriesProvider` mock fallback still populates stops.

---

## Testing
- Widget test (`rider_delivery_status_panel_test.dart`): given delivered + current + upcoming stops, the panel renders a green check for delivered, the current stop highlighted with "You are at Stop N", and the progress label "{delivered}/{total}". Empty case shows the "No active route" message.
- Widget test (`rider_route_status_section_test.dart`): renders the status panel and the map tile within a bounded height without overflow, in both light and dark themes.
- Update `rider_home_screen_test.dart`: assert `RiderRouteStatusSection` is present (replacing the removed bento assertions); keep the no-production-animation-weakening test approach (provider overrides + bounded pumps).
- Delete `rider_bento_tiles_test.dart`.
- Manual: `flutter analyze lib/`, `flutter test test/features/rider/home/`, `flutter build web --release --no-tree-shake-icons`.

---

## Success criteria
1. The rider home, below the GRIDGO hero, shows a full-width Delivery Status panel (progress + per-stop checklist with green checks for delivered, highlighted current stop) over a big always-on route map with numbered stops.
2. The 3 bento tiles are gone; `rider_bento_tiles.dart` + test deleted; no dangling references.
3. Theme-following (light + dark); GRIDGO hero + standard nav unchanged.
4. Wired to existing providers; no backend changes.
5. `flutter analyze` clean, rider/home tests pass, web release build succeeds.
