import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/screens/category_screen.dart';

void main() {
  testWidgets('shows "Add to your order" + Skip when addMode=true', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1,
      printSubtotal: 100, createdAt: DateTime.now(),
    ));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: CategoryScreen(addMode: true)),
    ));
    await tester.pumpAndSettle();
    expect(find.textContaining('Add to your order'), findsOneWidget);
    expect(find.text('Skip — review checkout'), findsOneWidget);
  });
}
