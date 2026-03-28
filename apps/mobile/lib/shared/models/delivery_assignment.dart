import 'enums.dart';

class DeliveryAssignment {
  const DeliveryAssignment({
    required this.id,
    required this.orderId,
    required this.driverId,
    required this.status,
    this.assignedAt,
    this.acceptedAt,
    this.pickedUpAt,
    this.onTheWayAt,
    this.arrivedAt,
    this.deliveredAt,
    this.declineReason,
    this.proofPhotoUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String orderId;
  final String driverId;
  final DeliveryStatus status;
  final DateTime? assignedAt;
  final DateTime? acceptedAt;
  final DateTime? pickedUpAt;
  final DateTime? onTheWayAt;
  final DateTime? arrivedAt;
  final DateTime? deliveredAt;
  final String? declineReason;
  final String? proofPhotoUrl;
  final DateTime createdAt;
  final DateTime updatedAt;

  DeliveryAssignment copyWith({
    String? id,
    String? orderId,
    String? driverId,
    DeliveryStatus? status,
    DateTime? assignedAt,
    DateTime? acceptedAt,
    DateTime? pickedUpAt,
    DateTime? onTheWayAt,
    DateTime? arrivedAt,
    DateTime? deliveredAt,
    String? declineReason,
    String? proofPhotoUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DeliveryAssignment(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      driverId: driverId ?? this.driverId,
      status: status ?? this.status,
      assignedAt: assignedAt ?? this.assignedAt,
      acceptedAt: acceptedAt ?? this.acceptedAt,
      pickedUpAt: pickedUpAt ?? this.pickedUpAt,
      onTheWayAt: onTheWayAt ?? this.onTheWayAt,
      arrivedAt: arrivedAt ?? this.arrivedAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      declineReason: declineReason ?? this.declineReason,
      proofPhotoUrl: proofPhotoUrl ?? this.proofPhotoUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() =>
      'DeliveryAssignment($id, ${status.displayName})';
}
