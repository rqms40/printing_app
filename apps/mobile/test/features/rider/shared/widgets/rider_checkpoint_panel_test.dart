import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_checkpoint_panel.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('delivery confirmation swipe exposes one actionable control', (
    tester,
  ) async {
    var confirmed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderCheckpointPanel(
            status: DeliveryStatus.arrived,
            onAdvance: () => confirmed = true,
          ),
        ),
      ),
    );

    final control = find.bySemanticsLabel('Swipe to confirm delivery');
    expect(control, findsOneWidget);
    final semantics = tester.getSemantics(control).getSemanticsData();
    expect(semantics.hasAction(SemanticsAction.tap), isTrue);

    final rect = tester.getRect(
      find.byKey(const ValueKey('rider-delivery-confirm-slider')),
    );
    final drag = await tester.startGesture(
      Offset(rect.left + 24, rect.center.dy),
    );
    await drag.moveBy(const Offset(24, 0));
    await tester.pump();
    await drag.moveBy(Offset(rect.width - 72, 0));
    await tester.pump();
    await drag.up();
    await tester.pump();
    expect(confirmed, isTrue);
  });

  testWidgets('offers an accessible tap alternative to the swipe gesture', (
    tester,
  ) async {
    var confirmed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderCheckpointPanel(
            status: DeliveryStatus.arrived,
            onAdvance: () => confirmed = true,
          ),
        ),
      ),
    );

    final button = find.widgetWithText(TextButton, 'Open proof of delivery');
    expect(button, findsOneWidget);
    await tester.tap(button);
    await tester.pump();

    expect(confirmed, isTrue);
  });
}
