import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/home/widgets/rider_cockpit_map.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_rail.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/routing_service.dart';

void main() {
  setUp(() {
    RoutingService.debugRouteFetcher = (start, end) async => [
      start,
      LatLng(
        start.latitude + (end.latitude - start.latitude) / 2,
        start.longitude + (end.longitude - start.longitude) / 2,
      ),
      end,
    ];
  });

  tearDown(() {
    RoutingService.debugRouteFetcher = null;
  });

  testWidgets('overlays the stop rail on the route map without overflow', (
    tester,
  ) async {
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

  testWidgets('does not draw a rider route when there is no active delivery', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: Scaffold(
            body: SizedBox(
              height: 380,
              child: RiderCockpitMap(
                mapStops: [_view(status: DeliveryStatus.assigned)],
                activeStop: null,
                completedCount: 0,
                currentStopIndex: 0,
                onMapTap: _noop,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byType(PolylineLayer), findsNothing);
  });

  testWidgets('draws a rider route when there is an active delivery', (
    tester,
  ) async {
    final active = _view(status: DeliveryStatus.accepted);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: Scaffold(
            body: SizedBox(
              height: 380,
              child: RiderCockpitMap(
                mapStops: [active],
                activeStop: active,
                completedCount: 0,
                currentStopIndex: 1,
                onMapTap: _noop,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byType(PolylineLayer), findsOneWidget);
  });

  testWidgets('loads the rider route when an active delivery appears', (
    tester,
  ) async {
    final active = _view(status: DeliveryStatus.accepted);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: Scaffold(
            body: SizedBox(
              height: 380,
              child: RiderCockpitMap(
                mapStops: [active],
                activeStop: null,
                completedCount: 0,
                currentStopIndex: 0,
                onMapTap: _noop,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(PolylineLayer), findsNothing);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: Scaffold(
            body: SizedBox(
              height: 380,
              child: RiderCockpitMap(
                mapStops: [active],
                activeStop: active,
                completedCount: 0,
                currentStopIndex: 1,
                onMapTap: _noop,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byType(PolylineLayer), findsOneWidget);
  });
}

void _noop() {}

RiderAssignmentView _view({required DeliveryStatus status}) {
  final now = DateTime.utc(2026, 6, 25, 9);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: 'assignment-${status.name}',
      orderId: 'order-${status.name}',
      riderId: 'rider-1',
      status: status,
      createdAt: now,
      updatedAt: now,
    ),
    order: const RiderOrderContext(
      orderRef: 'ORD-ROUTE',
      orderInternalId: 'order-route',
      category: 'Print',
      quantity: 1,
      totalPrice: 120,
      deliveryFee: 40,
      destination: RiderDestinationContext(
        fullAddress: 'Davao City',
        latitude: 7.0820,
        longitude: 125.6130,
      ),
    ),
  );
}
