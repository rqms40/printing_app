# Rider Home Route-Status + Big Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rider home's bento section (map tile + 3 tiles) with a full-width Delivery Status panel (progress + per-stop checklist) over a big always-on route map with numbered stop markers.

**Architecture:** A `RiderRouteStatusSection` (LayoutBuilder height-split) composes a new `RiderDeliveryStatusPanel` (header + progress + per-stop checklist) above the existing `RiderRouteMapTile` (enhanced to draw numbered markers for all stops). The rider home screen derives delivered/current/upcoming stop lists from `deliveriesProvider` and drops the three bento tiles. Theme-following; no backend changes.

**Tech Stack:** Flutter, Riverpod, flutter_map, hugeicons, flutter_animate.

Spec: `docs/superpowers/specs/2026-06-18-rider-home-route-status-design.md`.

Run all commands from `apps/mobile/`. Flutter binary: `/home/jd/fvm/versions/3.41.6/bin/flutter`. Branch: work directly on `main` (per user). Commit only listed files.

---

## Verified facts
- `DeliveryStatus` enum values: `assigned, accepted, pickedUp, onTheWay, arrived, delivered, declined`.
- `DeliveryAssignment` ctor: `DeliveryAssignment({required String id, required String orderId, required String riderId, required DeliveryStatus status, DateTime? assignedAt..deliveredAt, String? declineReason, String? proofPhotoUrl, required DateTime createdAt, required DateTime updatedAt})`.
- `RiderOrderContext` ctor: `{required String orderRef, required String orderInternalId, required String category, required int quantity, required double totalPrice, required double deliveryFee, String? customerName, String? customerPhone, RiderDestinationContext? destination}`.
- `RiderDestinationContext` ctor: `{String? fullAddress, String? landmark, String? barangay, String? city, double? latitude, double? longitude}`; `.shortLabel` → `'$barangay, $city'` if both set else `fullAddress ?? 'Delivery address'`; `.latLng` → `LatLng?`.
- `RiderAssignmentView({required DeliveryAssignment assignment, required RiderOrderContext order, int? routePosition})`; `.id`, `.status`, `.routePosition`, `.order`.
- `DeliveriesState`: `.activeDelivery` (`RiderAssignmentView?`), `.routeStops` (≤5, inProgress+new), `.completedAssignments` (delivered OR declined).
- `RiderRouteMapTile` current ctor (already on main): `RiderRouteMapTile({required List<RiderAssignmentView> stops, required RiderAssignmentView? activeStop, required VoidCallback onTap})` — renders one destination marker today; this plan adds numbered markers.
- Color tokens (`AppColorSet`): `surface, onSurface, onSurfaceDim, onBackground, background, brand, outline, accent, disabled`. Customer green check uses `Color(0xFF78EC75)` (`map_tracking_tile.dart` `_StatusLine`).
- `bento_tiles` are referenced ONLY by `rider_home_screen.dart`.

---

## File Structure
- Create `lib/features/rider/home/widgets/rider_delivery_status_panel.dart` — `RiderDeliveryStatusPanel` + `_StopCheckRow` + "View all stops" sheet + `preferredHeight()`.
- Create `lib/features/rider/home/widgets/rider_route_status_section.dart` — `RiderRouteStatusSection` (LayoutBuilder split).
- Modify `lib/features/rider/home/widgets/rider_route_map_tile.dart` — numbered multi-stop markers.
- Modify `lib/features/rider/home/screens/rider_home_screen.dart` — derive stop lists, swap bento → section, drop tile imports.
- Delete `lib/features/rider/home/widgets/rider_bento_tiles.dart` + `test/features/rider/home/rider_bento_tiles_test.dart`.
- Tests under `test/features/rider/home/`.

---

### Task 1: Delivery Status panel

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_delivery_status_panel.dart`
- Test: `apps/mobile/test/features/rider/home/rider_delivery_status_panel_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/home/widgets/rider_delivery_status_panel.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

RiderAssignmentView _view(String id, {String? name}) {
  final t = DateTime(2026, 6, 18);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: id, orderId: id, riderId: 'r1',
      status: DeliveryStatus.assigned, createdAt: t, updatedAt: t,
    ),
    order: RiderOrderContext(
      orderRef: 'ORD-$id', orderInternalId: id, category: 'paper',
      quantity: 1, totalPrice: 100, deliveryFee: 25, customerName: name,
      destination: const RiderDestinationContext(
        barangay: 'Talomo', city: 'Davao', latitude: 7.05, longitude: 125.6,
      ),
    ),
  );
}

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(brightness: Brightness.dark),
      home: Scaffold(body: SizedBox(height: 260, child: child)),
    );

void main() {
  testWidgets('renders header, progress, current-stop highlight', (tester) async {
    await tester.pumpWidget(_wrap(RiderDeliveryStatusPanel(
      deliveredStops: [_view('1', name: 'Maria'), _view('2', name: 'Juan')],
      currentStop: _view('3', name: 'Ana'),
      upcomingStops: [_view('4', name: 'Leo')],
      onTapStop: (_) {},
    )));
    await tester.pump();

    expect(find.text('Delivery Status'), findsOneWidget);
    expect(find.textContaining('2/4'), findsOneWidget);
    expect(find.textContaining('You are at Stop 3'), findsOneWidget);
    expect(find.textContaining('Delivered'), findsWidgets);
  });

  testWidgets('empty route shows no-active message', (tester) async {
    await tester.pumpWidget(_wrap(const RiderDeliveryStatusPanel(
      deliveredStops: [], currentStop: null, upcomingStops: [],
      onTapStop: _noop,
    )));
    await tester.pump();
    expect(find.textContaining('No active route'), findsOneWidget);
  });
}

void _noop(RiderAssignmentView _) {}
```

(`LatLng` import is used indirectly via the fixture's destination; keep it so the analyzer is satisfied if you reference it — if unused, remove it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_delivery_status_panel_test.dart`
Expected: FAIL — `RiderDeliveryStatusPanel` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

enum _StopState { delivered, current, upcoming }

class _StopRow {
  const _StopRow(this.number, this.view, this.state);
  final int number;
  final RiderAssignmentView view;
  final _StopState state;
}

/// "Delivery Status" panel: header + delivered/total progress + per-stop
/// checklist (delivered check, highlighted current stop, dim upcoming).
class RiderDeliveryStatusPanel extends StatelessWidget {
  const RiderDeliveryStatusPanel({
    super.key,
    required this.deliveredStops,
    required this.currentStop,
    required this.upcomingStops,
    required this.onTapStop,
  });

  final List<RiderAssignmentView> deliveredStops;
  final RiderAssignmentView? currentStop;
  final List<RiderAssignmentView> upcomingStops;
  final void Function(RiderAssignmentView) onTapStop;

  static const _visibleCap = 4;

  /// Preferred panel height for the section's layout split.
  static double preferredHeight({required int totalRows}) {
    if (totalRows == 0) return 92;
    final visible = totalRows < _visibleCap ? totalRows : _visibleCap;
    const chrome = 16 + 26 + 8 + 24 + 8; // pad + header + gap + progress + gap
    const rowHeight = 46.0;
    final viewMore = totalRows > visible ? 22.0 : 0.0;
    return chrome + (rowHeight * visible) + viewMore;
  }

  List<_StopRow> _rows() {
    final rows = <_StopRow>[];
    var n = 1;
    for (final v in deliveredStops) {
      rows.add(_StopRow(n++, v, _StopState.delivered));
    }
    if (currentStop != null) {
      rows.add(_StopRow(n++, currentStop!, _StopState.current));
    }
    for (final v in upcomingStops) {
      rows.add(_StopRow(n++, v, _StopState.upcoming));
    }
    return rows;
  }

  List<_StopRow> _windowed(List<_StopRow> rows) {
    if (rows.length <= _visibleCap) return rows;
    final curIdx = rows.indexWhere((r) => r.state == _StopState.current);
    final anchor = curIdx < 0 ? 0 : curIdx;
    final start = (anchor - 1).clamp(0, rows.length - _visibleCap);
    return rows.sublist(start, start + _visibleCap);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final rows = _rows();
    final total = rows.length;
    final deliveredCount = deliveredStops.length;
    final ratio = total == 0 ? 0.0 : deliveredCount / total;
    final percent = (ratio * 100).round();

    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(color: colors.surface),
        child: total == 0
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _header(colors),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'No active route — check Orders for assignments.',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _header(colors),
                  const SizedBox(height: AppSpacing.xs),
                  _ProgressRow(
                    colors: colors,
                    label: 'Route · $deliveredCount/$total',
                    ratio: ratio,
                    percent: percent,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Expanded(
                    child: ListView(
                      padding: EdgeInsets.zero,
                      children: [
                        for (final row in _windowed(rows))
                          Padding(
                            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                            child: _StopCheckRow(
                              colors: colors,
                              row: row,
                              onTap: () => onTapStop(row.view),
                            ),
                          ),
                        if (rows.length > _windowed(rows).length)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () =>
                                  _showAllStops(context, colors, rows, onTapStop),
                              style: TextButton.styleFrom(
                                foregroundColor: colors.brand,
                                minimumSize: Size.zero,
                                padding: const EdgeInsets.symmetric(horizontal: 2),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: Text(
                                'View all stops',
                                style: AppTypography.caption.copyWith(
                                  color: colors.brand,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _header(AppColorSet colors) => Text(
        'Delivery Status',
        maxLines: 1,
        style: AppTypography.h3.copyWith(
          color: colors.onSurface,
          fontSize: 20,
          height: 1.0,
          fontWeight: FontWeight.w800,
        ),
      );
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.colors,
    required this.label,
    required this.ratio,
    required this.percent,
  });

  final AppColorSet colors;
  final String label;
  final double ratio;
  final int percent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          maxLines: 1,
          style: AppTypography.caption.copyWith(
            color: colors.onSurface,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: AppRadius.borderFull,
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 6,
                  backgroundColor: colors.outline.withValues(alpha: 0.55),
                  valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
                ),
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '$percent%',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 8,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StopCheckRow extends StatelessWidget {
  const _StopCheckRow({
    required this.colors,
    required this.row,
    required this.onTap,
  });

  final AppColorSet colors;
  final _StopRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final view = row.view;
    final name = view.order.customerName ?? view.order.orderRef;
    final addr = view.order.destination?.shortLabel;

    late final Widget badge;
    late final String title;
    late final String subtitle;
    Color bg = Colors.transparent;

    switch (row.state) {
      case _StopState.delivered:
        badge = Container(
          width: 26,
          height: 26,
          decoration: const BoxDecoration(
            color: Color(0xFF78EC75),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded, size: 15, color: Colors.black),
        );
        title = 'Stop ${row.number} · $name';
        subtitle = 'Delivered';
      case _StopState.current:
        badge = Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(color: colors.brand, shape: BoxShape.circle),
          child: Center(
            child: Text(
              '${row.number}',
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        );
        title = 'You are at Stop ${row.number}';
        subtitle = addr == null ? name : '$name · $addr';
        bg = colors.brand.withValues(alpha: 0.08);
      case _StopState.upcoming:
        badge = Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(color: colors.onSurfaceDim, width: 1.2),
          ),
          child: Center(
            child: Text(
              '${row.number}',
              style: TextStyle(
                color: colors.onSurfaceDim,
                fontWeight: FontWeight.w800,
                fontSize: 11,
              ),
            ),
          ),
        );
        title = 'Stop ${row.number} · $name';
        subtitle = addr ?? 'Upcoming';
    }

    final isCurrent = row.state == _StopState.current;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: AppRadius.borderMd,
        ),
        padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
        child: Row(
          children: [
            badge,
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: isCurrent ? colors.brand : colors.onSurface,
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontWeight: FontWeight.w600,
                      fontSize: 9.5,
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _showAllStops(
  BuildContext context,
  AppColorSet colors,
  List<_StopRow> rows,
  void Function(RiderAssignmentView) onTapStop,
) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: colors.surface,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      final c = Theme.of(sheetContext).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;
      return SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'All stops',
                style: AppTypography.h3.copyWith(
                  color: c.onSurface,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
                  itemBuilder: (_, i) => _StopCheckRow(
                    colors: c,
                    row: rows[i],
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      onTapStop(rows[i].view);
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_delivery_status_panel_test.dart`
Expected: PASS. (4 rows ≤ cap → all shown; delivered rows show "Delivered"; current shows "You are at Stop 3"; progress "Route · 2/4".) If the `latlong2` import is unused in the test, remove it to satisfy the analyzer.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_delivery_status_panel.dart apps/mobile/test/features/rider/home/rider_delivery_status_panel_test.dart
git commit -m "feat(rider): add delivery status panel with per-stop checklist

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Numbered multi-stop markers on the map tile

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart`

- [ ] **Step 1: Replace the single destination marker with numbered stop markers**

In `rider_route_map_tile.dart`, find the `MarkerLayer` inside the `FlutterMap` `children:` (currently a single `Marker(point: _destination, ... Icon(Icons.location_on_rounded))`). Replace that `MarkerLayer(markers: [...])` with:

```dart
                    MarkerLayer(markers: _stopMarkers(colors)),
```

Then add these two methods to `_RiderRouteMapTileState` (e.g., just before `build` or after it):

```dart
  List<Marker> _stopMarkers(AppColorSet colors) {
    final markers = <Marker>[];
    var n = 1;
    for (final stop in widget.stops) {
      final point = stop.order.destination?.latLng;
      if (point == null) {
        n++;
        continue;
      }
      markers.add(
        Marker(
          point: point,
          width: 34,
          height: 44,
          alignment: Alignment.topCenter,
          child: _numberBadge(n, colors),
        ),
      );
      n++;
    }
    if (markers.isEmpty) {
      markers.add(
        Marker(
          point: _destination,
          width: 30,
          height: 30,
          child: Icon(Icons.location_on_rounded, color: colors.brand, size: 28),
        ),
      );
    }
    return markers;
  }

  Widget _numberBadge(int number, AppColorSet colors) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: colors.surface,
            shape: BoxShape.circle,
            border: Border.all(color: colors.brand, width: 1.6),
            boxShadow: const [
              BoxShadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 2)),
            ],
          ),
          child: Center(
            child: Text(
              '$number',
              style: TextStyle(
                color: colors.onSurface,
                fontWeight: FontWeight.w800,
                fontSize: 11,
                height: 1,
              ),
            ),
          ),
        ),
        Container(
          width: 2.2,
          height: 10,
          decoration: BoxDecoration(
            color: colors.brand,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ],
    );
  }
```

Leave the rest of the file (loading state, polyline, time label, caption, `onTap`, camera fit, dispose) unchanged. `_destination` and `widget.stops` already exist. `AppColorSet` is already imported via `app_colors.dart`.

- [ ] **Step 2: Verify it compiles**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/rider/home/widgets/rider_route_map_tile.dart`
Expected: No issues found.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart
git commit -m "feat(rider): draw numbered stop markers on the route map tile

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Route status section (layout split)

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_route_status_section.dart`
- Test: `apps/mobile/test/features/rider/home/rider_route_status_section_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_delivery_status_panel.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_status_section.dart';

void main() {
  testWidgets('composes status panel and map tile without overflow',
      (tester) async {
    await tester.runAsync(() async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: const Scaffold(
            body: SizedBox(
              height: 460,
              child: RiderRouteStatusSection(
                deliveredStops: [],
                currentStop: null,
                upcomingStops: [],
                mapStops: [],
                onMapTap: _noop,
                onTapStop: _noopStop,
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));
    });
    await tester.pump();

    expect(find.byType(RiderDeliveryStatusPanel), findsOneWidget);
    expect(find.byType(RiderRouteMapTile), findsOneWidget);
  });
}

void _noop() {}
void _noopStop(Object _) {}
```

(`onTapStop` is `void Function(RiderAssignmentView)`; `_noopStop(Object _)` is assignment-compatible. If the analyzer rejects it, change the signature to `void _noopStop(dynamic _) {}`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_route_status_section_test.dart`
Expected: FAIL — `RiderRouteStatusSection` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/features/rider/home/widgets/rider_delivery_status_panel.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Full-width rider home section: Delivery Status panel above a big route map.
/// Mirrors the customer delivery-status + map layout, with rider semantics.
class RiderRouteStatusSection extends StatelessWidget {
  const RiderRouteStatusSection({
    super.key,
    required this.deliveredStops,
    required this.currentStop,
    required this.upcomingStops,
    required this.mapStops,
    required this.onMapTap,
    required this.onTapStop,
  });

  final List<RiderAssignmentView> deliveredStops;
  final RiderAssignmentView? currentStop;
  final List<RiderAssignmentView> upcomingStops;
  final List<RiderAssignmentView> mapStops;
  final VoidCallback onMapTap;
  final void Function(RiderAssignmentView) onTapStop;

  static const _gap = AppSpacing.sm;
  static const _minMapHeight = 240.0;

  @override
  Widget build(BuildContext context) {
    final total = deliveredStops.length +
        (currentStop != null ? 1 : 0) +
        upcomingStops.length;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight =
            constraints.hasBoundedHeight ? constraints.maxHeight : 460.0;
        final preferred =
            RiderDeliveryStatusPanel.preferredHeight(totalRows: total);
        final maxStatus =
            (maxHeight - _gap - _minMapHeight).clamp(0.0, maxHeight).toDouble();
        final statusHeight =
            preferred.clamp(0.0, maxStatus <= 0 ? maxHeight : maxStatus).toDouble();
        final mapHeight =
            (maxHeight - statusHeight - _gap).clamp(0.0, double.infinity).toDouble();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: statusHeight,
              child: RiderDeliveryStatusPanel(
                deliveredStops: deliveredStops,
                currentStop: currentStop,
                upcomingStops: upcomingStops,
                onTapStop: onTapStop,
              ),
            ),
            const SizedBox(height: _gap),
            SizedBox(
              height: mapHeight,
              child: RiderRouteMapTile(
                stops: mapStops,
                activeStop: currentStop,
                onTap: onMapTap,
              ),
            ),
          ],
        );
      },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_route_status_section_test.dart`
Expected: PASS. The `runAsync` wrapper lets `RoutingService.getRoute` settle so the map leaves no pending timer. If a pending-timer teardown error still occurs, add `await tester.pumpAndSettle(const Duration(seconds: 1));` inside the `runAsync` block. Do NOT modify production widgets to pass the test.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_route_status_section.dart apps/mobile/test/features/rider/home/rider_route_status_section_test.dart
git commit -m "feat(rider): add route status section (status panel + big map split)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Integrate into the home screen; drop the bento tiles

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart`
- Modify: `apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart`
- Delete: `apps/mobile/lib/features/rider/home/widgets/rider_bento_tiles.dart`
- Delete: `apps/mobile/test/features/rider/home/rider_bento_tiles_test.dart`

- [ ] **Step 1: Edit the screen**

In `rider_home_screen.dart`:

1. Remove these imports:
```dart
import 'package:printing_app/features/rider/home/widgets/rider_bento_tiles.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
```
2. Add these imports:
```dart
import 'package:printing_app/features/rider/home/widgets/rider_route_status_section.dart';
import 'package:printing_app/shared/models/enums.dart';
```
3. In `build`, after the existing `final routeStops = state.routeStops;` line, add the derived lists:
```dart
    final delivered = state.completedAssignments
        .where((v) => v.status == DeliveryStatus.delivered)
        .toList();
    final upcoming = routeStops.where((v) => v.id != active?.id).toList();
    final mapStops = <RiderAssignmentView>[
      ...delivered,
      if (active != null) active,
      ...upcoming,
    ];
```
4. Replace the entire bento block — the
```dart
                    SizedBox(
                      height: 290,
                      child: Row(
                        ... map tile + Column of RiderActiveStopTile / RiderDeliveriesCountTile / RiderEarningsTile ...
                      ),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 100.ms,
                      curve: Curves.easeOut,
                    ),
```
block — with:
```dart
                    SizedBox(
                      height: 460,
                      child: RiderRouteStatusSection(
                        deliveredStops: delivered,
                        currentStop: active,
                        upcomingStops: upcoming,
                        mapStops: mapStops,
                        onMapTap: () {
                          if (active != null) {
                            context.push('/rider/deliveries/${active.id}/active');
                          } else {
                            context.go('/rider/deliveries');
                          }
                        },
                        onTapStop: (v) => context.push('/rider/deliveries/${v.id}'),
                      ),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 100.ms,
                      curve: Curves.easeOut,
                    ),
```
5. Remove the now-unused `earnings` variable if present: delete `final earnings = ref.watch(earningsProvider);` and its `earningsProvider` import IF `earningsProvider` is no longer referenced anywhere in the file (the Earnings tile was its only user). Confirm with a grep in Step 3.

Leave the header, resume-active card, HeroBanner, Today's Route section, Recent Deliveries section, and chat FAB exactly as they are.

- [ ] **Step 2: Update the screen test**

In `apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart`, add an import and one assertion so it verifies the new section. Add:
```dart
import 'package:printing_app/features/rider/home/widgets/rider_route_status_section.dart';
```
and inside the test, after the existing `expect(find.byType(RiderTodayRouteSection), findsOneWidget);`, add:
```dart
    expect(find.byType(RiderRouteStatusSection), findsOneWidget);
```
Do not otherwise weaken the test (keep its provider overrides / bounded pumps / `runAsync` approach intact).

- [ ] **Step 3: Delete the bento files and verify no references**

```bash
cd /home/jd/projects/printing_app
git rm apps/mobile/lib/features/rider/home/widgets/rider_bento_tiles.dart apps/mobile/test/features/rider/home/rider_bento_tiles_test.dart
grep -rn "rider_bento_tiles\|RiderActiveStopTile\|RiderDeliveriesCountTile\|RiderEarningsTile\|RiderBorderTile" apps/mobile/lib apps/mobile/test || echo "no references"
grep -n "earningsProvider" apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart || echo "earningsProvider not referenced (remove its import)"
```
Expected: "no references". If `earningsProvider` is no longer referenced, ensure its import line is removed from the screen.

- [ ] **Step 4: Verify compile + screen test**

Run:
```
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/rider/ test/features/rider/
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/
```
Expected: analyze clean; all rider/home tests pass (bento test is gone; panel, section, screen, and existing widget tests pass).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart
git commit -m "feat(rider): use route status section on home; drop bento tiles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Analyzer**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/`
Expected: No issues found!

- [ ] **Step 2: Rider home tests**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/`
Expected: All tests pass.

- [ ] **Step 3: Full suite**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test`
Expected: All tests pass.

- [ ] **Step 4: Web release build**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons`
Expected: `✓ Built build/web`.

---

## Self-Review

**Spec coverage:**
- Per-stop checklist (delivered check / current highlight / upcoming dim) → Task 1 (`_StopCheckRow`). ✓
- Progress bar delivered/total → Task 1 (`_ProgressRow`, "Route · d/t" + percent). ✓
- "View all stops" overflow sheet → Task 1 (`_showAllStops`, cap 4 windowed around current). ✓
- Always-on big map + numbered markers → Task 2 (`_stopMarkers`/`_numberBadge`) + Task 3 (section gives map the larger remainder, min 240). ✓
- Replace bento, ~440–460px section → Task 4 (`SizedBox(height: 460)`). ✓
- Drop 3 tiles + delete file/test → Task 4 (git rm + grep). ✓
- Data from existing providers, no backend → Task 4 derivation. ✓
- Keep hero/header/resume/carousel/recent/nav → Task 4 leaves them intact. ✓
- Theme-following → all widgets resolve `AppColors` by brightness. ✓
- analyze/tests/build green → Task 5. ✓

**Placeholder scan:** No TBD/TODO. The two test-only adjustment notes (unused `latlong2` import; `_noopStop` signature) give exact fallbacks, not vague guidance.

**Type consistency:** `RiderRouteStatusSection` ctor params match Task 4's call site and Task 3's definition. `RiderDeliveryStatusPanel` ctor (`deliveredStops`, `currentStop`, `upcomingStops`, `onTapStop`) is identical in Tasks 1, 3, 4. `preferredHeight({required int totalRows})` defined in Task 1, called in Task 3. `RiderRouteMapTile(stops, activeStop, onTap)` unchanged signature, used in Task 3. Stop numbering is sequential (delivered→current→upcoming) and identical between the checklist (Task 1) and `mapStops` ordering (Task 4) so map marker numbers match the checklist.
