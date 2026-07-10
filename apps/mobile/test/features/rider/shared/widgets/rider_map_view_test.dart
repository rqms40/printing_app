import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_map_view.dart';
import 'package:printing_app/shared/models/route_geometry.dart';
import 'package:printing_app/shared/services/routing_service.dart';

RiderDispatchPlanStop _stop({GeoJsonLineString? geometry}) =>
    RiderDispatchPlanStop(
      assignmentId: '101',
      sequence: 1,
      status: RiderDispatchStopStatus.pending,
      destinationLatitude: 7.073,
      destinationLongitude: 125.613,
      legDurationSeconds: 180,
      legDistanceMeters: 2500,
      geometry: geometry,
      geometryMalformed: geometry == null,
    );

Widget _app(RiderDispatchPlanStop stop) => ProviderScope(
  child: MaterialApp(
    home: Scaffold(
      body: SizedBox(
        height: 400,
        child: RiderMapView(
          assignmentId: '101',
          destination: stop.destination,
          planStop: stop,
          trackLocation: false,
        ),
      ),
    ),
  ),
);

void main() {
  tearDown(() => RoutingService.debugRouteFetcher = null);

  testWidgets('renders the persisted active leg without client routing', (
    tester,
  ) async {
    var clientRoutingCalls = 0;
    RoutingService.debugRouteFetcher = (start, end) async {
      clientRoutingCalls++;
      return [start, end];
    };
    final stop = _stop(
      geometry: GeoJsonLineString.tryParse({
        'type': 'LineString',
        'coordinates': [
          [125.608, 7.064],
          [125.610, 7.068],
          [125.613, 7.073],
        ],
      }),
    );

    await tester.pumpWidget(_app(stop));
    await tester.pump();

    expect(find.byKey(const Key('active-route-leg')), findsOneWidget);
    expect(find.byType(PolylineLayer), findsOneWidget);
    expect(find.text('Persisted route · 2.5 km'), findsOneWidget);
    expect(clientRoutingCalls, 0);
  });

  testWidgets('missing persisted geometry degrades without a fake line', (
    tester,
  ) async {
    var clientRoutingCalls = 0;
    RoutingService.debugRouteFetcher = (start, end) async {
      clientRoutingCalls++;
      return [start, end];
    };

    await tester.pumpWidget(_app(_stop()));
    await tester.pump();

    expect(find.byType(PolylineLayer), findsNothing);
    expect(find.text('Route geometry unavailable'), findsOneWidget);
    expect(clientRoutingCalls, 0);
  });
}
