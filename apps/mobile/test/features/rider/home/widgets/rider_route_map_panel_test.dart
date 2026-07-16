import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_panel.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/shared/rider_assignment_parser.dart';

void main() {
  test(
    'parses one stable route plan with relative and immutable positions',
    () {
      final views = mergeRiderAssignmentViewsWithPlan(
        active: [
          parseAssignmentView(_assignment(102)),
          parseAssignmentView(_assignment(101)),
        ],
        history: const [],
        plan: parseRiderDispatchPlan(_routePlanFixture()),
      );

      expect(views.map((view) => view.id), ['101', '102']);
      expect(views.map((view) => view.routePosition), [1, 2]);
      expect(views.map((view) => view.planSequence), [1, 2]);
      expect(views.first.planVersion, 1);
      expect(views.first.planStop!.geometry!.points.first.longitude, 125.6079);
    },
  );

  test(
    'keeps completed plan legs while relative pending position advances',
    () {
      final fixture = _routePlanFixture();
      (fixture['stops'] as List<dynamic>).first['status'] = 'completed';
      final views = mergeRiderAssignmentViewsWithPlan(
        active: [parseAssignmentView(_assignment(102))],
        history: [parseAssignmentView(_assignment(101, status: 'delivered'))],
        plan: parseRiderDispatchPlan(fixture),
      );

      expect(views.map((view) => view.id), ['101', '102']);
      expect(views.first.routePosition, isNull);
      expect(views.first.planSequence, 1);
      expect(views.last.routePosition, 1);
      expect(views.last.planSequence, 2);
    },
  );

  test('rejects fractional rider plan integers without truncating them', () {
    for (final field in const [
      'version',
      'assignmentId',
      'sequence',
      'legDurationSeconds',
      'legDistanceMeters',
    ]) {
      final fixture = _routePlanFixture();
      if (field == 'version') {
        fixture[field] = 1.5;
      } else {
        (fixture['stops'] as List<dynamic>).first[field] = 1.5;
      }

      expect(
        parseRiderDispatchPlan(fixture),
        isNull,
        reason: '$field must not be truncated to an integer',
      );
    }
  });

  test('rejects fractional assignment route identity fields', () {
    final fractionalPosition = parseAssignmentView({
      ..._assignment(101),
      'routePosition': 1.5,
      'dispatchPlanVersion': 2.5,
    });
    final fractionalStop = parseAssignmentView({
      ..._assignment(101),
      'dispatchPlanStop': {
        ...(_routePlanFixture()['stops'] as List<dynamic>).first
            as Map<String, dynamic>,
        'sequence': 1.5,
      },
    });

    expect(fractionalPosition.routePosition, isNull);
    expect(fractionalPosition.planVersion, isNull);
    expect(fractionalStop.planStop, isNull);
  });

  test('accepts opaque assignment IDs but rejects numeric fractional IDs', () {
    final opaque = _routePlanFixture();
    (opaque['stops'] as List<dynamic>).first['assignmentId'] = 'ven-assignment';
    final fractional = _routePlanFixture();
    (fractional['stops'] as List<dynamic>).first['assignmentId'] = '101.5';

    expect(
      parseRiderDispatchPlan(opaque)?.stops.first.assignmentId,
      'ven-assignment',
    );
    expect(parseRiderDispatchPlan(fractional), isNull);
  });

  testWidgets('renders both persisted planned legs without client routing', (
    tester,
  ) async {
    final views = mergeRiderAssignmentViewsWithPlan(
      active: [
        parseAssignmentView(_assignment(102, status: 'assigned')),
        parseAssignmentView(_assignment(101, status: 'assigned')),
      ],
      history: const [],
      plan: parseRiderDispatchPlan(_routePlanFixture()),
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 500,
              child: RiderRouteMapPanel(stops: views, activeStop: views.first),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('route-leg-0')), findsOneWidget);
    expect(find.byKey(const Key('route-leg-1')), findsOneWidget);
    expect(find.text('Persisted route · Plan v1'), findsOneWidget);
    expect(find.textContaining('Optimizing'), findsNothing);
    expect(find.byIcon(Icons.local_taxi_rounded), findsNothing);
    expect(find.byKey(const Key('route-summary')), findsOneWidget);
    expect(find.text('2 stops left · ~4 min · 1.2 km'), findsOneWidget);
    _expectRequiredAttribution(tester);
  });

  testWidgets('home tile renders the same persisted legs and plan version', (
    tester,
  ) async {
    final views = mergeRiderAssignmentViewsWithPlan(
      active: [
        parseAssignmentView(_assignment(102, status: 'assigned')),
        parseAssignmentView(_assignment(101, status: 'assigned')),
      ],
      history: const [],
      plan: parseRiderDispatchPlan(_routePlanFixture()),
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 500,
              child: RiderRouteMapTile(
                stops: views,
                activeStop: views.first,
                onTap: () {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('route-leg-0')), findsOneWidget);
    expect(find.byKey(const Key('route-leg-1')), findsOneWidget);
    // A healthy persisted plan renders quietly — no dispatch-plan jargon.
    expect(find.textContaining('Persisted route'), findsNothing);
    expect(find.textContaining('Optimizing'), findsNothing);
    expect(find.text('No route planned yet'), findsNothing);
    expect(find.byIcon(Icons.local_taxi_rounded), findsNothing);
    expect(find.byKey(const Key('route-summary')), findsOneWidget);
    expect(find.byKey(const Key('route-open-pill')), findsOneWidget);
    expect(find.text('2 stops left · ~4 min · 1.2 km'), findsOneWidget);
    _expectRequiredAttribution(tester);
  });

  test(
    'uses server route position instead of assignment response list index',
    () {
      final views = parseAssignmentViews([
        {..._assignment(102), 'routePosition': 2},
        {..._assignment(101), 'routePosition': 1},
      ]);

      expect(views.map((view) => view.id), ['102', '101']);
      expect(views.map((view) => view.routePosition), [2, 1]);
    },
  );

  testWidgets('marks malformed persisted geometry as degraded', (tester) async {
    final fixture = _routePlanFixture();
    (fixture['stops'] as List<dynamic>).last['legGeometry'] = {
      'type': 'LineString',
      'coordinates': [
        [999, 7.0731],
        [125.62, 7.08],
      ],
    };
    final views = mergeRiderAssignmentViewsWithPlan(
      active: [
        parseAssignmentView(_assignment(101, status: 'assigned')),
        parseAssignmentView(_assignment(102, status: 'assigned')),
      ],
      history: const [],
      plan: parseRiderDispatchPlan(fixture),
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 500,
              child: RiderRouteMapPanel(stops: views, activeStop: views.first),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('route-leg-0')), findsOneWidget);
    expect(find.byKey(const Key('route-leg-1')), findsNothing);
    expect(find.text('Route geometry degraded'), findsOneWidget);
  });

  testWidgets('marks missing persisted geometry as degraded', (tester) async {
    final fixture = _routePlanFixture();
    (fixture['stops'] as List<dynamic>).last.remove('legGeometry');
    final views = mergeRiderAssignmentViewsWithPlan(
      active: [
        parseAssignmentView(_assignment(101, status: 'assigned')),
        parseAssignmentView(_assignment(102, status: 'assigned')),
      ],
      history: const [],
      plan: parseRiderDispatchPlan(fixture),
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 500,
              child: RiderRouteMapPanel(stops: views, activeStop: views.first),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('route-leg-0')), findsOneWidget);
    expect(find.byKey(const Key('route-leg-1')), findsNothing);
    expect(find.text('Route geometry degraded'), findsOneWidget);
  });
}

void _expectRequiredAttribution(WidgetTester tester) {
  final attribution = tester.widget<RichAttributionWidget>(
    find.byType(RichAttributionWidget),
  );
  final labels = attribution.attributions
      .whereType<TextSourceAttribution>()
      .map((source) => source.text)
      .toList();
  expect(labels, containsAll(['OpenStreetMap contributors', 'CARTO']));
  expect(labels, contains('Route data: OSRM'));
}

Map<String, dynamic> _assignment(int id, {String status = 'on_the_way'}) {
  return {
    'id': id,
    'orderId': 'order-$id',
    'riderId': 'rider-juan',
    'status': status,
    'createdAt': '2026-07-10T09:00:00Z',
    'updatedAt': '2026-07-10T09:00:00Z',
    'order': {
      'id': 'order-$id',
      'orderId': 'ORD-$id',
      'category': 'paper',
      'quantity': 1,
      'totalPrice': 20,
      'deliveryFee': 10,
      'destination': {
        'fullAddress': '$id destination',
        'city': 'Davao City',
        'latitude': id == 101 ? '7.0731000' : '7.0800000',
        'longitude': id == 101 ? '125.6128000' : '125.6200000',
      },
    },
  };
}

Map<String, dynamic> _routePlanFixture() => {
  'id': 9,
  'version': 1,
  'status': 'active',
  'originLatitude': '7.0640000',
  'originLongitude': '125.6079000',
  'provider': 'osrm',
  'profile': 'driving',
  'routingDataStale': false,
  'stops': [
    {
      'assignmentId': 101,
      'sequence': 1,
      'status': 'pending',
      'destinationLatitude': '7.0731000',
      'destinationLongitude': '125.6128000',
      'legDurationSeconds': 12,
      'legDistanceMeters': 77,
      'legGeometry': {
        'type': 'LineString',
        'coordinates': [
          [125.6079, 7.064],
          [125.6128, 7.0731],
        ],
      },
    },
    {
      'assignmentId': 102,
      'sequence': 2,
      'status': 'pending',
      'destinationLatitude': '7.0800000',
      'destinationLongitude': '125.6200000',
      'legDurationSeconds': 170,
      'legDistanceMeters': 1134,
      'legGeometry': {
        'type': 'LineString',
        'coordinates': [
          [125.6128, 7.0731],
          [125.62, 7.08],
        ],
      },
    },
  ],
};
