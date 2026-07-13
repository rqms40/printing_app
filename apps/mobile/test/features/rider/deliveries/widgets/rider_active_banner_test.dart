import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/deliveries/widgets/rider_active_banner.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('exposes one named continue-delivery action', (tester) async {
    final semantics = tester.ensureSemantics();
    final now = DateTime(2026, 7, 11, 12);
    final view = RiderAssignmentView(
      assignment: DeliveryAssignment(
        id: '11',
        orderId: '4',
        riderId: '1',
        status: DeliveryStatus.onTheWay,
        createdAt: now,
        updatedAt: now,
      ),
      order: const RiderOrderContext(
        orderRef: 'ORD-10004',
        orderInternalId: '4',
        category: 'paper',
        quantity: 1,
        totalPrice: 250,
        deliveryFee: 50,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RiderActiveBanner(view: view, onTap: () {}),
        ),
      ),
    );

    final control = find.bySemanticsLabel(
      RegExp(r'^Continue delivery\. ORD-10004\.'),
    );
    expect(control, findsOneWidget);
    expect(
      tester
          .getSemantics(control)
          .getSemanticsData()
          .hasAction(ui.SemanticsAction.tap),
      isTrue,
    );
    semantics.dispose();
  });
}
