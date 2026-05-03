import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Map<String, dynamic>? captured;
  late InterceptorsWrapper iw;

  setUpAll(() {
    const secureStorageChannel = MethodChannel(
      'plugins.it_nomads.com/flutter_secure_storage',
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorageChannel, (_) async => null);

    ApiClient.instance.init(baseUrl: 'http://mock-test/api');
  });

  setUp(() {
    captured = null;
    iw = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/orders/batch') {
          captured = Map<String, dynamic>.from(options.data as Map);
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: {'batchId': 'BATCH-1', 'orders': const []},
            ),
          );
          return;
        }
        handler.next(options);
      },
    );
    ApiClient.instance.dio.interceptors.add(iw);
  });

  tearDown(() {
    ApiClient.instance.dio.interceptors.remove(iw);
  });

  test('placeCheckout posts speedTier to /orders/batch', () async {
    final container = ProviderContainer(
      overrides: [
        ordersProvider.overrideWith(
          (ref) => OrdersNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = CheckoutState(
      items: [
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
      ],
      paymentMethod: PaymentMethod.cod,
      speedTier: DeliverySpeedTier.priority,
    );

    await container.read(ordersProvider.notifier).placeCheckout(state);

    expect(captured, isNotNull);
    expect(captured?['speedTier'], 'priority');
    expect(captured?['paymentMethod'], 'cod');
    expect(captured?['deliveryOption'], 'delivery');
    // Server's whitelist DTO rejects `priority`, so the field must NOT be sent.
    expect(captured?.containsKey('priority'), isFalse);
  });

  test('placeCheckout omits stale scheduled slot for standard tier', () async {
    final container = ProviderContainer(
      overrides: [
        ordersProvider.overrideWith(
          (ref) => OrdersNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = CheckoutState(
      items: [_cartItem()],
      paymentMethod: PaymentMethod.cod,
      speedTier: DeliverySpeedTier.standard,
      scheduledSlot: const ScheduledSlot(
        templateId: 7,
        date: '2026-05-04',
        startTime: '09:00:00',
        endTime: '11:00:00',
      ),
    );

    await container.read(ordersProvider.notifier).placeCheckout(state);

    expect(captured, isNotNull);
    expect(captured?['speedTier'], 'standard');
    expect(captured?.containsKey('slotTemplateId'), isFalse);
    expect(captured?.containsKey('slotDate'), isFalse);
  });

  test('placeCheckout sends selected slot only for scheduled tier', () async {
    final container = ProviderContainer(
      overrides: [
        ordersProvider.overrideWith(
          (ref) => OrdersNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = CheckoutState(
      items: [_cartItem()],
      paymentMethod: PaymentMethod.cod,
      speedTier: DeliverySpeedTier.scheduled,
      scheduledSlot: const ScheduledSlot(
        templateId: 7,
        date: '2026-05-04',
        startTime: '09:00:00',
        endTime: '11:00:00',
      ),
    );

    await container.read(ordersProvider.notifier).placeCheckout(state);

    expect(captured, isNotNull);
    expect(captured?['speedTier'], 'scheduled');
    expect(captured?['slotTemplateId'], 7);
    expect(captured?['slotDate'], '2026-05-04');
  });

  test(
    'placeCheckout posts temporary pinned address without deliveryAddressId',
    () async {
      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = CheckoutState(
        items: [
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
        ],
        paymentMethod: PaymentMethod.cod,
        temporaryAddress: const TemporaryCheckoutAddress(
          label: 'Temporary drop',
          fullAddress: 'Unit 12, Jacinto Extension, Davao City',
          city: 'Davao City',
          landmark: 'Beside the blue gate',
          latitude: 7.0731,
          longitude: 125.6128,
        ),
      );

      await container.read(ordersProvider.notifier).placeCheckout(state);

      expect(captured, isNotNull);
      expect(captured?['deliveryAddressId'], isNull);
      expect(captured?['temporaryAddress'], {
        'label': 'Temporary drop',
        'fullAddress': 'Unit 12, Jacinto Extension, Davao City',
        'barangay': null,
        'city': 'Davao City',
        'province': null,
        'zipCode': null,
        'landmark': 'Beside the blue gate',
        'latitude': 7.0731,
        'longitude': 125.6128,
      });
    },
  );

  test(
    'placeCheckout posts saved address id without temporary address',
    () async {
      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = CheckoutState(
        items: [
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
        ],
        paymentMethod: PaymentMethod.cod,
        singleAddress: _address('9'),
      );

      await container.read(ordersProvider.notifier).placeCheckout(state);

      expect(captured, isNotNull);
      expect(captured?['deliveryAddressId'], 9);
      expect(captured?.containsKey('temporaryAddress'), isFalse);
    },
  );

  test(
    'placeCheckout posts mixed saved and temporary multidrop destinations',
    () async {
      final container = ProviderContainer(
        overrides: [
          ordersProvider.overrideWith(
            (ref) =>
                OrdersNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      final item = CartItem(
        id: 'a',
        category: 'paper',
        fileName: 'a.pdf',
        filePath: '/tmp/a.pdf',
        fileSize: 1,
        fileMetadataId: 1,
        quantity: 2,
        pageCount: 1,
        printSubtotal: 200,
        createdAt: DateTime.now(),
      );
      const temporaryAddress = TemporaryCheckoutAddress(
        label: 'Event booth',
        fullAddress: 'SMX Booth A12, Davao City',
        city: 'Davao City',
        landmark: 'Near loading bay',
        latitude: 7.0731,
        longitude: 125.6128,
      );
      final state = CheckoutState(
        items: [item],
        mode: DeliveryMode.multidrop,
        paymentMethod: PaymentMethod.cod,
        drops: const [
          DestinationGroup(
            id: 'drop-1',
            label: 'Home',
            itemIds: [],
            addressId: 10,
          ),
          DestinationGroup(
            id: 'drop-2',
            label: 'Drop 2',
            itemIds: [],
            temporaryAddress: temporaryAddress,
          ),
        ],
        unitAssignments: const {
          'a': ['drop-1', 'drop-2'],
        },
      );

      await container.read(ordersProvider.notifier).placeCheckout(state);

      expect(captured, isNotNull);
      expect(captured?['deliveryAddressId'], isNull);
      expect(captured?.containsKey('temporaryAddress'), isFalse);
      expect(captured?['destinations'], [
        {'addressId': 10, 'label': 'Home'},
        {
          'label': 'Event booth',
          'address': {
            'label': 'Event booth',
            'fullAddress': 'SMX Booth A12, Davao City',
            'barangay': null,
            'city': 'Davao City',
            'province': null,
            'zipCode': null,
            'landmark': 'Near loading bay',
            'latitude': 7.0731,
            'longitude': 125.6128,
          },
        },
      ]);
      final payloadItems = captured?['items'] as List<dynamic>;
      expect(payloadItems, hasLength(2));
      expect(payloadItems[0]['destinationIndex'], 0);
      expect(payloadItems[1]['destinationIndex'], 1);
    },
  );

  test('placeCheckout rejects multidrop drops without destinations', () async {
    final container = ProviderContainer(
      overrides: [
        ordersProvider.overrideWith(
          (ref) => OrdersNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = CheckoutState(
      items: [
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
      ],
      mode: DeliveryMode.multidrop,
      paymentMethod: PaymentMethod.cod,
      drops: const [
        DestinationGroup(id: 'drop-1', label: 'Drop 1', itemIds: []),
      ],
      unitAssignments: const {
        'a': ['drop-1'],
      },
    );

    expect(
      () => container.read(ordersProvider.notifier).placeCheckout(state),
      throwsA(isA<StateError>()),
    );
    expect(captured, isNull);
  });

  test('placeCheckout rejects multidrop copies without assignment', () async {
    final container = ProviderContainer(
      overrides: [
        ordersProvider.overrideWith(
          (ref) => OrdersNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);

    final state = CheckoutState(
      items: [
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
      ],
      mode: DeliveryMode.multidrop,
      paymentMethod: PaymentMethod.cod,
      drops: const [
        DestinationGroup(
          id: 'drop-1',
          label: 'Home',
          itemIds: [],
          addressId: 10,
        ),
      ],
      unitAssignments: const {},
    );

    expect(
      () => container.read(ordersProvider.notifier).placeCheckout(state),
      throwsA(isA<StateError>()),
    );
    expect(captured, isNull);
  });
}

CartItem _cartItem() => CartItem(
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
);

Address _address(String id) => Address(
  id: id,
  userId: '1',
  label: 'Home',
  fullAddress: 'Home address',
  city: 'Davao City',
  latitude: 7.0731,
  longitude: 125.6128,
  isDefault: false,
  createdAt: DateTime.now(),
  updatedAt: DateTime.now(),
);
