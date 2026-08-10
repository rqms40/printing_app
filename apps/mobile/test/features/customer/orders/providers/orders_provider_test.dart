import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/quote_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Map<String, dynamic>? lastBatchPayload;
  var batchResponseOrders = <Map<String, dynamic>>[];
  Map<String, dynamic>? batchAssignedSlot;
  var failOrdersGet = false;
  var ordersGetResponse = <Map<String, dynamic>>[];
  final deferredOrdersGets = <Completer<List<Map<String, dynamic>>>>[];
  Map<String, dynamic>? orderByIdResponse;
  var orderByIdFetches = 0;
  final forceBetaLimitPaths = <String>{};
  final force500Paths = <String>{};
  Map<String, dynamic>? lastAcceptQuotePayload;
  var acceptQuoteCalls = 0;
  Completer<void>? acceptQuoteGate;
  String? acceptQuoteErrorCode;

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

          if (options.path == '/orders' && options.method == 'GET') {
            if (deferredOrdersGets.isNotEmpty) {
              final response = deferredOrdersGets.removeAt(0);
              unawaited(
                response.future.then(
                  (data) => handler.resolve(
                    Response(
                      requestOptions: options,
                      statusCode: 200,
                      data: data,
                    ),
                  ),
                ),
              );
              return;
            }
            if (failOrdersGet) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response(
                    requestOptions: options,
                    statusCode: 500,
                    data: {'message': 'orders refresh failed'},
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
              return;
            }

            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: ordersGetResponse,
              ),
            );
            return;
          }

          if (options.path == '/orders/7' && options.method == 'GET') {
            orderByIdFetches++;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: orderByIdResponse,
              ),
            );
            return;
          }

          if (forceBetaLimitPaths.contains(options.path)) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 403,
                  data: {
                    'statusCode': 403,
                    'code': 'BETA_ORDER_LIMIT_REACHED',
                    'message':
                        'Beta testers may place only one order during the beta program.',
                  },
                ),
                type: DioExceptionType.badResponse,
              ),
            );
            return;
          }

          if (force500Paths.contains(options.path)) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 500,
                  data: {'message': 'boom'},
                ),
                type: DioExceptionType.badResponse,
              ),
            );
            return;
          }

          if (options.path.endsWith('/orders/42/accept-quote') &&
              options.method == 'POST') {
            acceptQuoteCalls++;
            lastAcceptQuotePayload = Map<String, dynamic>.from(
              options.data as Map,
            );
            final errorCode = acceptQuoteErrorCode;
            if (errorCode != null) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response(
                    requestOptions: options,
                    statusCode: 400,
                    data: {
                      'code': errorCode,
                      'message': 'The selected quote changed',
                    },
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
              return;
            }
            final gate = acceptQuoteGate;
            if (gate != null) {
              unawaited(
                gate.future.then(
                  (_) => handler.resolve(
                    Response(
                      requestOptions: options,
                      statusCode: 201,
                      data: const <String, dynamic>{},
                    ),
                  ),
                ),
              );
              return;
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: const <String, dynamic>{},
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
                data: {
                  'batchId': 'BATCH-10001',
                  'orders': batchResponseOrders,
                  'assignedSlot': ?batchAssignedSlot,
                },
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
    batchAssignedSlot = null;
    failOrdersGet = false;
    ordersGetResponse = [];
    deferredOrdersGets.clear();
    orderByIdResponse = null;
    orderByIdFetches = 0;
    batchResponseOrders = [
      _orderJson(id: '101', orderId: 'ORD-BATCH-1', fileName: 'proposal.pdf'),
      _orderJson(id: '102', orderId: 'ORD-BATCH-2', fileName: 'gear.stl'),
    ];
    forceBetaLimitPaths.clear();
    force500Paths.clear();
    lastAcceptQuotePayload = null;
    acceptQuoteCalls = 0;
    acceptQuoteGate = null;
    acceptQuoteErrorCode = null;
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
      OrderStatus.collectedByCustomer,
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
        expect(o.orderStatus, isNot(OrderStatus.collectedByCustomer));
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
          OrderStatus.collectedByCustomer,
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
      OrderStatus.submitted,
      OrderStatus.approvedForMatching,
    };

    test('orderPlaced is cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.submitted), true);
    });

    test('fileVerified is cancellable', () {
      expect(
        cancellableStatuses.contains(OrderStatus.approvedForMatching),
        true,
      );
    });

    test('printingInProgress is NOT cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.production), false);
    });

    test('delivered is NOT cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.delivered), false);
    });

    test('cancelOrder logic cancels eligible order', () {
      final orders = List<Order>.from(MockData.orders);

      // Find an orderPlaced order
      final eligible = orders.firstWhere(
        (o) => o.orderStatus == OrderStatus.submitted,
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
        (o) => o.orderStatus == OrderStatus.production,
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
      expect(afterCancel.orderStatus, OrderStatus.production);
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
        orderStatus: OrderStatus.submitted,
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

  group('OrdersNotifier lifecycle', () {
    test(
      'promotion with null assignment refetches order before enabling map',
      () async {
        WebSocketService.disableOrdersSocketForTests = true;
        WebSocketService.instance.disconnect();
        addTearDown(() {
          WebSocketService.disableOrdersSocketForTests = false;
          WebSocketService.instance.disconnect();
        });
        ordersGetResponse = [
          {
            ..._orderJson(
              id: '7',
              orderId: 'ORD-10007',
              fileName: 'proposal.pdf',
              orderStatus: 'on_the_way',
            ),
            'deliveryQueuePosition': 2,
            'deliveryQueueSize': 2,
            'canTrackDelivery': false,
            'deliveryAssignmentId': null,
            'deliveryPlanVersion': 4,
            'destination': {
              'fullAddress': 'Ven home',
              'city': 'Davao City',
              'latitude': 7.0731,
              'longitude': 125.6128,
            },
          },
        ];
        orderByIdResponse = {
          ...ordersGetResponse.single,
          'deliveryQueuePosition': 1,
          'deliveryQueueSize': 1,
          'canTrackDelivery': true,
          'deliveryAssignmentId': 101,
          'deliveryRouteGeometry': {
            'type': 'LineString',
            'coordinates': [
              [125.6079, 7.064],
              [125.6128, 7.0731],
            ],
          },
          'deliveryLegDurationSeconds': 170,
          'deliveryLegDistanceMeters': 1134,
          'deliveryRoutingDataStale': false,
        };

        final notifier = OrdersNotifier();
        final container = ProviderContainer(
          overrides: [
            ordersProvider.overrideWith((ref) => notifier),
            addressProvider.overrideWith(
              (ref) =>
                  AddressNotifier(initialState: const [], skipBootstrap: true),
            ),
          ],
        );
        addTearDown(container.dispose);
        await Future<void>.delayed(const Duration(milliseconds: 20));
        expect(notifier.state.single.deliveryQueuePosition, 2);
        final privateMap = await container.read(liveDeliveryMapProvider.future);
        expect(privateMap.queuePosition, 2);
        expect(privateMap.routePoints, isEmpty);

        WebSocketService.instance.dispatchDeliveryQueueUpdatedForTests({
          'orderId': 7,
          'orderRef': 'ORD-10007',
          'queuePosition': 1,
          'queueSize': 1,
          'canTrackDelivery': false,
          'assignmentId': null,
          'planVersion': 4,
        });
        await Future<void>.delayed(const Duration(milliseconds: 20));

        expect(orderByIdFetches, 1);
        expect(notifier.state.single.deliveryQueuePosition, 1);
        expect(notifier.state.single.deliveryAssignmentId, '101');
        expect(notifier.state.single.canTrackDelivery, isTrue);
        expect(notifier.state.single.deliveryRouteGeometry, isNotNull);
        final promotedMap = await container.read(
          liveDeliveryMapProvider.future,
        );
        expect(promotedMap.queuePosition, 1);
        expect(promotedMap.deliveryAssignmentId, '101');
        expect(promotedMap.routePoints, isNotEmpty);
        expect(promotedMap.routingHealth, RoutingHealth.current);
      },
    );

    test('malformed plan metrics parse as null and degraded', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      WebSocketService.instance.disconnect();
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      ordersGetResponse = [
        {
          ..._orderJson(
            id: '7',
            orderId: 'ORD-10007',
            fileName: 'proposal.pdf',
            orderStatus: 'arrived_at_destination',
          ),
          'canTrackDelivery': true,
          'deliveryPlanVersion': 0,
          'deliveryLegDurationSeconds': -1,
          'deliveryLegDistanceMeters': 'not-a-number',
        },
      ];
      final notifier = OrdersNotifier();
      addTearDown(notifier.dispose);
      await Future<void>.delayed(const Duration(milliseconds: 20));

      final order = notifier.state.single;
      expect(order.orderStatus, OrderStatus.outForDelivery);
      expect(order.deliveryPlanVersion, isNull);
      expect(order.deliveryLegDurationSeconds, isNull);
      expect(order.deliveryLegDistanceMeters, isNull);
      expect(order.deliveryRouteGeometryMalformed, isTrue);
    });

    test('reports initial order loading again after a session reset', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      var loadReports = 0;
      final notifier = OrdersNotifier(
        skipBootstrap: true,
        onInitialLoadComplete: () => loadReports++,
      );
      addTearDown(notifier.dispose);

      await notifier.refreshOrders();
      await Future<void>.delayed(Duration.zero);
      expect(loadReports, 1);

      notifier.clear();
      await notifier.startSession();
      await Future<void>.delayed(Duration.zero);

      expect(loadReports, 2);
    });

    test('reports failed initial history load as non-authoritative', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      failOrdersGet = true;
      addTearDown(() {
        failOrdersGet = false;
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      final results = <bool>[];
      final notifier = OrdersNotifier(
        skipBootstrap: true,
        realFlow: true,
        onInitialLoadResult: results.add,
      );
      addTearDown(notifier.dispose);

      await notifier.refreshOrders();
      await Future<void>.delayed(Duration.zero);

      expect(notifier.state, isEmpty);
      expect(results, [false]);
    });

    test('session restart re-registers the delivery queue listener', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      WebSocketService.instance.disconnect();
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      ordersGetResponse = [];
      final notifier = OrdersNotifier(skipBootstrap: true);
      addTearDown(notifier.dispose);

      notifier.clear();
      await notifier.startSession();
      expect(WebSocketService.instance.deliveryQueueListenerCountForTests, 1);

      WebSocketService.instance.disconnect();
      notifier.clear();
      await notifier.startSession();

      expect(WebSocketService.instance.deliveryQueueListenerCountForTests, 1);
    });

    test('an old orders response cannot replace a new session', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      final oldResponse = Completer<List<Map<String, dynamic>>>();
      final newResponse = Completer<List<Map<String, dynamic>>>();
      deferredOrdersGets.addAll([oldResponse, newResponse]);
      final notifier = OrdersNotifier(skipBootstrap: true);
      addTearDown(notifier.dispose);

      final oldRefresh = notifier.refreshOrders();
      notifier.clear();
      final newRefresh = notifier.startSession();
      newResponse.complete([
        _orderJson(id: '8', orderId: 'ORD-VEN', fileName: 'ven.pdf'),
      ]);
      await newRefresh;
      oldResponse.complete([
        _orderJson(id: '7', orderId: 'ORD-MARK', fileName: 'mark.pdf'),
      ]);
      await oldRefresh;

      expect(notifier.state.single.orderId, 'ORD-VEN');
    });

    test('failed refresh preserves existing real orders', () async {
      failOrdersGet = true;
      final existingOrder = _orderFromJson(
        _orderJson(id: '7', orderId: 'ORD-10007', fileName: 'proposal.pdf'),
      );
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

      await container.read(ordersProvider.notifier).refreshOrders();

      final orders = container.read(ordersProvider);
      expect(orders, hasLength(1));
      expect(orders.single.id, '7');
      expect(orders.single.orderId, 'ORD-10007');
      expect(
        container.read(ordersProvider.notifier).errorMessage,
        'Unable to refresh live orders',
      );
    });

    test('dispose unregisters websocket completion listener', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      WebSocketService.instance.disconnect();
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });

      var completionRefreshes = 0;
      final initialOrder = MockData.orders.first.copyWith(
        orderStatus: OrderStatus.submitted,
      );
      final notifier = OrdersNotifier(
        initialState: [initialOrder],
        onCompletionUpdate: () async {
          completionRefreshes++;
        },
      );

      await Future<void>.delayed(Duration.zero);
      expect(WebSocketService.instance.orderListenerCountForTests, 1);

      notifier.dispose();
      expect(WebSocketService.instance.orderListenerCountForTests, 0);

      WebSocketService.instance.dispatchOrderUpdateForTests(
        _orderJson(
          id: initialOrder.id,
          orderId: initialOrder.orderId,
          fileName: initialOrder.fileName ?? 'completed.pdf',
          orderStatus: 'delivered',
        ),
      );
      await Future<void>.delayed(Duration.zero);

      expect(completionRefreshes, 0);
    });
  });

  group('OrdersNotifier.addBatchOrder', () {
    test(
      'single item aggregate response keeps ORD-10007 as visible order',
      () async {
        batchResponseOrders = [
          _singleItemBatchOrderJson(paymentMethod: 'gcash'),
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
              items: [_paperCartItem(printSubtotal: 175)],
              deliveryOption: 'delivery',
              deliveryAddressId: '9',
              deliveryFee: 50,
              paymentMethod: PaymentMethod.gcash,
            );

        expect(createdOrders, hasLength(1));
        final order = createdOrders.single;
        expect(order.id, '7');
        expect(order.orderId, 'ORD-10007');
        expect(order.batchId, 'BATCH-10001');
        expect(order.batchOrderId, '1');
        expect(order.isBatchOrder, isFalse);
        expect(order.itemCount, 1);
        expect(order.paymentMethod, PaymentMethod.gcash);
        expect(order.deliveryAddress?.fullAddress, 'Test');
        expect(order.deliveryAddress?.city, 'Test');
        expect(order.deliveryAddress?.latitude, 7.0793179);
        expect(order.deliveryAddress?.longitude, 125.6149458);
        expect(container.read(ordersProvider).single.orderId, 'ORD-10007');
      },
    );

    test(
      'single child batch response without items preserves ORD-10007',
      () async {
        batchResponseOrders = [
          _singleItemBatchOrderJson(
            paymentMethod: 'credits',
            includeItems: false,
          ),
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
              items: [_paperCartItem(printSubtotal: 175)],
              deliveryOption: 'delivery',
              deliveryAddressId: '9',
              deliveryFee: 50,
              paymentMethod: PaymentMethod.gridCredits,
            );

        final order = createdOrders.single;
        expect(order.orderId, 'ORD-10007');
        expect(order.batchId, 'BATCH-10001');
        expect(order.isBatchOrder, isFalse);
        expect(order.itemCount, 1);
        expect(order.items.single.orderId, 'ORD-10007');
        expect(order.paymentMethod, PaymentMethod.gridCredits);
        expect(container.read(ordersProvider).single.orderId, 'ORD-10007');
      },
    );

    test(
      'single aggregate batch response displays order id and keeps batch metadata',
      () async {
        final cases = {
          'gridCredits': PaymentMethod.gridCredits,
          'pilot_credit': PaymentMethod.gridCredits,
          'gcash': PaymentMethod.gcash,
        };

        for (final entry in cases.entries) {
          batchResponseOrders = [
            _aggregateBatchOrderJson(paymentMethod: entry.key),
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
                items: [_paperCartItem(printSubtotal: 175)],
                deliveryOption: 'delivery',
                deliveryAddressId: '9',
                deliveryFee: 50,
                paymentMethod: PaymentMethod.gridCredits,
              );

          expect(createdOrders, hasLength(1));
          final order = createdOrders.single;
          expect(order.id, '7');
          expect(order.orderId, 'ORD-10007');
          expect(order.batchId, 'BATCH-10001');
          expect(order.batchOrderId, '1');
          expect(order.isBatchOrder, isTrue);
          expect(order.paymentMethod, entry.value);
          expect(order.deliveryAddress?.latitude, 14.5995);
          expect(order.deliveryAddress?.longitude, 120.9842);
          expect(order.items, hasLength(2));
          expect(order.items.map((item) => item.orderId), [
            'ORD-ITEM-1',
            'ORD-ITEM-2',
          ]);
          expect(container.read(ordersProvider).single.orderId, 'ORD-10007');
        }
      },
    );

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
        expect(lastBatchPayload!['paymentMethod'], 'pilot_credit');

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
          containsPair('specialInstructions', 'Trim to the crop marks.'),
        );
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

    test(
      'parses top-level assigned slot returned from batch response',
      () async {
        batchResponseOrders = [
          _orderJson(
            id: '101',
            orderId: 'ORD-BATCH-1',
            fileName: 'proposal.pdf',
          ),
        ];
        batchAssignedSlot = {
          'slotTemplateId': 7,
          'date': '2026-05-04',
          'startTime': '09:00:00',
          'endTime': '11:00:00',
        };
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
              items: [_paperCartItem(printSubtotal: 175)],
              deliveryOption: 'delivery',
              deliveryAddressId: '9',
              deliveryFee: 50,
              paymentMethod: PaymentMethod.gridCredits,
            );

        expect(createdOrders.single.assignedSlot?.slotTemplateId, 7);
        expect(createdOrders.single.assignedSlot?.date, '2026-05-04');
        expect(createdOrders.single.assignedSlot?.startTime, '09:00:00');
        expect(createdOrders.single.assignedSlot?.endTime, '11:00:00');
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
              'specialInstructions': 'Keep the embossed logo sharp.',
              'quantity': '1',
              'totalPrice': '240.00',
              'threeDSpecs': {
                'fileFormat': 'stl',
                'material': 'pla',
                'color': 'White',
                'infillPercentage': '20',
                'layerHeight': '0.20',
                'supports': 'false',
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
      expect(item.specialInstructions, 'Keep the embossed logo sharp.');
      expect(item.threeDSpecs?.infillPercentage, 20);
      expect(item.threeDSpecs?.supports, isFalse);
      expect(item.threeDSpecs?.layerHeight, 0.2);
    });
  });

  group('OrdersNotifier catalog quote lifecycle', () {
    testWidgets('server-projected COD advisory reaches the quoted rail UI', (
      tester,
    ) async {
      WebSocketService.disableOrdersSocketForTests = true;
      WebSocketService.instance.disconnect();
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      ordersGetResponse = [_quotedCatalogOrderJson()];
      final notifier = OrdersNotifier(skipBootstrap: true);
      await tester.runAsync(notifier.refreshOrders);
      final projectedOrder = notifier.state.single;
      notifier.dispose();

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: QuoteCard(
                order: projectedOrder,
                isOwner: true,
                onAccept: (_, _, _) async {},
              ),
            ),
          ),
        ),
      );

      expect(projectedOrder.codEligible, isTrue);
      expect(find.text('Cash on Delivery'), findsOneWidget);
    });

    test('keeps RFQ batch lines independently reviewable', () async {
      WebSocketService.disableOrdersSocketForTests = true;
      WebSocketService.instance.disconnect();
      addTearDown(() {
        WebSocketService.disableOrdersSocketForTests = false;
        WebSocketService.instance.disconnect();
      });
      ordersGetResponse = [
        {
          ..._quotedCatalogOrderJson(),
          'id': 42,
          'orderId': 'ORD-10042',
          'batchOrderId': 9,
          'batchOrder': {'batchRef': 'BATCH-RFQ-9'},
          'pricingStatus': 'pending_quote',
          'quotedTotalMinor': null,
          'quoteAssignmentId': null,
        },
        {
          ..._quotedCatalogOrderJson(),
          'id': 43,
          'orderId': 'ORD-10043',
          'batchOrderId': 9,
          'batchOrder': {'batchRef': 'BATCH-RFQ-9'},
          'pricingStatus': 'quoted',
          'quotedTotalMinor': '20000',
          'quoteAssignmentId': 78,
        },
      ];
      final notifier = OrdersNotifier();
      addTearDown(notifier.dispose);

      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(notifier.state, hasLength(2));
      expect(notifier.state.map((order) => order.orderId), {
        'ORD-10042',
        'ORD-10043',
      });
    });

    test(
      'parses dynamic leaf metadata, specs, and exact minor strings',
      () async {
        WebSocketService.disableOrdersSocketForTests = true;
        WebSocketService.instance.disconnect();
        addTearDown(() {
          WebSocketService.disableOrdersSocketForTests = false;
          WebSocketService.instance.disconnect();
        });
        ordersGetResponse = [_quotedCatalogOrderJson()];
        final notifier = OrdersNotifier();
        addTearDown(notifier.dispose);

        await Future<void>.delayed(const Duration(milliseconds: 20));

        final order = notifier.state.single;
        final item = order.lineItems.single;
        expect(order.pricingStatus, PricingStatus.quoted);
        expect(order.quotedTotalMinor.toString(), '90071992547409931234');
        expect(order.deliveryFeeMinor.toString(), '1234');
        expect(order.quotedGoodsMinor.toString(), '90071992547409930000');
        expect(order.quoteAssignmentId, 77);
        expect(order.promisedCompletionAt, DateTime.utc(2026, 8, 20, 9));
        expect(item.category, 'future-fabrication');
        expect(item.categoryName, 'Future Fabrication');
        expect(item.groupSlug, 'future-services');
        expect(item.groupName, 'Future Services');
        expect(item.examples, ['Custom future parts']);
        expect(item.specs, {'finish': 'matte'});
        expect(item.specLabels, {'finish': 'UV-DTF / CMYK+W'});
        expect(item.specDisplayValues, {'finish': 'Matte finish'});
        expect(item.paperSpecs, isNull);
        expect(item.threeDSpecs, isNull);
      },
    );

    test(
      'posts exact quote acceptance body and refreshes on success',
      () async {
        ordersGetResponse = [
          {
            ..._quotedCatalogOrderJson(),
            'pricingStatus': 'accepted',
            'orderStatus': 'awaiting_payment',
            'paymentMethod': 'pilot_credit',
            'quoteAcceptedAt': '2026-08-12T10:00:00.000Z',
          },
        ];
        final notifier = OrdersNotifier(
          initialState: [_quotedCatalogOrderModel()],
          skipBootstrap: true,
        );
        addTearDown(notifier.dispose);

        await notifier.acceptQuote('42', 77, PaymentMethod.gridCredits);

        expect(lastAcceptQuotePayload, {
          'supplierAssignmentId': 77,
          'paymentMethod': 'pilot_credit',
        });
        expect(acceptQuoteCalls, 1);
        expect(notifier.state.single.pricingStatus, PricingStatus.accepted);
        expect(notifier.state.single.orderStatus, OrderStatus.awaitingPayment);
      },
    );

    test(
      'suppresses duplicate quote acceptance while request is in flight',
      () async {
        acceptQuoteGate = Completer<void>();
        ordersGetResponse = [_quotedCatalogOrderJson()];
        final notifier = OrdersNotifier(
          initialState: [_quotedCatalogOrderModel()],
          skipBootstrap: true,
        );
        addTearDown(notifier.dispose);

        final first = notifier.acceptQuote('42', 77, PaymentMethod.gridCredits);
        final replay = notifier.acceptQuote('42', 77, PaymentMethod.cod);
        await Future<void>.delayed(const Duration(milliseconds: 20));
        expect(acceptQuoteCalls, 1);
        acceptQuoteGate!.complete();
        await Future.wait([first, replay]);
        expect(acceptQuoteCalls, 1);
      },
    );

    test(
      'surfaces stale quote conflict without replacing durable state',
      () async {
        acceptQuoteErrorCode = 'stale_quote';
        final quoted = _quotedCatalogOrderModel();
        final notifier = OrdersNotifier(
          initialState: [quoted],
          skipBootstrap: true,
        );
        addTearDown(notifier.dispose);

        await expectLater(
          notifier.acceptQuote('42', 77, PaymentMethod.cod),
          throwsA(
            isA<QuoteAcceptanceException>()
                .having((error) => error.code, 'code', 'stale_quote')
                .having(
                  (error) => error.refreshRecommended,
                  'refreshRecommended',
                  isTrue,
                ),
          ),
        );
        expect(notifier.state.single, same(quoted));
        expect(notifier.state.single.quotedTotalMinor, quoted.quotedTotalMinor);
      },
    );
  });

  group('OrdersNotifier — beta order limit', () {
    test(
      'addBatchOrder throws BetaOrderLimitException on 403 with code',
      () async {
        forceBetaLimitPaths.add('/orders/batch');

        final container = ProviderContainer(
          overrides: [
            ordersProvider.overrideWith(
              (ref) =>
                  OrdersNotifier(initialState: const [], skipBootstrap: true),
            ),
          ],
        );
        addTearDown(container.dispose);

        await expectLater(
          container
              .read(ordersProvider.notifier)
              .addBatchOrder(
                items: [_paperCartItem(printSubtotal: 175)],
                deliveryOption: 'delivery',
                deliveryAddressId: '9',
                deliveryFee: 50,
                paymentMethod: PaymentMethod.gridCredits,
              ),
          throwsA(isA<BetaOrderLimitException>()),
        );
      },
    );

    test('addBatchOrder rethrows generic 500s without conversion', () async {
      force500Paths.add('/orders/batch');

      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      await expectLater(
        container
            .read(ordersProvider.notifier)
            .addBatchOrder(
              items: [_paperCartItem(printSubtotal: 175)],
              deliveryOption: 'delivery',
              deliveryAddressId: '9',
              deliveryFee: 50,
              paymentMethod: PaymentMethod.gridCredits,
            ),
        throwsA(isNot(isA<BetaOrderLimitException>())),
      );
    });

    test(
      'addOrder throws BetaOrderLimitException on 403 with code (no local fallback)',
      () async {
        forceBetaLimitPaths.add('/orders');

        final container = ProviderContainer(
          overrides: [
            ordersProvider.overrideWith(
              (ref) =>
                  OrdersNotifier(initialState: const [], skipBootstrap: true),
            ),
          ],
        );
        addTearDown(container.dispose);

        final newOrder = Order(
          id: 'test_new',
          orderId: 'ORD-99999',
          userId: 'usr_001',
          category: 'paper',
          quantity: 1,
          totalPrice: 100,
          deliveryFee: 0,
          paymentMethod: PaymentMethod.cod,
          paymentStatus: PaymentStatus.pending,
          orderStatus: OrderStatus.submitted,
          deliveryOption: 'delivery',
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );

        final notifier = container.read(ordersProvider.notifier);
        await expectLater(
          notifier.addOrder(newOrder),
          throwsA(isA<BetaOrderLimitException>()),
        );
        // Local fallback must NOT have happened.
        expect(container.read(ordersProvider), isEmpty);
      },
    );

    test('addOrder falls back locally on generic 500', () async {
      force500Paths.add('/orders');

      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      final newOrder = Order(
        id: 'test_new_fallback',
        orderId: 'ORD-99998',
        userId: 'usr_001',
        category: 'paper',
        quantity: 1,
        totalPrice: 100,
        deliveryFee: 0,
        paymentMethod: PaymentMethod.cod,
        paymentStatus: PaymentStatus.pending,
        orderStatus: OrderStatus.submitted,
        deliveryOption: 'delivery',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final notifier = container.read(ordersProvider.notifier);
      final result = await notifier.addOrder(newOrder);
      expect(result.id, 'test_new_fallback');
      expect(container.read(ordersProvider).map((o) => o.id), [
        'test_new_fallback',
      ]);
    });

    test('real-flow addOrder fails closed on generic 500', () async {
      force500Paths.add('/orders');
      final notifier = OrdersNotifier(skipBootstrap: true, realFlow: true);
      addTearDown(notifier.dispose);
      final newOrder = Order(
        id: 'must-not-be-local',
        orderId: 'ORD-99997',
        userId: 'usr_001',
        category: 'paper',
        quantity: 1,
        totalPrice: 100,
        deliveryFee: 0,
        paymentMethod: PaymentMethod.gridCredits,
        paymentStatus: PaymentStatus.pending,
        orderStatus: OrderStatus.submitted,
        deliveryOption: 'delivery',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await expectLater(
        notifier.addOrder(newOrder),
        throwsA(isA<DioException>()),
      );
      expect(notifier.state, isEmpty);
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

Map<String, dynamic> _singleItemBatchOrderJson({
  required String paymentMethod,
  bool includeItems = true,
}) {
  final now = DateTime(2026, 5, 2, 20, 13, 43).toIso8601String();
  final json = <String, dynamic>{
    'id': 7,
    'orderId': 'ORD-10007',
    'userId': '1',
    'batchOrderId': 1,
    'batchOrder': {'batchRef': 'BATCH-10001'},
    'category': 'paper',
    'fileName': 'bad-design-hero.png',
    'fileUrl': '/uploads/bad-design-hero.png',
    'quantity': 1,
    'totalPrice': '2.00',
    'deliveryFee': '0.00',
    'paymentMethod': paymentMethod,
    'paymentStatus': 'pending',
    'orderStatus': 'orderPlaced',
    'deliveryOption': 'delivery',
    'deliveryAddressId': 1,
    'destination': {
      'id': 1,
      'label': 'Test',
      'fullAddress': 'Test',
      'city': 'Test',
      'landmark': 'Test',
      'latitude': 7.0793179,
      'longitude': 125.6149458,
    },
    'createdAt': now,
    'updatedAt': now,
  };
  if (includeItems) {
    json['items'] = [
      {
        'id': 7,
        'orderId': 'ORD-10007',
        'category': 'paper',
        'fileName': 'bad-design-hero.png',
        'fileUrl': '/uploads/bad-design-hero.png',
        'quantity': 1,
        'totalPrice': '2.00',
      },
    ];
  }
  return json;
}

Map<String, dynamic> _quotedCatalogOrderJson() {
  final now = DateTime.utc(2026, 8, 12, 8).toIso8601String();
  return {
    'id': 42,
    'orderId': 'ORD-10042',
    'userId': 1,
    'category': 'future-fabrication',
    'quantity': 2,
    'totalPrice': '0.00',
    'deliveryFee': '12.34',
    'deliveryFeeMinor': '1234',
    'pricingStatus': 'quoted',
    'quotedTotalMinor': '90071992547409931234',
    'quotedAt': '2026-08-12T08:30:00.000Z',
    'promisedCompletionAt': '2026-08-20T09:00:00.000Z',
    'quoteAssignmentId': 77,
    'codEligible': true,
    'paymentMethod': 'pending_quote',
    'paymentStatus': 'pending_quote',
    'orderStatus': 'supplier_accepted',
    'deliveryOption': 'delivery',
    'createdAt': now,
    'updatedAt': now,
    'items': [
      {
        'id': 420,
        'orderId': 'ORD-10042',
        'category': 'future-fabrication',
        'categorySlug': 'future-fabrication',
        'categoryName': 'Future Fabrication',
        'groupSlug': 'future-services',
        'groupName': 'Future Services',
        'groupDescription': 'Products added after this client shipped.',
        'examples': ['Custom future parts'],
        'pricingModel': 'quote_required',
        'quantity': 2,
        'totalPrice': null,
        'paperSpecs': {
          'paperSize': 'a4',
          'colorMode': 'full_color',
          'mediaType': 'standard',
          'printSides': 'front_only',
          'binding': 'none',
        },
        'threeDSpecs': {
          'fileFormat': 'stl',
          'material': 'pla',
          'color': 'white',
          'infillPercentage': 20,
          'layerHeight': 0.2,
          'supports': false,
        },
        'specs': [
          {
            'key': 'finish',
            'label': 'UV-DTF / CMYK+W',
            'value': 'matte',
            'displayValue': 'Matte finish',
          },
        ],
      },
    ],
  };
}

Order _quotedCatalogOrderModel() {
  return Order(
    id: '42',
    orderId: 'ORD-10042',
    userId: '1',
    category: 'future-fabrication',
    categoryName: 'Future Fabrication',
    groupSlug: 'future-services',
    groupName: 'Future Services',
    quantity: 2,
    totalPrice: 0,
    deliveryFee: 12.34,
    deliveryFeeMinor: BigInt.from(1234),
    pricingStatus: PricingStatus.quoted,
    quotedTotalMinor: BigInt.parse('90071992547409931234'),
    quotedAt: DateTime.utc(2026, 8, 12, 8, 30),
    promisedCompletionAt: DateTime.utc(2026, 8, 20, 9),
    quoteAssignmentId: 77,
    codEligible: true,
    paymentMethod: PaymentMethod.gridCredits,
    paymentStatus: PaymentStatus.pending,
    orderStatus: OrderStatus.supplierAccepted,
    deliveryOption: 'delivery',
    createdAt: DateTime.utc(2026, 8, 12, 8),
    updatedAt: DateTime.utc(2026, 8, 12, 8),
  );
}

Map<String, dynamic> _orderJson({
  required String id,
  required String orderId,
  required String fileName,
  String orderStatus = 'orderPlaced',
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
    'orderStatus': orderStatus,
    'deliveryOption': 'delivery',
    'deliveryAddressId': 9,
    'createdAt': now,
    'updatedAt': now,
  };
}

Order _orderFromJson(Map<String, dynamic> json) {
  final now = DateTime.parse(json['createdAt'] as String);
  return Order(
    id: json['id'].toString(),
    orderId: json['orderId'] as String,
    userId: json['userId'] as String,
    batchOrderId: json['batchOrderId'].toString(),
    batchId: (json['batchOrder'] as Map<String, dynamic>)['batchRef']
        .toString(),
    category: json['category'] as String,
    fileName: json['fileName'] as String?,
    fileUrl: json['fileUrl'] as String?,
    fileMetadataId: json['fileMetadataId'] as int?,
    quantity: json['quantity'] as int,
    totalPrice: (json['totalPrice'] as num).toDouble(),
    deliveryFee: (json['deliveryFee'] as num).toDouble(),
    paymentMethod: PaymentMethod.gridCredits,
    paymentStatus: PaymentStatus.pending,
    orderStatus: OrderStatus.submitted,
    deliveryOption: json['deliveryOption'] as String,
    deliveryAddressId: json['deliveryAddressId'].toString(),
    createdAt: now,
    updatedAt: now,
  );
}

Map<String, dynamic> _aggregateBatchOrderJson({required String paymentMethod}) {
  final now = DateTime(2026, 4, 25, 12).toIso8601String();
  return {
    'id': 7,
    'orderId': 'ORD-10007',
    'userId': 'usr_001',
    'batchOrderId': 1,
    'batchOrder': {'batchRef': 'BATCH-10001'},
    'category': 'batch',
    'quantity': 2,
    'totalPrice': '415.00',
    'deliveryFee': '50.00',
    'paymentMethod': paymentMethod,
    'paymentStatus': 'pending',
    'orderStatus': 'orderPlaced',
    'deliveryOption': 'delivery',
    'deliveryAddressId': 9,
    'deliveryAddress': {
      'label': 'Studio',
      'fullAddress': '123 Print Street',
      'barangay': 'Barangay 1',
      'city': 'Manila',
      'province': 'Metro Manila',
      'zipCode': '1000',
      'latitude': 14.5995,
      'longitude': 120.9842,
    },
    'createdAt': now,
    'updatedAt': now,
    'items': [
      {
        'id': 701,
        'orderId': 'ORD-ITEM-1',
        'category': 'paper',
        'fileName': 'proposal.pdf',
        'fileUrl': '/tmp/proposal.pdf',
        'fileMetadataId': 42,
        'quantity': 1,
        'totalPrice': '175.00',
      },
      {
        'id': 702,
        'orderId': 'ORD-ITEM-2',
        'category': '3d',
        'fileName': 'gear.stl',
        'fileUrl': '/tmp/gear.stl',
        'fileMetadataId': 84,
        'quantity': 1,
        'totalPrice': '240.00',
      },
    ],
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
    specialInstructions: 'Trim to the crop marks.',
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
