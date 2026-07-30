import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_vehicle_marker.dart';

void main() {
  testWidgets('marker rotates to heading and exposes semantics', (
    tester,
  ) async {
    final marker = riderVehicleMarker(
      point: const LatLng(7.1, 125.6),
      headingDegrees: 90,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: FlutterMap(
          options: const MapOptions(initialCenter: LatLng(7.1, 125.6)),
          children: [MarkerLayer(markers: [marker])],
        ),
      ),
    );
    await tester.pump();
    expect(
      find.descendant(
        of: find.byType(MarkerLayer),
        matching: find.byType(Transform),
      ),
      findsWidgets,
    );
    expect(
      find.bySemanticsLabel('Rider current location marker'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.navigation_rounded), findsOneWidget);
  });

  testWidgets('marker without heading shows neutral dot, no arrow', (
    tester,
  ) async {
    final marker = riderVehicleMarker(point: const LatLng(7.1, 125.6));
    await tester.pumpWidget(
      MaterialApp(
        home: FlutterMap(
          options: const MapOptions(initialCenter: LatLng(7.1, 125.6)),
          children: [MarkerLayer(markers: [marker])],
        ),
      ),
    );
    await tester.pump();
    expect(find.byIcon(Icons.navigation_rounded), findsNothing);
    expect(find.byIcon(Icons.circle), findsOneWidget);
  });

  testWidgets('AnimatedVehiclePosition interpolates between points', (
    tester,
  ) async {
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
    await tester.pump(const Duration(milliseconds: 400));
    expect(points.last.latitude, 1);
  });
}
