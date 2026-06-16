import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/widgets/tutorial_bubble.dart';

void main() {
  group('TutorialBubble', () {
    testWidgets('shows step counter and Skip but no Got it when onAdvance is null', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'GRIDGO Credits',
            body: 'Pay without GCash.',
            step: 1,
            totalSteps: 2,
            onSkip: () {},
            onAdvance: null,
          ),
        ),
      ));
      expect(find.text('1 of 2'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      expect(find.text('Got it →'), findsNothing);
    });

    testWidgets('shows Got it → when onAdvance is provided', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'Items',
            body: 'Quick review.',
            step: 5,
            totalSteps: 9,
            onSkip: () {},
            onAdvance: () {},
          ),
        ),
      ));
      expect(find.text('Got it →'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
    });

    testWidgets('Got it → fires onAdvance', (tester) async {
      bool advanced = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'T',
            body: 'B',
            step: 1,
            totalSteps: 3,
            onSkip: () {},
            onAdvance: () => advanced = true,
          ),
        ),
      ));
      await tester.tap(find.text('Got it →'));
      expect(advanced, isTrue);
    });

    testWidgets('Skip fires onSkip', (tester) async {
      bool skipped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'T',
            body: 'B',
            step: 1,
            totalSteps: 3,
            onSkip: () => skipped = true,
            onAdvance: null,
          ),
        ),
      ));
      await tester.tap(find.text('Skip'));
      expect(skipped, isTrue);
    });
  });
}
