import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/admin/dashboard/screens/dashboard_screen.dart';

void main() {
  Widget createTestWidget() {
    return const ProviderScope(
      child: MaterialApp(
        home: Scaffold(body: DashboardScreen()),
      ),
    );
  }

  group('DashboardScreen', () {
    testWidgets('renders KPI cards', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('New Orders'), findsOneWidget);
      expect(find.text('In Production'), findsOneWidget);
      expect(find.text('Monthly Revenue'), findsOneWidget);
    });

    testWidgets('renders chart sections', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Scroll down to find charts
      await tester.dragUntilVisible(
        find.text('Sales Trend'),
        find.byType(ListView).first,
        const Offset(0, -300),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Sales Trend'), findsOneWidget);
    });
  });
}
