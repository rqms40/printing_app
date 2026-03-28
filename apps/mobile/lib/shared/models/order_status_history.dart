import 'enums.dart';

class OrderStatusHistory {
  const OrderStatusHistory({
    required this.id,
    required this.orderId,
    required this.fromStatus,
    required this.toStatus,
    this.changedByUserId,
    this.notes,
    required this.createdAt,
  });

  final String id;
  final String orderId;
  final OrderStatus fromStatus;
  final OrderStatus toStatus;
  final String? changedByUserId;
  final String? notes;
  final DateTime createdAt;

  OrderStatusHistory copyWith({
    String? id,
    String? orderId,
    OrderStatus? fromStatus,
    OrderStatus? toStatus,
    String? changedByUserId,
    String? notes,
    DateTime? createdAt,
  }) {
    return OrderStatusHistory(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      fromStatus: fromStatus ?? this.fromStatus,
      toStatus: toStatus ?? this.toStatus,
      changedByUserId: changedByUserId ?? this.changedByUserId,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'OrderStatusHistory(${fromStatus.displayName} -> ${toStatus.displayName})';
}
