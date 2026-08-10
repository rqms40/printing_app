import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/category_screen.dart';

void main() {
  testWidgets('shows four group cards with exact copy and product counts', (
    tester,
  ) async {
    await _pumpCategory(tester);

    expect(find.text('Marketing & Promotional Collateral'), findsOneWidget);
    expect(
      find.text(
        'Best for businesses, startups, and events looking to promote services or distribute physical marketing material.',
      ),
      findsOneWidget,
    );
    expect(find.text('6 products'), findsOneWidget);
    expect(find.text('4 products'), findsNWidgets(2));
    expect(find.text('3 products'), findsOneWidget);
    expect(find.text('Paper Printing'), findsNothing);
    expect(find.text('3D Printing'), findsNothing);
  });

  testWidgets('group cards are semantic buttons with at least 44px targets', (
    tester,
  ) async {
    await _pumpCategory(tester);

    final card = find.byKey(const ValueKey('catalog-group-marketing-promo'));
    expect(card, findsOneWidget);
    final semantics = tester.getSemantics(card);
    expect(semantics.hasFlag(SemanticsFlag.isButton), isTrue);
    expect(tester.getSize(card).height, greaterThanOrEqualTo(44));
    expect(tester.getSize(card).width, greaterThanOrEqualTo(44));
  });

  testWidgets('failed catalog shows browse warning and retry recovers', (
    tester,
  ) async {
    var shouldFail = true;
    final container = ProviderContainer(
      overrides: [
        productCatalogLoaderProvider.overrideWithValue(() async {
          if (shouldFail) throw StateError('offline');
          return _snapshotWire();
        }),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(theme: AppTheme.light, home: const CategoryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('saved catalog'), findsOneWidget);
    expect(container.read(productCatalogProvider).canSubmit, isFalse);

    shouldFail = false;
    await tester.tap(find.widgetWithText(TextButton, 'Retry'));
    await tester.pumpAndSettle();

    expect(find.textContaining('saved catalog'), findsNothing);
    expect(container.read(productCatalogProvider).canSubmit, isTrue);
  });

  testWidgets('group browsing renders in light and dark themes', (
    tester,
  ) async {
    for (final theme in [AppTheme.light, AppTheme.dark]) {
      await _pumpCategory(tester, theme: theme);
      expect(find.text('Browse by product group'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('shows Add to your order and skip action in add mode', (
    tester,
  ) async {
    await _pumpCategory(tester, addMode: true);
    expect(find.text('Add to your order'), findsOneWidget);
    expect(find.text('Skip — review checkout'), findsOneWidget);
  });
}

Future<void> _pumpCategory(
  WidgetTester tester, {
  ThemeData? theme,
  bool addMode = false,
}) async {
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final container = ProviderContainer(
    overrides: [
      productCatalogLoaderProvider.overrideWithValue(
        () async => _snapshotWire(),
      ),
    ],
  );
  addTearDown(container.dispose);
  final router = GoRouter(
    initialLocation: '/customer/order/new',
    routes: [
      GoRoute(
        path: '/customer/order/new',
        builder: (_, _) => CategoryScreen(addMode: addMode),
      ),
      GoRoute(
        path: '/customer/order/groups/:groupSlug',
        builder: (_, state) => Text(state.pathParameters['groupSlug']!),
      ),
      GoRoute(
        path: '/customer/order/checkout',
        builder: (_, _) => const Text('Checkout'),
      ),
    ],
  );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: theme ?? AppTheme.light,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Map<String, dynamic> _snapshotWire() {
  final snapshot = ProductCatalog.v110Snapshot();
  return {
    'version': snapshot.version,
    'groups': snapshot.activeGroups
        .map(
          (group) => {
            'slug': group.slug,
            'name': group.name,
            'description': group.description,
            'sortOrder': group.sortOrder,
            'products': group.products.map(_productWire).toList(),
          },
        )
        .toList(),
  };
}

Map<String, dynamic> _productWire(ProductCategory product) => {
  'id': product.id,
  'name': product.name,
  'slug': product.slug,
  'description': product.description,
  'mobileDescription': product.mobileDescription,
  'examples': product.examples,
  'fileProcessingType': product.fileProcessingType,
  'pricingModel': product.pricingModel,
  'pricingStatus': product.pricingStatus,
  'baseRate': product.baseRate,
  'quantityUnit': product.quantityUnit,
  'maxFileSizeMb': product.maxFileSizeMb,
  'allowedExtensions': product.allowedExtensions,
  'isActive': product.isActive,
  'sortOrder': product.sortOrder,
  'specs': const [],
};
