import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/admin/dashboard/screens/dashboard_screen.dart';

void main() {
  Widget createTestWidget() {
    return const ProviderScope(
      child: MaterialApp(
        home: DashboardScreen(),
      ),
    );
  }

  group('DashboardScreen', () {
    testWidgets('renders KPI cards', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('New Orders'), findsOneWidget);
      expect(find.text('In Production'), findsOneWidget);
      expect(find.text('Ready for Pickup'), findsOneWidget);
      expect(find.text('Revenue'), findsOneWidget);
    });

    testWidgets('renders chart sections', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Sales Trend'), findsOneWidget);
      expect(find.text('Order Volume'), findsOneWidget);
    });
  });
}
