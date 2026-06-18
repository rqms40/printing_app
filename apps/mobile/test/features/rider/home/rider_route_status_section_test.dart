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
void _noopStop(dynamic _) {}
