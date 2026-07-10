import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/services/api_client.dart';

import '../../../../helpers/test_setup.dart';

Address _address({String id = '1', bool isDefault = false}) => Address(
  id: id,
  userId: '7',
  label: 'Home',
  fullAddress: '12 Sampaguita St',
  city: 'Davao City',
  latitude: 7.064,
  longitude: 125.608,
  isDefault: isDefault,
  createdAt: DateTime.utc(2026, 7, 10),
  updatedAt: DateTime.utc(2026, 7, 10),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  Interceptor? interceptor;

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
    interceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/addresses' ||
            options.path.startsWith('/addresses/')) {
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
              error: 'offline',
            ),
          );
          return;
        }
        handler.next(options);
      },
    );
    ApiClient.instance.dio.interceptors.add(interceptor!);
  });

  tearDownAll(() {
    final value = interceptor;
    if (value != null) ApiClient.instance.dio.interceptors.remove(value);
  });

  test(
    'real-flow refresh preserves existing addresses and exposes retry error',
    () async {
      final original = _address();
      final notifier = AddressNotifier(
        initialState: [original],
        skipBootstrap: true,
        realFlow: true,
      );
      addTearDown(notifier.dispose);

      final refreshed = await notifier.refreshAddresses();

      expect(refreshed, isFalse);
      expect(notifier.state, [original]);
      expect(notifier.errorMessage, 'Unable to load saved addresses');
    },
  );

  test(
    'real-flow address mutations report failure without local success',
    () async {
      final original = _address();
      final notifier = AddressNotifier(
        initialState: [original],
        skipBootstrap: true,
        realFlow: true,
      );
      addTearDown(notifier.dispose);

      final added = await notifier.addAddress(_address(id: 'pending'));
      expect(added, isNull);
      expect(notifier.state, [original]);
      expect(notifier.errorMessage, 'Address was not saved');

      final updated = await notifier.updateAddress(
        original.copyWith(label: 'Renamed'),
      );
      expect(updated, isFalse);
      expect(notifier.state.single.label, 'Home');
      expect(notifier.errorMessage, 'Unable to update this address');

      final defaulted = await notifier.setDefault(original.id);
      expect(defaulted, isFalse);
      expect(notifier.state.single.isDefault, isFalse);
      expect(notifier.errorMessage, 'Unable to set the default address');

      final deleted = await notifier.deleteAddress(original.id);
      expect(deleted, isFalse);
      expect(notifier.state, [original]);
      expect(notifier.errorMessage, 'Unable to delete this address');
    },
  );
}
