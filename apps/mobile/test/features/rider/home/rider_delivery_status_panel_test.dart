import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_delivery_status_panel.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

RiderAssignmentView _view(String id, {String? name}) {
  final t = DateTime(2026, 6, 18);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: id, orderId: id, riderId: 'r1',
      status: DeliveryStatus.assigned, createdAt: t, updatedAt: t,
    ),
    order: RiderOrderContext(
      orderRef: 'ORD-$id', orderInternalId: id, category: 'paper',
      quantity: 1, totalPrice: 100, deliveryFee: 25, customerName: name,
      destination: const RiderDestinationContext(
        barangay: 'Talomo', city: 'Davao', latitude: 7.05, longitude: 125.6,
      ),
    ),
  );
}

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(brightness: Brightness.dark),
      home: Scaffold(body: SizedBox(height: 260, child: child)),
    );

void main() {
  testWidgets('renders header, progress, current-stop highlight', (tester) async {
    await tester.pumpWidget(_wrap(RiderDeliveryStatusPanel(
      deliveredStops: [_view('1', name: 'Maria'), _view('2', name: 'Juan')],
      currentStop: _view('3', name: 'Ana'),
      upcomingStops: [_view('4', name: 'Leo')],
      onTapStop: (_) {},
    )));
    await tester.pump();

    expect(find.text('Delivery Status'), findsOneWidget);
    expect(find.textContaining('2/4'), findsOneWidget);
    expect(find.textContaining('You are at Stop 3'), findsOneWidget);
    expect(find.textContaining('Delivered'), findsWidgets);
  });

  testWidgets('empty route shows no-active message', (tester) async {
    await tester.pumpWidget(_wrap(const RiderDeliveryStatusPanel(
      deliveredStops: [], currentStop: null, upcomingStops: [],
      onTapStop: _noop,
    )));
    await tester.pump();
    expect(find.textContaining('No active route'), findsOneWidget);
  });
}

void _noop(RiderAssignmentView _) {}
