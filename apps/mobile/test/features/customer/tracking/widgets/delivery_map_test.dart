import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/tracking/widgets/delivery_map.dart';
import 'package:printing_app/shared/models/enums.dart';

Widget _wrap(LiveDeliveryMapState state) => ProviderScope(
      overrides: [
        liveDeliveryMapProvider.overrideWith((_) async => state),
      ],
      child: const MaterialApp(home: Scaffold(body: DeliveryMap())),
    );

/// Pump enough frames for the FutureProvider to resolve without waiting for
/// the infinite pulse animation to settle (it never would).
Future<void> _settle(WidgetTester tester) async {
  await tester.pump();                              // trigger build
  await tester.pump(const Duration(milliseconds: 50)); // resolve FutureProvider
}

void main() {
  group('DeliveryMap widget', () {
    testWidgets('shows loading indicator while provider is loading', (tester) async {
      await tester.pumpWidget(_wrap(LiveDeliveryMapState.loading()));
      await _settle(tester);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows loading indicator in idle state (no active delivery)', (tester) async {
      await tester.pumpWidget(_wrap(LiveDeliveryMapState.idle()));
      await _settle(tester);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows Live Tracking badge in active state', (tester) async {
      final active = LiveDeliveryMapState.active(
        driverPoint: const LatLng(7.07, 125.61),
        shopPoint: const LatLng(7.064, 125.608),
        destPoint: const LatLng(7.073, 125.613),
        routePoints: [
          const LatLng(7.064, 125.608),
          const LatLng(7.068, 125.610),
          const LatLng(7.073, 125.613),
        ],
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.onTheWay,
      );
      await tester.pumpWidget(_wrap(active));
      await _settle(tester);
      expect(find.text('Live Tracking'), findsOneWidget);
    });

    testWidgets('shows ETA badge in active state', (tester) async {
      final active = LiveDeliveryMapState.active(
        driverPoint: const LatLng(7.07, 125.61),
        shopPoint: const LatLng(7.064, 125.608),
        destPoint: const LatLng(7.073, 125.613),
        routePoints: List.generate(
          15,
          (i) => LatLng(7.064 + i * 0.001, 125.608),
        ),
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.onTheWay,
      );
      await tester.pumpWidget(_wrap(active));
      await _settle(tester);
      expect(find.textContaining('min'), findsOneWidget);
    });
  });
}
