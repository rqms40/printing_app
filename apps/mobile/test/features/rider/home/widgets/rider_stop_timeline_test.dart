import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_timeline.dart';

void main() {
  testWidgets('renders screenshot-style stop rail capped at five stops', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 80,
            height: 360,
            child: RiderStopTimeline(
              totalStops: 7,
              completedCount: 1,
              currentStopIndex: 2,
            ),
          ),
        ),
      ),
    );

    expect(
      find.byKey(const ValueKey('rider-stop-timeline-check')),
      findsOneWidget,
    );
    expect(find.text('STOP'), findsNothing);
    expect(find.text('1'), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('6'), findsNothing);
    expect(
      find.byKey(const ValueKey('rider-stop-timeline-chevron')),
      findsOneWidget,
    );
  });
}
