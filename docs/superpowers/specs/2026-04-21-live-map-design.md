# Live Map — Customer Home Tile & Tracking Screen

**Date:** 2026-04-21
**Status:** Approved
**Scope:** `MapTrackingTile` (home), `DeliveryMap` (tracking screen), `MapHelpers`, new `liveDeliveryMapProvider`

---

## Problem

The home map tile (`MapTrackingTile`) is entirely hardcoded — fake Manila coordinates, always-dark CartoDB tiles, no connection to real order or driver data. The tracking screen (`DeliveryMap`) simulates driver movement with a timer rather than consuming real WebSocket location data. Neither screen is theme-aware. There is no idle state for when no delivery is active.

---

## Goals

1. Home map tile shows real driver position when a delivery is `onTheWay`, and a static Davao City view otherwise.
2. Both screens share one source of truth for driver location and route — no duplicate state.
3. Tracking screen owns the WebSocket connection; home tile reads the cached result.
4. Both screens switch tile styles with the system theme (CartoDB Dark Matter / Positron).
5. Tapping the home tile always navigates to `/customer/tracking`.

---

## Architecture

### Shared State — `liveDeliveryMapProvider`

A single Riverpod `FutureProvider` (or `StateNotifierProvider`) that:

- Reads `activeOrdersProvider` to find the first order with `OrderStatus.onTheWay`.
- Reads `locationProvider` for the live driver `LatLng` (emitted by the tracking screen's WS connection).
- Calls `RoutingService.getRoute(shopPoint, destPoint)` to fetch/cache the road-following polyline.
- Derives `destPoint` from the active order's delivery address lat/lng fields.
- Derives `shopPoint` from a fixed branch location (configurable constant, Davao City).

Exposes `LiveDeliveryMapState`:

```dart
enum LiveMapStatus { loading, active, idle }

class LiveDeliveryMapState {
  final LiveMapStatus status;
  final LatLng? driverPoint;   // null when idle
  final LatLng shopPoint;
  final LatLng destPoint;
  final List<LatLng> routePoints;
  final String? orderId;
  final OrderStatus? orderStatus;
}
```

**Idle state** uses a fixed Davao City center point (approx `LatLng(7.1907, 125.4553)`) with no markers and no route.

---

### `MapHelpers` — Theme-Aware Tile Layer

Add a `tileLayer(Brightness brightness)` method:

```
dark  → https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png
light → https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png
```

Both screens call `MapHelpers.tileLayer(Theme.of(context).brightness)`. The existing single-style `tileLayer()` is replaced. `kRouteColor` and markers remain unchanged — they are visible on both tile styles.

---

### `MapTrackingTile` — Home Tile Rewrite

Becomes a `ConsumerWidget` reading `liveDeliveryMapProvider`.

**Active state** (`LiveMapStatus.active`):

```
┌─────────────────────────────────┐
│  [CartoDB dark or light tiles]  │
│                                 │
│    🏪────────🚛──────⚑         │
│         teal route polyline     │
│                                 │
│  ● LIVE MAP          ~12 min   │
└─────────────────────────────────┘
```

- Driver marker, shop marker, destination marker via `MapHelpers`.
- Route polyline via `MapHelpers.routePolyline()`.
- `LIVE MAP` badge (yellow, top-left) with pulsing dot.
- ETA chip (top-right): `~N min` derived from remaining route points.
- Map is non-interactive (`InteractiveFlag.none`).
- Tap → `context.push('/customer/tracking')`.

**Idle state** (`LiveMapStatus.idle`):

```
┌─────────────────────────────────┐
│  [CartoDB tiles, Davao view]    │
│  dark overlay (0.35 opacity)    │
│                                 │
│     📍 Davao City               │
│     No active delivery          │
│                                 │
└─────────────────────────────────┘
```

- Static map centred on Davao City, zoom ~12.
- No markers, no route.
- Semi-transparent dark overlay with centred label.
- Tap → `context.push('/customer/tracking')`.

**Loading state** (`LiveMapStatus.loading`):

- `Container` with `colors.surfaceVariant` background + `CircularProgressIndicator`.
- Same size/border-radius as active state.

---

### `DeliveryMap` — Tracking Screen Update

Becomes a `ConsumerStatefulWidget`:

- Reads `liveDeliveryMapProvider` for `shopPoint`, `destPoint`, `routePoints`.
- Reads `locationProvider` for live `driverPoint` (already a Riverpod provider).
- On `initState`, calls `WebSocketService.instance.connectLocation(...)` and `subscribeToDelivery(assignmentId)` — this is the **only place** the location WS is connected.
- Removes the `Timer`-based simulation and the internal `_loadRoute()` call — route comes from the shared provider.
- Pulse animation on the Live Tracking badge is kept.
- ETA badge uses `routePoints.length - currentIndex` as before, but `currentIndex` is derived from matching `locationProvider`'s `LatLng` to the nearest point on the route.
- Theme-aware tiles via `MapHelpers.tileLayer(brightness)`.

---

## File Plan

| Action | File |
|--------|------|
| Modify | `lib/shared/widgets/map_helpers.dart` |
| Create | `lib/features/customer/home/providers/live_delivery_map_provider.dart` |
| Modify | `lib/features/customer/home/widgets/map_tracking_tile.dart` |
| Modify | `lib/features/customer/tracking/widgets/delivery_map.dart` |

No new dependencies required. All packages (`flutter_map`, `latlong2`, `flutter_riverpod`) are already in `pubspec.yaml`.

---

## Data Flow

```
activeOrdersProvider ──┐
                       ├──► liveDeliveryMapProvider ──► MapTrackingTile (home)
locationProvider ──────┤                            └──► DeliveryMap (tracking)
RoutingService ────────┘
                                ▲
                                │ feeds
                         DeliveryMap (WS owner)
                         WebSocketService.connectLocation()
```

---

## Error & Edge Cases

| Case | Behaviour |
|------|-----------|
| No active orders | Idle state — Davao static map |
| Active order but no `onTheWay` status | Idle state (driver not yet assigned/en route) |
| `locationProvider` returns null | Use `shopPoint` as driver position fallback |
| `RoutingService` fails / OSRM unreachable | Falls back to `_fallbackRoute` (already implemented) |
| WS disconnects mid-delivery | Last known `locationProvider` state held; no crash |
| Delivery address has no lat/lng | Idle state — destPoint cannot be computed |

---

## Out of Scope

- Push notification on delivery status change (separate feature).
- Driver heading/bearing rotation on the marker.
- Multi-order tracking (only the first `onTheWay` order is shown).
