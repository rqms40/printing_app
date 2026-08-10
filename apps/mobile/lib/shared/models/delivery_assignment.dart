import 'enums.dart';

class DeliveryProof {
  const DeliveryProof({
    required this.type,
    this.fileId,
    this.objectKey,
    this.signatureData,
    this.capturedAt,
    this.capturedByRiderId,
  });

  final String type;
  final int? fileId;
  final String? objectKey;
  final String? signatureData;
  final DateTime? capturedAt;
  final String? capturedByRiderId;
}

class DeliveryAssignment {
  const DeliveryAssignment({
    required this.id,
    required this.orderId,
    required this.riderId,
    required this.status,
    this.assignedAt,
    this.acceptedAt,
    this.pickedUpAt,
    this.onTheWayAt,
    this.arrivedAt,
    this.deliveredAt,
    this.declineReason,
    this.proofPhotoUrl,
    this.proof,
    this.pickupOtp,
    this.deliveryOtp,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String orderId;
  final String riderId;
  final DeliveryStatus status;
  final DateTime? assignedAt;
  final DateTime? acceptedAt;
  final DateTime? pickedUpAt;
  final DateTime? onTheWayAt;
  final DateTime? arrivedAt;
  final DateTime? deliveredAt;
  final String? declineReason;
  final String? proofPhotoUrl;
  final DeliveryProof? proof;

  /// Active supplier pickup OTP (null after pickup verified).
  final String? pickupOtp;

  /// Active customer delivery OTP (null until after pickup / after delivery).
  final String? deliveryOtp;
  final DateTime createdAt;
  final DateTime updatedAt;

  DeliveryAssignment copyWith({
    String? id,
    String? orderId,
    String? riderId,
    DeliveryStatus? status,
    DateTime? assignedAt,
    DateTime? acceptedAt,
    DateTime? pickedUpAt,
    DateTime? onTheWayAt,
    DateTime? arrivedAt,
    DateTime? deliveredAt,
    String? declineReason,
    String? proofPhotoUrl,
    DeliveryProof? proof,
    String? pickupOtp,
    String? deliveryOtp,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DeliveryAssignment(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      riderId: riderId ?? this.riderId,
      status: status ?? this.status,
      assignedAt: assignedAt ?? this.assignedAt,
      acceptedAt: acceptedAt ?? this.acceptedAt,
      pickedUpAt: pickedUpAt ?? this.pickedUpAt,
      onTheWayAt: onTheWayAt ?? this.onTheWayAt,
      arrivedAt: arrivedAt ?? this.arrivedAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      declineReason: declineReason ?? this.declineReason,
      proofPhotoUrl: proofPhotoUrl ?? this.proofPhotoUrl,
      proof: proof ?? this.proof,
      pickupOtp: pickupOtp ?? this.pickupOtp,
      deliveryOtp: deliveryOtp ?? this.deliveryOtp,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() => 'DeliveryAssignment($id, ${status.displayName})';
}
