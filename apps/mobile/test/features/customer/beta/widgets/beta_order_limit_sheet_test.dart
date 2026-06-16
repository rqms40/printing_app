import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_order_limit_sheet.dart';

void main() {
  testWidgets('renders title, body and Got it button', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: BetaOrderLimitSheet()),
      ),
    );

    expect(find.text("You've used your beta order"), findsOneWidget);
    expect(
      find.textContaining('beta testers can place one order'),
      findsOneWidget,
    );
    expect(find.text('Got it'), findsOneWidget);
  });

  testWidgets('Got it button pops the bottom sheet', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                builder: (_) => const BetaOrderLimitSheet(),
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text("You've used your beta order"), findsOneWidget);

    final gotItButton = find.text('Got it');
    await tester.ensureVisible(gotItButton);
    await tester.tap(gotItButton);
    await tester.pumpAndSettle();

    expect(find.text("You've used your beta order"), findsNothing);
  });
}
