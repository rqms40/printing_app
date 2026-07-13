import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/screens/beta_success_wall_screen.dart';

void main() {
  testWidgets('shows GRID Community CTA on the beta success wall', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: BetaSuccessWallScreen())),
    );

    await tester.pump();

    expect(find.text('Join GRID Community'), findsOneWidget);
    expect(
      find.textContaining('updates, feedback, and launch perks'),
      findsOneWidget,
    );
  });

  testWidgets('presents photo upload as a required beta completion step', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: BetaSuccessWallScreen())),
    );
    await tester.pump();

    expect(
      find.text('Add a photo of your prints to complete beta testing.'),
      findsOneWidget,
    );
    expect(find.text('Skip for now'), findsNothing);
  });

  testWidgets('does not expose decorative artwork as an unnamed image', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: BetaSuccessWallScreen())),
    );
    await tester.pump();

    final root = tester.getSemantics(find.byType(BetaSuccessWallScreen));
    final unnamedImages = _semanticsTree(root).where((node) {
      final data = node.getSemanticsData();
      return data.flagsCollection.isImage && data.label.trim().isEmpty;
    });

    expect(unnamedImages, isEmpty);
    semantics.dispose();
  });
}

Iterable<SemanticsNode> _semanticsTree(SemanticsNode node) sync* {
  yield node;
  final children = <SemanticsNode>[];
  node.visitChildren((child) {
    children.add(child);
    return true;
  });
  for (final child in children) {
    yield* _semanticsTree(child);
  }
}
