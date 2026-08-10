import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';

void main() {
  test(
    'failed API keeps exact snapshot browseable but submission unauthorized',
    () async {
      final container = ProviderContainer(
        overrides: [
          productCatalogLoaderProvider.overrideWithValue(
            () async => throw StateError('offline'),
          ),
        ],
      );
      addTearDown(container.dispose);

      await _waitForLoad(container);
      final state = container.read(productCatalogProvider);

      expect(state.catalog.activeGroups.length, 4);
      expect(state.catalog.activeGroups.expand((g) => g.products).length, 17);
      expect(state.error, isA<StateError>());
      expect(state.isServerBacked, isFalse);
      expect(state.canSubmit, isFalse);
    },
  );

  test('successful server catalog is the only submission authority', () async {
    final container = ProviderContainer(
      overrides: [
        productCatalogLoaderProvider.overrideWithValue(
          () async => _serverCatalog('Server Flyers'),
        ),
      ],
    );
    addTearDown(container.dispose);

    await _waitForLoad(container);
    final state = container.read(productCatalogProvider);

    expect(state.catalog.productBySlug('flyers')?.name, 'Server Flyers');
    expect(state.error, isNull);
    expect(state.isServerBacked, isTrue);
    expect(state.canSubmit, isTrue);
  });

  test(
    'retry replaces warning snapshot with current server authority',
    () async {
      var attempts = 0;
      final container = ProviderContainer(
        overrides: [
          productCatalogLoaderProvider.overrideWithValue(() async {
            attempts++;
            if (attempts == 1) throw StateError('offline');
            return _serverCatalog('Fresh Flyers');
          }),
        ],
      );
      addTearDown(container.dispose);

      await _waitForLoad(container);
      expect(container.read(productCatalogProvider).canSubmit, isFalse);

      await container.read(productCatalogProvider.notifier).retry();

      final state = container.read(productCatalogProvider);
      expect(attempts, 2);
      expect(state.catalog.productBySlug('flyers')?.name, 'Fresh Flyers');
      expect(state.error, isNull);
      expect(state.canSubmit, isTrue);
    },
  );

  test('malformed success cannot authorize submission', () async {
    final container = ProviderContainer(
      overrides: [
        productCatalogLoaderProvider.overrideWithValue(
          () async => {'version': '1.10', 'groups': 'invalid'},
        ),
      ],
    );
    addTearDown(container.dispose);

    await _waitForLoad(container);
    final state = container.read(productCatalogProvider);

    expect(state.catalog.activeGroups.length, 4);
    expect(state.error, isA<FormatException>());
    expect(state.canSubmit, isFalse);
  });
}

Future<void> _waitForLoad(ProviderContainer container) async {
  if (!container.read(productCatalogProvider.notifier).isLoading) return;
  final completer = Completer<void>();
  late final ProviderSubscription<ProductCatalogState> subscription;
  subscription = container.listen<ProductCatalogState>(productCatalogProvider, (
    _,
    next,
  ) {
    if (!container.read(productCatalogProvider.notifier).isLoading &&
        !completer.isCompleted) {
      completer.complete();
    }
  }, fireImmediately: true);
  await completer.future;
  subscription.close();
}

Map<String, dynamic> _serverCatalog(String productName) {
  return {
    'version': '1.10',
    'groups': [
      {
        'slug': 'marketing-promo',
        'name': 'Marketing & Promotional Collateral',
        'description': 'Server-owned group',
        'sortOrder': 1,
        'products': [
          {
            'id': 1,
            'name': productName,
            'slug': 'flyers',
            'description': 'Server-owned product',
            'examples': ['Server example'],
            'fileProcessingType': 'document',
            'pricingModel': 'quote_required',
            'pricingStatus': 'pending_quote',
            'baseRate': null,
            'quantityUnit': 'copy',
            'maxFileSizeMb': 100,
            'allowedExtensions': ['pdf'],
            'isActive': true,
            'sortOrder': 1,
            'specs': const [],
          },
        ],
      },
    ],
  };
}
