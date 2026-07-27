import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/repositories/ruler_scale_preferences.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
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
}
