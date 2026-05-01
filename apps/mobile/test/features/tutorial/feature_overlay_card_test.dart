import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';

void main() {
  group('FeatureOverlayCard', () {
    testWidgets('hero variant renders title, body, and primary CTA, no Skip when showSkip false', (tester) async {
      bool ctaTapped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            heroIcon: HugeIcons.strokeRoundedPrinter,
            title: "Let's print something.",
            body: "We'll walk you through your first order.",
            iconTiles: const [],
            ctaLabel: 'Show me how →',
            onCta: () => ctaTapped = true,
            onSkip: () {},
            showSkip: false,
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text("Let's print something."), findsOneWidget);
      expect(find.text("We'll walk you through your first order."), findsOneWidget);
      expect(find.text('Show me how →'), findsOneWidget);
      expect(find.text('Skip for now'), findsNothing);

      await tester.tap(find.text('Show me how →'));
      expect(ctaTapped, isTrue);
    });

    testWidgets('icon tile variant still renders tiles when heroIcon is null', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'Welcome',
            body: 'Body',
            iconTiles: const [
              FeatureIconTile(icon: HugeIcons.strokeRoundedPrinter, label: 'Order'),
              FeatureIconTile(icon: HugeIcons.strokeRoundedLocation01, label: 'Track'),
              FeatureIconTile(icon: HugeIcons.strokeRoundedMessage01, label: 'Chat'),
            ],
            ctaLabel: 'Got it',
            onCta: () {},
            onSkip: () {},
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Order'), findsOneWidget);
      expect(find.text('Track'), findsOneWidget);
      expect(find.text('Chat'), findsOneWidget);
    });

    testWidgets('Skip for now visible when showSkip is true (default)', (tester) async {
      bool skipped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'T', body: 'B',
            iconTiles: const [],
            ctaLabel: 'Got it',
            onCta: () {},
            onSkip: () => skipped = true,
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.text('Skip for now'));
      expect(skipped, isTrue);
    });
  });
}
