import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/repositories/ruler_scale_preferences.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/shared/widgets/ruler_overlay.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('preset selection applies its 1:N scale immediately', (
    tester,
  ) async {
    int? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetricScalePicker(
            initialDenominator: 100,
            onSelected: (value) => selected = value,
          ),
        ),
      ),
    );

    expect(find.text('1:100'), findsOneWidget);
    await tester.tap(find.text('1:50'));
    await tester.pump();

    expect(selected, 50);
  });

  testWidgets('custom scale rejects malformed and non-positive values', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetricScalePicker(initialDenominator: 100, onSelected: (_) {}),
        ),
      ),
    );

    await tester.tap(find.text('Custom'));
    await tester.pump();

    for (final invalid in ['', '10.5', 'abc', '0', '-20']) {
      await tester.enterText(find.byType(TextField), invalid);
      await tester.tap(find.text('Apply'));
      await tester.pump();
      expect(find.text('Enter a positive whole number'), findsOneWidget);
    }
  });

  testWidgets('custom scale applies a valid 1:N value', (tester) async {
    int? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetricScalePicker(
            initialDenominator: 100,
            onSelected: (value) => selected = value,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Custom'));
    await tester.pump();
    await tester.enterText(find.byType(TextField), '150');
    await tester.tap(find.text('Apply'));
    await tester.pump();

    expect(selected, 150);
  });

  testWidgets('custom scale rejects denominators beyond the supported range', (
    tester,
  ) async {
    int? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetricScalePicker(
            initialDenominator: 100,
            onSelected: (value) => selected = value,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Custom'));
    await tester.pump();
    await tester.enterText(
      find.byType(TextField),
      '${kMaxMetricScaleDenominator + 1}',
    );
    await tester.tap(find.text('Apply'));
    await tester.pump();

    expect(selected, isNull);
    expect(
      find.text('Enter a scale between 1:1 and 1:$kMaxMetricScaleDenominator'),
      findsOneWidget,
    );
  });

  testWidgets('custom scale accepts the maximum supported denominator', (
    tester,
  ) async {
    int? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetricScalePicker(
            initialDenominator: 100,
            onSelected: (value) => selected = value,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Custom'));
    await tester.pump();
    await tester.enterText(
      find.byType(TextField),
      '$kMaxMetricScaleDenominator',
    );
    await tester.tap(find.text('Apply'));
    await tester.pump();

    expect(selected, kMaxMetricScaleDenominator);
  });

  test('restores independent metric scales for distinct accounts', () async {
    SharedPreferences.setMockInitialValues({});
    final repository = RulerScalePreferences();

    expect(await repository.load('user-a'), 100);
    await repository.save('user-a', 50);
    await repository.save('user-b', 125);

    expect(await repository.load('user-a'), 50);
    expect(await repository.load('user-b'), 125);
    expect(await repository.load(null), 100);
  });

  test('ignores an out-of-range persisted denominator', () async {
    SharedPreferences.setMockInitialValues({
      'ruler_metric_scale_denominator_user-a': kMaxMetricScaleDenominator + 1,
    });
    final repository = RulerScalePreferences();

    expect(await repository.load('user-a'), RulerScalePreferences.defaultDenominator);

    await repository.save('user-b', kMaxMetricScaleDenominator + 1);
    expect(await repository.load('user-b'), RulerScalePreferences.defaultDenominator);
  });
}
