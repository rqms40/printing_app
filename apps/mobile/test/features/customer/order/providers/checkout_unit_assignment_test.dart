import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';

void main() {
  group('Multi-drop unit assignments', () {
    test('switching to multidrop creates Drop 1 and auto-assigns all copies', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 100, quantity: 2));
      n.addItem(_item('b', 50));

      n.setMode(DeliveryMode.multidrop);
      final state = c.read(checkoutProvider);

      expect(state.drops.length, 1);
      final dropId = state.drops.first.id;
      expect(state.unitAssignments['a'], [dropId, dropId]);
      expect(state.unitAssignments['b'], [dropId]);
    });

    test('assignUnit moves a single copy to another drop', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 100, quantity: 2));
      n.setMode(DeliveryMode.multidrop);
      final firstDropId = c.read(checkoutProvider).drops.first.id;

      n.setDrops([
        ...c.read(checkoutProvider).drops,
        const DestinationGroup(id: 'drop-2', label: 'Drop 2', itemIds: []),
      ]);
      n.assignUnit('a', 1, 'drop-2');

      final assignments = c.read(checkoutProvider).unitAssignments['a']!;
      expect(assignments[0], firstDropId);
      expect(assignments[1], 'drop-2');
    });

    test('removing a drop falls back to the first remaining drop', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 100, quantity: 2));
      n.setMode(DeliveryMode.multidrop);
      final firstDropId = c.read(checkoutProvider).drops.first.id;

      n.setDrops([
        ...c.read(checkoutProvider).drops,
        const DestinationGroup(id: 'drop-2', label: 'Drop 2', itemIds: []),
      ]);
      n.assignUnit('a', 0, 'drop-2');
      n.assignUnit('a', 1, 'drop-2');

      // Now remove drop-2 — both copies should fall back to firstDropId.
      n.setDrops(
        c.read(checkoutProvider).drops.where((d) => d.id != 'drop-2').toList(),
      );
      expect(c.read(checkoutProvider).unitAssignments['a'], [
        firstDropId,
        firstDropId,
      ]);
    });

    test('increasing quantity pads new copies with the first drop', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 100, quantity: 1));
      n.setMode(DeliveryMode.multidrop);
      final firstDropId = c.read(checkoutProvider).drops.first.id;
      n.setDrops([
        ...c.read(checkoutProvider).drops,
        const DestinationGroup(id: 'drop-2', label: 'Drop 2', itemIds: []),
      ]);
      n.assignUnit('a', 0, 'drop-2');

      n.setQuantity('a', 3);

      final assignments = c.read(checkoutProvider).unitAssignments['a']!;
      expect(assignments.length, 3);
      // The original copy stays on drop-2; new copies inherit fallback (first drop).
      expect(assignments[0], 'drop-2');
      expect(assignments[1], firstDropId);
      expect(assignments[2], firstDropId);
    });

    test('removing an item drops its assignments', () {
      final c = ProviderContainer();
      final n = c.read(checkoutProvider.notifier);
      n.addItem(_item('a', 100));
      n.setMode(DeliveryMode.multidrop);
      n.removeItem('a');
      expect(c.read(checkoutProvider).unitAssignments.containsKey('a'), isFalse);
    });
  });
}

CartItem _item(String id, double price, {int quantity = 1}) => CartItem(
      id: id,
      category: 'paper',
      fileName: '$id.pdf',
      filePath: '/tmp/$id.pdf',
      fileSize: 1,
      fileMetadataId: 1,
      quantity: quantity,
      pageCount: 1,
      printSubtotal: price,
      createdAt: DateTime.now(),
    );
