import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_decline_dialog.dart';

void main() {
  testWidgets('decline requires an explicit reason and can be cancelled', (
    tester,
  ) async {
    String? result = 'unset';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await showRiderDeclineDialog(context);
              },
              child: const Text('Decline'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Decline'));
    await tester.pumpAndSettle();
    expect(find.text('Decline this delivery?'), findsOneWidget);
    for (final reason in riderDeclineReasons) {
      expect(find.text(reason), findsOneWidget);
    }

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isNull);

    await tester.tap(find.text('Decline'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vehicle problem'));
    await tester.pumpAndSettle();
    expect(result, 'Vehicle problem');
  });
}
