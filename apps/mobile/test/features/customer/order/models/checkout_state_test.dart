import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';

void main() {
  group('CheckoutState', () {
    test('default state is empty delivery mode with standard tier', () {
      const state = CheckoutState();
      expect(state.items, isEmpty);
      expect(state.mode, DeliveryMode.delivery);
      expect(state.speedTier, DeliverySpeedTier.standard);
      expect(state.subtotal, 0);
    });

    test('subtotal sums item printSubtotal', () {
      final state = CheckoutState(items: [_item('a', 100), _item('b', 50)]);
      expect(state.subtotal, 150);
    });

    test('itemCount returns number of items, not sum of quantities', () {
      final state = CheckoutState(
        items: [
          _item('a', 100, quantity: 5),
          _item('b', 50, quantity: 2),
        ],
      );
      expect(state.itemCount, 2);
    });
  });
}

CartItem _item(String id, double price, {int quantity = 1}) => CartItem(
  id: id,
  category: 'paper',
  fileName: '$id.pdf',
  filePath: '/tmp/$id.pdf',
  fileSize: 1024,
  fileMetadataId: 1,
  quantity: quantity,
  pageCount: 1,
  printSubtotal: price,
  createdAt: DateTime.now(),
);
