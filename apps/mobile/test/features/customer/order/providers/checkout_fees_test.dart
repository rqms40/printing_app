import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';

void main() {
  group('checkoutFeesProvider', () {
    test('standard tier: 25 delivery fee, no priority surcharge', () {
      final c = ProviderContainer();
      c.read(checkoutProvider.notifier).addItem(_item('a', 200));
      final fees = c.read(checkoutFeesProvider);
      expect(fees.subtotal, 200);
      expect(fees.deliveryFee, 25);
      expect(fees.priorityFee, 0);
      expect(fees.extraDropFee, 0);
      expect(fees.serviceFee, 2);
      expect(fees.total, 227);
    });

    test('express tier includes the configured priority surcharge', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      n.setSpeedTier(DeliverySpeedTier.priority);
      final fees = c.read(checkoutFeesProvider);
      expect(fees.deliveryFee, 25);
      expect(fees.priorityFee, 50);
      expect(fees.total, 277);
    });

    test('multidrop with 2 drops adds the configured extra-drop fee', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      n.setDrops([
        const DestinationGroup(id: '1', label: 'A', itemIds: []),
        const DestinationGroup(id: '2', label: 'B', itemIds: []),
      ]);
      final fees = c.read(checkoutFeesProvider);
      expect(fees.extraDropFee, 30);
    });
  });
}

CartItem _item(String id, double price) => CartItem(
  id: id,
  category: 'paper',
  fileName: '$id.pdf',
  filePath: '/tmp/$id.pdf',
  fileSize: 1,
  fileMetadataId: 1,
  quantity: 1,
  pageCount: 1,
  printSubtotal: price,
  createdAt: DateTime.now(),
);
