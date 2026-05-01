import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/multidrop_groups.dart';

void main() {
  testWidgets('renders one row per drop and "Add another drop" link', (tester) async {
    final container = ProviderContainer();
    final n = container.read(checkoutProvider.notifier);
    n.addItem(CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1,
      printSubtotal: 100, createdAt: DateTime.now(),
    ));
    n.setDrops([
      const DestinationGroup(id: '1', label: 'Drop 1', itemIds: ['a']),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
    ));
    expect(find.text('Drop 1'), findsOneWidget);
    expect(find.text('Add another drop'), findsOneWidget);
  });

  testWidgets('+ Add another drop appends an empty group', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).setDrops([
      const DestinationGroup(id: '1', label: 'Drop 1', itemIds: []),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
    ));
    await tester.tap(find.text('Add another drop'));
    await tester.pump();
    expect(container.read(checkoutProvider).drops.length, 2);
  });
}
