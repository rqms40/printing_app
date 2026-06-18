# Rider Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/rider/home` to mirror the customer home's layout (greeting header + status chip, GRIDGO hero, two-column bento, horizontal carousel, recent list) with rider content, and switch the rider bottom nav to the standard customer nav (circular yellow FAB + accent pill), theme-following (light + dark).

**Architecture:** New focused widgets under `features/rider/home/widgets/` that parallel the customer home widgets and resolve colors from `AppColors` via `Theme.of(context).brightness`. The rider `StatefulShellRoute` drops its forced `AppTheme.dark` wrapper and uses `AppBottomNavStyle.standard`. All data comes from existing providers (`deliveriesProvider`, `riderProfileProvider`, `earningsProvider`, `authProvider`, `chatProvider`) — no backend changes.

**Tech Stack:** Flutter, Riverpod, go_router, flutter_map, hugeicons, flutter_animate.

Spec: `docs/superpowers/specs/2026-06-17-rider-home-redesign-design.md`.

---

## Reference facts (verified against the codebase)

- Customer color resolution pattern: `Theme.of(context).brightness == Brightness.dark ? AppColors.dark : AppColors.light` → `AppColorSet colors`.
- `colors` exposes: `background, surface, surfaceVariant, onBackground, onSurfaceDim, outline, brand, accent, success, warning, error, disabled, info`.
- `deliveriesProvider` → `DeliveriesState`: `.activeDelivery` (`RiderAssignmentView?`), `.routeStops` (`List<RiderAssignmentView>`, ≤5), `.inProgressAssignments`, `.completedAssignments`, `.assignments`, `.refreshAssignments()`.
- `RiderAssignmentView`: `.id`, `.status` (`DeliveryStatus`), `.routePosition` (`int?`), `.order` (`RiderOrderContext`), `.assignment`.
- `RiderOrderContext`: `.orderRef`, `.orderInternalId`, `.category`, `.quantity`, `.totalPrice`, `.deliveryFee`, `.customerName` (`String?`), `.customerPhone` (`String?`), `.destination` (`RiderDestinationContext?` with `.shortLabel`, `.latLng`).
- `riderProfileProvider` → `RiderProfileState`: `.isAvailable`, `.isLoading`; notifier `.setAvailability(bool)`.
- `earningsProvider` → `EarningsData`: `.today`, `.thisWeek`, `.thisMonth`, `.total`, `.deliveries` (all set after async fetch).
- `riderDeliveryVisual(DeliveryStatus, AppColorSet)` → `RiderDeliveryVisual{ icon, tint, label, badgeVariant }` (in `features/rider/shared/rider_delivery_status.dart`).
- Map helpers: `MapHelpers.tileLayer(Brightness)`, `MapHelpers.shopPoint`, `MapHelpers.davaoCenter`; `RoutingService.getRoute(start, end)` → `Future<List<LatLng>>`.
- `formatCurrency(num)` in `utils/formatters.dart`.
- `HeroBanner` (`features/customer/home/widgets/hero_banner.dart`) is theme-agnostic — reuse as-is (keeps `bentobox.webp`).
- Stack routes: active delivery `'/rider/deliveries/<id>/active'`; detail `'/rider/deliveries/<id>'`.
- Chat open pattern (from current `rider_home_screen.dart`): resolve `apiOrderRef`, call `ref.read(chatProvider.notifier).openOrderConversation(apiOrderRef)`, then `context.push('/rider/chat/<id>?type=<type>&orderRef=<ref>')`.

---

## File Structure

- Create `features/rider/home/widgets/rider_online_pill.dart` — Online/Offline toggle (header chip slot).
- Create `features/rider/home/widgets/rider_home_header.dart` — date + greeting + bell + online pill.
- Create `features/rider/home/widgets/rider_resume_active_card.dart` — conditional resume-active-delivery card.
- Create `features/rider/home/widgets/rider_route_map_tile.dart` — theme-following bento map tile.
- Create `features/rider/home/widgets/rider_bento_tiles.dart` — `RiderActiveStopTile`, `RiderDeliveriesCountTile`, `RiderEarningsTile`.
- Create `features/rider/home/widgets/rider_today_route_section.dart` — horizontal "Today's Route" carousel.
- Create `features/rider/home/widgets/rider_recent_deliveries_section.dart` — recent completed deliveries list.
- Rewrite `features/rider/home/screens/rider_home_screen.dart` — composes the above in the customer layout.
- Modify `config/routes/app_router.dart:538-574` — rider shell: drop `Theme(data: AppTheme.dark)`, set `navStyle: AppBottomNavStyle.standard`.
- Tests under `apps/mobile/test/features/rider/home/`.

**Retired from the Home screen only** (not deleted; may be referenced by out-of-scope screens): `rider_branding_banner.dart`, `rider_route_map_panel.dart`, `rider_active_stop_card.dart`. Verify no remaining references after the rewrite (Task 9).

All commands run from `apps/mobile/`. Flutter binary: `fvm flutter` (or `/home/jd/fvm/versions/3.41.6/bin/flutter`).

---

### Task 1: Online-status pill

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_online_pill.dart`
- Test: `apps/mobile/test/features/rider/home/rider_online_pill_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_online_pill.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';

void main() {
  testWidgets('tapping the pill toggles availability', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: const Scaffold(body: RiderOnlinePill()),
        ),
      ),
    );
    await tester.pump();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(RiderOnlinePill)),
    );
    final before = container.read(riderProfileProvider).isAvailable;

    await tester.tap(find.byType(RiderOnlinePill));
    await tester.pump();

    expect(container.read(riderProfileProvider).isAvailable, !before);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_online_pill_test.dart`
Expected: FAIL — `rider_online_pill.dart` does not exist / `RiderOnlinePill` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';

/// Online/Offline availability toggle. Occupies the header slot where the
/// customer home shows its credits chip.
class RiderOnlinePill extends ConsumerWidget {
  const RiderOnlinePill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final online = ref.watch(riderProfileProvider).isAvailable;
    final accent = online ? colors.success : colors.onSurfaceDim;

    return GestureDetector(
      onTap: () =>
          ref.read(riderProfileProvider.notifier).setAvailability(!online),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: online
              ? colors.success.withValues(alpha: 0.14)
              : colors.surfaceVariant,
          borderRadius: AppRadius.borderMd,
          border: Border.all(
            color: online
                ? colors.success.withValues(alpha: 0.55)
                : colors.outline.withValues(alpha: 0.3),
            width: 0.75,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(
              online ? 'Online' : 'Offline',
              style: AppTypography.bodyBold.copyWith(
                color: accent,
                fontSize: 12,
                height: 1.0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_online_pill_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_online_pill.dart apps/mobile/test/features/rider/home/rider_online_pill_test.dart
git commit -m "feat(rider): add online/offline status pill for home header"
```

---

### Task 2: Home header

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_home_header.dart`
- Test: `apps/mobile/test/features/rider/home/rider_home_header_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';

void main() {
  testWidgets('renders greeting with the rider first name', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: RiderHomeHeader(firstName: 'Juan')),
        ),
      ),
    );
    await tester.pump();
    expect(find.textContaining('Juan'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_home_header_test.dart`
Expected: FAIL — `RiderHomeHeader` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_online_pill.dart';

/// Rider home header — date overline + greeting + bell + online pill.
/// Mirrors the customer home header layout.
class RiderHomeHeader extends StatelessWidget {
  const RiderHomeHeader({super.key, required this.firstName});

  final String firstName;

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }

  String _formattedDate() {
    final now = DateTime.now();
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
        'SATURDAY', 'SUNDAY'];
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _formattedDate(),
                style: AppTypography.overline.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 2),
              RichText(
                text: TextSpan(
                  style: AppTypography.h2.copyWith(color: colors.onBackground),
                  children: [
                    TextSpan(text: '${_greeting()} '),
                    TextSpan(
                      text: firstName,
                      style: AppTypography.h2.copyWith(color: colors.brand),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => context.go('/rider/alerts'),
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
            ),
            child: Center(
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedNotification02,
                size: 22,
                color: colors.onBackground,
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        const RiderOnlinePill(),
      ],
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_home_header_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_home_header.dart apps/mobile/test/features/rider/home/rider_home_header_test.dart
git commit -m "feat(rider): add home header (date, greeting, bell, online pill)"
```

---

### Task 3: Resume-active-delivery card

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_resume_active_card.dart`
- Test: `apps/mobile/test/features/rider/home/rider_resume_active_card_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_resume_active_card.dart';

void main() {
  testWidgets('shows order ref and stop count', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: RiderResumeActiveCard(
            orderRef: 'ORD-10005',
            stopCount: 3,
            onTap: _noop,
          ),
        ),
      ),
    );
    expect(find.textContaining('ORD-10005'), findsOneWidget);
    expect(find.textContaining('3'), findsWidgets);
  });
}

void _noop() {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_resume_active_card_test.dart`
Expected: FAIL — `RiderResumeActiveCard` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Conditional "resume active delivery" card. Mirrors the customer
/// resume-queue card. Render only when an active delivery exists.
class RiderResumeActiveCard extends StatelessWidget {
  const RiderResumeActiveCard({
    super.key,
    required this.orderRef,
    required this.stopCount,
    required this.onTap,
  });

  final String orderRef;
  final int stopCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final stopsLabel = stopCount == 1 ? 'stop' : 'stops';

    return Material(
      color: colors.surface,
      borderRadius: AppRadius.borderLg,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderLg,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.borderLg,
            border: Border.all(color: colors.outline, width: 1),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.brand,
                  borderRadius: AppRadius.borderMd,
                ),
                alignment: Alignment.center,
                child: const HugeIcon(
                  icon: HugeIcons.strokeRoundedDeliveryTruck02,
                  size: 18,
                  color: Colors.black,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Resume active delivery',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 13.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$orderRef · $stopCount $stopsLabel on route',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Open',
                style: AppTypography.caption.copyWith(
                  color: colors.brand,
                  fontWeight: FontWeight.w700,
                  fontSize: 11.5,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_resume_active_card_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_resume_active_card.dart apps/mobile/test/features/rider/home/rider_resume_active_card_test.dart
git commit -m "feat(rider): add resume-active-delivery card"
```

---

### Task 4: Route map tile (bento, theme-following)

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart`

No unit test (renders a live `FlutterMap`); verified by build + manual check. Adapted from `rider_route_map_panel.dart` but uses `AppColors`, fills its parent box (no `Expanded`/outer padding), and shows a compact time overlay.

- [ ] **Step 1: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Bento map tile showing the rider's route. Fills its parent (use inside an
/// Expanded/SizedBox). Mirrors the customer MapTrackingTile slot.
class RiderRouteMapTile extends ConsumerStatefulWidget {
  const RiderRouteMapTile({
    super.key,
    required this.stops,
    required this.activeStop,
    required this.onTap,
  });

  final List<RiderAssignmentView> stops;
  final RiderAssignmentView? activeStop;
  final VoidCallback onTap;

  @override
  ConsumerState<RiderRouteMapTile> createState() => _RiderRouteMapTileState();
}

class _RiderRouteMapTileState extends ConsumerState<RiderRouteMapTile> {
  final _mapController = MapController();
  List<LatLng> _routePoints = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  LatLng get _destination {
    final latLng = widget.activeStop?.order.destination?.latLng;
    if (latLng != null) return latLng;
    if (widget.stops.isNotEmpty) {
      return widget.stops.first.order.destination?.latLng ??
          MapHelpers.davaoCenter;
    }
    return MapHelpers.davaoCenter;
  }

  Future<void> _loadRoute() async {
    final points = await RoutingService.getRoute(
      MapHelpers.shopPoint,
      _destination,
    );
    if (!mounted) return;
    setState(() {
      _routePoints = points;
      _loading = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _routePoints.isEmpty) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(
            [MapHelpers.shopPoint, _destination, ..._routePoints],
          ),
          padding: const EdgeInsets.all(28),
        ),
      );
    });
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final timeLabel = DateFormat('h:mm a').format(DateTime.now());

    return GestureDetector(
      onTap: widget.onTap,
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: ColoredBox(
          color: colors.surface,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_loading)
                Center(
                  child: CircularProgressIndicator(
                    color: colors.brand,
                    strokeWidth: 2,
                  ),
                )
              else
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _destination,
                    initialZoom: 13,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.none,
                    ),
                  ),
                  children: [
                    MapHelpers.tileLayer(brightness),
                    if (_routePoints.isNotEmpty)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: _routePoints,
                            color: colors.brand.withValues(alpha: 0.9),
                            strokeWidth: 3.2,
                          ),
                        ],
                      ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _destination,
                          width: 30,
                          height: 30,
                          child: Icon(
                            Icons.location_on_rounded,
                            color: colors.brand,
                            size: 28,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              Positioned(
                top: 12,
                left: 12,
                child: Text(
                  timeLabel,
                  style: AppTypography.h1.copyWith(
                    color: colors.onBackground,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1,
                    shadows: [
                      Shadow(
                        color: colors.background.withValues(alpha: 0.7),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                bottom: 10,
                child: Text(
                  widget.activeStop == null
                      ? 'No active route'
                      : 'Tap to navigate',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontStyle: FontStyle.italic,
                    fontSize: 10,
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

- [ ] **Step 2: Verify it compiles**

Run: `fvm flutter analyze lib/features/rider/home/widgets/rider_route_map_tile.dart`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart
git commit -m "feat(rider): add theme-following route map bento tile"
```

---

### Task 5: Bento tiles (Active Stop / My Deliveries / Earnings)

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_bento_tiles.dart`
- Test: `apps/mobile/test/features/rider/home/rider_bento_tiles_test.dart`

These reuse the customer `_YellowBorderTile` visual pattern (local copy, since the customer one is private). The Earnings tile mirrors the bordered Feed tile.

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_bento_tiles.dart';

void main() {
  testWidgets('earnings tile shows a peso-formatted today value',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: RiderEarningsTile(todayAmount: 250)),
      ),
    );
    expect(find.textContaining('250'), findsOneWidget);
    expect(find.text('Earnings'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_bento_tiles_test.dart`
Expected: FAIL — `rider_bento_tiles.dart` missing.

- [ ] **Step 3: Write the widgets**

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/utils/formatters.dart';

/// Yellow-border tile: left icon panel, title/subtitle, chevron.
/// Local copy of the customer home tile pattern.
class RiderBorderTile extends StatefulWidget {
  const RiderBorderTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  final dynamic icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  State<RiderBorderTile> createState() => _RiderBorderTileState();
}

class _RiderBorderTileState extends State<RiderBorderTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderXl,
            border: Border.all(
              color: colors.outline.withValues(alpha: 0.4),
              width: 0.5,
            ),
          ),
          child: ClipRRect(
            borderRadius: AppRadius.borderXl,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 52,
                  child: Center(
                    child: HugeIcon(
                      icon: widget.icon,
                      size: 26,
                      color: colors.brand,
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          widget.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.onBackground,
                            fontSize: 12,
                            height: 1.2,
                          ),
                        ),
                        if (widget.subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            widget.subtitle!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 14,
                    color: colors.disabled,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Tile 1 — Active Stop (primary). Shows customer + order ref.
class RiderActiveStopTile extends StatelessWidget {
  const RiderActiveStopTile({
    super.key,
    required this.customerName,
    required this.orderRef,
    required this.onTap,
  });

  final String? customerName;
  final String? orderRef;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasActive = orderRef != null;
    return RiderBorderTile(
      icon: HugeIcons.strokeRoundedLocation01,
      title: hasActive ? (customerName ?? 'Active stop') : 'No active stop',
      subtitle: hasActive ? orderRef : 'Check Orders',
      onTap: onTap,
    );
  }
}

/// Tile 2 — My Deliveries count.
class RiderDeliveriesCountTile extends StatelessWidget {
  const RiderDeliveriesCountTile({
    super.key,
    required this.count,
    required this.onTap,
  });

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return RiderBorderTile(
      icon: HugeIcons.strokeRoundedLeftToRightListDash,
      title: 'My Deliveries',
      subtitle: count == 0 ? 'None active' : '$count active',
      onTap: onTap,
    );
  }
}

/// Tile 3 — Earnings (mirrors the bordered Feed tile shape).
class RiderEarningsTile extends StatelessWidget {
  const RiderEarningsTile({super.key, required this.todayAmount});

  final double todayAmount;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Earnings',
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
            height: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              borderRadius: AppRadius.borderMd,
              border: Border.all(
                color: colors.brand.withValues(alpha: 0.8),
                width: 0.75,
              ),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'TODAY',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 9,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    formatCurrency(todayAmount),
                    style: AppTypography.display.copyWith(
                      color: colors.brand,
                      fontSize: 22,
                      height: 1.0,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_bento_tiles_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_bento_tiles.dart apps/mobile/test/features/rider/home/rider_bento_tiles_test.dart
git commit -m "feat(rider): add active-stop, deliveries-count, earnings bento tiles"
```

---

### Task 6: Today's Route carousel

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_today_route_section.dart`
- Test: `apps/mobile/test/features/rider/home/rider_today_route_section_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';

void main() {
  testWidgets('shows empty state when no stops', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderTodayRouteSection(stops: const [], onTapStop: (_) {}),
        ),
      ),
    );
    expect(find.text("Today's Route"), findsOneWidget);
    expect(find.textContaining('No stops'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_today_route_section_test.dart`
Expected: FAIL — section undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';

/// Horizontal carousel of today's stops. Mirrors the customer Daily Grid.
class RiderTodayRouteSection extends StatelessWidget {
  const RiderTodayRouteSection({
    super.key,
    required this.stops,
    required this.onTapStop,
  });

  final List<RiderAssignmentView> stops;
  final void Function(RiderAssignmentView) onTapStop;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Today's Route",
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (stops.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadius.borderLg,
              border: Border.all(color: colors.outline, width: 0.5),
            ),
            child: Center(
              child: Text(
                'No stops on your route yet.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
          )
        else
          SizedBox(
            height: 116,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: stops.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) => _StopCard(
                view: stops[i],
                onTap: () => onTapStop(stops[i]),
              ),
            ),
          ),
      ],
    );
  }
}

class _StopCard extends StatelessWidget {
  const _StopCard({required this.view, required this.onTap});

  final RiderAssignmentView view;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 200,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderLg,
          border: Border.all(color: colors.outline, width: 0.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'STOP ${view.routePosition ?? '-'}',
                  style: AppTypography.overline.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 9,
                    letterSpacing: 1.5,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: visual.tint.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    visual.label,
                    style: AppTypography.overline.copyWith(
                      color: visual.tint,
                      fontSize: 8,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              order.customerName ?? 'Customer',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              order.destination?.shortLabel ?? order.orderRef,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 11,
              ),
            ),
            const Spacer(),
            Text(
              order.orderRef,
              style: AppTypography.caption.copyWith(
                color: colors.brand,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_today_route_section_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_today_route_section.dart apps/mobile/test/features/rider/home/rider_today_route_section_test.dart
git commit -m "feat(rider): add Today's Route horizontal carousel"
```

---

### Task 7: Recent Deliveries section

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_recent_deliveries_section.dart`
- Test: `apps/mobile/test/features/rider/home/rider_recent_deliveries_section_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_recent_deliveries_section.dart';

void main() {
  testWidgets('shows empty state when no completed deliveries',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderRecentDeliveriesSection(completed: const [], onTap: (_) {}),
        ),
      ),
    );
    expect(find.text('Recent Deliveries'), findsOneWidget);
    expect(find.textContaining('No completed'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_recent_deliveries_section_test.dart`
Expected: FAIL — section undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/utils/formatters.dart';

/// Recently completed deliveries list. Mirrors the customer Recent Orders.
class RiderRecentDeliveriesSection extends StatelessWidget {
  const RiderRecentDeliveriesSection({
    super.key,
    required this.completed,
    required this.onTap,
  });

  final List<RiderAssignmentView> completed;
  final void Function(RiderAssignmentView) onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final items = completed.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent Deliveries',
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (items.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadius.borderLg,
              border: Border.all(color: colors.outline, width: 0.5),
            ),
            child: Center(
              child: Text(
                'No completed deliveries yet.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
          )
        else
          ...items.map((v) => _RecentRow(view: v, onTap: () => onTap(v))),
      ],
    );
  }
}

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.view, required this.onTap});

  final RiderAssignmentView view;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm + 2),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(color: colors.outline, width: 0.5),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: visual.tint.withValues(alpha: 0.16),
                  borderRadius: AppRadius.borderMd,
                ),
                alignment: Alignment.center,
                child: HugeIcon(icon: visual.icon, size: 18, color: visual.tint),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.customerName ?? order.orderRef,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${order.orderRef} · ${visual.label}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                formatCurrency(order.deliveryFee),
                style: AppTypography.bodyBold.copyWith(
                  color: colors.brand,
                  fontSize: 12,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_recent_deliveries_section_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_recent_deliveries_section.dart apps/mobile/test/features/rider/home/rider_recent_deliveries_section_test.dart
git commit -m "feat(rider): add Recent Deliveries section"
```

---

### Task 8: Compose the new RiderHomeScreen

**Files:**
- Modify (rewrite): `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart`
- Test: `apps/mobile/test/features/rider/home/rider_home_screen_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/rider/home/screens/rider_home_screen.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';

void main() {
  testWidgets('rider home renders header and route section without overflow',
      (tester) async {
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, _) => const RiderHomeScreen())],
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: ThemeData(brightness: Brightness.dark),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(RiderHomeHeader), findsOneWidget);
    expect(find.byType(RiderTodayRouteSection), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `fvm flutter test test/features/rider/home/rider_home_screen_test.dart`
Expected: FAIL — old `RiderHomeScreen` does not contain `RiderHomeHeader`/`RiderTodayRouteSection`.

- [ ] **Step 3: Rewrite the screen**

Replace the entire contents of `rider_home_screen.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/history/providers/earnings_provider.dart';
import 'package:printing_app/features/rider/home/widgets/rider_bento_tiles.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';
import 'package:printing_app/features/rider/home/widgets/rider_recent_deliveries_section.dart';
import 'package:printing_app/features/rider/home/widgets/rider_resume_active_card.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Rider home — mirrors the customer home layout with rider content.
class RiderHomeScreen extends ConsumerWidget {
  const RiderHomeScreen({super.key});

  Future<void> _openChat(
    BuildContext context,
    WidgetRef ref,
    RiderAssignmentView view,
  ) async {
    final order = view.order;
    final apiOrderRef = int.tryParse(order.orderInternalId) == null
        ? order.orderRef
        : order.orderInternalId;
    final conv =
        await ref.read(chatProvider.notifier).openOrderConversation(apiOrderRef);
    if (!context.mounted || conv == null) return;
    context.push(
      '/rider/chat/${conv.id}?type=${conv.type.name}&orderRef=${order.orderRef}',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final auth = ref.watch(authProvider);
    final state = ref.watch(deliveriesProvider);
    final earnings = ref.watch(earningsProvider);
    final firstName = (auth.user?.fullName ?? 'Rider').split(' ').first;
    final active = state.activeDelivery;
    final routeStops = state.routeStops;

    return Stack(
      children: [
        ColoredBox(
          color: colors.background,
          child: SafeArea(
            child: RefreshIndicator(
              color: colors.brand,
              backgroundColor: colors.surface,
              onRefresh:
                  ref.read(deliveriesProvider.notifier).refreshAssignments,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                clipBehavior: Clip.none,
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.lg),
                    RiderHomeHeader(firstName: firstName)
                        .animate()
                        .fadeIn(duration: 400.ms, curve: Curves.easeOut),
                    const SizedBox(height: AppSpacing.lg),

                    if (active != null) ...[
                      RiderResumeActiveCard(
                        orderRef: active.order.orderRef,
                        stopCount: routeStops.length,
                        onTap: () => context.push(
                          '/rider/deliveries/${active.id}/active',
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    const HeroBanner(),
                    const SizedBox(height: AppSpacing.sm + 2),

                    SizedBox(
                      height: 290,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: RiderRouteMapTile(
                              stops: routeStops,
                              activeStop: active,
                              onTap: () {
                                if (active != null) {
                                  context.push(
                                    '/rider/deliveries/${active.id}/active',
                                  );
                                } else {
                                  context.go('/rider/deliveries');
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: RiderActiveStopTile(
                                    customerName: active?.order.customerName,
                                    orderRef: active?.order.orderRef,
                                    onTap: () {
                                      if (active != null) {
                                        context.push(
                                          '/rider/deliveries/${active.id}/active',
                                        );
                                      } else {
                                        context.go('/rider/deliveries');
                                      }
                                    },
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xs + 2),
                                Expanded(
                                  flex: 2,
                                  child: RiderDeliveriesCountTile(
                                    count: state.inProgressAssignments.length +
                                        state.newAssignments.length,
                                    onTap: () =>
                                        context.go('/rider/deliveries'),
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xs + 2),
                                Expanded(
                                  flex: 3,
                                  child: RiderEarningsTile(
                                    todayAmount: earnings.today,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 100.ms,
                      curve: Curves.easeOut,
                    ),

                    const SizedBox(height: AppSpacing.lg),
                    RiderTodayRouteSection(
                      stops: routeStops,
                      onTapStop: (v) =>
                          context.push('/rider/deliveries/${v.id}'),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 200.ms,
                      curve: Curves.easeOut,
                    ),

                    const SizedBox(height: AppSpacing.lg),
                    RiderRecentDeliveriesSection(
                      completed: state.completedAssignments,
                      onTap: (v) =>
                          context.push('/rider/deliveries/${v.id}'),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 300.ms,
                      curve: Curves.easeOut,
                    ),

                    const SizedBox(height: AppSpacing.xxl),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (active != null)
          Positioned(
            right: AppSpacing.xl,
            bottom: 90,
            child: Material(
              color: colors.accent,
              elevation: 6,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => _openChat(context, ref, active),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Center(
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedMessage01,
                      size: 22,
                      color: colors.accentOnColor,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
```

The customer `FloatingChatButton` is intentionally NOT reused: it has no tap-override
parameter and its internal tap routes to `/customer/chat`. The inline button above
keeps the same shape/colors (`colors.accent` / `colors.accentOnColor`) but opens the
active delivery's conversation via `_openChat`.

- [ ] **Step 4: Run test to verify it passes**

Run: `fvm flutter test test/features/rider/home/rider_home_screen_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart apps/mobile/test/features/rider/home/rider_home_screen_test.dart
git commit -m "feat(rider): rebuild home screen in customer layout language"
```

---

### Task 9: Switch rider shell to standard nav + theme-following

**Files:**
- Modify: `apps/mobile/lib/config/routes/app_router.dart:538-574`

- [ ] **Step 1: Edit the rider shell builder**

In the rider `StatefulShellRoute.indexedStack` builder, remove the `Theme(data: AppTheme.dark, child: ...)` wrapper so the shell uses the global app theme, and change the nav style. Replace:

```dart
        builder: (context, state, navigationShell) => Theme(
          data: AppTheme.dark,
          child: ScaffoldWithNav(
            currentIndex: navigationShell.currentIndex,
            showFab: true,
            navStyle: AppBottomNavStyle.riderCockpit,
            quickActions: kRiderQuickActions,
```

with:

```dart
        builder: (context, state, navigationShell) => ScaffoldWithNav(
            currentIndex: navigationShell.currentIndex,
            showFab: true,
            navStyle: AppBottomNavStyle.standard,
            quickActions: kRiderQuickActions,
```

Then remove the now-unbalanced closing `),` that previously closed the `Theme(...)` wrapper: the builder body should end with the `ScaffoldWithNav(...)` closing `),` only. After editing, the builder returns `ScaffoldWithNav(...)` directly.

- [ ] **Step 2: Remove the now-unused AppTheme import if nothing else uses it**

Run: `grep -n "AppTheme" lib/config/routes/app_router.dart`
If the only remaining hits are the `import` line and no other usages exist in the file, delete the `import 'package:printing_app/config/theme/app_theme.dart';` line. If other usages remain, leave the import.

- [ ] **Step 3: Verify it compiles**

Run: `fvm flutter analyze lib/config/routes/app_router.dart`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/config/routes/app_router.dart
git commit -m "feat(rider): use standard customer nav + global theme for rider shell"
```

---

### Task 10: Verify no orphaned references + full build

**Files:** none (verification only)

- [ ] **Step 1: Confirm retired home widgets are no longer imported**

Run:
```bash
grep -rn "rider_branding_banner\|rider_route_map_panel\|rider_active_stop_card" lib/
```
Expected: no matches under `lib/` (the new screen does not import them). If any non-home screen still imports one, leave that file alone — it is out of scope. The three retired widget files may remain on disk unused; do not delete them in this pass.

- [ ] **Step 2: Run the full analyzer**

Run: `fvm flutter analyze lib/`
Expected: No new errors introduced by this work. (Pre-existing warnings unrelated to rider home are acceptable.)

- [ ] **Step 3: Run all rider home tests**

Run: `fvm flutter test test/features/rider/home/`
Expected: All PASS.

- [ ] **Step 4: Web release build (project convention after mobile changes)**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons`
Expected: "✓ Built build/web".

- [ ] **Step 5: Commit (if any analyzer-driven fixes were needed)**

```bash
git add -A
git commit -m "chore(rider): verify rider home redesign builds clean"
```

---

## Self-Review

**Spec coverage:**
- Palette light+dark → all widgets resolve `AppColors` via brightness; shell de-themed (Task 9). ✓
- Nav matches customer → Task 9 sets `AppBottomNavStyle.standard` + existing FAB. ✓
- Online/Offline chip → Task 1. ✓
- GRIDGO hero with `.webp` → reused `HeroBanner` (Task 8). ✓
- Resume active card → Task 3 + Task 8 conditional render. ✓
- Two-column bento (map + 3 tiles) → Tasks 4, 5, 8. ✓
- Today's Route carousel → Task 6. ✓
- Recent Deliveries list → Task 7. ✓
- Contextual floating chat → Task 8 (only when `active != null`). ✓
- Error/empty/loading states → empty states in Tasks 6/7; "No active stop" in Task 5; refresh indicator + offline banners inherited. ✓
- Testing + web build → Task 10. ✓

**Placeholder scan:** No TBD/TODO; all steps contain concrete code or exact commands. Task 8 Step 4 explicitly handles the one unverified external signature (`FloatingChatButton`).

**Type consistency:** Provider/model names match the verified APIs (`activeDelivery`, `routeStops`, `inProgressAssignments`, `newAssignments`, `completedAssignments`, `setAvailability`, `EarningsData.today`, `RiderOrderContext.orderRef/customerName/deliveryFee/destination.shortLabel`, `RiderAssignmentView.id/status/routePosition`). Widget constructor names are consistent between definition tasks and the Task 8 composition.
