import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';

void main() {
  testWidgets('spotlight action also exposes an accessible bubble action', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final targetKey = GlobalKey();
    var activated = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Column(
              children: [
                SizedBox(key: targetKey, width: 120, height: 48),
                ElevatedButton(
                  onPressed: () => showCoachMark(context, [
                    TutorialStep(
                      targetKey: targetKey,
                      icon: HugeIcons.strokeRoundedPrinter,
                      title: 'Start Printing',
                      body: 'Tap here to start your first print order.',
                      advanceOnSpotlightTap: true,
                      onSpotlightTap: () => activated = true,
                    ),
                  ], () {}),
                  child: const Text('Show tutorial'),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Show tutorial'));
    await tester.pumpAndSettle();

    expect(find.text('Got it →'), findsOneWidget);
    expect(find.bySemanticsLabel('Tutorial spotlight'), findsOneWidget);
    await tester.tap(find.text('Got it →'));
    await tester.pumpAndSettle();

    expect(activated, isTrue);
    expect(find.text('Got it →'), findsNothing);
    semantics.dispose();
  });
}
