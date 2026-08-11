import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/tracking/screens/delivery_tracking_screen.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

Order _order({
  required String id,
  required String orderId,
  required OrderStatus status,
  AssignedRiderContact? rider,
  String? assignedRiderId,
  String? deliveryAssignmentId,
}) {
  final now = DateTime(2026, 7, 8);
  return Order(
    id: id,
    orderId: orderId,
    userId: '1',
    category: 'paper',
    quantity: 1,
    totalPrice: 100,
    deliveryFee: 50,
    paymentMethod: PaymentMethod.gcash,
    paymentStatus: PaymentStatus.paid,
    orderStatus: status,
    deliveryOption: 'delivery',
    assignedRiderId: assignedRiderId,
    deliveryAssignmentId: deliveryAssignmentId,
    canTrackDelivery: deliveryAssignmentId != null,
    assignedRider: rider,
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  group('selectDeliveryTrackingOrder', () {
    const rider = AssignedRiderContact(
      userId: '2',
      riderProfileId: '1',
      displayName: 'Juan Reyes',
      phoneNumber: '+639181234567',
      vehicleType: 'motorcycle',
      plateNumber: 'ABC 1234',
      deliveryAssignmentId: '1',
      deliveryStatus: 'on_the_way',
    );

    test('uses route id when one is provided', () {
      final orders = [
        _order(
          id: '4',
          orderId: 'ORD-10004',
          status: OrderStatus.outForDelivery,
          rider: rider,
          assignedRiderId: '2',
          deliveryAssignmentId: '1',
        ),
        _order(id: '6', orderId: 'ORD-10006', status: OrderStatus.cancelled),
      ];

      expect(
        selectDeliveryTrackingOrder(orders, 'ORD-10006')?.orderId,
        'ORD-10006',
      );
    });

    test('selects the active assigned delivery when route id is absent', () {
      final orders = [
        _order(id: '1', orderId: 'ORD-10001', status: OrderStatus.submitted),
        _order(
          id: '4',
          orderId: 'ORD-10004',
          status: OrderStatus.outForDelivery,
          rider: rider,
          assignedRiderId: '2',
          deliveryAssignmentId: '1',
        ),
      ];

      final selected = selectDeliveryTrackingOrder(orders, null);

      expect(selected?.orderId, 'ORD-10004');
      expect(selected?.assignedRider?.displayName, 'Juan Reyes');
    });

    test('does not select an on-the-way order without tracking access', () {
      final orders = [
        _order(
          id: '4',
          orderId: 'ORD-10004',
          status: OrderStatus.outForDelivery,
        ),
      ];

      expect(selectDeliveryTrackingOrder(orders, null), isNull);
    });
  });
}
