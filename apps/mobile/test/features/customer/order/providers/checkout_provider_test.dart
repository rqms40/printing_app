import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  group('CheckoutNotifier', () {
    late ProviderContainer container;
    setUp(() => container = ProviderContainer());
    tearDown(() => container.dispose());

    test('addItem appends to items', () {
      container.read(checkoutProvider.notifier).addItem(_item('a', 120));
      expect(container.read(checkoutProvider).items.length, 1);
      expect(container.read(checkoutProvider).subtotal, 120);
    });

    test('removeItem deletes by id', () {
      final n = container.read(checkoutProvider.notifier);
      n.addItem(_item('a', 100));
      n.addItem(_item('b', 50));
      n.removeItem('a');
      expect(container.read(checkoutProvider).items.single.id, 'b');
    });

    test('setMode switches mode', () {
      container.read(checkoutProvider.notifier).setMode(DeliveryMode.multidrop);
      expect(container.read(checkoutProvider).mode, DeliveryMode.multidrop);
    });

    test('setScheduledSlot also flips speedTier to scheduled', () {
      container
          .read(checkoutProvider.notifier)
          .setScheduledSlot(
            const ScheduledSlot(
              templateId: 1,
              date: '2026-05-01',
              startTime: '09:00:00',
              endTime: '11:00:00',
            ),
          );
      expect(
        container.read(checkoutProvider).speedTier,
        DeliverySpeedTier.scheduled,
      );
      expect(container.read(checkoutProvider).scheduledSlot, isNotNull);
    });

    test('setSpeedTier clears stale scheduled slot for immediate tiers', () {
      final notifier = container.read(checkoutProvider.notifier);
      notifier.setScheduledSlot(
        const ScheduledSlot(
          templateId: 1,
          date: '2026-05-01',
          startTime: '09:00:00',
          endTime: '11:00:00',
        ),
      );

      notifier.setSpeedTier(DeliverySpeedTier.standard);

      final state = container.read(checkoutProvider);
      expect(state.speedTier, DeliverySpeedTier.standard);
      expect(state.scheduledSlot, isNull);
    });

    test('setPaymentMethod updates state', () {
      container
          .read(checkoutProvider.notifier)
          .setPaymentMethod(PaymentMethod.gridCredits);
      expect(
        container.read(checkoutProvider).paymentMethod,
        PaymentMethod.gridCredits,
      );
    });

    test('temporary pinned address keeps saved single address as fallback', () {
      final notifier = container.read(checkoutProvider.notifier);
      notifier.setSingleAddress(_address('9', 'Home'));

      notifier.setTemporaryAddress(
        const TemporaryCheckoutAddress(
          label: 'Event booth',
          fullAddress: 'SMX Convention Center, Davao City',
          city: 'Davao City',
          latitude: 7.0764,
          longitude: 125.6138,
        ),
      );

      final state = container.read(checkoutProvider);
      expect(state.singleAddress?.id, '9');
      expect(state.temporaryAddress?.fullAddress, contains('SMX'));
    });

    test('saved single address replaces temporary pinned address', () {
      final notifier = container.read(checkoutProvider.notifier);
      notifier.setTemporaryAddress(
        const TemporaryCheckoutAddress(
          fullAddress: 'Temporary site, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        ),
      );

      notifier.setSingleAddress(_address('9', 'Home'));

      final state = container.read(checkoutProvider);
      expect(state.singleAddress?.id, '9');
      expect(state.temporaryAddress, isNull);
    });
  });
}

CartItem _item(String id, double price) => CartItem(
  id: id,
  category: 'paper',
  fileName: '$id.pdf',
  filePath: '/tmp/$id.pdf',
  fileSize: 1024,
  fileMetadataId: 1,
  quantity: 1,
  pageCount: 1,
  printSubtotal: price,
  createdAt: DateTime.now(),
);

Address _address(String id, String label) => Address(
  id: id,
  userId: '1',
  label: label,
  fullAddress: '$label address',
  city: 'Davao City',
  latitude: 7.0731,
  longitude: 125.6128,
  isDefault: false,
  createdAt: DateTime.now(),
  updatedAt: DateTime.now(),
);
