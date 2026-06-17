import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';

void main() {
  testWidgets('renders GRIDGO once with only GO in yellow', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: HeroBanner(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    final wordmarkFinder = find.byWidgetPredicate(
      (widget) =>
          widget is RichText && widget.text.toPlainText() == 'GRIDGO',
    );

    expect(wordmarkFinder, findsOneWidget);

    final wordmark = tester.widget<RichText>(wordmarkFinder);
    final spans = _flattenTextSpans(wordmark.text as TextSpan);

    expect(spans.map((span) => span.text).join(), 'GRIDGO');
    expect(spans.last.text, 'GO');
    expect(spans.last.style?.color, const Color(0xFFFFDE58));
  });
}

List<TextSpan> _flattenTextSpans(TextSpan span) {
  final result = <TextSpan>[];

  if (span.text != null) {
    result.add(span);
  }

  for (final child in span.children ?? const <InlineSpan>[]) {
    if (child is TextSpan) {
      result.addAll(_flattenTextSpans(child));
    }
  }

  return result;
}
