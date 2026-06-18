# Rider Cockpit Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-lay out the rider home as a cockpit — greeting header (no online pill) → GRIDGO hero → big map with a scrollable/collapsible numbered stop rail on its right → Active Stop card → Today's Route + Recent Deliveries below.

**Architecture:** New theme-following `RiderStopRail` (scrollable, collapsible) overlaid by `RiderCockpitMap` on top of the reused `RiderRouteMapTile`; the `RiderActiveStopCard` is re-themed off `RiderTheme`. The home screen swaps the v1.3.5 status section for the cockpit and deletes the superseded panel/section/online-pill. No backend changes.

**Tech Stack:** Flutter, Riverpod, flutter_map, hugeicons, flutter_animate.

Spec: `docs/superpowers/specs/2026-06-18-rider-cockpit-home-design.md`.

Run all commands from `apps/mobile/`. Flutter: `/home/jd/fvm/versions/3.41.6/bin/flutter`. Branch: `main`. Commit only listed files. Each commit message ends with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

---

## Verified facts
- `RiderRouteMapTile({required List<RiderAssignmentView> stops, required RiderAssignmentView? activeStop, required VoidCallback onTap})` — theme-following, numbered markers, fills its parent.
- `DeliveriesState`: `.activeDelivery`, `.routeStops` (≤5), `.completedAssignments`. `DeliveryStatus.delivered`.
- `RiderAssignmentView`: `.id`, `.status`, `.order` (`.customerName`, `.orderRef`, `.category`, `.quantity`, `.customerPhone`).
- `AppColorSet`: `surface, surfaceVariant, onSurface, onSurfaceDim, onBackground, brand, outline, background, accent`.
- Current `rider_home_header.dart` = date + greeting + bell + `const RiderOnlinePill()`. Current `rider_home_screen.dart` uses `RiderRouteStatusSection` for the mid section and imports `rider_route_status_section.dart` + `shared/models/enums.dart`; it already derives `delivered`, `active`, `upcoming`, `mapStops`.
- `RiderActiveStopCard({required RiderAssignmentView view, VoidCallback? onCall, VoidCallback? onMessage, VoidCallback? onTap})` exists, currently `RiderTheme`-themed, unused.
- Old `RiderStopTimeline` node visuals (check circle `Color(0xFF75D35B)`, 27px numbered circles with brand border) are the visual reference for the rail.

---

## File Structure
- Create `lib/features/rider/home/widgets/rider_stop_rail.dart` (+ test) — scrollable/collapsible numbered rail.
- Create `lib/features/rider/home/widgets/rider_cockpit_map.dart` (+ test) — map tile + overlaid rail.
- Modify `lib/features/rider/home/widgets/rider_active_stop_card.dart` — re-theme to `AppColors` (+ add test).
- Modify `lib/features/rider/home/widgets/rider_home_header.dart` — drop the online pill (+ update test).
- Modify `lib/features/rider/home/screens/rider_home_screen.dart` (+ test) — cockpit layout.
- Delete `rider_delivery_status_panel.dart`, `rider_route_status_section.dart`, `rider_online_pill.dart` + their 3 tests.

---

### Task 1: RiderStopRail (scrollable + collapsible)

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_stop_rail.dart`
- Test: `apps/mobile/test/features/rider/home/rider_stop_rail_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_rail.dart';

void main() {
  Widget host(Widget child) => MaterialApp(
        theme: ThemeData(brightness: Brightness.dark),
        home: Scaffold(
          body: Center(child: SizedBox(width: 80, height: 340, child: child)),
        ),
      );

  testWidgets('renders numbered nodes and toggles collapse', (tester) async {
    await tester.pumpWidget(host(const RiderStopRail(
      totalStops: 7, completedCount: 2, currentStopIndex: 3,
    )));
    await tester.pump();

    expect(find.text('3'), findsOneWidget);
    expect(find.byIcon(Icons.keyboard_double_arrow_left_rounded), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('rider-rail-toggle')));
    await tester.pump();

    expect(find.byIcon(Icons.keyboard_double_arrow_right_rounded), findsOneWidget);
    expect(find.text('3'), findsNothing);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_stop_rail_test.dart`
Expected: FAIL — `RiderStopRail` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';

/// Vertical numbered stop rail overlaid on the cockpit map's right edge.
/// Theme-following; scrolls when there are many stops; the chevron collapses
/// the rail to a small handle to give the map full width.
class RiderStopRail extends StatefulWidget {
  const RiderStopRail({
    super.key,
    required this.totalStops,
    required this.completedCount,
    required this.currentStopIndex,
  });

  final int totalStops;
  final int completedCount;
  final int currentStopIndex;

  @override
  State<RiderStopRail> createState() => _RiderStopRailState();
}

class _RiderStopRailState extends State<RiderStopRail> {
  bool _collapsed = false;

  void _toggle() => setState(() => _collapsed = !_collapsed);

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (_collapsed) {
      return SizedBox(
        width: 28,
        child: Align(
          alignment: Alignment.topCenter,
          child: _handle(colors, expand: true),
        ),
      );
    }

    final stops = widget.totalStops < 0 ? 0 : widget.totalStops;

    return SizedBox(
      width: 44,
      child: Column(
        children: [
          _CheckNode(colors: colors, complete: widget.completedCount > 0),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  for (var i = 1; i <= stops; i++) ...[
                    Container(width: 2.4, height: 12, color: colors.brand),
                    _StopNode(
                      colors: colors,
                      number: i,
                      done: i <= widget.completedCount,
                      current: i == widget.currentStopIndex,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          _handle(colors, expand: false),
        ],
      ),
    );
  }

  Widget _handle(AppColorSet colors, {required bool expand}) {
    return GestureDetector(
      key: const ValueKey('rider-rail-toggle'),
      onTap: _toggle,
      child: Container(
        width: expand ? 28 : 36,
        height: 28,
        decoration: BoxDecoration(
          color: colors.brand,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Icon(
            expand
                ? Icons.keyboard_double_arrow_right_rounded
                : Icons.keyboard_double_arrow_left_rounded,
            color: Colors.black,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class _CheckNode extends StatelessWidget {
  const _CheckNode({required this.colors, required this.complete});
  final AppColorSet colors;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: complete ? const Color(0xFF75D35B) : colors.surfaceVariant,
        shape: BoxShape.circle,
        border: complete
            ? null
            : Border.all(color: colors.outline, width: 1.4),
      ),
      child: Icon(
        Icons.check_rounded,
        size: 18,
        color: complete ? Colors.black : colors.onSurfaceDim,
      ),
    );
  }
}

class _StopNode extends StatelessWidget {
  const _StopNode({
    required this.colors,
    required this.number,
    required this.done,
    required this.current,
  });

  final AppColorSet colors;
  final int number;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final fg = current || done ? colors.onSurface : colors.onSurfaceDim;
    return Container(
      width: 27,
      height: 27,
      decoration: BoxDecoration(
        color: colors.surface,
        shape: BoxShape.circle,
        border: Border.all(
          color: colors.brand,
          width: current ? 2.4 : 1.4,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'STOP',
              style: TextStyle(
                color: fg,
                fontSize: 4.5,
                fontWeight: FontWeight.w900,
                height: 1,
              ),
            ),
            Text(
              '$number',
              style: TextStyle(
                color: fg,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                height: 1,
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

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_stop_rail_test.dart`
Expected: PASS. (`SingleChildScrollView` builds all children even when off-screen, so `find.text('3')` matches before collapse; after collapse only the `>>` handle is built.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_stop_rail.dart apps/mobile/test/features/rider/home/rider_stop_rail_test.dart
git commit -m "feat(rider): add scrollable collapsible stop rail

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: RiderCockpitMap (map + overlaid rail)

**Files:**
- Create: `apps/mobile/lib/features/rider/home/widgets/rider_cockpit_map.dart`
- Test: `apps/mobile/test/features/rider/home/rider_cockpit_map_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_cockpit_map.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_rail.dart';

void main() {
  testWidgets('overlays the stop rail on the route map without overflow',
      (tester) async {
    await tester.runAsync(() async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: const Scaffold(
            body: SizedBox(
              height: 380,
              child: RiderCockpitMap(
                mapStops: [],
                activeStop: null,
                completedCount: 0,
                currentStopIndex: 0,
                onMapTap: _noop,
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));
    });
    await tester.pump();

    expect(find.byType(RiderRouteMapTile), findsOneWidget);
    expect(find.byType(RiderStopRail), findsOneWidget);
  });
}

void _noop() {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_cockpit_map_test.dart`
Expected: FAIL — `RiderCockpitMap` undefined.

- [ ] **Step 3: Write the widget**

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_rail.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Cockpit map: the route map tile filling the area, with the numbered stop
/// rail overlaid on the right edge.
class RiderCockpitMap extends StatelessWidget {
  const RiderCockpitMap({
    super.key,
    required this.mapStops,
    required this.activeStop,
    required this.completedCount,
    required this.currentStopIndex,
    required this.onMapTap,
  });

  final List<RiderAssignmentView> mapStops;
  final RiderAssignmentView? activeStop;
  final int completedCount;
  final int currentStopIndex;
  final VoidCallback onMapTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        RiderRouteMapTile(
          stops: mapStops,
          activeStop: activeStop,
          onTap: onMapTap,
        ),
        Positioned(
          top: 12,
          right: 8,
          bottom: 36,
          child: RiderStopRail(
            totalStops: mapStops.length,
            completedCount: completedCount,
            currentStopIndex: currentStopIndex,
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_cockpit_map_test.dart`
Expected: PASS. If a "pending timer" teardown error occurs (from the map's loading spinner), add `await tester.pumpAndSettle(const Duration(seconds: 1));` inside the `runAsync` block. Do NOT modify production widgets to pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_cockpit_map.dart apps/mobile/test/features/rider/home/rider_cockpit_map_test.dart
git commit -m "feat(rider): add cockpit map (route map + overlaid stop rail)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Re-theme RiderActiveStopCard to AppColors

**Files:**
- Modify (rewrite): `apps/mobile/lib/features/rider/home/widgets/rider_active_stop_card.dart`
- Test: `apps/mobile/test/features/rider/home/rider_active_stop_card_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_active_stop_card.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

RiderAssignmentView _view() {
  final t = DateTime(2026, 6, 18);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: '10005', orderId: '10005', riderId: 'r1',
      status: DeliveryStatus.onTheWay, createdAt: t, updatedAt: t,
    ),
    order: const RiderOrderContext(
      orderRef: 'ORD-10005', orderInternalId: '10005', category: 'A3 Glossy',
      quantity: 3, totalPrice: 300, deliveryFee: 25, customerName: 'Maria',
    ),
  );
}

void main() {
  testWidgets('renders customer, summary, ref, and action icons', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(brightness: Brightness.dark),
      home: Scaffold(body: RiderActiveStopCard(view: _view())),
    ));
    await tester.pump();

    expect(find.text('Active Stop'), findsOneWidget);
    expect(find.text('Maria'), findsOneWidget);
    expect(find.textContaining('A3 Glossy'), findsOneWidget);
    expect(find.textContaining('ORD-10005'), findsOneWidget);
    expect(find.byKey(const ValueKey('rider-stop-call')), findsOneWidget);
    expect(find.byKey(const ValueKey('rider-stop-message')), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails (or passes incidentally)**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_active_stop_card_test.dart`
Expected: PASS or FAIL — the current widget already renders these, but it imports `RiderTheme`. The point of this task is the re-theme; proceed regardless to Step 3.

- [ ] **Step 3: Rewrite the widget theme-following**

Replace the entire contents of `apps/mobile/lib/features/rider/home/widgets/rider_active_stop_card.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Active stop card (cockpit bottom): avatar, customer, order summary, ref,
/// message + call actions. Theme-following.
class RiderActiveStopCard extends StatelessWidget {
  const RiderActiveStopCard({
    super.key,
    required this.view,
    this.onCall,
    this.onMessage,
    this.onTap,
  });

  final RiderAssignmentView view;
  final VoidCallback? onCall;
  final VoidCallback? onMessage;
  final VoidCallback? onTap;

  String get _orderSummary {
    final category = view.order.category;
    final qty = view.order.quantity;
    return '$category, $qty ${qty == 1 ? 'Copy' : 'Copies'}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final customerName = view.order.customerName ?? 'Customer';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active Stop',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              fontSize: 18,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 6),
          Material(
            color: colors.surface,
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.fromLTRB(8, 8, 10, 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.outline.withValues(alpha: 0.8)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: colors.surfaceVariant,
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.onSurface, width: 3),
                      ),
                      child: Icon(
                        Icons.person_rounded,
                        color: colors.onSurface,
                        size: 31,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customerName,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.brand,
                              fontSize: 12,
                              letterSpacing: 0,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _orderSummary,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurface,
                              fontSize: 10,
                              height: 1.05,
                            ),
                          ),
                          Text(
                            '#${view.order.orderRef}',
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurface,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              height: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _ActionIcon(
                      key: const ValueKey('rider-stop-message'),
                      icon: HugeIcons.strokeRoundedMail01,
                      colors: colors,
                      onTap: onMessage,
                    ),
                    const SizedBox(width: 6),
                    _ActionIcon(
                      key: const ValueKey('rider-stop-call'),
                      icon: HugeIcons.strokeRoundedCall,
                      colors: colors,
                      onTap: onCall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({
    super.key,
    required this.icon,
    required this.colors,
    this.onTap,
  });

  final dynamic icon;
  final AppColorSet colors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: colors.surfaceVariant,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 28,
          height: 28,
          child: Center(
            child: HugeIcon(icon: icon, color: colors.onSurface, size: 15),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_active_stop_card_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_active_stop_card.dart apps/mobile/test/features/rider/home/rider_active_stop_card_test.dart
git commit -m "feat(rider): re-theme active stop card to AppColors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Remove the online pill from the header

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/widgets/rider_home_header.dart`
- Modify: `apps/mobile/test/features/rider/home/rider_home_header_test.dart`

- [ ] **Step 1: Edit the header**

In `rider_home_header.dart`:
- Remove the import line `import 'package:printing_app/features/rider/home/widgets/rider_online_pill.dart';`
- Remove the trailing two children of the header `Row` — the `const SizedBox(width: AppSpacing.xs)` and `const RiderOnlinePill()` — so the row ends with the bell `GestureDetector`. (If removing `AppSpacing` leaves it unused, keep it — it is still used elsewhere in the file for the bell spacing; verify with the analyzer.)

- [ ] **Step 2: Update the header test**

In `rider_home_header_test.dart`, add an assertion that the online pill is gone. After the existing greeting assertion, add:
```dart
    expect(find.text('Online'), findsNothing);
    expect(find.text('Offline'), findsNothing);
```

- [ ] **Step 3: Verify compile + test**

Run:
```
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/rider/home/widgets/rider_home_header.dart
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/rider_home_header_test.dart
```
Expected: analyze clean; test passes.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/features/rider/home/widgets/rider_home_header.dart apps/mobile/test/features/rider/home/rider_home_header_test.dart
git commit -m "feat(rider): remove online pill from home header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Cockpit layout in the home screen; delete superseded files

**Files:**
- Modify: `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart`
- Modify: `apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart`
- Delete: `rider_delivery_status_panel.dart`, `rider_route_status_section.dart`, `rider_online_pill.dart` + their 3 test files.

- [ ] **Step 1: Read the screen**

`Read` `apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart` to see exact current content (it currently builds `RiderRouteStatusSection` and has `delivered`/`active`/`upcoming`/`mapStops` derivations and a resume-active card).

- [ ] **Step 2: Edit imports**

- Remove: `import 'package:printing_app/features/rider/home/widgets/rider_route_status_section.dart';`
- Add:
  - `import 'package:printing_app/features/rider/home/widgets/rider_cockpit_map.dart';`
  - `import 'package:printing_app/features/rider/home/widgets/rider_active_stop_card.dart';`
- Keep the existing `import 'package:printing_app/shared/models/enums.dart';` and the `rider_order_context.dart` import (used for `RiderAssignmentView`). If `RiderResumeActiveCard`'s import becomes unused after Step 4 removes the card, remove that import too.

- [ ] **Step 3: Add the two derived counts**

Where the screen derives `mapStops` (after `final mapStops = ...`), add:
```dart
    final completedCount = delivered.length;
    final currentStopIndex = active != null ? delivered.length + 1 : 0;
```

- [ ] **Step 4: Replace the status section block + resume card**

Replace the `SizedBox(height: 460, child: RiderRouteStatusSection(...))...animate()` block with the cockpit map + active stop card:
```dart
                    SizedBox(
                      height: 380,
                      child: RiderCockpitMap(
                        mapStops: mapStops,
                        activeStop: active,
                        completedCount: completedCount,
                        currentStopIndex: currentStopIndex,
                        onMapTap: () {
                          if (active != null) {
                            context.push('/rider/deliveries/${active.id}/active');
                          } else {
                            context.go('/rider/deliveries');
                          }
                        },
                      ),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 100.ms,
                      curve: Curves.easeOut,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (active != null)
                      RiderActiveStopCard(
                        view: active,
                        onTap: () =>
                            context.push('/rider/deliveries/${active.id}/active'),
                        onMessage: () => _openChat(context, ref, active),
                        onCall: () => _call(active.order.customerPhone),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: AppSpacing.sm,
                        ),
                        child: Text(
                          'No active stop — check Orders for assignments.',
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ),
```

Also DELETE the resume-active card block (the `if (active != null) ... RiderResumeActiveCard(...)` that sits between the header and the hero) — the Active Stop card replaces it.

- [ ] **Step 5: Add the chat/call helpers (if not already present)**

The screen already has an `_openChat(BuildContext, WidgetRef, RiderAssignmentView)` method (used by the existing chat FAB). Add a `_call` helper to the `RiderHomeScreen` class if absent:
```dart
  Future<void> _call(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }
```
and add the import `import 'package:url_launcher/url_launcher.dart';` if not present. (Confirm `_openChat` exists; it does, from the chat FAB.)

- [ ] **Step 6: Update the screen test**

In `rider_home_screen_test.dart`:
- Replace the import `rider_route_status_section.dart` with `import 'package:printing_app/features/rider/home/widgets/rider_cockpit_map.dart';`
- Replace the assertion `expect(find.byType(RiderRouteStatusSection), findsOneWidget);` with `expect(find.byType(RiderCockpitMap), findsOneWidget);`
- Keep the rest (provider overrides / runAsync / bounded pumps) intact.

- [ ] **Step 7: Delete superseded files + verify no references**

```bash
cd /home/jd/projects/printing_app
git rm \
  apps/mobile/lib/features/rider/home/widgets/rider_delivery_status_panel.dart \
  apps/mobile/test/features/rider/home/rider_delivery_status_panel_test.dart \
  apps/mobile/lib/features/rider/home/widgets/rider_route_status_section.dart \
  apps/mobile/test/features/rider/home/rider_route_status_section_test.dart \
  apps/mobile/lib/features/rider/home/widgets/rider_online_pill.dart \
  apps/mobile/test/features/rider/home/rider_online_pill_test.dart
grep -rn "rider_delivery_status_panel\|RiderDeliveryStatusPanel\|rider_route_status_section\|RiderRouteStatusSection\|rider_online_pill\|RiderOnlinePill" apps/mobile/lib apps/mobile/test || echo "no references"
```
Expected: "no references".

- [ ] **Step 8: Verify**

Run:
```
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/rider/ test/features/rider/
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/
```
Expected: analyze clean; all rider/home tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/lib/features/rider/home/screens/rider_home_screen.dart apps/mobile/test/features/rider/home/screens/rider_home_screen_test.dart
git commit -m "feat(rider): cockpit home layout (map + rail + active stop); drop status section & online pill

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Analyzer** — `/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/` → No issues found!
- [ ] **Step 2: Rider home tests** — `/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/rider/home/` → all pass.
- [ ] **Step 3: Full suite** — `/home/jd/fvm/versions/3.41.6/bin/flutter test` → all pass.
- [ ] **Step 4: Web release build** — `/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons` → `✓ Built build/web`.

---

## Self-Review

**Spec coverage:**
- Greeting header without online pill → Task 4. ✓
- GRIDGO hero kept → unchanged in screen (Task 5 leaves it). ✓
- Big map (majority) with right scrollable+collapsible numbered rail → Tasks 1 (rail), 2 (cockpit map), 5 (`SizedBox(height: 380)`). ✓
- Active Stop card (re-themed) + empty "No active stop" → Tasks 3, 5. ✓
- Today's Route + Recent Deliveries below (scroll) → Task 5 leaves them intact. ✓
- Drop resume-active card → Task 5 Step 4. ✓
- Delete superseded panel/section/online-pill + tests → Task 5 Step 7. ✓
- Theme-following → Tasks 1–3 resolve `AppColors`. ✓
- Rail numbers match map markers (sequential delivered→current→upcoming) → `completedCount`/`currentStopIndex` (Task 5) feed both the rail (Task 1) and `RiderRouteMapTile` markers via `mapStops` order. ✓
- analyze/tests/build green → Task 6. ✓

**Placeholder scan:** No TBD/TODO. Test-only fallbacks (pumpAndSettle for the map; analyzer check on `AppSpacing`) are concrete.

**Type consistency:** `RiderCockpitMap` ctor (`mapStops`, `activeStop`, `completedCount`, `currentStopIndex`, `onMapTap`) matches Task 2 definition and the Task 5 call site. `RiderStopRail` ctor (`totalStops`, `completedCount`, `currentStopIndex`) matches Tasks 1, 2. `RiderActiveStopCard` keeps its existing ctor (`view`, `onCall`, `onMessage`, `onTap`) — Task 5 call site matches. `_call`/`_openChat` helper names consistent. Stop numbering: rail `currentStopIndex = delivered.length + 1` aligns with map marker numbering (delivered are markers 1..k, current is k+1).
