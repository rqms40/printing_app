import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/catalog_requirements_screen.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';

void main() {
  test('strict required dates reject normalized impossible calendar dates', () {
    expect(parseStrictRequiredDate('2099-02-29'), isNull);
    expect(parseStrictRequiredDate('2099-13-01'), isNull);
    expect(parseStrictRequiredDate('2099-12-31'), DateTime(2099, 12, 31));
  });
  testWidgets('validates requirements then stores server-owned RFQ identity', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        productCatalogLoaderProvider.overrideWithValue(
          () async => _catalogWire(),
        ),
        orderFlowProvider.overrideWith(
          (ref) => OrderFlowNotifier(persistDraft: false),
        ),
      ],
    );
    addTearDown(container.dispose);
    final tutorial = container.read(pipelineTutorialProvider.notifier);
    tutorial.start();
    tutorial.advance();
    tutorial.advance();
    tutorial.advance();
    expect(
      container.read(pipelineTutorialProvider).step,
      PipelineStep.catalogRequirements,
    );
    final router = GoRouter(
      initialLocation: '/requirements',
      routes: [
        GoRoute(
          path: '/requirements',
          builder: (_, _) =>
              const CatalogRequirementsScreen(productSlug: 'flyers'),
        ),
        GoRoute(
          path: '/customer/order/upload',
          builder: (_, _) => const Text('Upload next'),
        ),
      ],
    );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Flyers requirements'), findsOneWidget);
    expect(find.text('Stock / material *'), findsOneWidget);
    expect(find.text('Quantity *'), findsOneWidget);
    expect(find.text('Required date *'), findsOneWidget);
    expect(find.text('Notes (optional)'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Continue to artwork'));
    await tester.pump();
    expect(find.text('Required date must be in the future'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('required-date-field')),
      '2099-12-31',
    );
    await tester.enterText(find.byKey(const ValueKey('quantity-field')), '25');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Continue to artwork'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Continue to artwork'));
    await tester.pump(const Duration(seconds: 1));

    final flow = container.read(orderFlowProvider);
    expect(flow.groupSlug, 'marketing-promo');
    expect(flow.productSlug, 'flyers');
    expect(flow.productName, 'Flyers');
    expect(flow.quoteRequired, isTrue);
    expect(flow.catalogServerBacked, isTrue);
    expect(flow.requiredDate, DateTime(2099, 12, 31));
    expect(flow.quantity, 25);
    expect(flow.specs, {'stock': 'matte'});
    expect(
      container.read(pipelineTutorialProvider).step,
      PipelineStep.uploadCard,
    );
  });
}

Map<String, dynamic> _catalogWire() => {
  'version': '1.10.0',
  'groups': [
    {
      'slug': 'marketing-promo',
      'name': 'Marketing',
      'description': 'Promo products',
      'sortOrder': 1,
      'products': [
        {
          'id': 1,
          'slug': 'flyers',
          'name': 'Flyers',
          'pricingModel': 'quote_required',
          'pricingStatus': 'pending_quote',
          'quantityUnit': 'copy',
          'maxFileSizeMb': 100,
          'allowedExtensions': ['pdf', 'png'],
          'isActive': true,
          'sortOrder': 1,
          'specs': [
            {
              'id': 2,
              'categoryId': 1,
              'key': 'stock',
              'label': 'Stock / material',
              'inputType': 'select',
              'valueType': 'string',
              'isRequired': true,
              'isActive': true,
              'pricingRole': 'none',
              'sortOrder': 1,
              'options': [
                {
                  'label': 'Matte',
                  'value': 'matte',
                  'isDefault': true,
                  'isActive': true,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
