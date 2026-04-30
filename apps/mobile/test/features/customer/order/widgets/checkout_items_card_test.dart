import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_items_card.dart';

void main() {
  testWidgets('renders one row per item with name and quantity', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).addItem(CartItem(
          id: 'a', category: 'paper', fileName: 'thesis.pdf', filePath: '/tmp/a.pdf',
          fileSize: 1, fileMetadataId: 1, quantity: 3, pageCount: 10,
          printSubtotal: 150, createdAt: DateTime.now(),
        ));

    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const Scaffold(body: CheckoutItemsCard())),
      GoRoute(path: '/customer/order/new', builder: (_, _) => const Scaffold(body: SizedBox())),
    ]);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));

    expect(find.text('thesis.pdf'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('+ Add Items'), findsOneWidget);
  });
}
