import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/icon_container.dart';

void main() {
  testWidgets('treats the empty-state icon as decorative', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EmptyState(
            heading: 'No active delivery',
            body: 'Accept an assignment to start live navigation.',
            icon: HugeIcons.strokeRoundedDeliveryTruck02,
          ),
        ),
      ),
    );

    expect(
      find.ancestor(
        of: find.byType(IconContainer),
        matching: find.byType(ExcludeSemantics),
      ),
      findsOneWidget,
    );
  });
}
