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

    testWidgets('dev bypass buttons are visible (Customer, Rider, Admin)',
        (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('DEV LOGIN'), findsOneWidget);
      expect(find.text('Customer'), findsOneWidget);
      expect(find.text('Rider'), findsOneWidget);
      expect(find.text('Admin'), findsOneWidget);
    });

    testWidgets('renders "Create one" navigation text', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // The text lives inside a Text.rich with spans, so use textContaining.
      expect(
        find.textContaining("Don't have an account?"),
        findsOneWidget,
      );
    });

    testWidgets('renders "Forgot password?" link', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Forgot password?'), findsOneWidget);
    });
  });
}
