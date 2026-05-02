import 'enums.dart';
import 'paper_specs.dart';
import 'three_d_specs.dart';

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
    this.assignedDriverId,
    this.deliveryAssignmentId,
    this.estimatedCompletionAt,
    this.adminStatusNote,
    this.adminStatusSetAt,
    this.adminNotes,
    this.trackingLink,
    this.items = const [],
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
  final String? assignedDriverId;
  final String? deliveryAssignmentId;
  final DateTime? estimatedCompletionAt;
  final String? adminStatusNote;
  final DateTime? adminStatusSetAt;
  final String? adminNotes;
  final String? trackingLink;
  final List<OrderLineItem> items;
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
      ),
    ];
  }

  bool get isBatchOrder => lineItems.length > 1 || batchOrderId != null;
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
    String? assignedDriverId,
    String? deliveryAssignmentId,
    DateTime? estimatedCompletionAt,
    String? adminStatusNote,
    DateTime? adminStatusSetAt,
    String? adminNotes,
    String? trackingLink,
    List<OrderLineItem>? items,
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
      assignedDriverId: assignedDriverId ?? this.assignedDriverId,
      deliveryAssignmentId: deliveryAssignmentId ?? this.deliveryAssignmentId,
      estimatedCompletionAt:
          estimatedCompletionAt ?? this.estimatedCompletionAt,
      adminStatusNote: adminStatusNote ?? this.adminStatusNote,
      adminStatusSetAt: adminStatusSetAt ?? this.adminStatusSetAt,
      adminNotes: adminNotes ?? this.adminNotes,
      trackingLink: trackingLink ?? this.trackingLink,
      items: items ?? this.items,
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
