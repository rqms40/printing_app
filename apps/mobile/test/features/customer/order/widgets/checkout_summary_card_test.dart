import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_summary_card.dart';

void main() {
  testWidgets('renders subtotal, delivery, service fee rows', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
          id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
          fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1,
          printSubtotal: 200, createdAt: DateTime.now(),
        ));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSummaryCard())),
    ));
    expect(find.textContaining('Subtotal'), findsOneWidget);
    expect(find.textContaining('Delivery'), findsOneWidget);
    expect(find.textContaining('Service fee'), findsOneWidget);
  });
}
