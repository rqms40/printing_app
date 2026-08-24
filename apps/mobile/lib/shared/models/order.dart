import 'enums.dart';
import 'order_status_history.dart';
import 'paper_specs.dart';
import 'three_d_specs.dart';
import 'route_geometry.dart';

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

class AssignedRiderContact {
  const AssignedRiderContact({
    required this.userId,
    required this.riderProfileId,
    required this.displayName,
    this.fullName,
    this.nickname,
    this.phoneNumber,
    this.vehicleType,
    this.plateNumber,
    required this.deliveryAssignmentId,
    required this.deliveryStatus,
  });

  final String userId;
  final String riderProfileId;
  final String displayName;
  final String? fullName;
  final String? nickname;
  final String? phoneNumber;
  final String? vehicleType;
  final String? plateNumber;
  final String deliveryAssignmentId;
  final String deliveryStatus;

  factory AssignedRiderContact.fromJson(Map<String, dynamic> json) {
    String? read(String camel, String snake) {
      final value = json[camel] ?? json[snake];
      return value?.toString();
    }

    return AssignedRiderContact(
      userId: read('userId', 'user_id') ?? '',
      riderProfileId: read('riderProfileId', 'rider_profile_id') ?? '',
      displayName:
          read('displayName', 'display_name') ??
          read('fullName', 'full_name') ??
          read('nickname', 'nickname') ??
          'Rider',
      fullName: read('fullName', 'full_name'),
      nickname: read('nickname', 'nickname'),
      phoneNumber: read('phoneNumber', 'phone_number'),
      vehicleType: read('vehicleType', 'vehicle_type'),
      plateNumber: read('plateNumber', 'plate_number'),
      deliveryAssignmentId:
          read('deliveryAssignmentId', 'delivery_assignment_id') ?? '',
      deliveryStatus: read('deliveryStatus', 'delivery_status') ?? 'assigned',
    );
  }
}

class AssignedSupplierContact {
  const AssignedSupplierContact({
    required this.supplierId,
    required this.businessName,
    this.decision,
    this.acceptanceDeadline,
    this.assignmentId,
    this.logoUrl,
    this.address,
    this.broadAddress,
    this.selfQcEvidenceUrls = const [],
    this.selfQcEvidenceFileIds = const [],
    this.quotedPriceMinor,
    this.quotedPromisedDate,
    this.customerConfirmedQuoteAt,
  });

  final int supplierId;
  final String businessName;
  final String? decision;
  final DateTime? acceptanceDeadline;
  final int? assignmentId;
  final String? logoUrl;
  final String? address;
  final String? broadAddress;
  final List<String> selfQcEvidenceUrls;
  final List<int> selfQcEvidenceFileIds;
  final int? quotedPriceMinor;
  final DateTime? quotedPromisedDate;
  final DateTime? customerConfirmedQuoteAt;

  bool get hasQuotedPrice =>
      quotedPriceMinor != null && quotedPriceMinor! > 0;
  bool get isQuoteConfirmed => customerConfirmedQuoteAt != null;

  factory AssignedSupplierContact.fromJson(Map<String, dynamic> json) {
    Object? read(String camel, String snake) => json[camel] ?? json[snake];

    final idRaw = read('supplierId', 'supplier_id');
    final id = idRaw is int
        ? idRaw
        : int.tryParse(idRaw?.toString() ?? '') ?? 0;
    final name =
        (read('businessName', 'business_name')?.toString().trim().isNotEmpty ==
                true
            ? read('businessName', 'business_name')!.toString().trim()
            : 'Supplier');

    DateTime? deadline;
    final rawDeadline = read('acceptanceDeadline', 'acceptance_deadline');
    if (rawDeadline != null) {
      deadline = DateTime.tryParse(rawDeadline.toString());
    }

    final assignmentRaw = read('assignmentId', 'assignment_id');
    final assignmentId = assignmentRaw is int
        ? assignmentRaw
        : int.tryParse(assignmentRaw?.toString() ?? '');

    final urlsRaw =
        read('selfQcEvidenceUrls', 'self_qc_evidence_urls');
    final urls = <String>[];
    if (urlsRaw is List) {
      for (final u in urlsRaw) {
        final s = u?.toString().trim() ?? '';
        if (s.isNotEmpty) urls.add(s);
      }
    }

    final idsRaw =
        read('selfQcEvidenceFileIds', 'self_qc_evidence_file_ids');
    final ids = <int>[];
    if (idsRaw is List) {
      for (final i in idsRaw) {
        final n = i is int ? i : int.tryParse(i?.toString() ?? '');
        if (n != null && n > 0) ids.add(n);
      }
    }

    int? parseMinor(Object? value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is num) return value.round();
      return int.tryParse(value.toString()) ??
          double.tryParse(value.toString())?.round();
    }

    DateTime? parseDate(Object? value) {
      if (value == null) return null;
      return DateTime.tryParse(value.toString());
    }

    return AssignedSupplierContact(
      supplierId: id,
      businessName: name,
      decision: read('decision', 'decision')?.toString(),
      acceptanceDeadline: deadline,
      assignmentId: assignmentId,
      logoUrl: read('logoUrl', 'logo_url')?.toString(),
      address: read('address', 'address')?.toString(),
      broadAddress: read('broadAddress', 'broad_address')?.toString(),
      selfQcEvidenceUrls: urls,
      selfQcEvidenceFileIds: ids,
      quotedPriceMinor: parseMinor(
        read('quotedPriceMinor', 'quoted_price_minor'),
      ),
      quotedPromisedDate: parseDate(
        read('quotedPromisedDate', 'quoted_promised_date'),
      ),
      customerConfirmedQuoteAt: parseDate(
        read('customerConfirmedQuoteAt', 'customer_confirmed_quote_at'),
      ),
    );
  }
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

/// Client-facing material claim / concern attached to an order.
class OrderClaim {
  const OrderClaim({
    required this.id,
    required this.orderId,
    required this.category,
    required this.categoryLabel,
    required this.status,
    required this.statusLabel,
    this.actionLabel,
    this.resolutionNotes,
    required this.withinWindow,
    required this.openedAt,
    this.resolvedAt,
  });

  final int id;
  final int orderId;
  final String category;
  final String categoryLabel;
  final String status;
  final String statusLabel;
  /// Ops action when resolved (e.g. "Reprint approved").
  final String? actionLabel;
  final String? resolutionNotes;
  final bool withinWindow;
  final DateTime openedAt;
  final DateTime? resolvedAt;

  bool get isOpen =>
      status == 'open' || status == 'under_review';

  bool get isResolved => !isOpen;

  factory OrderClaim.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) {
      if (value == null) return null;
      if (value is DateTime) return value;
      return DateTime.tryParse(value.toString());
    }

    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? 0;
    }

    return OrderClaim(
      id: parseInt(json['id']),
      orderId: parseInt(json['orderId'] ?? json['order_id']),
      category: (json['category'] ?? '').toString(),
      categoryLabel: (json['categoryLabel'] ??
              json['category_label'] ??
              json['category'] ??
              'Concern')
          .toString(),
      status: (json['status'] ?? 'open').toString(),
      statusLabel: (json['statusLabel'] ??
              json['status_label'] ??
              json['status'] ??
              'Open')
          .toString(),
      actionLabel: (json['actionLabel'] ?? json['action_label'])?.toString(),
      resolutionNotes:
          (json['resolutionNotes'] ?? json['resolution_notes'])?.toString(),
      withinWindow: json['withinWindow'] == true ||
          json['within_window'] == true,
      openedAt: parseDate(json['openedAt'] ?? json['opened_at']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      resolvedAt: parseDate(json['resolvedAt'] ?? json['resolved_at']),
    );
  }
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
    this.priorityFee = 0,
    this.extraDestinationFee = 0,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.orderStatus,
    this.declineReason,
    this.cancellationReason,
    this.cancelledAt,
    required this.deliveryOption,
    this.deliveryAddressId,
    this.deliveryAddress,
    this.assignedRiderId,
    this.deliveryAssignmentId,
    this.deliveryQueuePosition,
    this.deliveryQueueSize,
    this.canTrackDelivery = false,
    this.deliveryPlanState,
    this.deliveryPlanVersion,
    this.deliveryRouteGeometry,
    this.deliveryRouteGeometryMalformed = false,
    this.deliveryLegDurationSeconds,
    this.deliveryLegDistanceMeters,
    this.deliveryRoutingDataStale,
    this.deliveryOtp,
    this.assignedRider,
    this.assignedSupplier,
    this.estimatedCompletionAt,
    this.adminStatusNote,
    this.adminStatusSetAt,
    this.adminNotes,
    this.trackingLink,
    this.assignedSlot,
    this.items = const [],
    this.claims = const [],
    this.statusHistory = const [],
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
  final double priorityFee;
  final double extraDestinationFee;
  final PaymentMethod paymentMethod;
  final PaymentStatus paymentStatus;
  final OrderStatus orderStatus;
  final String? declineReason;
  final String? cancellationReason;
  final DateTime? cancelledAt;
  final String deliveryOption;
  final String? deliveryAddressId;
  final OrderDeliveryAddress? deliveryAddress;
  final String? assignedRiderId;
  final String? deliveryAssignmentId;
  final int? deliveryQueuePosition;
  final int? deliveryQueueSize;
  final bool canTrackDelivery;
  final String? deliveryPlanState;
  final int? deliveryPlanVersion;
  final GeoJsonLineString? deliveryRouteGeometry;
  final bool deliveryRouteGeometryMalformed;
  final int? deliveryLegDurationSeconds;
  final int? deliveryLegDistanceMeters;
  final bool? deliveryRoutingDataStale;

  /// Customer handoff OTP while out for delivery (null after delivery).
  final String? deliveryOtp;
  final AssignedRiderContact? assignedRider;
  final AssignedSupplierContact? assignedSupplier;
  final DateTime? estimatedCompletionAt;
  final String? adminStatusNote;
  final DateTime? adminStatusSetAt;
  final String? adminNotes;
  final String? trackingLink;
  final AssignedDeliverySlot? assignedSlot;
  final List<OrderLineItem> items;
  /// Material concerns / claims reported by the customer (and ops outcomes).
  final List<OrderClaim> claims;
  /// Marketplace + logistics status transitions (server-authoritative).
  final List<OrderStatusHistory> statusHistory;
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
    double? priorityFee,
    double? extraDestinationFee,
    PaymentMethod? paymentMethod,
    PaymentStatus? paymentStatus,
    OrderStatus? orderStatus,
    String? declineReason,
    String? cancellationReason,
    DateTime? cancelledAt,
    String? deliveryOption,
    String? deliveryAddressId,
    OrderDeliveryAddress? deliveryAddress,
    String? assignedRiderId,
    String? deliveryAssignmentId,
    int? deliveryQueuePosition,
    int? deliveryQueueSize,
    bool? canTrackDelivery,
    String? deliveryPlanState,
    int? deliveryPlanVersion,
    GeoJsonLineString? deliveryRouteGeometry,
    bool? deliveryRouteGeometryMalformed,
    int? deliveryLegDurationSeconds,
    int? deliveryLegDistanceMeters,
    bool? deliveryRoutingDataStale,
    String? deliveryOtp,
    AssignedRiderContact? assignedRider,
    AssignedSupplierContact? assignedSupplier,
    DateTime? estimatedCompletionAt,
    String? adminStatusNote,
    DateTime? adminStatusSetAt,
    String? adminNotes,
    String? trackingLink,
    AssignedDeliverySlot? assignedSlot,
    List<OrderLineItem>? items,
    List<OrderClaim>? claims,
    List<OrderStatusHistory>? statusHistory,
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
      priorityFee: priorityFee ?? this.priorityFee,
      extraDestinationFee: extraDestinationFee ?? this.extraDestinationFee,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      orderStatus: orderStatus ?? this.orderStatus,
      declineReason: declineReason ?? this.declineReason,
      cancellationReason: cancellationReason ?? this.cancellationReason,
      cancelledAt: cancelledAt ?? this.cancelledAt,
      deliveryOption: deliveryOption ?? this.deliveryOption,
      deliveryAddressId: deliveryAddressId ?? this.deliveryAddressId,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      assignedRiderId: assignedRiderId ?? this.assignedRiderId,
      deliveryAssignmentId: deliveryAssignmentId ?? this.deliveryAssignmentId,
      deliveryQueuePosition:
          deliveryQueuePosition ?? this.deliveryQueuePosition,
      deliveryQueueSize: deliveryQueueSize ?? this.deliveryQueueSize,
      canTrackDelivery: canTrackDelivery ?? this.canTrackDelivery,
      deliveryPlanState: deliveryPlanState ?? this.deliveryPlanState,
      deliveryPlanVersion: deliveryPlanVersion ?? this.deliveryPlanVersion,
      deliveryRouteGeometry:
          deliveryRouteGeometry ?? this.deliveryRouteGeometry,
      deliveryRouteGeometryMalformed:
          deliveryRouteGeometryMalformed ?? this.deliveryRouteGeometryMalformed,
      deliveryLegDurationSeconds:
          deliveryLegDurationSeconds ?? this.deliveryLegDurationSeconds,
      deliveryLegDistanceMeters:
          deliveryLegDistanceMeters ?? this.deliveryLegDistanceMeters,
      deliveryRoutingDataStale:
          deliveryRoutingDataStale ?? this.deliveryRoutingDataStale,
      deliveryOtp: deliveryOtp ?? this.deliveryOtp,
      assignedRider: assignedRider ?? this.assignedRider,
      assignedSupplier: assignedSupplier ?? this.assignedSupplier,
      estimatedCompletionAt:
          estimatedCompletionAt ?? this.estimatedCompletionAt,
      adminStatusNote: adminStatusNote ?? this.adminStatusNote,
      adminStatusSetAt: adminStatusSetAt ?? this.adminStatusSetAt,
      adminNotes: adminNotes ?? this.adminNotes,
      trackingLink: trackingLink ?? this.trackingLink,
      assignedSlot: assignedSlot ?? this.assignedSlot,
      items: items ?? this.items,
      claims: claims ?? this.claims,
      statusHistory: statusHistory ?? this.statusHistory,
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
