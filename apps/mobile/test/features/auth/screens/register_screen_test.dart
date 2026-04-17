import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/screens/register_screen.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

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
    testWidgets('renders only credential fields on the first signup step',
        (tester) async {
      await tester.pumpWidget(_wrap(const RegisterScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Confirm Password'), findsOneWidget);
      expect(find.byType(AppButton), findsOneWidget);
      expect(find.text('Tell us a bit about yourself'), findsNothing);
      expect(find.text('Student'), findsNothing);
      expect(find.text('Professional'), findsNothing);
    });
  });
}
