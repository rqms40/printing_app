import 'enums.dart';
import 'paper_specs.dart';
import 'three_d_specs.dart';

class Order {
  const Order({
    required this.id,
    required this.orderId,
    required this.userId,
    required this.category,
    this.fileUrl,
    this.fileName,
    this.paperSpecs,
    this.threeDSpecs,
    required this.quantity,
    required this.totalPrice,
    required this.deliveryFee,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.orderStatus,
    this.declineReason,
    this.cancellationReason,
    this.cancelledAt,
    required this.deliveryOption,
    this.deliveryAddressId,
    this.assignedDriverId,
    this.estimatedCompletionAt,
    this.adminNotes,
    this.trackingLink,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String orderId; // ORD-XXXXX
  final String userId;
  final String category;
  final String? fileUrl;
  final String? fileName;
  final PaperSpecs? paperSpecs;
  final ThreeDSpecs? threeDSpecs;
  final int quantity;
  final double totalPrice;
  final double deliveryFee;
  final PaymentMethod paymentMethod;
  final PaymentStatus paymentStatus;
  final OrderStatus orderStatus;
  final String? declineReason;
  final String? cancellationReason;
  final DateTime? cancelledAt;
  final String deliveryOption;
  final String? deliveryAddressId;
  final String? assignedDriverId;
  final DateTime? estimatedCompletionAt;
  final String? adminNotes;
  final String? trackingLink;
  final DateTime createdAt;
  final DateTime updatedAt;

  Order copyWith({
    String? id,
    String? orderId,
    String? userId,
    String? category,
    String? fileUrl,
    String? fileName,
    PaperSpecs? paperSpecs,
    ThreeDSpecs? threeDSpecs,
    int? quantity,
    double? totalPrice,
    double? deliveryFee,
    PaymentMethod? paymentMethod,
    PaymentStatus? paymentStatus,
    OrderStatus? orderStatus,
    String? declineReason,
    String? cancellationReason,
    DateTime? cancelledAt,
    String? deliveryOption,
    String? deliveryAddressId,
    String? assignedDriverId,
    DateTime? estimatedCompletionAt,
    String? adminNotes,
    String? trackingLink,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Order(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      userId: userId ?? this.userId,
      category: category ?? this.category,
      fileUrl: fileUrl ?? this.fileUrl,
      fileName: fileName ?? this.fileName,
      paperSpecs: paperSpecs ?? this.paperSpecs,
      threeDSpecs: threeDSpecs ?? this.threeDSpecs,
      quantity: quantity ?? this.quantity,
      totalPrice: totalPrice ?? this.totalPrice,
      deliveryFee: deliveryFee ?? this.deliveryFee,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      orderStatus: orderStatus ?? this.orderStatus,
      declineReason: declineReason ?? this.declineReason,
      cancellationReason: cancellationReason ?? this.cancellationReason,
      cancelledAt: cancelledAt ?? this.cancelledAt,
      deliveryOption: deliveryOption ?? this.deliveryOption,
      deliveryAddressId: deliveryAddressId ?? this.deliveryAddressId,
      assignedDriverId: assignedDriverId ?? this.assignedDriverId,
      estimatedCompletionAt: estimatedCompletionAt ?? this.estimatedCompletionAt,
      adminNotes: adminNotes ?? this.adminNotes,
      trackingLink: trackingLink ?? this.trackingLink,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() =>
      'Order($orderId, ${orderStatus.displayName}, $category)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Order && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
