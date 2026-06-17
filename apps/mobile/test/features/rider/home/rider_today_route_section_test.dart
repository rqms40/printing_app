import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';

void main() {
  testWidgets('shows empty state when no stops', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderTodayRouteSection(stops: const [], onTapStop: (_) {}),
        ),
      ),
    );
    expect(find.text("Today's Route"), findsOneWidget);
    expect(find.textContaining('No stops'), findsOneWidget);
  });
}
