import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_map_view.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

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

Widget _app(
  RiderDispatchPlanStop stop, {
  bool trackLocation = false,
  RiderLocationTracker? tracker,
}) => ProviderScope(
  overrides: [
    if (tracker != null)
      riderLocationTrackerProvider.overrideWith((ref, args) => tracker),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: SizedBox(
        height: 400,
        child: RiderMapView(
          assignmentId: '101',
          destination: stop.destination,
          planStop: stop,
          trackLocation: trackLocation,
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('renders the persisted active leg without client routing', (
    tester,
  ) async {
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
    expect(find.text('2.5 km to this stop'), findsOneWidget);
  });

  testWidgets('missing persisted geometry degrades without a fake line', (
    tester,
  ) async {
    await tester.pumpWidget(_app(_stop()));
    await tester.pump();

    expect(find.byType(PolylineLayer), findsNothing);
    expect(find.text('Route line unavailable'), findsOneWidget);
  });

  testWidgets('live rider map exposes a manual GPS refresh control', (
    tester,
  ) async {
    final tracker = RiderLocationTracker(
      assignmentId: '101',
      enabled: false,
      autoStart: false,
    );

    await tester.pumpWidget(
      _app(_stop(), trackLocation: true, tracker: tracker),
    );
    await tester.pump();

    final refreshControl = find.bySemanticsLabel('Refresh GPS location');
    expect(refreshControl, findsOneWidget);
    final semantics = tester.getSemantics(refreshControl).getSemanticsData();
    expect(semantics.hasAction(SemanticsAction.tap), isTrue);
    expect(semantics.hasFlag(SemanticsFlag.isFocusable), isTrue);
    final controlPosition = tester.widget<Positioned>(
      find.byKey(const Key('rider-map-location-control')),
    );
    expect(controlPosition.top, isNotNull);
    expect(controlPosition.bottom, isNull);
  });
}
