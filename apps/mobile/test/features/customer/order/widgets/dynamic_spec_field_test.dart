import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/widgets/dynamic_spec_field.dart';

void main() {
  Widget host(ProductSpecDefinition spec, ValueChanged<dynamic> onChanged) =>
      MaterialApp(
        home: Scaffold(
          body: DynamicSpecField(
            definition: spec,
            value: spec.defaultSelection,
            onChanged: onChanged,
          ),
        ),
      );

  testWidgets('renders API select label, help, options, and default', (
    tester,
  ) async {
    dynamic changed;
    const spec = ProductSpecDefinition.select(
      id: 1,
      categoryId: 2,
      key: 'stock',
      label: 'Stock / material',
      helpText: 'Choose the substrate supplied by Operations.',
      pricingRole: 'none',
      sortOrder: 1,
      options: [
        ProductSpecOption(label: 'Matte 120 gsm', value: 'matte'),
        ProductSpecOption(
          label: 'Gloss 150 gsm',
          value: 'gloss',
          isDefault: true,
        ),
      ],
    );

    await tester.pumpWidget(host(spec, (value) => changed = value));

    expect(find.text('Stock / material *'), findsOneWidget);
    expect(
      find.text('Choose the substrate supplied by Operations.'),
      findsOneWidget,
    );
    expect(find.text('Gloss 150 gsm'), findsOneWidget);
    await tester.tap(find.text('Gloss 150 gsm'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Matte 120 gsm').last);
    await tester.pump();
    expect(changed, 'matte');
  });

  testWidgets('renders number bounds, boolean, and required text validation', (
    tester,
  ) async {
    const number = ProductSpecDefinition(
      id: 1,
      categoryId: 2,
      key: 'copies',
      label: 'Copy count',
      inputType: 'number',
      valueType: 'number',
      isRequired: true,
      pricingRole: 'none',
      minValue: 2,
      maxValue: 10,
      sortOrder: 1,
    );
    await tester.pumpWidget(host(number, (_) {}));
    final numberField = tester.widget<TextFormField>(
      find.byType(TextFormField),
    );
    expect(numberField.validator?.call('1'), 'Minimum is 2');
    expect(numberField.validator?.call('11'), 'Maximum is 10');
    expect(numberField.validator?.call('5'), isNull);

    const boolean = ProductSpecDefinition(
      id: 2,
      categoryId: 2,
      key: 'food_grade',
      label: 'Food grade',
      inputType: 'boolean',
      valueType: 'boolean',
      pricingRole: 'none',
      sortOrder: 2,
    );
    await tester.pumpWidget(host(boolean, (_) {}));
    expect(find.byType(DropdownButtonFormField<bool>), findsOneWidget);

    const text = ProductSpecDefinition(
      id: 3,
      categoryId: 2,
      key: 'finish',
      label: 'Finish',
      inputType: 'text',
      valueType: 'string',
      isRequired: true,
      pricingRole: 'none',
      sortOrder: 3,
    );
    await tester.pumpWidget(host(text, (_) {}));
    final textField = tester.widget<TextFormField>(find.byType(TextFormField));
    expect(textField.validator?.call('  '), 'Finish is required');
  });

  testWidgets('required sides and food-grade values stay unset until chosen', (
    tester,
  ) async {
    dynamic changed;
    final snapshotSpecs = ProductCatalog.v110Snapshot().categories.expand(
      (item) => item.specs,
    );
    final sides = snapshotSpecs.firstWhere((spec) => spec.key == 'sides');
    await tester.pumpWidget(host(sides, (value) => changed = value));
    final sidesField = tester.widget<TextFormField>(find.byType(TextFormField));
    expect(sides.defaultSelection, isNull);
    expect(sidesField.initialValue, isEmpty);
    expect(sidesField.validator?.call(''), 'Sides is required');

    final foodGrade = snapshotSpecs.firstWhere(
      (spec) => spec.key == 'food_grade_requirement',
    );
    await tester.pumpWidget(host(foodGrade, (value) => changed = value));
    final booleanField = tester.widget<DropdownButtonFormField<bool>>(
      find.byType(DropdownButtonFormField<bool>),
    );
    expect(foodGrade.defaultSelection, isNull);
    expect(booleanField.initialValue, isNull);
    expect(
      booleanField.validator?.call(null),
      'Food-grade requirement is required',
    );
    await tester.tap(find.text('Food-grade requirement *'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No').last);
    await tester.pumpAndSettle();
    expect(changed, isFalse);
    expect(find.text('No'), findsOneWidget);
  });
}
