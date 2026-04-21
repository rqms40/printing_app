import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/widgets/age_range_selector.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.dark),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

void main() {
  group('AgeRangeSelector', () {
    testWidgets('renders all 5 age range labels', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      expect(find.text('Under 18'), findsOneWidget);
      expect(find.text('18–24'), findsOneWidget);
      expect(find.text('25–34'), findsOneWidget);
      expect(find.text('35–44'), findsOneWidget);
      expect(find.text('45+'), findsOneWidget);
    });

    testWidgets('renders emoji for each card', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      expect(find.text('🎒'), findsOneWidget);
      expect(find.text('🎓'), findsOneWidget);
      expect(find.text('🚀'), findsOneWidget);
      expect(find.text('💼'), findsOneWidget);
      expect(find.text('🌟'), findsOneWidget);
    });

    testWidgets('selected card uses brand text color (accentOnColor)',
        (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: '25_34', onChanged: (_) {})),
      );
      await tester.pump();
      final selectedText = tester.widget<Text>(find.text('25–34'));
      expect(selectedText.style?.color, equals(AppColors.dark.accentOnColor));
    });

    testWidgets('fires onChanged with correct value when tapped',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(
          AgeRangeSelector(
            value: null,
            onChanged: (v) => selected = v,
          ),
        ),
      );
      await tester.tap(find.text('18–24'));
      expect(selected, equals('18_24'));
    });

    testWidgets('renders 5 page dot AnimatedContainer indicators', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      // 5 dots rendered as AnimatedContainer widgets in the dot row
      // The scroll row also uses AnimatedContainer for cards (5 cards)
      // Total AnimatedContainers = 5 (cards) + 5 (dots) = 10
      // We verify by checking the dot row exists with the right structure
      expect(find.byType(AnimatedContainer), findsNWidgets(10));
    });
  });
}
