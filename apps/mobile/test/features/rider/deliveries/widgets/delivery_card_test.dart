import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/deliveries/widgets/delivery_card.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('exposes the rider assignment details and open action', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final now = DateTime(2026, 7, 11, 12);
    final view = RiderAssignmentView(
      assignment: DeliveryAssignment(
        id: '12',
        orderId: '7',
        riderId: '1',
        status: DeliveryStatus.assigned,
        createdAt: now,
        updatedAt: now,
      ),
      order: const RiderOrderContext(
        orderRef: 'ORD-10007',
        orderInternalId: '7',
        category: 'paper',
        quantity: 1,
        totalPrice: 29,
        deliveryFee: 27,
        destination: RiderDestinationContext(
          fullAddress: 'Mark beta route address, Davao City',
        ),
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DeliveryCard(view: view, onTap: () {}),
        ),
      ),
    );

    final control = find.bySemanticsLabel(RegExp(r'^Delivery ORD-10007\.'));
    expect(control, findsOneWidget);
    expect(
      tester
          .getSemantics(control)
          .getSemanticsData()
          .hasAction(ui.SemanticsAction.tap),
      isTrue,
    );
    expect(find.text('Accept'), findsOneWidget);
    expect(find.text('Decline'), findsOneWidget);
    expect(
      tester
          .widget<GestureDetector>(find.byType(GestureDetector).first)
          .excludeFromSemantics,
      isTrue,
      reason: 'the labeled delivery control owns the card tap semantics',
    );
    semantics.dispose();
  });
}
