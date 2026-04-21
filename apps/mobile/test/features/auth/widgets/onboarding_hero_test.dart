import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/widgets/onboarding_hero.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.dark}) {
  return MaterialApp(
    theme: ThemeData(brightness: brightness),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

void main() {
  group('OnboardingHero', () {
    testWidgets('renders headline text', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.verified_user_rounded,
            headline: 'Your data, your rules.',
          ),
        ),
      );
      expect(find.text('Your data, your rules.'), findsOneWidget);
    });

    testWidgets('renders subtitle when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.verified_user_rounded,
            headline: 'Test headline',
            subtitle: 'Test subtitle',
          ),
        ),
      );
      expect(find.text('Test subtitle'), findsOneWidget);
    });

    testWidgets('omits subtitle widget when subtitle is empty', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.school_rounded,
            headline: 'Just a headline',
          ),
        ),
      );
      // Only the headline Text renders; no subtitle Text
      expect(find.byType(Text), findsOneWidget);
    });

    testWidgets('icon uses brand color in dark mode', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.verified_user_rounded,
            headline: 'Test',
          ),
        ),
      );
      final icon = tester.widget<Icon>(find.byType(Icon).first);
      expect(icon.color, equals(AppColors.dark.brand));
    });
  });
}
