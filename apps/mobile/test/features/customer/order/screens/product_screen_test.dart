import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/product_screen.dart';

void main() {
  testWidgets(
    'shows exact leaves and supplied examples for the selected group',
    (tester) async {
      await _pumpProducts(tester);

      expect(find.text('Marketing & Promotional Collateral'), findsOneWidget);
      expect(find.text('Flyers'), findsOneWidget);
      expect(
        find.text('Single sheets • Event promos • Product announcements'),
        findsOneWidget,
      );
      expect(find.text('Tarpaulins & Outdoor Banners'), findsOneWidget);
      expect(find.textContaining('₱'), findsNothing);
      expect(find.textContaining('0.00'), findsNothing);
    },
  );

  testWidgets(
    'product card is accessible and navigates to generic requirements',
    (tester) async {
      final router = await _pumpProducts(tester);
      final card = find.byKey(const ValueKey('catalog-product-flyers'));

      final semantics = tester.getSemantics(card);
      expect(semantics.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(tester.getSize(card).height, greaterThanOrEqualTo(44));
      await tester.tap(
        find.descendant(of: card, matching: find.byType(InkWell)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Requirements: flyers'), findsOneWidget);
      expect(router.canPop(), isTrue);
    },
  );

  testWidgets('product browsing renders in light and dark themes', (
    tester,
  ) async {
    for (final theme in [AppTheme.light, AppTheme.dark]) {
      await _pumpProducts(tester, theme: theme);
      expect(find.text('Choose a product'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('unknown group offers a safe route back to catalog', (
    tester,
  ) async {
    await _pumpProducts(tester, groupSlug: 'missing');

    expect(find.text('Product group unavailable'), findsOneWidget);
    expect(
      find.widgetWithText(OutlinedButton, 'Back to catalog'),
      findsOneWidget,
    );
  });

  testWidgets('shows fallback warning when authority fails after navigation', (
    tester,
  ) async {
    await _pumpProducts(
      tester,
      loader: () async => throw StateError('offline'),
    );

    expect(find.textContaining('saved catalog'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Retry'), findsOneWidget);
    expect(find.text('Flyers'), findsOneWidget);
  });
}

Future<GoRouter> _pumpProducts(
  WidgetTester tester, {
  String groupSlug = 'marketing-promo',
  ThemeData? theme,
  ProductCatalogLoader? loader,
}) async {
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final container = ProviderContainer(
    overrides: [
      productCatalogLoaderProvider.overrideWithValue(
        loader ?? () async => _snapshotWire(),
      ),
    ],
  );
  addTearDown(container.dispose);
  final router = GoRouter(
    initialLocation: '/customer/order/groups/$groupSlug',
    routes: [
      GoRoute(
        path: '/customer/order/groups/:groupSlug',
        builder: (_, state) =>
            ProductScreen(groupSlug: state.pathParameters['groupSlug']!),
      ),
      GoRoute(
        path: '/customer/order/products/:productSlug/requirements',
        builder: (_, state) =>
            Text('Requirements: ${state.pathParameters['productSlug']}'),
      ),
      GoRoute(
        path: '/customer/order/new',
        builder: (_, _) => const Text('Catalog'),
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
  return router;
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
            'products': group.products
                .map(
                  (product) => {
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
                  },
                )
                .toList(),
          },
        )
        .toList(),
  };
}
