import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/order_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

Widget _wrap(Widget child, {DeliveryFeeSettings? fees}) {
  return ProviderScope(
    overrides: [
      deliveryFeeSettingsProvider.overrideWith(
        (ref) async =>
            fees ??
            const DeliveryFeeSettings(
              deliveryFeePerKm: 25,
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            ),
      ),
    ],
    child: MaterialApp(home: Scaffold(body: child)),
  );
}

Order _order({
  double totalPrice = 150,
  double deliveryFee = 25,
  double priorityFee = 0,
  int? quotedPriceMinor,
}) {
  final now = DateTime(2026, 4, 25, 12);
  return Order(
    id: '101',
    orderId: 'ORD-10024',
    userId: '1',
    category: 'paper',
    fileName: 'file.pdf',
    quantity: 1,
    totalPrice: totalPrice,
    deliveryFee: deliveryFee,
    priorityFee: priorityFee,
    paymentMethod: PaymentMethod.gridCredits,
    paymentStatus: PaymentStatus.pending,
    orderStatus: OrderStatus.submitted,
    deliveryOption: 'delivery',
    assignedSupplier: quotedPriceMinor == null
        ? null
        : AssignedSupplierContact(
            supplierId: 9,
            businessName: 'Print shop',
            quotedPriceMinor: quotedPriceMinor,
          ),
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  testWidgets('OrderCard presents batch orders as one multi-item order', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final now = DateTime(2026, 4, 25, 12);
    final order = Order(
      id: '101',
      orderId: 'BATCH-10001',
      userId: '1',
      batchOrderId: '77',
      batchId: 'BATCH-10001',
      category: 'batch',
      fileName: '2 print jobs',
      quantity: 3,
      totalPrice: 415,
      deliveryFee: 50,
      paymentMethod: PaymentMethod.gridCredits,
      paymentStatus: PaymentStatus.pending,
      orderStatus: OrderStatus.submitted,
      deliveryOption: 'delivery',
      createdAt: now,
      updatedAt: now,
      items: const [
        OrderLineItem(
          id: '101',
          orderId: 'ORD-10001',
          category: 'paper',
          fileName: 'proposal.pdf',
          quantity: 2,
          totalPrice: 175,
        ),
        OrderLineItem(
          id: '102',
          orderId: 'ORD-10002',
          category: '3d',
          fileName: 'gear.stl',
          quantity: 1,
          totalPrice: 240,
        ),
      ],
    );

    await tester.pumpWidget(_wrap(OrderCard(order: order)));
    await tester.pumpAndSettle();

    expect(find.text('BATCH-10001'), findsOneWidget);
    expect(find.text('MIXED'), findsOneWidget);
    expect(find.text('2 items · proposal.pdf + gear.stl'), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp(r'^Order BATCH-10001\.')),
      findsOneWidget,
    );
    semantics.dispose();
  });

  testWidgets('OrderCard exposes its open action to web semantics', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    var opened = false;
    final order = _order(totalPrice: 175, deliveryFee: 50);

    await tester.pumpWidget(
      _wrap(OrderCard(order: order, onTap: () => opened = true)),
    );
    await tester.pumpAndSettle();

    final control = find.bySemanticsLabel(RegExp(r'^Order ORD-10024\.'));
    expect(control, findsOneWidget);
    final semanticsData = tester.getSemantics(control).getSemanticsData();
    expect(semanticsData.hasAction(ui.SemanticsAction.tap), isTrue);
    expect(opened, isFalse);
    semantics.dispose();
  });

  testWidgets('shows initial estimate, not print subtotal', (tester) async {
    await tester.pumpWidget(
      _wrap(
        OrderCard(order: _order(totalPrice: 150, deliveryFee: 25)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('₱175.00'), findsOneWidget);
    expect(find.text('₱150.00'), findsNothing);
  });

  testWidgets('updates to quoted final print plus delivery and service fee', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        OrderCard(
          order: _order(
            totalPrice: 150,
            deliveryFee: 25,
            quotedPriceMinor: 20000,
          ),
        ),
        fees: const DeliveryFeeSettings(
          deliveryFeePerKm: 25,
          priorityFeeAmount: 50,
          extraDestinationSurcharge: 30,
          serviceFeePercent: 10,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 200 print + 20 service + 25 delivery
    expect(find.text('₱245.00'), findsOneWidget);
    expect(find.text('₱175.00'), findsNothing);
  });
}
