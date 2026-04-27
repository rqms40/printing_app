import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/widgets/ruler_overlay.dart';

void main() {
  testWidgets('RulerOverlay shows mm dimensions', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 300,
            height: 400,
            child: RulerOverlay(widthMm: 210, heightMm: 297),
          ),
        ),
      ),
    );
    expect(find.text('210mm × 297mm'), findsOneWidget);
  });
}
