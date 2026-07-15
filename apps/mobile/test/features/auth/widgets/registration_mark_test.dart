import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/widgets/registration_mark.dart';

void main() {
  testWidgets('renders one mark per step and announces position', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: RegistrationMarkRow(total: 5, completed: 1, current: 1),
        ),
      ),
    );

    expect(
      find.descendant(
        of: find.byType(RegistrationMarkRow),
        matching: find.byType(CustomPaint),
      ),
      findsNWidgets(5),
    );
    expect(find.bySemanticsLabel('Step 2 of 5'), findsOneWidget);
  });
}
