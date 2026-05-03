import 'enums.dart';
import 'paper_specs.dart';
import 'three_d_specs.dart';

class OrderDeliveryAddress {
  const OrderDeliveryAddress({
    this.label,
    required this.fullAddress,
    this.barangay,
    required this.city,
    this.province,
    this.zipCode,
    this.landmark,
    required this.latitude,
    required this.longitude,
  });

  final String? label;
  final String fullAddress;
  final String? barangay;
  final String city;
  final String? province;
  final String? zipCode;
  final String? landmark;
  final double latitude;
  final double longitude;
}

class AssignedDeliverySlot {
  const AssignedDeliverySlot({
    required this.slotTemplateId,
    required this.date,
    required this.startTime,
    required this.endTime,
  });

  final int slotTemplateId;
  final String date;
  final String startTime;
  final String endTime;
}

class OrderLineItem {
  const OrderLineItem({
    required this.id,
    required this.orderId,
    required this.category,
    this.fileUrl,
    this.fileName,
    this.fileMetadataId,
    this.specs = const {},
    this.specDisplayValues = const {},
    this.paperSpecs,
    this.threeDSpecs,
    required this.quantity,
    required this.totalPrice,
    this.specialInstructions,
  });

  final String id;
  final String orderId;
  final String category;
  final String? fileUrl;
  final String? fileName;
  final int? fileMetadataId;
  final Map<String, dynamic> specs;
  final Map<String, String> specDisplayValues;
  final PaperSpecs? paperSpecs;
  final ThreeDSpecs? threeDSpecs;
  final int quantity;
  final double totalPrice;
  final String? specialInstructions;
}

class Order {
  const Order({
    required this.id,
    required this.orderId,
    required this.userId,
    this.batchOrderId,
    this.batchId,
    required this.category,
    this.fileUrl,
    this.fileName,
    this.fileMetadataId,
    this.specs = const {},
    this.specDisplayValues = const {},
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
    this.deliveryAddress,
    this.assignedDriverId,
    this.deliveryAssignmentId,
    this.estimatedCompletionAt,
    this.adminStatusNote,
    this.adminStatusSetAt,
    this.adminNotes,
    this.trackingLink,
    this.assignedSlot,
    this.items = const [],
    this.specialInstructions,
    required this.createdAt,
    required this.updatedAt,
    this.printMode = 'fitToPage',
  });

  final String id;
  final String orderId; // ORD-XXXXX
  final String userId;
  final String? batchOrderId;
  final String? batchId;
  final String category;
  final String? fileUrl;
  final String? fileName;
  final int? fileMetadataId;
  final Map<String, dynamic> specs;
  final Map<String, String> specDisplayValues;
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
  final OrderDeliveryAddress? deliveryAddress;
  final String? assignedDriverId;
  final String? deliveryAssignmentId;
  final DateTime? estimatedCompletionAt;
  final String? adminStatusNote;
  final DateTime? adminStatusSetAt;
  final String? adminNotes;
  final String? trackingLink;
  final AssignedDeliverySlot? assignedSlot;
  final List<OrderLineItem> items;
  final String? specialInstructions;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// `'fitToPage'` or `'actualSize'`.
  final String printMode;

  List<OrderLineItem> get lineItems {
    if (items.isNotEmpty) return items;

    return [
      OrderLineItem(
        id: id,
        orderId: orderId,
        category: category == '3d' ? '3d' : 'paper',
        fileUrl: fileUrl,
        fileName: fileName,
        fileMetadataId: fileMetadataId,
        specs: specs,
        specDisplayValues: specDisplayValues,
        paperSpecs: paperSpecs,
        threeDSpecs: threeDSpecs,
        quantity: quantity,
        totalPrice: totalPrice,
        specialInstructions: specialInstructions,
      ),
    ];
  }

  bool get isBatchOrder => lineItems.length > 1;
  int get itemCount => lineItems.length;
  bool get hasMixedItemTypes {
    final categories = lineItems.map((item) => item.category).toSet();
    return categories.contains('paper') && categories.contains('3d');
  }

  String get orderTypeShortLabel {
    if (hasMixedItemTypes) return 'Mixed';
    if (lineItems.any((item) => item.category == '3d')) return '3D';
    return 'Paper';
  }

  String get orderTypeLabel => '$orderTypeShortLabel Printing';

  String get itemSummary {
    final names = lineItems
        .take(2)
        .map((item) => item.fileName ?? _categoryLabel(item.category))
        .join(' + ');
    final overflow = lineItems.length > 2
        ? ' +${lineItems.length - 2} more'
        : '';
    return '$names$overflow';
  }

  Order copyWith({
    String? id,
    String? orderId,
    String? userId,
    String? batchOrderId,
    String? batchId,
    String? category,
    String? fileUrl,
    String? fileName,
    int? fileMetadataId,
    Map<String, dynamic>? specs,
    Map<String, String>? specDisplayValues,
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
    OrderDeliveryAddress? deliveryAddress,
    String? assignedDriverId,
    String? deliveryAssignmentId,
    DateTime? estimatedCompletionAt,
    String? adminStatusNote,
    DateTime? adminStatusSetAt,
    String? adminNotes,
    String? trackingLink,
    AssignedDeliverySlot? assignedSlot,
    List<OrderLineItem>? items,
    String? specialInstructions,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? printMode,
  }) {
    return Order(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      userId: userId ?? this.userId,
      batchOrderId: batchOrderId ?? this.batchOrderId,
      batchId: batchId ?? this.batchId,
      category: category ?? this.category,
      fileUrl: fileUrl ?? this.fileUrl,
      fileName: fileName ?? this.fileName,
      fileMetadataId: fileMetadataId ?? this.fileMetadataId,
      specs: specs ?? this.specs,
      specDisplayValues: specDisplayValues ?? this.specDisplayValues,
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
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      assignedDriverId: assignedDriverId ?? this.assignedDriverId,
      deliveryAssignmentId: deliveryAssignmentId ?? this.deliveryAssignmentId,
      estimatedCompletionAt:
          estimatedCompletionAt ?? this.estimatedCompletionAt,
      adminStatusNote: adminStatusNote ?? this.adminStatusNote,
      adminStatusSetAt: adminStatusSetAt ?? this.adminStatusSetAt,
      adminNotes: adminNotes ?? this.adminNotes,
      trackingLink: trackingLink ?? this.trackingLink,
      assignedSlot: assignedSlot ?? this.assignedSlot,
      items: items ?? this.items,
      specialInstructions: specialInstructions ?? this.specialInstructions,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      printMode: printMode ?? this.printMode,
    );
  }

  @override
  String toString() => 'Order($orderId, ${orderStatus.displayName}, $category)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Order && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

String _categoryLabel(String category) {
  if (category == '3d') return '3D print';
  if (category == 'paper') return 'Paper print';
  return category;
}
