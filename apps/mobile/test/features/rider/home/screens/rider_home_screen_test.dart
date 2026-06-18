import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/home/screens/rider_home_screen.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_status_section.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';

void main() {
  testWidgets('rider home renders header and route section without overflow',
      (tester) async {
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, __) => const RiderHomeScreen())],
    );

    // runAsync lets outstanding futures (network failures, earnings fallback)
    // settle before we hand control back to the fake-async pump loop.
    await tester.runAsync(() async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            // Bypass the bootstrap fetch so no pending API timers are created.
            deliveriesProvider.overrideWith(
              (_) => DeliveriesNotifier(bootstrap: false),
            ),
          ],
          child: MaterialApp.router(
            theme: ThemeData(brightness: Brightness.dark),
            routerConfig: router,
          ),
        ),
      );

      // Give earningsProvider's network call a chance to fail and settle.
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });

    // Advance past the one-shot flutter_animate fade-in timers
    // (max delay 300ms + duration 400ms = 700ms total).
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(seconds: 1));

    expect(find.byType(RiderHomeHeader), findsOneWidget);
    expect(find.byType(RiderTodayRouteSection), findsOneWidget);
    expect(find.byType(RiderRouteStatusSection), findsOneWidget);
  });
}
