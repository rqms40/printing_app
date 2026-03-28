import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

import '../../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
  });

  group('AddressNotifier', () {
    late AddressNotifier notifier;

    setUp(() async {
      notifier = AddressNotifier();
      // Wait for async _fetchAddresses to complete (falls back to MockData)
      await Future.delayed(const Duration(milliseconds: 200));
    });

    test('initializes with MockData addresses (API fallback)', () {
      expect(notifier.state, isNotEmpty);
      expect(notifier.state.length, MockData.addresses.length);
    });

    test('canAddMore is true when under max limit', () {
      // MockData has 3 addresses, max is 5
      expect(notifier.canAddMore, true);
    });

    test('addAddress appends to list', () async {
      final initialCount = notifier.state.length;
      final newAddress = Address(
        id: 'addr_new',
        userId: 'usr_001',
        label: 'Gym',
        fullAddress: '999 Fitness Ave, Pasig City',
        city: 'Pasig City',
        latitude: 14.58,
        longitude: 121.06,
        isDefault: false,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await notifier.addAddress(newAddress);

      expect(notifier.state.length, initialCount + 1);
      expect(notifier.state.last.label, 'Gym');
    });

    test('addAddress with isDefault unsets other defaults', () async {
      final defaultAddr = Address(
        id: 'addr_new_default',
        userId: 'usr_001',
        label: 'New Default',
        fullAddress: '100 Main St, Manila',
        city: 'Manila',
        latitude: 14.60,
        longitude: 121.00,
        isDefault: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await notifier.addAddress(defaultAddr);

      // Only the new address should be default
      final defaults = notifier.state.where((a) => a.isDefault).toList();
      expect(defaults.length, 1);
      expect(defaults.first.id, 'addr_new_default');
    });

    test('deleteAddress removes address from list', () async {
      final initialCount = notifier.state.length;
      final idToDelete = notifier.state.last.id;

      await notifier.deleteAddress(idToDelete);

      expect(notifier.state.length, initialCount - 1);
      expect(notifier.state.where((a) => a.id == idToDelete), isEmpty);
    });

    test('setDefault updates only the target address to default', () async {
      // Set the second address as default
      final targetId = notifier.state[1].id;

      await notifier.setDefault(targetId);

      for (final a in notifier.state) {
        if (a.id == targetId) {
          expect(a.isDefault, true);
        } else {
          expect(a.isDefault, false);
        }
      }
    });

    test('updateAddress replaces the matching address', () async {
      final original = notifier.state.first;
      final updated = original.copyWith(label: 'Updated Home');

      await notifier.updateAddress(updated);

      final result = notifier.state.firstWhere((a) => a.id == original.id);
      expect(result.label, 'Updated Home');
    });

    test('addAddress respects max limit of 5', () async {
      // Add addresses until we hit the limit
      for (var i = 0; i < 5; i++) {
        if (!notifier.canAddMore) break;
        await notifier.addAddress(Address(
          id: 'addr_fill_$i',
          userId: 'usr_001',
          label: 'Fill $i',
          fullAddress: 'Address $i',
          city: 'City',
          latitude: 14.0 + i * 0.01,
          longitude: 121.0 + i * 0.01,
          isDefault: false,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        ));
      }

      // Now at max — try adding one more
      expect(notifier.canAddMore, false);
      final countAtMax = notifier.state.length;

      await notifier.addAddress(Address(
        id: 'addr_over_limit',
        userId: 'usr_001',
        label: 'Over Limit',
        fullAddress: 'Should not be added',
        city: 'City',
        latitude: 14.0,
        longitude: 121.0,
        isDefault: false,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ));

      expect(notifier.state.length, countAtMax); // unchanged
    });

    test('refreshAddresses reloads from MockData', () async {
      // Delete an address
      await notifier.deleteAddress(notifier.state.first.id);
      expect(notifier.state.length, MockData.addresses.length - 1);

      // Refresh reloads
      await notifier.refreshAddresses();
      expect(notifier.state.length, MockData.addresses.length);
    });
  });
}
