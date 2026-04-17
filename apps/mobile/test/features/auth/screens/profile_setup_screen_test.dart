import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/auth/screens/profile_setup_screen.dart';

Widget _wrap(Widget child) {
  return ProviderScope(
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('ProfileSetupScreen', () {
    testWidgets('renders profiling controls alongside identity fields', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const ProfileSetupScreen(
            draft: RegistrationDraft(
              email: 'new@test.com',
              password: 'password123',
            ),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Complete Your Profile'), findsOneWidget);
      expect(find.text('Full Name'), findsOneWidget);
      expect(find.text('Tell us a bit about yourself'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Professional'), findsOneWidget);
    });
  });
}
