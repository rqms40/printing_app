import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/rider/home/widgets/rider_active_stop_card.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('renders compact active stop details and actions', (
    tester,
  ) async {
    var called = false;
    var messaged = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(brightness: Brightness.dark),
        home: Scaffold(
          body: RiderActiveStopCard(
            view: _view(),
            onCall: () => called = true,
            onMessage: () => messaged = true,
          ),
        ),
      ),
    );

    expect(find.text('Active Stop'), findsOneWidget);
    expect(find.text('Maria'), findsOneWidget);
    expect(find.text('A3 Glossy, 3 Copies'), findsOneWidget);
    expect(find.text('#ORD-1005'), findsOneWidget);

    final name = tester.widget<Text>(find.text('Maria'));
    expect(name.style?.color, AppColors.dark.brand);

    await tester.tap(find.byKey(const ValueKey('rider-stop-message')));
    await tester.tap(find.byKey(const ValueKey('rider-stop-call')));
    expect(messaged, isTrue);
    expect(called, isTrue);
  });

  testWidgets('shows the plan leg ETA and distance when the stop is planned', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(brightness: Brightness.dark),
        home: Scaffold(
          body: RiderActiveStopCard(
            view: _view(
              planStop: const RiderDispatchPlanStop(
                assignmentId: 'assignment-1',
                sequence: 1,
                status: RiderDispatchStopStatus.pending,
                destinationLatitude: 7.2,
                destinationLongitude: 125.5,
                legDurationSeconds: 540,
                legDistanceMeters: 2300,
                geometry: null,
                geometryMalformed: false,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('~9 min · 2.3 km'), findsOneWidget);
  });
}

RiderAssignmentView _view({RiderDispatchPlanStop? planStop}) {
  final now = DateTime.utc(2026, 6, 17, 10);
  return RiderAssignmentView(
    planStop: planStop,
    assignment: DeliveryAssignment(
      id: 'assignment-1',
      orderId: 'order-1',
      riderId: 'rider-1',
      status: DeliveryStatus.onTheWay,
      createdAt: now,
      updatedAt: now,
    ),
    order: const RiderOrderContext(
      orderRef: 'ORD-1005',
      orderInternalId: 'order-1',
      category: 'A3 Glossy',
      quantity: 3,
      totalPrice: 360,
      deliveryFee: 80,
      customerName: 'Maria',
      customerPhone: '+639171234567',
    ),
  );
}
