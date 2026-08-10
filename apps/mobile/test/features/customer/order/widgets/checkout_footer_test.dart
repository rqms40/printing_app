import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_footer.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('delivery cannot be placed without saved or temporary address', (
    tester,
  ) async {
    var placed = 0;
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(checkoutProvider.notifier);
    notifier.addItem(_item('a'));
    notifier.setPaymentMethod(PaymentMethod.cod);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: const SizedBox(),
            bottomNavigationBar: CheckoutFooter(onPlaceOrder: () => placed++),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Place Order'));
    await tester.pump();

    expect(placed, 0);
  });

  testWidgets('delivery can be placed with a valid temporary pinned address', (
    tester,
  ) async {
    var placed = 0;
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(checkoutProvider.notifier);
    notifier.addItem(_item('a'));
    notifier.setPaymentMethod(PaymentMethod.cod);
    notifier.setTemporaryAddress(
      const TemporaryCheckoutAddress(
        fullAddress: 'Unit 12, Jacinto Extension, Davao City',
        city: 'Davao City',
        latitude: 7.0731,
        longitude: 125.6128,
      ),
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: const SizedBox(),
            bottomNavigationBar: CheckoutFooter(onPlaceOrder: () => placed++),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Place Order'));
    await tester.pump();

    expect(placed, 1);
  });

  testWidgets('multidrop cannot be placed until every drop has a destination', (
    tester,
  ) async {
    var placed = 0;
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(checkoutProvider.notifier);
    notifier.addItem(_item('a'));
    notifier.setPaymentMethod(PaymentMethod.cod);
    notifier.setMode(DeliveryMode.multidrop);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: const SizedBox(),
            bottomNavigationBar: CheckoutFooter(onPlaceOrder: () => placed++),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Place Order'));
    await tester.pump();

    expect(placed, 0);
  });

  testWidgets('multidrop can be placed with saved and temporary destinations', (
    tester,
  ) async {
    var placed = 0;
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(checkoutProvider.notifier);
    notifier.addItem(_item('a'));
    notifier.setPaymentMethod(PaymentMethod.cod);
    notifier.setMode(DeliveryMode.multidrop);
    notifier.setDrops([
      const DestinationGroup(
        id: 'drop-1',
        label: 'Home',
        itemIds: [],
        addressId: 10,
      ),
      const DestinationGroup(
        id: 'drop-2',
        label: 'Drop 2',
        itemIds: [],
        temporaryAddress: TemporaryCheckoutAddress(
          fullAddress: 'SMX Booth A12, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        ),
      ),
    ]);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: const SizedBox(),
            bottomNavigationBar: CheckoutFooter(onPlaceOrder: () => placed++),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Place Order'));
    await tester.pump();

    expect(placed, 1);
  });

  testWidgets('RFQ footer fails closed without current catalog authority', (
    tester,
  ) async {
    var submitted = 0;
    final container = ProviderContainer(
      overrides: [
        productCatalogLoaderProvider.overrideWithValue(
          () async => throw StateError('offline'),
        ),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_rfqItem())
      ..setMode(DeliveryMode.pickup);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: const SizedBox(),
            bottomNavigationBar: CheckoutFooter(
              onPlaceOrder: () => submitted++,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Submit quote request'));
    await tester.pump();

    expect(submitted, 0);
    expect(
      find.text('Refresh the catalog to submit this request.'),
      findsOneWidget,
    );
  });
}

CartItem _item(String id) => CartItem(
  id: id,
  category: 'paper',
  fileName: '$id.pdf',
  filePath: '/tmp/$id.pdf',
  fileSize: 1024,
  fileMetadataId: 1,
  quantity: 1,
  pageCount: 1,
  printSubtotal: 100,
  createdAt: DateTime.now(),
);

CartItem _rfqItem() => CartItem(
  id: 'rfq',
  category: 'flyers',
  productSlug: 'flyers',
  quoteRequired: true,
  requiredDate: DateTime(2099, 12, 31),
  catalogServerBacked: true,
  fileName: 'art.pdf',
  fileMetadataId: 4,
  specs: const {'stock': 'matte'},
  quantity: 1,
  pageCount: 1,
  createdAt: DateTime(2026),
);
