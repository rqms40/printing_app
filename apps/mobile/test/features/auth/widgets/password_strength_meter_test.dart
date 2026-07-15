import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/widgets/password_strength_meter.dart';

void main() {
  test('scores password strength by length and composition', () {
    expect(scorePassword(''), PasswordStrength.empty);
    expect(scorePassword('abc'), PasswordStrength.weak);
    expect(scorePassword('abcdefgh'), PasswordStrength.fair);
    expect(scorePassword('abcd1234ef'), PasswordStrength.strong);
    expect(scorePassword('1234567890'), PasswordStrength.fair);
  });

  testWidgets('renders the strength label', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PasswordStrengthMeter(strength: PasswordStrength.strong),
        ),
      ),
    );
    expect(find.text('Strong'), findsOneWidget);
  });
}
