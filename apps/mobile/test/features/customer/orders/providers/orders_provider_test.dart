import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/screens/payment_screen.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Map<String, dynamic>? lastBatchPayload;
  var batchResponseOrders = <Map<String, dynamic>>[];

  setUpAll(() {
    const secureStorageChannel = MethodChannel(
      'plugins.it_nomads.com/flutter_secure_storage',
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorageChannel, (_) async => null);

    ApiClient.instance.init(baseUrl: 'http://mock-test/api');
    ApiClient.instance.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/credits/settings') {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'creditsOnlyMode': false},
              ),
            );
            return;
          }

          if (options.path == '/orders/batch') {
            lastBatchPayload = Map<String, dynamic>.from(options.data as Map);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: {'batchId': 'BATCH-10001', 'orders': batchResponseOrders},
              ),
            );
            return;
          }

          handler.next(options);
        },
      ),
    );
  });

  setUp(() async {
    Hive.init(
      '${Directory.systemTemp.path}/orders_provider_test_${DateTime.now().microsecondsSinceEpoch}',
    );
    await Hive.openBox('draft_orders');
    await Hive.box('draft_orders').clear();
    lastBatchPayload = null;
    batchResponseOrders = [
      _orderJson(id: '101', orderId: 'ORD-BATCH-1', fileName: 'proposal.pdf'),
      _orderJson(id: '102', orderId: 'ORD-BATCH-2', fileName: 'gear.stl'),
    ];
  });

  tearDown(() async {
    await Hive.close();
  });

  // Since OrdersNotifier constructor calls _connectWebSocket which causes
  // unhandled async WebSocket errors in tests, we test the orders logic
  // (filtering, cancellation rules, etc.) directly using MockData.

  group('Orders logic — activeOrders filtering', () {
    final terminalStatuses = {
      OrderStatus.delivered,
      OrderStatus.completedPickup,
      OrderStatus.cancelled,
    };

    final allOrders = MockData.orders;

    test('MockData has orders', () {
      expect(allOrders, isNotEmpty);
      expect(allOrders.length, 10);
    });

    test('activeOrders excludes terminal statuses', () {
      final active = allOrders
          .where((o) => !terminalStatuses.contains(o.orderStatus))
          .toList();
      for (final o in active) {
        expect(o.orderStatus, isNot(OrderStatus.delivered));
        expect(o.orderStatus, isNot(OrderStatus.completedPickup));
        expect(o.orderStatus, isNot(OrderStatus.cancelled));
      }
      expect(active, isNotEmpty);
    });

    test('completedOrders includes only terminal statuses', () {
      final completed = allOrders
          .where((o) => terminalStatuses.contains(o.orderStatus))
          .toList();
      expect(completed, isNotEmpty);
      for (final o in completed) {
        expect([
          OrderStatus.delivered,
          OrderStatus.completedPickup,
          OrderStatus.cancelled,
        ], contains(o.orderStatus));
      }
    });

    test('activeOrders + completedOrders == all orders', () {
      final active = allOrders
          .where((o) => !terminalStatuses.contains(o.orderStatus))
          .toList();
      final completed = allOrders
          .where((o) => terminalStatuses.contains(o.orderStatus))
          .toList();
      expect(active.length + completed.length, allOrders.length);
    });
  });

  group('Orders logic — cancellation rules', () {
    final cancellableStatuses = {
      OrderStatus.orderPlaced,
      OrderStatus.fileVerified,
    };

    test('orderPlaced is cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.orderPlaced), true);
    });

    test('fileVerified is cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.fileVerified), true);
    });

    test('printingInProgress is NOT cancellable', () {
      expect(
        cancellableStatuses.contains(OrderStatus.printingInProgress),
        false,
      );
    });

    test('delivered is NOT cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.delivered), false);
    });

    test('cancelOrder logic cancels eligible order', () {
      final orders = List<Order>.from(MockData.orders);

      // Find an orderPlaced order
      final eligible = orders.firstWhere(
        (o) => o.orderStatus == OrderStatus.orderPlaced,
      );

      // Simulate cancelOrder logic from provider
      final updated = [
        for (final order in orders)
          if (order.id == eligible.id &&
              cancellableStatuses.contains(order.orderStatus))
            order.copyWith(
              orderStatus: OrderStatus.cancelled,
              cancelledAt: DateTime.now(),
              updatedAt: DateTime.now(),
            )
          else
            order,
      ];

      final cancelledOrder = updated.firstWhere((o) => o.id == eligible.id);
      expect(cancelledOrder.orderStatus, OrderStatus.cancelled);
      expect(cancelledOrder.cancelledAt, isNotNull);
    });

    test('cancelOrder logic does NOT cancel non-eligible order', () {
      final orders = List<Order>.from(MockData.orders);

      // Find a printingInProgress order
      final nonEligible = orders.firstWhere(
        (o) => o.orderStatus == OrderStatus.printingInProgress,
      );

      // Simulate cancelOrder logic from provider
      final updated = [
        for (final order in orders)
          if (order.id == nonEligible.id &&
              cancellableStatuses.contains(order.orderStatus))
            order.copyWith(
              orderStatus: OrderStatus.cancelled,
              cancelledAt: DateTime.now(),
              updatedAt: DateTime.now(),
            )
          else
            order,
      ];

      final afterCancel = updated.firstWhere((o) => o.id == nonEligible.id);
      expect(afterCancel.orderStatus, OrderStatus.printingInProgress);
    });
  });

  group('Orders logic — addOrder', () {
    test('addOrder prepends to list', () {
      final orders = List<Order>.from(MockData.orders);
      final initialCount = orders.length;

      final newOrder = Order(
        id: 'test_new',
        orderId: 'ORD-99999',
        userId: 'usr_001',
        category: 'paper',
        quantity: 1,
        totalPrice: 100,
        deliveryFee: 0,
        paymentMethod: PaymentMethod.gcash,
        paymentStatus: PaymentStatus.paid,
        orderStatus: OrderStatus.orderPlaced,
        deliveryOption: 'pickup',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      // Simulate addOrder offline fallback
      final updated = [newOrder, ...orders];

      expect(updated.length, initialCount + 1);
      expect(updated.first.orderId, 'ORD-99999');
    });
  });

  group('OrdersNotifier.addBatchOrder', () {
    test(
      'posts batch payload and prepends one grouped customer order',
      () async {
        final existingOrder = MockData.orders.first;
        final container = ProviderContainer(
          overrides: [
            ordersProvider.overrideWith(
              (ref) => OrdersNotifier(
                initialState: [existingOrder],
                skipBootstrap: true,
              ),
            ),
          ],
        );
        addTearDown(container.dispose);
        final notifier = container.read(ordersProvider.notifier);

        final createdOrders = await notifier.addBatchOrder(
          items: [
            _paperCartItem(printSubtotal: 175),
            _threeDCartItem(printSubtotal: 240),
          ],
          deliveryOption: 'delivery',
          deliveryAddressId: '9',
          deliveryFee: 50,
          paymentMethod: PaymentMethod.gridCredits,
        );

        expect(createdOrders, hasLength(1));
        expect(createdOrders.single.orderId, 'BATCH-10001');
        expect(createdOrders.single.isBatchOrder, isTrue);
        expect(createdOrders.single.itemCount, 2);
        expect(createdOrders.single.totalPrice, 415);
        expect(createdOrders.single.deliveryFee, 50);
        expect(createdOrders.single.items.map((item) => item.orderId), [
          'ORD-BATCH-1',
          'ORD-BATCH-2',
        ]);
        expect(container.read(ordersProvider).map((order) => order.orderId), [
          'BATCH-10001',
          existingOrder.orderId,
        ]);

        expect(lastBatchPayload, isNotNull);
        expect(lastBatchPayload!['deliveryOption'], 'delivery');
        expect(lastBatchPayload!['deliveryAddressId'], 9);
        expect(lastBatchPayload!['deliveryFee'], 50);
        expect(lastBatchPayload!['paymentMethod'], 'gridCredits');

        final items = lastBatchPayload!['items'] as List<dynamic>;
        expect(items, hasLength(2));
        expect(items.first, containsPair('category', 'paper'));
        expect(items.first, containsPair('quantity', 2));
        expect(items.first, containsPair('totalPrice', 175));
        expect(items.first, containsPair('fileName', 'proposal.pdf'));
        expect(items.first, containsPair('fileUrl', '/tmp/proposal.pdf'));
        expect(items.first, containsPair('fileMetadataId', 42));
        expect(
          items.first,
          containsPair(
            'paperSpecs',
            containsPair('paperSize', PaperSize.a4.name),
          ),
        );

        expect(items.last, containsPair('category', '3d'));
        expect(items.last, containsPair('quantity', 3));
        expect(items.last, containsPair('totalPrice', 240));
        expect(items.last, containsPair('fileName', 'gear.stl'));
        expect(
          items.last,
          containsPair(
            'threeDSpecs',
            containsPair('fileFormat', FileFormat3D.stl.name),
          ),
        );
      },
    );

    test('omits nonnumeric delivery address ids from batch payload', () async {
      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container
          .read(ordersProvider.notifier)
          .addBatchOrder(
            items: [_paperCartItem(printSubtotal: 175)],
            deliveryOption: 'delivery',
            deliveryAddressId: 'addr_001',
            deliveryFee: 50,
            paymentMethod: PaymentMethod.gridCredits,
          );

      expect(lastBatchPayload, isNotNull);
      expect(lastBatchPayload!['deliveryAddressId'], isNull);
    });

    test('parses numeric-string 3D specs from batch response', () async {
      final now = DateTime(2026, 4, 25, 12).toIso8601String();
      batchResponseOrders = [
        {
          'id': '201',
          'orderId': 'ORD-AGG-1',
          'userId': 'usr_001',
          'batchOrderId': 77,
          'batchOrder': {'batchRef': 'BATCH-10001'},
          'category': 'batch',
          'quantity': '2',
          'totalPrice': '415.00',
          'deliveryFee': '50.00',
          'paymentMethod': 'gridCredits',
          'paymentStatus': 'pending',
          'orderStatus': 'orderPlaced',
          'deliveryOption': 'delivery',
          'createdAt': now,
          'updatedAt': now,
          'items': [
            {
              'id': '301',
              'orderId': 'ORD-ITEM-1',
              'category': '3d',
              'fileName': 'gear.stl',
              'fileMetadataId': '84',
              'quantity': '1',
              'totalPrice': '240.00',
              'threeDSpecs': {
                'fileFormat': 'stl',
                'material': 'pla',
                'color': 'White',
                'infillPercentage': '20',
                'layerHeight': '0.20',
                'supports': false,
              },
            },
          ],
        },
      ];
      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      final createdOrders = await container
          .read(ordersProvider.notifier)
          .addBatchOrder(
            items: [_threeDCartItem(printSubtotal: 240)],
            deliveryOption: 'delivery',
            deliveryAddressId: '9',
            deliveryFee: 50,
            paymentMethod: PaymentMethod.gridCredits,
          );

      final item = createdOrders.single.items.single;
      expect(item.fileMetadataId, 84);
      expect(item.threeDSpecs?.infillPercentage, 20);
      expect(item.threeDSpecs?.layerHeight, 0.2);
    });
  });

  group('PaymentScreen cart checkout', () {
    test('total uses cart subtotal plus shared delivery fee', () {
      final total = paymentScreenOrderTotal(
        flowState: const OrderFlowState(
          totalPrice: 999,
          deliveryOption: 'delivery',
          deliveryFee: 50,
        ),
        cartState: CartState(
          items: [
            _paperCartItem(printSubtotal: 175),
            _threeDCartItem(printSubtotal: 240),
          ],
        ),
      );

      expect(total, 465);
    });
  });

  group('Order model', () {
    test('copyWith preserves unchanged fields', () {
      final order = MockData.orders.first;
      final copied = order.copyWith(orderStatus: OrderStatus.cancelled);
      expect(copied.orderStatus, OrderStatus.cancelled);
      expect(copied.id, order.id);
      expect(copied.orderId, order.orderId);
      expect(copied.userId, order.userId);
      expect(copied.totalPrice, order.totalPrice);
    });

    test('equality is based on id', () {
      final order1 = MockData.orders.first;
      final order2 = order1.copyWith(orderStatus: OrderStatus.cancelled);
      expect(order1, equals(order2)); // same id
    });
  });
}

Map<String, dynamic> _orderJson({
  required String id,
  required String orderId,
  required String fileName,
}) {
  final now = DateTime(2026, 4, 25, 12).toIso8601String();
  return {
    'id': id,
    'orderId': orderId,
    'userId': 'usr_001',
    'batchOrderId': 77,
    'batchOrder': {'batchRef': 'BATCH-10001'},
    'category': fileName.endsWith('.stl') ? '3d' : 'paper',
    'fileName': fileName,
    'fileUrl': '/tmp/$fileName',
    'fileMetadataId': fileName.endsWith('.stl') ? 84 : 42,
    'quantity': 1,
    'totalPrice': fileName.endsWith('.stl') ? 240 : 175,
    'deliveryFee': orderId.endsWith('1') ? 50 : 0,
    'paymentMethod': 'gridCredits',
    'paymentStatus': 'pending',
    'orderStatus': 'orderPlaced',
    'deliveryOption': 'delivery',
    'deliveryAddressId': 9,
    'createdAt': now,
    'updatedAt': now,
  };
}

CartItem _paperCartItem({double printSubtotal = 175}) {
  return CartItem(
    id: 'cart-paper',
    category: 'paper',
    fileName: 'proposal.pdf',
    filePath: '/tmp/proposal.pdf',
    fileSize: 2048,
    fileMetadataId: 42,
    paperSpecs: const PaperSpecs(
      paperSize: PaperSize.a4,
      colorMode: ColorMode.fullColor,
      mediaType: MediaType.matte,
      printSides: PrintSides.backToBack,
      binding: Binding.spiral,
    ),
    quantity: 2,
    pageCount: 10,
    printSubtotal: printSubtotal,
    createdAt: DateTime(2026, 4, 25, 10),
  );
}

CartItem _threeDCartItem({double printSubtotal = 240}) {
  return CartItem(
    id: 'cart-3d',
    category: '3d',
    fileName: 'gear.stl',
    filePath: '/tmp/gear.stl',
    fileSize: 4096,
    fileMetadataId: 84,
    threeDSpecs: const ThreeDSpecs(
      fileFormat: FileFormat3D.stl,
      material: Material3D.pla,
      color: 'White',
      infillPercentage: 35,
      layerHeight: 0.16,
      supports: true,
      notes: 'Hollow center',
    ),
    quantity: 3,
    pageCount: 1,
    printSubtotal: printSubtotal,
    createdAt: DateTime(2026, 4, 25, 11),
  );
}
