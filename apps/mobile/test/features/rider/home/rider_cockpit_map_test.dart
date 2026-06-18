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
