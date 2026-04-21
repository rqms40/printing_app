import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/shared/models/enums.dart';

GoRouter _router() => GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const MapTrackingTile()),
      GoRoute(path: '/customer/tracking', builder: (_, __) => const Scaffold()),
    ]);

Widget _wrap(LiveDeliveryMapState state) => ProviderScope(
      overrides: [
        liveDeliveryMapProvider.overrideWith((_) async => state),
      ],
      child: MaterialApp.router(routerConfig: _router()),
    );

void main() {
  testWidgets('shows CircularProgressIndicator when loading', (tester) async {
    await tester.pumpWidget(_wrap(LiveDeliveryMapState.loading()));
    await tester.pump(); // let FutureProvider settle
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('shows "No active delivery" label in idle state', (tester) async {
    await tester.pumpWidget(_wrap(LiveDeliveryMapState.idle()));
    await tester.pumpAndSettle();
    expect(find.text('No active delivery'), findsOneWidget);
  });

  testWidgets('shows LIVE MAP badge in active state', (tester) async {
    final active = LiveDeliveryMapState.active(
      driverPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
      orderId: 'ORD-001',
      orderStatus: OrderStatus.onTheWay,
    );
    await tester.pumpWidget(_wrap(active));
    await tester.pumpAndSettle();
    expect(find.text('LIVE MAP'), findsOneWidget);
  });
}
