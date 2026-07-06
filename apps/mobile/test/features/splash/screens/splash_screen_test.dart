import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/splash/screens/splash_screen.dart';

void main() {
  testWidgets('renders splash wordmark as GRID plus grey GO', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: SplashScreen(),
        ),
      ),
    );

    await tester.pump(const Duration(seconds: 2));

    final wordmarkFinder = find.byWidgetPredicate(
      (widget) => widget is RichText && widget.text.toPlainText() == 'GRIDGO',
    );

    expect(wordmarkFinder, findsOneWidget);

    final wordmark = tester.widget<RichText>(wordmarkFinder);
    final spans = _flattenTextSpans(wordmark.text as TextSpan);

    expect(spans.map((span) => span.text).join(), 'GRIDGO');
    expect(spans[0].text, 'GRID');
    expect(spans[0].style?.color, const Color(0xFF1E1E1E));
    expect(spans[1].text, 'GO');
    expect(spans[1].style?.color, Colors.grey);

    await tester.pumpWidget(const SizedBox.shrink());
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
