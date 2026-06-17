import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_recent_deliveries_section.dart';

void main() {
  testWidgets('shows empty state when no completed deliveries',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderRecentDeliveriesSection(completed: const [], onTap: (_) {}),
        ),
      ),
    );
    expect(find.text('Recent Deliveries'), findsOneWidget);
    expect(find.textContaining('No completed'), findsOneWidget);
  });
}
