import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

void main() {
  testWidgets('RFQ review exposes pending copy without payment or totals', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        productCatalogLoaderProvider.overrideWithValue(
          () async => _catalogWire(),
        ),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
        ordersProvider.overrideWith((_) => _RfqOrdersNotifier()),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_rfqItem())
      ..setMode(DeliveryMode.pickup);
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, _) => const CheckoutScreen())],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();

    expect(find.text('Price and turnaround pending review'), findsWidgets);
    expect(find.text('Stock: Matte'), findsOneWidget);
    expect(find.text('Payment method'), findsNothing);
    expect(find.text('Delivery options'), findsNothing);
    expect(find.text('Payment details'), findsNothing);
    expect(find.textContaining('₱0'), findsNothing);
    expect(find.text('Submit quote request'), findsOneWidget);
  });

  testWidgets('mixed priced and RFQ checkout remains visibly rejected', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final orders = _RecordingRfqOrdersNotifier();
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        productCatalogLoaderProvider.overrideWithValue(
          () async => _catalogWire(),
        ),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
        ordersProvider.overrideWith((_) => orders),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_rfqItem())
      ..addItem(_legacyItem())
      ..setMode(DeliveryMode.pickup);
    final router = _router();
    addTearDown(router.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit quote request'));
    await tester.pump();

    expect(
      find.text('Submit priced and quote-request items separately.'),
      findsOneWidget,
    );
    expect(orders.calls, 0);
  });

  testWidgets('RFQ success clears only items included in submitted snapshot', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final orders = _ControllableRfqOrdersNotifier();
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        productCatalogLoaderProvider.overrideWithValue(
          () async => _catalogWire(),
        ),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
        ordersProvider.overrideWith((_) => orders),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_rfqItem(id: 'submitted'))
      ..setMode(DeliveryMode.pickup);
    final router = _router();
    addTearDown(router.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit quote request'));
    await tester.pump();
    container.read(checkoutProvider.notifier).addItem(_rfqItem(id: 'new'));
    orders.complete();
    await tester.pumpAndSettle();

    expect(container.read(checkoutProvider).items.map((item) => item.id), [
      'new',
    ]);
  });

  testWidgets('RFQ API error preserves submitted checkout state', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        productCatalogLoaderProvider.overrideWithValue(
          () async => _catalogWire(),
        ),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
        ordersProvider.overrideWith((_) => _FailingRfqOrdersNotifier()),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_rfqItem(id: 'preserved'))
      ..setMode(DeliveryMode.pickup);
    final router = _router();
    addTearDown(router.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit quote request'));
    await tester.pumpAndSettle();

    expect(container.read(checkoutProvider).items.single.id, 'preserved');
    expect(find.text('Service unavailable'), findsOneWidget);
  });
}

class _RfqOrdersNotifier extends OrdersNotifier {
  _RfqOrdersNotifier() : super(skipBootstrap: true);
  @override
  Future<List<Order>> submitRfq(CheckoutState state) async => const [];
}

class _RecordingRfqOrdersNotifier extends OrdersNotifier {
  _RecordingRfqOrdersNotifier() : super(skipBootstrap: true);
  int calls = 0;

  @override
  Future<List<Order>> submitRfq(CheckoutState state) async {
    calls++;
    return const [];
  }
}

class _ControllableRfqOrdersNotifier extends OrdersNotifier {
  _ControllableRfqOrdersNotifier() : super(skipBootstrap: true);
  final _completer = Completer<List<Order>>();

  @override
  Future<List<Order>> submitRfq(CheckoutState state) => _completer.future;

  void complete() => _completer.complete(const []);
}

class _FailingRfqOrdersNotifier extends OrdersNotifier {
  _FailingRfqOrdersNotifier() : super(skipBootstrap: true);

  @override
  Future<List<Order>> submitRfq(CheckoutState state) => Future.error(
    DioException(
      requestOptions: RequestOptions(path: '/orders/requests/batch'),
      response: Response(
        requestOptions: RequestOptions(path: '/orders/requests/batch'),
        statusCode: 503,
        data: {'message': 'Service unavailable'},
      ),
    ),
  );
}

GoRouter _router() => GoRouter(
  routes: [
    GoRoute(path: '/', builder: (_, _) => const CheckoutScreen()),
    GoRoute(
      path: '/customer/order/success',
      builder: (_, _) => const Scaffold(body: Text('Success')),
    ),
  ],
);

CartItem _rfqItem({String id = 'rfq'}) => CartItem(
  id: id,
  category: 'flyers',
  categoryName: 'Flyers',
  productSlug: 'flyers',
  quoteRequired: true,
  requiredDate: DateTime(2099, 12, 31),
  catalogServerBacked: true,
  fileName: 'art.pdf',
  fileMetadataId: 41,
  specs: const {'stock': 'matte'},
  specDisplayValues: const {'stock': 'Matte'},
  quantity: 100,
  pageCount: 1,
  createdAt: DateTime(2026),
);

CartItem _legacyItem() => CartItem(
  id: 'legacy',
  category: 'paper',
  fileName: 'paper.pdf',
  fileMetadataId: 42,
  quantity: 1,
  pageCount: 1,
  printSubtotal: 10,
  createdAt: DateTime(2026),
);

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
          'allowedExtensions': ['pdf'],
          'isActive': true,
          'sortOrder': 1,
          'specs': const [],
        },
      ],
    },
  ],
};
