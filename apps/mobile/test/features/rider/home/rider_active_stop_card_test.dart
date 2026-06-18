import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_active_stop_card.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

RiderAssignmentView _view() {
  final t = DateTime(2026, 6, 18);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: '10005', orderId: '10005', riderId: 'r1',
      status: DeliveryStatus.onTheWay, createdAt: t, updatedAt: t,
    ),
    order: const RiderOrderContext(
      orderRef: 'ORD-10005', orderInternalId: '10005', category: 'A3 Glossy',
      quantity: 3, totalPrice: 300, deliveryFee: 25, customerName: 'Maria',
    ),
  );
}

void main() {
  testWidgets('renders customer, summary, ref, and action icons', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(brightness: Brightness.dark),
      home: Scaffold(body: RiderActiveStopCard(view: _view())),
    ));
    await tester.pump();

    expect(find.text('Active Stop'), findsOneWidget);
    expect(find.text('Maria'), findsOneWidget);
    expect(find.textContaining('A3 Glossy'), findsOneWidget);
    expect(find.textContaining('ORD-10005'), findsOneWidget);
    expect(find.byKey(const ValueKey('rider-stop-call')), findsOneWidget);
    expect(find.byKey(const ValueKey('rider-stop-message')), findsOneWidget);
  });
}
