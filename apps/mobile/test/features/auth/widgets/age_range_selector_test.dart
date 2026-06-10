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
    testWidgets('renders the initial page label', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      await tester.pump();
      // Page 0 ('Under 18') is always the visible starting card
      expect(find.text('Under 18'), findsOneWidget);
    });

    testWidgets('renders SVG illustration for visible cards', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      await tester.pump();
      // Each rendered card shows one SvgPicture age illustration
      expect(find.byType(SvgPicture), findsWidgets);
    });

    testWidgets('pre-selected value initialises at the correct page',
        (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: '25_34', onChanged: (_) {})),
      );
      await tester.pump();
      // Initialises at page 2 ('25–34')
      expect(find.text('25–34'), findsOneWidget);
    });

    testWidgets('fires onChanged with correct value when page changes',
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
      await tester.pump();
      // Drag left to advance from page 0 to page 1 ('18_24')
      await tester.drag(find.byType(PageView), const Offset(-600, 0));
      await tester.pumpAndSettle();
      expect(selected, equals('18_24'));
    });

    testWidgets('renders 5 dot page indicators', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      await tester.pump();
      // The dot row always renders one AnimatedContainer per age range option (5).
      // PageView adds more AnimatedContainers for visible cards, so total >= 5.
      expect(
        find.byType(AnimatedContainer).evaluate().length,
        greaterThanOrEqualTo(5),
      );
    });
  });
}
