# Rider Map Uplift (Phase B1, issue #83) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rider map trustworthy and informative — a single heading-aware animated vehicle marker, per-stop and total ETAs from the server plan, a stale-route warning, the real plan origin, and the audited UX gap fixes.

**Architecture:** All changes are in `apps/mobile` (the server already returns every datum needed — `legDurationSeconds` per stop and `totalDurationSeconds`/`totalDistanceMeters` on the plan; mobile parses the former and ignores the rest). A new `RiderVehicleMarker` widget becomes the one vehicle representation across `rider_map_view`, `rider_route_map_tile`, and `rider_route_map_panel`, fed by a tracker state extended with heading/speed/accuracy. ETA/summary rendering derives from the existing `RiderDispatchPlan`/`RiderAssignmentView` models.

**Tech Stack:** Flutter 3.41.6 (fvm), flutter_map 8.x, Riverpod, geolocator, existing widget-test harnesses under `apps/mobile/test/features/rider/`.

## Global Constraints

- Branch: `feat/rider-map-uplift` in a worktree off `agent/beta-coherence-program` (it contains the merged F1–F5 fixes).
- Server-authoritative: never re-route or re-order stops client-side; routing failure stays a hard `routing_unavailable` (no haversine fallback).
- Surface name is exactly "Deliveries" wherever the rider queue is referenced.
- Checks per change: `fvm flutter analyze lib/` and the touched test files; full `fvm flutter test` before the final commit.
- All user-visible text ≥ 10pt; tap targets ≥ 44dp.
- Commands run from `apps/mobile` with `export PATH="$HOME/.pub-cache/bin:$PATH"`.

---

### Task 1: Tracker state carries heading, speed, and accuracy

**Files:**
- Modify: `apps/mobile/lib/features/rider/shared/providers/rider_location_tracker_provider.dart` (`RiderGpsPoint` ~:25, `_point` mapper ~:75, `RiderLocationTrackerState` ~:93)
- Test: `apps/mobile/test/features/rider/shared/providers/rider_location_tracker_provider_test.dart` (extend the existing file)

**Interfaces:**
- Produces: `RiderGpsPoint.accuracyMeters: double?`; `RiderLocationTrackerState.headingDegrees: double?`, `.speedMetersPerSecond: double?`, `.accuracyMeters: double?` — consumed by Tasks 3–4.

- [ ] **Step 1: Failing test** — in the existing tracker test file, feed a fake `RiderLocationSource` emitting `RiderGpsPoint(latitude: 7.1, longitude: 125.6, speed: 4.2, heading: 90, accuracyMeters: 12.5)` and assert the notifier state exposes `headingDegrees == 90`, `speedMetersPerSecond == 4.2`, `accuracyMeters == 12.5` alongside the existing `point`.
- [ ] **Step 2: Run** `fvm flutter test test/features/rider/shared/providers/rider_location_tracker_provider_test.dart` → FAIL (fields undefined).
- [ ] **Step 3: Implement** — add `accuracyMeters` to `RiderGpsPoint` (+ constructor); map `position.accuracy` in `GeolocatorRiderLocationSource._point`; add the three nullable fields to `RiderLocationTrackerState` (constructor + wherever `copy`/new-state construction happens in `_onPoint`); thread the incoming point's values into every state emission that carries `point`.
- [ ] **Step 4: Run test** → PASS. `fvm flutter analyze lib/` → clean.
- [ ] **Step 5: Commit** `feat(rider): expose heading, speed, and accuracy from GPS tracker`.

### Task 2: Plan model parses totals

**Files:**
- Modify: `apps/mobile/lib/features/rider/shared/models/rider_order_context.dart` (`RiderDispatchPlan`)
- Modify: `apps/mobile/lib/features/rider/shared/rider_assignment_parser.dart` (plan parsing ~:323-352)
- Test: `apps/mobile/test/features/rider/shared/rider_assignment_parser_test.dart` (extend)

**Interfaces:**
- Produces: `RiderDispatchPlan.totalDurationSeconds: int?`, `.totalDistanceMeters: int?` — consumed by Task 6.

- [ ] **Step 1: Failing test** — extend an existing parser test's plan JSON with `"totalDurationSeconds": 540, "totalDistanceMeters": 2300` and assert both land on the parsed plan.
- [ ] **Step 2: Run** the parser test file → FAIL.
- [ ] **Step 3: Implement** — add both nullable `int` fields to `RiderDispatchPlan` and parse with the file's existing int-coercion helper (same one used for `legDurationSeconds`).
- [ ] **Step 4: Test + analyze** → PASS/clean.
- [ ] **Step 5: Commit** `feat(rider): parse dispatch plan total duration and distance`.

### Task 3: RiderVehicleMarker — one heading-aware animated marker

**Files:**
- Create: `apps/mobile/lib/features/rider/shared/widgets/rider_vehicle_marker.dart`
- Test: `apps/mobile/test/features/rider/shared/widgets/rider_vehicle_marker_test.dart`

**Interfaces:**
- Produces:
  - `Marker riderVehicleMarker({required LatLng point, double? headingDegrees, double? accuracyMeters, Key? semanticKey, String semanticLabel = 'Rider current location marker'})`
  - `CircleLayer riderAccuracyCircle({required LatLng point, required double accuracyMeters})`
  - `class AnimatedVehiclePosition extends StatefulWidget` — wraps a map child, lerps `LatLng` changes over 600ms so position updates glide instead of teleporting; exposes `builder(BuildContext, LatLng animatedPoint)`.

- [ ] **Step 1: Failing widget test**

```dart
testWidgets('marker rotates to heading and exposes semantics', (tester) async {
  final marker = riderVehicleMarker(
    point: const LatLng(7.1, 125.6),
    headingDegrees: 90,
    semanticLabel: 'Rider current location marker',
  );
  await tester.pumpWidget(MaterialApp(
    home: FlutterMap(
      options: const MapOptions(initialCenter: LatLng(7.1, 125.6)),
      children: [MarkerLayer(markers: [marker])],
    ),
  ));
  await tester.pump();
  final rotate = tester.widget<Transform>(
    find.descendant(of: find.byType(MarkerLayer), matching: find.byType(Transform)).first,
  );
  expect(rotate.transform, isNot(Matrix4.identity()));
  expect(find.bySemanticsLabel('Rider current location marker'), findsOneWidget);
});

testWidgets('AnimatedVehiclePosition interpolates between points', (tester) async {
  final points = <LatLng>[];
  Widget build(LatLng p) => AnimatedVehiclePosition(
        point: p,
        builder: (context, animated) {
          points.add(animated);
          return const SizedBox();
        },
      );
  await tester.pumpWidget(build(const LatLng(0, 0)));
  await tester.pumpWidget(build(const LatLng(1, 1)));
  await tester.pump(const Duration(milliseconds: 300));
  expect(points.last.latitude, greaterThan(0));
  expect(points.last.latitude, lessThan(1));
});
```

- [ ] **Step 2: Run** → FAIL (symbols undefined).
- [ ] **Step 3: Implement** `rider_vehicle_marker.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// The single GRIDGO vehicle marker: yellow disc, dark heading arrow.
/// Rotates with [headingDegrees]; falls back to a neutral dot when the
/// heading is unknown so it never points a misleading direction.
Marker riderVehicleMarker({
  required LatLng point,
  double? headingDegrees,
  double? accuracyMeters,
  Key? semanticKey,
  String semanticLabel = 'Rider current location marker',
}) {
  final hasHeading = headingDegrees != null && headingDegrees >= 0;
  final disc = Container(
    decoration: BoxDecoration(
      color: kRouteColor,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 2.5),
      boxShadow: const [
        BoxShadow(color: Color(0x40000000), blurRadius: 8, offset: Offset(0, 2)),
      ],
    ),
    child: hasHeading
        ? Transform.rotate(
            angle: headingDegrees * (3.141592653589793 / 180.0),
            child: const Icon(Icons.navigation_rounded,
                color: kRouteBorderColor, size: 22),
          )
        : const Icon(Icons.circle, color: kRouteBorderColor, size: 12),
  );
  return Marker(
    point: point,
    width: 44,
    height: 44,
    child: Semantics(
      key: semanticKey,
      container: true,
      label: semanticLabel,
      child: disc,
    ),
  );
}

/// Translucent GPS accuracy circle drawn under the vehicle marker.
CircleLayer riderAccuracyCircle({
  required LatLng point,
  required double accuracyMeters,
}) {
  return CircleLayer(
    circles: [
      CircleMarker(
        point: point,
        radius: accuracyMeters,
        useRadiusInMeter: true,
        color: kRouteColor.withValues(alpha: 0.12),
        borderColor: kRouteColor.withValues(alpha: 0.35),
        borderStrokeWidth: 1,
      ),
    ],
  );
}

/// Lerps the vehicle's LatLng over [duration] whenever [point] changes so
/// the marker glides between GPS fixes instead of teleporting.
class AnimatedVehiclePosition extends StatefulWidget {
  const AnimatedVehiclePosition({
    super.key,
    required this.point,
    required this.builder,
    this.duration = const Duration(milliseconds: 600),
  });

  final LatLng point;
  final Widget Function(BuildContext context, LatLng animatedPoint) builder;
  final Duration duration;

  @override
  State<AnimatedVehiclePosition> createState() => _AnimatedVehiclePositionState();
}

class _AnimatedVehiclePositionState extends State<AnimatedVehiclePosition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: widget.duration);
  late LatLng _from = widget.point;
  late LatLng _to = widget.point;

  @override
  void didUpdateWidget(AnimatedVehiclePosition oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.point != widget.point) {
      _from = _current;
      _to = widget.point;
      _controller.forward(from: 0);
    }
  }

  LatLng get _current {
    final t = Curves.easeInOut.transform(_controller.value);
    return LatLng(
      _from.latitude + (_to.latitude - _from.latitude) * t,
      _from.longitude + (_to.longitude - _from.longitude) * t,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => widget.builder(context, _current),
      );
}
```

- [ ] **Step 4: Test + analyze** → PASS/clean.
- [ ] **Step 5: Commit** `feat(rider): unified heading-aware animated vehicle marker`.

### Task 4: Adopt the marker on all three rider maps

**Files:**
- Modify: `apps/mobile/lib/features/rider/shared/widgets/rider_map_view.dart` (replace `MapHelpers.riderMarker` usage; wrap with `AnimatedVehiclePosition`; add accuracy circle when `accuracyMeters != null`)
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart:245-255` (replace `Icons.local_taxi_rounded` static marker)
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_panel.dart:248-253` (same)
- Test: extend `apps/mobile/test/features/rider/` map tests (existing files for these widgets; add assertions that `Icons.local_taxi_rounded` is gone and the semantics label `Rider current location marker` is present)

**Interfaces:**
- Consumes: Task 1 state fields, Task 3 widgets. Heading/accuracy flow from `riderLocationTrackerProvider` state where the map already watches it; the home tile/panel (no live GPS) pass `headingDegrees: null`.

- [ ] **Step 1: Failing tests** — for each of the three widgets: pump with an active plan/assignment (reuse each test file's existing fixtures) and assert `find.byIcon(Icons.local_taxi_rounded)` findsNothing and `find.bySemanticsLabel('Rider current location marker')` findsOneWidget.
- [ ] **Step 2: Run** → FAIL on the two home widgets (taxi icon present).
- [ ] **Step 3: Implement** — swap each site to `riderVehicleMarker(...)`; in `rider_map_view.dart` wrap the marker point in `AnimatedVehiclePosition` and insert `riderAccuracyCircle` as a layer directly beneath the marker layer when accuracy is known.
- [ ] **Step 4: Tests + analyze** → PASS/clean.
- [ ] **Step 5: Commit** `feat(rider): adopt unified vehicle marker across rider maps`.

### Task 5: Per-stop ETAs

**Files:**
- Create: `apps/mobile/lib/features/rider/shared/rider_eta.dart`
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_stop_timeline.dart`, `rider_stop_rail.dart`, `rider_today_route_section.dart:105`, `rider_active_stop_card.dart`
- Test: `apps/mobile/test/features/rider/shared/rider_eta_test.dart` + extend the widgets' tests

**Interfaces:**
- Produces: `String formatEtaMinutes(int seconds)` → `'~1 min'` for <90s, `'~N min'` (ceil) otherwise, `'~1 h 5 min'` above 60 min; `String formatDistanceMeters(int meters)` → `'850 m'` under 1 km else `'2.3 km'`.

- [ ] **Step 1: Failing unit test**

```dart
test('eta formatting', () {
  expect(formatEtaMinutes(45), '~1 min');
  expect(formatEtaMinutes(540), '~9 min');
  expect(formatEtaMinutes(3900), '~1 h 5 min');
  expect(formatDistanceMeters(850), '850 m');
  expect(formatDistanceMeters(2340), '2.3 km');
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the two pure functions. **Step 4:** PASS.
- [ ] **Step 5: Failing widget assertions** — active stop card and today-route cards show `formatEtaMinutes(planStop.legDurationSeconds)` when the stop is planned; timeline/rail nodes show it beneath the stop number.
- [ ] **Step 6: Implement** the chips using each widget's existing text styles (caption-size, `colors.onSurfaceDim`), sourcing `legDurationSeconds` from the `RiderAssignmentView.planStop` each widget already receives.
- [ ] **Step 7: Tests + analyze** → PASS/clean. **Step 8: Commit** `feat(rider): per-stop ETAs from the dispatch plan`.

### Task 6: Route summary replaces the decorative clock

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart:159-191` (clock overlay) and the matching overlay in `rider_route_map_panel.dart`
- Test: extend both widgets' tests

**Interfaces:**
- Consumes: Task 2 plan totals, Task 5 formatters.

- [ ] **Step 1: Failing test** — with a plan of 2 stops, `totalDurationSeconds: 540`, `totalDistanceMeters: 2300`, the tile shows `'2 stops · ~9 min · 2.3 km'` and no longer renders the live clock text.
- [ ] **Step 2: Implement** — replace the time/weekday overlay with a summary chip using the same container styling; when totals are null fall back to `'N stops'`. Also replace the bottom caption's `'No persisted dispatch plan'` copy with `'Route not planned yet'` (non-error tone) and raise the caption from italic-muted to the widget's caption style.
- [ ] **Step 3: Tests + analyze** → PASS/clean. **Step 4: Commit** `feat(rider): route summary overlay with plan totals`.

### Task 7: Stale-route banner

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart` (cockpit) and `apps/mobile/lib/features/rider/deliveries/screens/deliveries_screen.dart`
- Test: extend both screens' tests

**Interfaces:**
- Consumes: `DeliveriesState.dataStale` (already populated at `deliveries_provider.dart:212`, currently unread).

- [ ] **Step 1: Failing test** — with provider state `dataStale: true`, both screens show a banner `'Route data may be outdated — pull to refresh'` (MaterialBanner or the app's existing inline-banner pattern; match whichever the codebase uses for `rider_active_banner.dart`).
- [ ] **Step 2: Implement** the banner, dismissible, re-shown when a new stale plan arrives.
- [ ] **Step 3: Tests + analyze** → PASS/clean. **Step 4: Commit** `feat(rider): stale route warning banner`.

### Task 8: Plan origin instead of hardcoded shop

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_route_map_tile.dart` and `rider_route_map_panel.dart` and `rider_map_view.dart` (wherever `MapHelpers.shopPoint`/`shopMarker()` is used with no point)
- Test: extend map widget tests

- [ ] **Step 1: Failing test** — plan fixture with `origin` ≠ `MapHelpers.shopPoint`: the shop marker renders at `plan.origin`.
- [ ] **Step 2: Implement** — `MapHelpers.shopMarker(point: plan?.origin ?? MapHelpers.shopPoint)`; camera-fit bounds already include leg points so no fit change.
- [ ] **Step 3: Tests + analyze** → PASS/clean. **Step 4: Commit** `fix(rider): shop marker uses dispatch plan origin`.

### Task 9: Checkpoint honesty and safety (slider label, decline confirm, proof preview/retry)

**Files:**
- Modify: `apps/mobile/lib/features/rider/shared/widgets/rider_checkpoint_panel.dart:169-300`
- Modify: `apps/mobile/lib/features/rider/deliveries/providers/deliveries_provider.dart:281-289` (`declineAssignment` signature gains `String reason`)
- Modify: `apps/mobile/lib/features/rider/shared/widgets/proof_of_delivery_sheet.dart:45-158`
- Test: extend `rider_checkpoint_panel` and `proof_of_delivery_sheet` tests

- [ ] **Step 1: Failing tests** — (a) arrived state renders slider label `'Swipe to open proof of delivery'` and does NOT render the duplicate `'Open proof of delivery'` text button; (b) tapping Decline opens a dialog with reason choices (`'Customer unreachable'`, `'Vehicle problem'`, `'Too far / out of area'`, `'Other'`) and a Cancel action, and `declineAssignment` is only called after confirm with the chosen reason; (c) photo proof shows a preview with `'Use photo'` / `'Retake'` before upload, and a failed upload shows a `'Retry upload'` action instead of silently resetting.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** exactly those behaviors (AlertDialog for decline; reuse the sheet's existing upload function for retry; pass the picked reason through to the existing API call replacing the hardcoded `'Rider declined'`).
- [ ] **Step 4: Tests + analyze** → PASS/clean. **Step 5: Commit** `fix(rider): honest proof slider, decline confirmation with reason, proof preview and retry`.

### Task 10: Cleanup batch — dead widgets, microtext, naming, affordances

**Files:**
- Delete: `apps/mobile/lib/features/rider/active_delivery/widgets/status_action_bar.dart`, `apps/mobile/lib/features/rider/deliveries/widgets/checkpoint_action.dart` (grep first: `grep -rn "StatusActionBar\|CheckpointAction" apps/mobile/lib` must show no remaining consumers; if one exists, migrate it to `RiderCheckpointPanel` before deleting)
- Modify: `rider_stop_rail.dart:166` and `rider_stop_timeline.dart:133` — `'STOP'` label `fontSize: 4.5` → 10 (shrink the number if needed, never below 10)
- Modify: `rider_stop_timeline.dart:41` and the rail equivalent — "done" derives from the stop's `status == RiderDispatchStopStatus.completed`, not `stopNumber <= completedCount`
- Modify: `rider_today_route_section.dart:105` — hide the position badge when `routePosition == null` instead of rendering `'STOP -'`
- Modify: `active_delivery_screen.dart:167-168` — empty-state button routes to the Deliveries tab and its label says `'Back to Deliveries'`; audit all rider copy so the queue surface is called "Deliveries" (tab label, empty states, banners)
- Modify: `rider_home_screen.dart:103-111` — give the cockpit map an explicit affordance: overlay a `'View route'`/`'Open delivery'` pill (44dp) instead of the whole-map silent tap; `rider_home_screen.dart:43-47` + `active_delivery_screen.dart:88-104` — when `canLaunchUrl` fails or phone is null, show `ScaffoldMessenger` snackbar `'Could not open — no app available'` / `'No phone number on file'`
- Test: extend the affected widget tests (rail/timeline status-based done; today-route null-position; URL failure snackbar via injected launcher failure if the code uses a launcher seam — if it calls `launchUrl` directly, add a thin injectable wrapper in the same file)

- [ ] **Step 1: Failing tests** for: status-based done-shading (a skipped stop between completed ones is not shaded done), hidden badge on null position, 10pt minimum on the STOP label, snackbar on failed call.
- [ ] **Step 2: Implement** all items; delete the two dead files after the grep proves no consumers.
- [ ] **Step 3: Tests + analyze** → PASS/clean. **Step 4: Commit** `fix(rider): rider UX cleanup — dead widgets, readable labels, honest states`.

### Task 11: Verification gate

- [ ] **Step 1:** `fvm flutter analyze lib/` → No issues. `fvm flutter test` → all pass.
- [ ] **Step 2:** `fvm flutter build web --release --no-tree-shake-icons` → succeeds.
- [ ] **Step 3:** Android emulator run (`make mobile-android` against the Docker API): drive rider Juan through a seeded assignment; screenshot home cockpit, active delivery map, decline dialog, proof sheet; orchestrator reviews screenshots against #83's checklist.
- [ ] **Step 4:** Merge into `agent/beta-coherence-program`, re-run contract e2e (`MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts`), check off #83 items.
