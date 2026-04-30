import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
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
    expect(captured?['priority'], true);
  });
}
