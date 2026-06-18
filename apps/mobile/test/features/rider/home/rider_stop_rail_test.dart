import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_rail.dart';

void main() {
  Widget host(Widget child) => MaterialApp(
        theme: ThemeData(brightness: Brightness.dark),
        home: Scaffold(
          body: Center(child: SizedBox(width: 80, height: 340, child: child)),
        ),
      );

  testWidgets('renders numbered nodes and toggles collapse', (tester) async {
    await tester.pumpWidget(host(const RiderStopRail(
      totalStops: 7, completedCount: 2, currentStopIndex: 3,
    )));
    await tester.pump();

    expect(find.text('3'), findsOneWidget);
    expect(find.byIcon(Icons.keyboard_double_arrow_left_rounded), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('rider-rail-toggle')));
    await tester.pump();

    expect(find.byIcon(Icons.keyboard_double_arrow_right_rounded), findsOneWidget);
    expect(find.text('3'), findsNothing);
  });
}
