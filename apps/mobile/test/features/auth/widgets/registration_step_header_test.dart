import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/widgets/registration_step_header.dart';

void main() {
  testWidgets('shows the plate coordinate, label, and title', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: RegistrationStepHeader(
            index: 1,
            total: 5,
            plateLabel: 'ACCOUNT',
            title: 'Set up your account',
          ),
        ),
      ),
    );

    expect(find.text('PLATE 02 / 05 · ACCOUNT'), findsOneWidget);
    expect(find.text('Set up your account'), findsOneWidget);
    expect(find.bySemanticsLabel('Step 2 of 5'), findsOneWidget);
  });
}
