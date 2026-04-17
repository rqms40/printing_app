import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/screens/register_screen.dart';

Widget _wrap(Widget child) {
  return ProviderScope(
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('RegisterScreen', () {
    testWidgets('renders the role picker and student niches', (tester) async {
      await tester.pumpWidget(_wrap(const RegisterScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Tell us a bit about yourself'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Professional'), findsOneWidget);

      await tester.tap(find.text('Student'));
      await tester.pumpAndSettle();

      expect(find.text('What are you studying?'), findsOneWidget);
      expect(find.text('Architecture'), findsOneWidget);
      expect(find.text('Engineering'), findsOneWidget);
      expect(find.text('Medical / Nursing'), findsOneWidget);
      expect(find.text('Law / Arts / Others'), findsOneWidget);
    });

    testWidgets('switches to professional fields when selected', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const RegisterScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Professional'));
      await tester.pumpAndSettle();

      expect(find.text('What is your field?'), findsOneWidget);
      expect(find.text('Architect / Designer'), findsOneWidget);
      expect(find.text('Engineer / Contractor'), findsOneWidget);
      expect(find.text('Medical Professional'), findsOneWidget);
      expect(find.text('Business / Corporate'), findsOneWidget);
    });
  });
}
