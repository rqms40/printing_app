import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';

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
        items: [_item('a', 100, quantity: 5), _item('b', 50, quantity: 2)],
      );
      expect(state.itemCount, 2);
    });

    test('temporary checkout address serializes pinned location details', () {
      const address = TemporaryCheckoutAddress(
        label: 'Temporary drop',
        fullAddress: 'Unit 12, Jacinto Extension, Davao City',
        city: 'Davao City',
        landmark: 'Beside the blue gate',
        latitude: 7.0731,
        longitude: 125.6128,
      );

      expect(address.isValid, isTrue);
      expect(address.displayLabel, 'Temporary drop');
      expect(address.toJson(), {
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
    });

    test(
      'temporary checkout address is invalid without text or coordinates',
      () {
        const address = TemporaryCheckoutAddress(
          fullAddress: '',
          city: 'Davao City',
          latitude: 0,
          longitude: 0,
        );

        expect(address.isValid, isFalse);
      },
    );

    test(
      'destination group accepts saved or temporary address destinations',
      () {
        const temporary = TemporaryCheckoutAddress(
          label: 'Event booth',
          fullAddress: 'SMX Booth A12, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        );

        const savedDrop = DestinationGroup(
          id: 'drop-1',
          label: 'Home',
          itemIds: [],
          addressId: 12,
        );
        const temporaryDrop = DestinationGroup(
          id: 'drop-2',
          label: 'Drop 2',
          itemIds: [],
          temporaryAddress: temporary,
        );

        expect(savedDrop.hasValidDestination, isTrue);
        expect(savedDrop.destinationLabel, 'Home');
        expect(temporaryDrop.hasValidDestination, isTrue);
        expect(temporaryDrop.destinationLabel, 'Event booth');
      },
    );
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
