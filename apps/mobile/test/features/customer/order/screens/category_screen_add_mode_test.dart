import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/category_screen.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';

void main() {
  testWidgets('shows "Add to your order" + Skip when addMode=true', (
    tester,
  ) async {
    final container = ProviderContainer();
    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'a',
            category: 'paper',
            fileName: 'a.pdf',
            filePath: '/tmp/a.pdf',
            fileSize: 1,
            fileMetadataId: 1,
            quantity: 1,
            pageCount: 1,
            printSubtotal: 100,
            createdAt: DateTime.now(),
          ),
        );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: CategoryScreen(addMode: true)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Add to your order'), findsOneWidget);
    expect(find.text('Skip — review checkout'), findsOneWidget);
  });

  testWidgets('waits for catalog load before showing category coach mark', (
    tester,
  ) async {
    final catalogCompleter = Completer<ProductCatalog>();
    final container = ProviderContainer(
      overrides: [
        productCatalogProvider.overrideWith((ref) => catalogCompleter.future),
      ],
    );
    addTearDown(container.dispose);

    container.read(pipelineTutorialProvider.notifier)
      ..start()
      ..advance();

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: CategoryScreen()),
      ),
    );

    await tester.pump(const Duration(milliseconds: 700));
    expect(
      find.text(
        'Pick Paper Printing for documents, photos, and posters.',
        skipOffstage: false,
      ),
      findsNothing,
    );

    catalogCompleter.complete(ProductCatalog.fallback());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();

    expect(
      find.text(
        'Pick Paper Printing for documents, photos, and posters.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
  });
}
