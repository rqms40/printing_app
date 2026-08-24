import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/features/customer/order/providers/matching_preview_provider.dart';

ProviderContainer _container({DeliveryFeeSettings? fees}) {
  return ProviderContainer(
    overrides: [
      if (fees != null)
        deliveryFeeSettingsProvider.overrideWith((ref) async => fees),
    ],
  );
}

void main() {
  group('checkoutFeesProvider', () {
    test('standard tier: 25 delivery fee, no priority surcharge', () {
      final c = _container();
      c.read(checkoutProvider.notifier).addItem(_item('a', 200));
      final fees = c.read(checkoutFeesProvider);
      expect(fees.subtotal, 200);
      expect(fees.deliveryFee, 25);
      expect(fees.priorityFee, 0);
      expect(fees.extraDropFee, 0);
      expect(fees.serviceFee, 0);
      expect(fees.total, 225);
    });

    test('uses admin delivery fee per km, priority fee, and % service fee',
        () async {
      final c = _container(
        fees: const DeliveryFeeSettings(
          deliveryFeePerKm: 100,
          priorityFeeAmount: 50,
          extraDestinationSurcharge: 30,
          serviceFeePercent: 10,
        ),
      );
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      await c.read(deliveryFeeSettingsProvider.future);

      expect(c.read(checkoutFeesProvider).deliveryFee, 100);
      expect(c.read(checkoutFeesProvider).priorityFee, 0);
      expect(c.read(checkoutFeesProvider).serviceFee, 20);
      expect(c.read(checkoutFeesProvider).basePriorityFee, 50);
      expect(c.read(checkoutFeesProvider).total, 200 + 20 + 100);

      n.setSpeedTier(DeliverySpeedTier.priority);
      final express = c.read(checkoutFeesProvider);
      expect(express.deliveryFee, 100);
      expect(express.priorityFee, 50);
      expect(express.serviceFee, 20);
      expect(express.total, 200 + 20 + 100 + 50);
    });

    test('matching preview does not replace admin delivery option fee', () async {
      final c = ProviderContainer(
        overrides: [
          deliveryFeeSettingsProvider.overrideWith(
            (ref) async => const DeliveryFeeSettings(
              deliveryFeePerKm: 50,
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            ),
          ),
          matchingPreviewProvider.overrideWith(
            (ref) => _QuotedMatchingPreview(),
          ),
        ],
      );
      addTearDown(c.dispose);
      c.read(checkoutProvider.notifier).addItem(_item('a', 200));
      await c.read(deliveryFeeSettingsProvider.future);

      expect(c.read(checkoutFeesProvider).deliveryFee, 50);
    });

    test('express tier includes the configured priority surcharge', () {
      final c = _container();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 200));
      n.setSpeedTier(DeliverySpeedTier.priority);
      final fees = c.read(checkoutFeesProvider);
      expect(fees.deliveryFee, 25);
      expect(fees.priorityFee, 50);
      expect(fees.total, 275);
    });

    test('multidrop with 2 drops adds the configured extra-drop fee', () {
      final c = _container();
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

class _QuotedMatchingPreview extends MatchingPreviewNotifier {
  _QuotedMatchingPreview() {
    state = _quoted;
  }

  static const _quoted = MatchedSupplierPreview(
    supplierId: 9,
    businessName: 'Quoted shop',
    preference: 'quality',
    deliveryFeePesos: 25,
    feeIsEstimate: true,
  );

  @override
  Future<MatchedSupplierPreview?> preview({
    required String category,
    int? destinationId,
    double? latitude,
    double? longitude,
  }) async {
    state = _quoted;
    return _quoted;
  }
}
