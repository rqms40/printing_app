import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/features/admin/queue/widgets/queue_order_card.dart';
import 'package:printing_app/features/admin/queue/widgets/status_picker.dart';
import 'package:printing_app/features/admin/rider_management/widgets/rider_list_tile.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/rider_profile.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

void main() {
  Widget wrapForPhone(Widget child, {double width = 320}) {
    return MaterialApp(
      theme: AppTheme.light,
      home: MediaQuery(
        data: MediaQueryData(size: Size(width, 640)),
        child: Scaffold(
          body: Center(
            child: SizedBox(width: width, child: child),
          ),
        ),
      ),
    );
  }

  testWidgets('status picker fits long status labels in narrow cards', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      wrapForPhone(
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: SizedBox(
            width: 140,
            child: StatusPicker(
              currentStatus: OrderStatus.delivered,
              onStatusSelected: _noopStatus,
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('queue order card handles long operational values on phone width', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final order = MockData.orders.first.copyWith(
      orderId: 'ORD-2026-VERY-LONG-REFERENCE-000001',
      totalPrice: 999999999,
      deliveryFee: 99999,
      items: [
        const OrderLineItem(
          id: 'item-long',
          orderId: 'ORD-2026-VERY-LONG-REFERENCE-000001',
          category: 'paper',
          fileName:
              'architectural-blueprint-final-final-revision-super-long-file-name.pdf',
          quantity: 99,
          totalPrice: 999999999,
        ),
      ],
    );

    await tester.pumpWidget(
      wrapForPhone(
        Padding(
          padding: const EdgeInsets.all(16),
          child: QueueOrderCard(order: order),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'rider list tile keeps assign action reachable on narrow screens',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final rider = RiderProfile(
        id: 'rider-long',
        userId: 'unknown-user-with-long-id-for-fallback-name',
        vehicleType: VehicleType.motorcycle,
        plateNumber: 'DAVAO-GRIDGO-DELIVERY-PLATE-2026',
        licenseNumber: 'LTO-123',
        isAvailable: true,
        createdAt: DateTime(2026),
        updatedAt: DateTime(2026),
      );

      await tester.pumpWidget(
        wrapForPhone(
          Padding(
            padding: const EdgeInsets.all(16),
            child: RiderListTile(rider: rider, onAssign: () {}),
          ),
        ),
      );

      expect(find.text('Assign'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

void _noopStatus(OrderStatus status) {}
