import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/widgets/gender_identity_selector.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.dark),
    home: Scaffold(body: child),
  );
}

void main() {
  group('GenderIdentitySelector', () {
    testWidgets('renders Male, Female, and Prefer not to say options',
        (tester) async {
      await tester.pumpWidget(
        _wrap(GenderIdentitySelector(value: null, onChanged: (_) {})),
      );
      expect(find.text('Male'), findsOneWidget);
      expect(find.text('Female'), findsOneWidget);
      expect(find.text('Prefer not to say'), findsOneWidget);
    });

    testWidgets('fires onChanged with Male when Male card is tapped',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(
          GenderIdentitySelector(
            value: null,
            onChanged: (v) => selected = v,
          ),
        ),
      );
      await tester.tap(find.text('Male'));
      expect(selected, equals('Male'));
    });

    testWidgets('fires onChanged with Prefer not to say when button tapped',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(
          GenderIdentitySelector(
            value: null,
            onChanged: (v) => selected = v,
          ),
        ),
      );
      await tester.tap(find.text('Prefer not to say'));
      expect(selected, equals('Prefer not to say'));
    });

    testWidgets('selected Male card uses accentOnColor text (black on yellow)',
        (tester) async {
      await tester.pumpWidget(
        _wrap(GenderIdentitySelector(value: 'Male', onChanged: (_) {})),
      );
      await tester.pump();
      final maleText = tester.widget<Text>(find.text('Male'));
      expect(maleText.style?.color, equals(AppColors.dark.accentOnColor));
    });
  });
}
