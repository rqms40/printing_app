import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/screens/login_screen.dart';

/// Wraps a widget in a minimal MaterialApp with ProviderScope for testing.
Widget _wrap(Widget child) {
  return ProviderScope(
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('LoginScreen', () {
    testWidgets('renders "Welcome back" heading', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('renders email and password fields', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
    });

    testWidgets('renders Sign In button', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Sign In'), findsOneWidget);
    });

    testWidgets('dev bypass controls are hidden by default', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('DEV LOGIN'), findsNothing);
      expect(find.text('Customer'), findsNothing);
      expect(find.text('Rider'), findsNothing);
      expect(find.text('Admin'), findsNothing);
    });

    testWidgets('renders "Create one" navigation text', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // The text lives inside a Text.rich with spans, so use textContaining.
      expect(find.textContaining("Don't have an account?"), findsOneWidget);
    });

    testWidgets('renders "Forgot password?" link', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Forgot password?'), findsOneWidget);
    });

    testWidgets('toggles password visibility with the eye icon', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      final passwordField = find.byType(TextField).at(1);

      expect(tester.widget<TextField>(passwordField).obscureText, isTrue);
      expect(find.byIcon(Icons.visibility_rounded), findsOneWidget);

      await tester.tap(
        find.ancestor(
          of: find.byIcon(Icons.visibility_rounded),
          matching: find.byType(InkWell),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      expect(tester.widget<TextField>(passwordField).obscureText, isFalse);
      expect(find.byIcon(Icons.visibility_off_rounded), findsOneWidget);

      await tester.tap(
        find.ancestor(
          of: find.byIcon(Icons.visibility_off_rounded),
          matching: find.byType(InkWell),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      expect(tester.widget<TextField>(passwordField).obscureText, isTrue);
      expect(find.byIcon(Icons.visibility_rounded), findsOneWidget);
    });
  });
}
