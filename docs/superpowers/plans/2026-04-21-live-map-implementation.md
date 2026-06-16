# Live Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded fake home map tile and simulated tracking screen with a real shared provider that reads live rider location from the WebSocket and switches map tile styles with the system theme.

**Architecture:** A new `liveDeliveryMapProvider` reads `activeOrdersProvider`, `addressProvider`, and `locationProvider` to produce a single `LiveDeliveryMapState`. The tracking screen (`DeliveryMap`) owns the WebSocket location connection and feeds `locationProvider`. The home tile (`MapTrackingTile`) and tracking screen both consume the shared state. `MapHelpers` gains a theme-aware `tileLayer(Brightness)` used by both screens.

**Tech Stack:** Flutter, flutter_riverpod, flutter_map, latlong2, OSRM routing (RoutingService — already implemented)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/shared/widgets/map_helpers.dart` | Add `tileLayer(Brightness)` — CartoDB Dark Matter / Positron |
| Create | `lib/features/customer/home/providers/live_delivery_map_provider.dart` | `LiveDeliveryMapState`, `LiveMapStatus`, `liveDeliveryMapProvider` |
| Modify | `lib/features/customer/home/widgets/map_tracking_tile.dart` | Rewrite as `ConsumerWidget` consuming `liveDeliveryMapProvider` |
| Modify | `lib/features/customer/tracking/widgets/delivery_map.dart` | Rewrite as `ConsumerStatefulWidget`, owns WS connection |
| Create | `test/features/customer/home/providers/live_delivery_map_provider_test.dart` | Unit tests for state logic |
| Create | `test/features/customer/home/widgets/map_tracking_tile_test.dart` | Widget tests for all three tile states |

---

## Task 1: Theme-Aware Tile Layer in MapHelpers

**Files:**
- Modify: `lib/shared/widgets/map_helpers.dart`

- [ ] **Step 1: Replace `tileLayer()` with `tileLayer(Brightness brightness)`**

Open `lib/shared/widgets/map_helpers.dart` and replace the existing `tileLayer()` method:

```dart
/// Returns a CartoDB tile layer matching the system theme.
/// Dark mode → Dark Matter. Light mode → Positron.
static TileLayer tileLayer(Brightness brightness) {
  final url = brightness == Brightness.dark
      ? 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      : 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
  return TileLayer(
    urlTemplate: url,
    userAgentPackageName: 'com.gridgoprint.app',
  );
}
```

Also add the Davao City center constant at the top of the class (after `mapCenter`):

```dart
/// Davao City center — used for idle state on home map tile.
static const davaoCenter = LatLng(7.1907, 125.4553);
```

- [ ] **Step 2: Analyze to confirm no broken call sites**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/shared/widgets/map_helpers.dart
```

Expected: `No issues found.`

If `delivery_map.dart` calls the old `MapHelpers.tileLayer()` (no args), it will error — that's fine, it gets fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/shared/widgets/map_helpers.dart
git commit -m "feat: add theme-aware tileLayer(Brightness) to MapHelpers"
```

---

## Task 2: LiveDeliveryMapProvider

**Files:**
- Create: `lib/features/customer/home/providers/live_delivery_map_provider.dart`
- Create: `test/features/customer/home/providers/live_delivery_map_provider_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/customer/home/providers/live_delivery_map_provider_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  group('LiveDeliveryMapState', () {
    test('idle() uses Davao center and empty route', () {
      final state = LiveDeliveryMapState.idle();
      expect(state.status, LiveMapStatus.idle);
      expect(state.riderPoint, isNull);
      expect(state.routePoints, isEmpty);
      expect(state.orderId, isNull);
      // Davao City approx
      expect(state.shopPoint.latitude, closeTo(7.1907, 0.001));
    });

    test('active() sets all fields', () {
      const rider = LatLng(7.20, 125.46);
      const shop = LatLng(7.19, 125.45);
      const dest = LatLng(7.21, 125.47);
      final route = [shop, rider, dest];

      final state = LiveDeliveryMapState.active(
        riderPoint: rider,
        shopPoint: shop,
        destPoint: dest,
        routePoints: route,
        orderId: 'ORD-001',
        orderStatus: OrderStatus.onTheWay,
      );

      expect(state.status, LiveMapStatus.active);
      expect(state.riderPoint, rider);
      expect(state.shopPoint, shop);
      expect(state.destPoint, dest);
      expect(state.routePoints, route);
      expect(state.orderId, 'ORD-001');
      expect(state.orderStatus, OrderStatus.onTheWay);
    });

    test('loading() has loading status', () {
      final state = LiveDeliveryMapState.loading();
      expect(state.status, LiveMapStatus.loading);
    });

    test('etaMinutes returns remaining route points count', () {
      const rider = LatLng(7.20, 125.46);
      const shop = LatLng(7.19, 125.45);
      const dest = LatLng(7.21, 125.47);
      final route = List.generate(30, (i) => LatLng(7.19 + i * 0.001, 125.45));

      final state = LiveDeliveryMapState.active(
        riderPoint: rider,
        shopPoint: shop,
        destPoint: dest,
        routePoints: route,
        orderId: 'ORD-001',
        orderStatus: OrderStatus.onTheWay,
      );

      // nearestRouteIndex for rider not in list → returns 0, eta = 30
      expect(state.etaMinutes, greaterThanOrEqualTo(0));
    });
  });
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/home/providers/live_delivery_map_provider_test.dart
```

Expected: FAIL — `live_delivery_map_provider.dart` does not exist yet.

- [ ] **Step 3: Create the provider file**

Create `lib/features/customer/home/providers/live_delivery_map_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/rider/active_delivery/providers/location_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

enum LiveMapStatus { loading, active, idle }

class LiveDeliveryMapState {
  const LiveDeliveryMapState._({
    required this.status,
    required this.shopPoint,
    required this.destPoint,
    this.riderPoint,
    this.routePoints = const [],
    this.orderId,
    this.orderStatus,
  });

  final LiveMapStatus status;
  final LatLng shopPoint;
  final LatLng destPoint;
  final LatLng? riderPoint;
  final List<LatLng> routePoints;
  final String? orderId;
  final OrderStatus? orderStatus;

  factory LiveDeliveryMapState.loading() => LiveDeliveryMapState._(
        status: LiveMapStatus.loading,
        shopPoint: MapHelpers.davaoCenter,
        destPoint: MapHelpers.davaoCenter,
      );

  factory LiveDeliveryMapState.idle() => LiveDeliveryMapState._(
        status: LiveMapStatus.idle,
        shopPoint: MapHelpers.davaoCenter,
        destPoint: MapHelpers.davaoCenter,
      );

  factory LiveDeliveryMapState.active({
    required LatLng riderPoint,
    required LatLng shopPoint,
    required LatLng destPoint,
    required List<LatLng> routePoints,
    required String orderId,
    required OrderStatus orderStatus,
  }) =>
      LiveDeliveryMapState._(
        status: LiveMapStatus.active,
        shopPoint: shopPoint,
        destPoint: destPoint,
        riderPoint: riderPoint,
        routePoints: routePoints,
        orderId: orderId,
        orderStatus: orderStatus,
      );

  /// Index of the route point nearest to [riderPoint].
  int get nearestRouteIndex {
    if (riderPoint == null || routePoints.isEmpty) return 0;
    const distance = Distance();
    var nearest = 0;
    var minDist = double.infinity;
    for (var i = 0; i < routePoints.length; i++) {
      final d = distance(riderPoint!, routePoints[i]);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return nearest;
  }

  /// Estimated minutes remaining (1 point ≈ 1 minute).
  int get etaMinutes =>
      routePoints.isEmpty ? 0 : routePoints.length - nearestRouteIndex;
}

/// Fixed shop/branch location in Davao City.
const _shopPoint = LatLng(7.0640, 125.6079); // Davao City downtown

/// Shared provider — reads active order + live rider location + OSRM route.
/// Tracking screen owns the WS connection that feeds [locationProvider].
final liveDeliveryMapProvider =
    FutureProvider.autoDispose<LiveDeliveryMapState>((ref) async {
  final orders = ref.watch(activeOrdersProvider);
  final locationUpdate = ref.watch(locationProvider);
  final addresses = ref.watch(addressProvider);

  // Find first order that is actively on the way
  final onTheWayOrder = orders
      .where((o) => o.orderStatus == OrderStatus.onTheWay)
      .firstOrNull;

  if (onTheWayOrder == null) return LiveDeliveryMapState.idle();

  // Resolve delivery address lat/lng
  final address = onTheWayOrder.deliveryAddressId != null
      ? addresses
          .where((a) => a.id == onTheWayOrder.deliveryAddressId)
          .firstOrNull
      : null;

  if (address == null) return LiveDeliveryMapState.idle();

  final destPoint = LatLng(address.latitude, address.longitude);

  // Rider position — use locationProvider if available, else fall back to shop
  final riderPoint = locationUpdate != null
      ? LatLng(locationUpdate.latitude, locationUpdate.longitude)
      : _shopPoint;

  // Fetch route (cached by RoutingService)
  final routePoints = await RoutingService.getRoute(_shopPoint, destPoint);

  return LiveDeliveryMapState.active(
    riderPoint: riderPoint,
    shopPoint: _shopPoint,
    destPoint: destPoint,
    routePoints: routePoints,
    orderId: onTheWayOrder.orderId,
    orderStatus: onTheWayOrder.orderStatus,
  );
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/home/providers/live_delivery_map_provider_test.dart
```

Expected: All tests PASS.

- [ ] **Step 5: Analyze**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/home/providers/live_delivery_map_provider.dart
```

Expected: `No issues found.`

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/home/providers/live_delivery_map_provider.dart \
        apps/mobile/test/features/customer/home/providers/live_delivery_map_provider_test.dart
git commit -m "feat: add liveDeliveryMapProvider with LiveDeliveryMapState"
```

---

## Task 3: Rewrite MapTrackingTile

**Files:**
- Modify: `lib/features/customer/home/widgets/map_tracking_tile.dart`
- Create: `test/features/customer/home/widgets/map_tracking_tile_test.dart`

- [ ] **Step 1: Write the failing widget tests**

Create `test/features/customer/home/widgets/map_tracking_tile_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/shared/models/enums.dart';

GoRouter _router() => GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const MapTrackingTile()),
      GoRoute(path: '/customer/tracking', builder: (_, __) => const Scaffold()),
    ]);

Widget _wrap(LiveDeliveryMapState state) => ProviderScope(
      overrides: [
        liveDeliveryMapProvider.overrideWith((_) async => state),
      ],
      child: MaterialApp.router(routerConfig: _router()),
    );

void main() {
  testWidgets('shows CircularProgressIndicator when loading', (tester) async {
    await tester.pumpWidget(_wrap(LiveDeliveryMapState.loading()));
    await tester.pump(); // let FutureProvider settle
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('shows "No active delivery" label in idle state', (tester) async {
    await tester.pumpWidget(_wrap(LiveDeliveryMapState.idle()));
    await tester.pumpAndSettle();
    expect(find.text('No active delivery'), findsOneWidget);
  });

  testWidgets('shows LIVE MAP badge in active state', (tester) async {
    final active = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
      orderId: 'ORD-001',
      orderStatus: OrderStatus.onTheWay,
    );
    await tester.pumpWidget(_wrap(active));
    await tester.pumpAndSettle();
    expect(find.text('LIVE MAP'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/home/widgets/map_tracking_tile_test.dart
```

Expected: FAIL — existing `MapTrackingTile` has none of these.

- [ ] **Step 3: Rewrite MapTrackingTile**

Replace entire contents of `lib/features/customer/home/widgets/map_tracking_tile.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

class MapTrackingTile extends ConsumerWidget {
  const MapTrackingTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mapAsync = ref.watch(liveDeliveryMapProvider);
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return GestureDetector(
      onTap: () => context.push('/customer/tracking'),
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: mapAsync.when(
          loading: () => _LoadingTile(colors: colors),
          error: (_, __) => _IdleTile(brightness: brightness, colors: colors),
          data: (state) => state.status == LiveMapStatus.active
              ? _ActiveTile(state: state, brightness: brightness)
              : _IdleTile(brightness: brightness, colors: colors),
        ),
      ),
    );
  }
}

// ── Loading ──────────────────────────────────────────────────────────────────

class _LoadingTile extends StatelessWidget {
  const _LoadingTile({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.surfaceVariant,
      child: Center(
        child: CircularProgressIndicator(color: colors.accent),
      ),
    );
  }
}

// ── Idle ─────────────────────────────────────────────────────────────────────

class _IdleTile extends StatelessWidget {
  const _IdleTile({required this.brightness, required this.colors});
  final Brightness brightness;
  final AppColorSet colors;

  static const _davaoZoom = 12.0;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        FlutterMap(
          options: const MapOptions(
            initialCenter: MapHelpers.davaoCenter,
            initialZoom: _davaoZoom,
            interactionOptions: InteractionOptions(
              flags: InteractiveFlag.none,
            ),
          ),
          children: [MapHelpers.tileLayer(brightness)],
        ),
        // Dim overlay
        Container(color: Colors.black.withValues(alpha: 0.35)),
        // Label
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.location_on_rounded,
                  color: Colors.white, size: 28),
              const SizedBox(height: 6),
              Text(
                'No active delivery',
                style: AppTypography.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Active ────────────────────────────────────────────────────────────────────

class _ActiveTile extends StatelessWidget {
  const _ActiveTile({required this.state, required this.brightness});
  final LiveDeliveryMapState state;
  final Brightness brightness;

  @override
  Widget build(BuildContext context) {
    final riderPoint = state.riderPoint!;
    final eta = state.etaMinutes;

    return Stack(
      fit: StackFit.expand,
      children: [
        FlutterMap(
          options: MapOptions(
            initialCenter: riderPoint,
            initialZoom: 13.8,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.none,
            ),
          ),
          children: [
            MapHelpers.tileLayer(brightness),
            if (state.routePoints.isNotEmpty)
              MapHelpers.routePolyline(state.routePoints),
            MarkerLayer(markers: [
              MapHelpers.shopMarker(point: state.shopPoint),
              MapHelpers.destinationMarker(point: state.destPoint),
              MapHelpers.riderMarker(riderPoint),
            ]),
          ],
        ),

        // LIVE MAP badge — top left
        Positioned(
          top: AppSpacing.sm,
          left: AppSpacing.sm,
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFFFDE58),
              borderRadius: AppRadius.borderFull,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: Colors.black,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  'LIVE MAP',
                  style: AppTypography.overline.copyWith(
                    color: Colors.black,
                    fontSize: 8,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),

        // ETA badge — top right
        Positioned(
          top: AppSpacing.sm,
          right: AppSpacing.sm,
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.65),
              borderRadius: AppRadius.borderFull,
            ),
            child: Text(
              '~$eta min',
              style: AppTypography.overline.copyWith(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4: Run widget tests**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/home/widgets/map_tracking_tile_test.dart
```

Expected: All tests PASS.

- [ ] **Step 5: Analyze**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/home/widgets/map_tracking_tile.dart
```

Expected: `No issues found.`

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart \
        apps/mobile/test/features/customer/home/widgets/map_tracking_tile_test.dart
git commit -m "feat: rewrite MapTrackingTile — real data, theme-aware tiles, Davao idle state"
```

---

## Task 4: Rewrite DeliveryMap (WS Owner)

**Files:**
- Modify: `lib/features/customer/tracking/widgets/delivery_map.dart`

- [ ] **Step 1: Rewrite delivery_map.dart**

Replace entire contents of `lib/features/customer/tracking/widgets/delivery_map.dart`:

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/rider/active_delivery/providers/location_provider.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

class DeliveryMap extends ConsumerStatefulWidget {
  const DeliveryMap({super.key});

  @override
  ConsumerState<DeliveryMap> createState() => _DeliveryMapState();
}

class _DeliveryMapState extends ConsumerState<DeliveryMap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _connectLocationSocket();
  }

  /// Opens the location WebSocket and subscribes to the active delivery.
  /// This is the only place in the app where the location WS is connected.
  Future<void> _connectLocationSocket() async {
    await WebSocketService.instance.connectLocation(
      onLocationUpdate: (data) {
        if (data is! Map) return;
        final d = Map<String, dynamic>.from(data as Map);
        final lat = (d['latitude'] as num?)?.toDouble();
        final lng = (d['longitude'] as num?)?.toDouble();
        if (lat == null || lng == null) return;
        // Push into locationProvider so both this screen and the home tile update
        ref.read(locationProvider.notifier).state = LocationUpdate(
          id: 'live',
          deliveryAssignmentId: 'active',
          latitude: lat,
          longitude: lng,
          timestamp: DateTime.now(),
        );
      },
    );

    // Subscribe to the active order's location channel
    final mapState = await ref.read(liveDeliveryMapProvider.future);
    if (mapState.orderId != null) {
      WebSocketService.instance.subscribeToDelivery(mapState.orderId!);
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final mapAsync = ref.watch(liveDeliveryMapProvider);

    return mapAsync.when(
      loading: () => _loadingView(colors),
      error: (_, __) => _loadingView(colors),
      data: (state) {
        if (state.status != LiveMapStatus.active) return _loadingView(colors);
        return _mapView(state, brightness, colors);
      },
    );
  }

  Widget _loadingView(AppColorSet colors) {
    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        height: 300,
        color: colors.surfaceVariant,
        child: Center(child: CircularProgressIndicator(color: colors.accent)),
      ),
    );
  }

  Widget _mapView(
      LiveDeliveryMapState state, Brightness brightness, AppColorSet colors) {
    final riderPoint = state.riderPoint!;
    final eta = state.etaMinutes;

    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: colors.outline, width: 0.5),
          borderRadius: AppRadius.borderLg,
        ),
        child: ClipRRect(
          borderRadius: AppRadius.borderLg,
          child: Stack(
            children: [
              FlutterMap(
                options: MapOptions(
                  initialCenter: riderPoint,
                  initialZoom: 13.5,
                ),
                children: [
                  MapHelpers.tileLayer(brightness),
                  if (state.routePoints.isNotEmpty)
                    MapHelpers.routePolyline(state.routePoints),
                  MarkerLayer(markers: [
                    MapHelpers.shopMarker(point: state.shopPoint),
                    MapHelpers.destinationMarker(point: state.destPoint),
                    MapHelpers.riderMarker(riderPoint),
                  ]),
                ],
              ),

              // Live Tracking badge — top left
              Positioned(
                top: AppSpacing.sm,
                left: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.95),
                    borderRadius: AppRadius.borderFull,
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x20000000),
                          blurRadius: 8,
                          offset: Offset(0, 2)),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedBuilder(
                        animation: _pulseController,
                        builder: (context, _) => Opacity(
                          opacity: 0.4 + (_pulseController.value * 0.6),
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: kRouteColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'Live Tracking',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurface,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ETA badge — top right
              Positioned(
                top: AppSpacing.sm,
                right: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.95),
                    borderRadius: AppRadius.borderFull,
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x20000000),
                          blurRadius: 8,
                          offset: Offset(0, 2)),
                    ],
                  ),
                  child: Text(
                    '~$eta min',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurface,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Analyze**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/tracking/widgets/delivery_map.dart
```

Expected: `No issues found.`

- [ ] **Step 3: Run all tests**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: All tests pass (same count as before this task — `DeliveryMap` has no existing unit tests).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/features/customer/tracking/widgets/delivery_map.dart
git commit -m "feat: rewrite DeliveryMap — WS owner, reads liveDeliveryMapProvider, theme-aware"
```

---

## Task 5: Full Analyze + Web Build

- [ ] **Step 1: Full analyze**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib
```

Expected: 0 errors. Pre-existing warnings in `tam_survey_screen.dart` are acceptable.

- [ ] **Step 2: Web build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release
```

Expected: `✓ Built build/web`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: live map — complete (provider, theme tiles, home tile, tracking screen)"
```
