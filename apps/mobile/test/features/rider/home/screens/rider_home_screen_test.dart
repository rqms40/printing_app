import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/rider/home/screens/rider_home_screen.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';

void main() {
  testWidgets('rider home renders header and route section without overflow',
      (tester) async {
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, _) => const RiderHomeScreen())],
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: ThemeData(brightness: Brightness.dark),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(RiderHomeHeader), findsOneWidget);
    expect(find.byType(RiderTodayRouteSection), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
