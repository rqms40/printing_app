import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_payment_card.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('shows "Choose payment method" when none selected', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
    ));
    expect(find.text('Choose payment method'), findsOneWidget);
  });

  testWidgets('shows method label when selected', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).setPaymentMethod(PaymentMethod.gridCredits);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
    ));
    expect(find.textContaining('GRID Credits'), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);
  });
}
