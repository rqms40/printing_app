import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/active_delivery/screens/active_delivery_screen.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

class _MutableDeliveriesNotifier extends DeliveriesNotifier {
  _MutableDeliveriesNotifier(DeliveryStatus status)
    : super(
        bootstrap: false,
        initialState: DeliveriesState(views: [_view(status)]),
      );

  void setStatus(DeliveryStatus status) {
    final current = state.views.single;
    state = state.copyWith(
      views: [
        RiderAssignmentView(
          assignment: current.assignment.copyWith(status: status),
          order: current.order,
        ),
      ],
    );
  }
}

RiderAssignmentView _view(DeliveryStatus status) {
  final now = DateTime(2026, 7, 11, 12);
  return RiderAssignmentView(
    assignment: DeliveryAssignment(
      id: '42',
      orderId: '1042',
      riderId: '7',
      status: status,
      createdAt: now,
      updatedAt: now,
    ),
    order: const RiderOrderContext(
      orderRef: 'GRID-1042',
      orderInternalId: '1042',
      category: 'Paper print',
      quantity: 1,
      totalPrice: 12,
      deliveryFee: 0,
      customerName: 'Ven',
      customerPhone: '09170000000',
      destination: RiderDestinationContext(
        fullAddress: 'Ven beta delivery address',
        latitude: 7.1907,
        longitude: 125.4553,
      ),
    ),
  );
}

Widget _app(_MutableDeliveriesNotifier notifier) {
  return ProviderScope(
    overrides: [deliveriesProvider.overrideWith((_) => notifier)],
    child: const MaterialApp(home: ActiveDeliveryScreen(assignmentId: '42')),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('shows proof confirmation immediately when opened as arrived', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final notifier = _MutableDeliveriesNotifier(DeliveryStatus.arrived);
    await tester.pumpWidget(_app(notifier));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    final proofControl = find.byKey(
      const ValueKey('rider-delivery-confirm-slider'),
    );
    expect(proofControl, findsOneWidget);
    expect(tester.getRect(proofControl).bottom, lessThanOrEqualTo(844));
    expect(
      find.widgetWithText(TextButton, 'Open proof of delivery').hitTestable(),
      findsOneWidget,
    );
  });

  testWidgets('expands proof confirmation when delivery becomes arrived', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final notifier = _MutableDeliveriesNotifier(DeliveryStatus.onTheWay);
    await tester.pumpWidget(_app(notifier));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(
      find.byKey(const ValueKey('rider-delivery-confirm-slider')).hitTestable(),
      findsNothing,
    );

    notifier.setStatus(DeliveryStatus.arrived);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    final proofControl = find.byKey(
      const ValueKey('rider-delivery-confirm-slider'),
    );
    expect(proofControl, findsOneWidget);
    expect(tester.getRect(proofControl).bottom, lessThanOrEqualTo(844));
    expect(
      find.widgetWithText(TextButton, 'Open proof of delivery').hitTestable(),
      findsOneWidget,
    );
  });
}
