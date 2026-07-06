import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/widgets/age_range_selector.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.dark),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

void main() {
  group('AgeRangeSelector', () {
    testWidgets('renders every age range option', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      await tester.pump();

      expect(find.text('Under 18'), findsOneWidget);
      expect(find.text('18–24'), findsOneWidget);
      expect(find.text('25–34'), findsOneWidget);
      expect(find.text('35–44'), findsOneWidget);
      expect(find.text('45+'), findsOneWidget);
    });

    testWidgets('renders SVG illustration for visible cards', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      await tester.pump();
      // Each rendered card shows one SvgPicture age illustration
      expect(find.byType(SvgPicture), findsWidgets);
    });

    testWidgets('pre-selected value marks the matching card', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: '25_34', onChanged: (_) {})),
      );
      await tester.pump();

      final selectedCard = tester.widget<AnimatedContainer>(
        find
            .descendant(
              of: find.byKey(const ValueKey('age-range-25_34')),
              matching: find.byType(AnimatedContainer),
            )
            .first,
      );
      final decoration = selectedCard.decoration! as BoxDecoration;
      expect(decoration.border, isNotNull);
    });

    testWidgets('fires onChanged with correct value when an option is tapped', (
      tester,
    ) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (v) => selected = v)),
      );
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey('age-range-18_24')));
      await tester.pump();

      expect(selected, equals('18_24'));
    });
  });
}
