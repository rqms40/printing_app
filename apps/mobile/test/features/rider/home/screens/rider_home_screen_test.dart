import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/home/screens/rider_home_screen.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('does not promote assigned-only jobs into Active Stop', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap([
        _view(
          id: 'assigned-one',
          status: DeliveryStatus.assigned,
          customerName: 'Maria Santos',
        ),
      ]),
    );

    expect(find.text('GRID'), findsOneWidget);
    expect(find.text('Active Stop'), findsNothing);
    expect(
      find.text('No active stop — check Orders for new assignments.'),
      findsOneWidget,
    );
  });

  testWidgets('uses the in-progress assignment as the Active Stop', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap([
        _view(
          id: 'assigned-one',
          status: DeliveryStatus.assigned,
          customerName: 'New Customer',
        ),
        _view(
          id: 'active-one',
          status: DeliveryStatus.pickedUp,
          customerName: 'Maria Santos',
        ),
      ]),
    );

    expect(find.text('Active Stop'), findsOneWidget);
    expect(find.text('Maria Santos'), findsOneWidget);
    expect(find.text('New Customer'), findsNothing);
  });

  testWidgets('renders the rider cockpit shell', (tester) async {
    await tester.pumpWidget(
      _wrap([
        _view(
          id: 'active-one',
          status: DeliveryStatus.pickedUp,
          customerName: 'Maria Santos',
        ),
      ]),
    );

    expect(find.text('GRID'), findsOneWidget);
    expect(find.text('MAPPING THE FUTURE OF PRINTING.'), findsOneWidget);
    expect(find.text('Active Stop'), findsOneWidget);
    expect(find.text('Maria Santos'), findsOneWidget);
  });
}

Widget _wrap(List<RiderAssignmentView> views) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((_) {
        final notifier = AuthNotifier();
        notifier.devBypass('rider');
        return notifier;
      }),
      deliveriesProvider.overrideWith(
        (_) => DeliveriesNotifier(
          bootstrap: false,
          initialState: DeliveriesState(views: views),
        ),
      ),
    ],
    child: const MaterialApp(
      home: SizedBox(width: 390, height: 844, child: RiderHomeScreen()),
    ),
  );
}

RiderAssignmentView _view({
  required String id,
  required DeliveryStatus status,
  required String customerName,
}) {
  final now = DateTime.utc(2026, 6, 17, 10);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: id,
      orderId: 'order-$id',
      riderId: 'rider-1',
      status: status,
      assignedAt: now.subtract(const Duration(minutes: 15)),
      acceptedAt: status == DeliveryStatus.assigned
          ? null
          : now.subtract(const Duration(minutes: 10)),
      pickedUpAt: switch (status) {
        DeliveryStatus.pickedUp ||
        DeliveryStatus.onTheWay ||
        DeliveryStatus.arrived => now.subtract(const Duration(minutes: 5)),
        _ => null,
      },
      onTheWayAt: switch (status) {
        DeliveryStatus.onTheWay || DeliveryStatus.arrived => now,
        _ => null,
      },
      createdAt: now.subtract(const Duration(minutes: 20)),
      updatedAt: now,
    ),
    order: RiderOrderContext(
      orderRef: 'ORD-$id',
      orderInternalId: id,
      category: 'A3 Glossy',
      quantity: 3,
      totalPrice: 360,
      deliveryFee: 80,
      customerName: customerName,
      customerPhone: '+639171234567',
      destination: const RiderDestinationContext(
        fullAddress: '123 CM Recto Avenue, Davao City',
        barangay: 'Poblacion',
        city: 'Davao City',
        latitude: 7.0731,
        longitude: 125.6128,
      ),
    ),
  );
}
