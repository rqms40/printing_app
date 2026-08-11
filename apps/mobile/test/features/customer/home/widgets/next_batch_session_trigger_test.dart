import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_dialog.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_session_trigger.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../../order/providers/delivery_slot_provider_test.mocks.dart';

const _info = NextBatchInfo(
  reason: NextBatchReason.dayOver,
  todayDate: '2099-07-16',
  relevantDate: '2099-07-17',
  relevantIsToday: false,
  upcoming: [
    UpcomingSlot(
      startTime: '09:30:00',
      endTime: '11:30:00',
      bookedCount: 2,
      capacity: 10,
    ),
  ],
  nextSlotStart: '09:30:00',
  nextSlotEnd: '11:30:00',
);

Order _onTheWayOrder() => Order(
  id: 'ord_test',
  orderId: 'ORD-TEST-001',
  userId: 'usr_001',
  category: 'Poster',
  quantity: 1,
  totalPrice: 500.0,
  deliveryFee: 80.0,
  paymentMethod: PaymentMethod.gcash,
  paymentStatus: PaymentStatus.paid,
  orderStatus: OrderStatus.outForDelivery,
  deliveryOption: 'delivery',
  createdAt: DateTime(2026, 7, 16),
  updatedAt: DateTime(2026, 7, 16),
);

Widget _wrap({
  NextBatchInfo? info = _info,
  bool ordersLoaded = true,
  BookedSlotInfo? booked,
  List<Order> activeOrders = const [],
}) {
  return ProviderScope(
    overrides: [
      dioProvider.overrideWithValue(MockDio()),
      nextBatchInfoProvider.overrideWith((_) => info),
      ordersInitialLoadCompleteProvider.overrideWith((_) => ordersLoaded),
      bookedDeliverySlotProvider.overrideWith((_) => booked),
      activeOrdersProvider.overrideWithValue(activeOrders),
    ],
    child: const MaterialApp(
      home: NextBatchSessionTrigger(child: Scaffold(body: Text('home'))),
    ),
  );
}

void main() {
  testWidgets('shows the reminder when nothing is booked or in flight', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();
    expect(find.text('Catch the next batch'), findsNothing);
    expect(find.text("Today's last batch has departed"), findsOneWidget);
  });

  testWidgets('stays silent while the customer has a booked batch', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        booked: const BookedSlotInfo(
          orderId: 'ORD-1',
          slot: AssignedDeliverySlot(
            slotTemplateId: 1,
            date: '2099-07-16',
            startTime: '09:30:00',
            endTime: '11:30:00',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text("Today's last batch has departed"), findsNothing);
  });

  testWidgets('stays silent while a delivery is on the road', (tester) async {
    await tester.pumpWidget(_wrap(activeOrders: [_onTheWayOrder()]));
    await tester.pumpAndSettle();
    expect(find.text("Today's last batch has departed"), findsNothing);
  });

  testWidgets('shows without waiting when orders have not loaded yet', (
    tester,
  ) async {
    // Fail-open: an unloaded orders list must never delay the reminder —
    // deferring makes it pop mid-interaction once orders land.
    await tester.pumpWidget(_wrap(ordersLoaded: false));
    await tester.pumpAndSettle();
    expect(find.text("Today's last batch has departed"), findsOneWidget);
  });

  testWidgets('booked batch does not suppress before orders load', (
    tester,
  ) async {
    // A booked slot can only be known once orders are loaded; with the flag
    // false the reminder still shows (fail-open).
    await tester.pumpWidget(
      _wrap(
        ordersLoaded: false,
        booked: const BookedSlotInfo(
          orderId: 'ORD-1',
          slot: AssignedDeliverySlot(
            slotTemplateId: 1,
            date: '2099-07-16',
            startTime: '09:30:00',
            endTime: '11:30:00',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text("Today's last batch has departed"), findsOneWidget);
  });
}
