import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/orders/widgets/order_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

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
      orderStatus: OrderStatus.orderPlaced,
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

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: OrderCard(order: order)),
      ),
    );

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
    final now = DateTime(2026, 4, 25, 12);
    var opened = false;
    final order = Order(
      id: '101',
      orderId: 'ORD-10001',
      userId: '1',
      category: 'paper',
      fileName: 'proposal.pdf',
      quantity: 1,
      totalPrice: 175,
      deliveryFee: 50,
      paymentMethod: PaymentMethod.gridCredits,
      paymentStatus: PaymentStatus.pending,
      orderStatus: OrderStatus.orderPlaced,
      deliveryOption: 'delivery',
      createdAt: now,
      updatedAt: now,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(order: order, onTap: () => opened = true),
        ),
      ),
    );

    final control = find.bySemanticsLabel(RegExp(r'^Order ORD-10001\.'));
    expect(control, findsOneWidget);
    final semanticsData = tester.getSemantics(control).getSemanticsData();
    expect(semanticsData.hasAction(ui.SemanticsAction.tap), isTrue);
    expect(opened, isFalse);
    semantics.dispose();
  });
}
