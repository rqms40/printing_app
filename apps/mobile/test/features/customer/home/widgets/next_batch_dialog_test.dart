import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_dialog.dart';

void main() {
  testWidgets('close command has an accessible name and tap action', (
    tester,
  ) async {
    const info = NextBatchInfo(
      reason: NextBatchReason.weekend,
      todayDate: '2026-07-11',
      relevantDate: '2026-07-13',
      relevantIsToday: false,
      upcoming: [],
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: NextBatchDialog(info: info)),
      ),
    );

    final close = find.bySemanticsLabel('Close batch information');
    expect(close, findsOneWidget);
    final semantics = tester.getSemantics(close);
    expect(semantics.flagsCollection.isButton, isTrue);
    expect(semantics.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
  });
}
