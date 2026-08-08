import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/utils/formatters.dart';

/// List filter for GET /supplier/jobs?filter=
enum SupplierJobListFilter {
  all,
  assigned,
  accepted,
  inProduction,
}

extension SupplierJobListFilterX on SupplierJobListFilter {
  String get apiValue => switch (this) {
    SupplierJobListFilter.all => 'all',
    SupplierJobListFilter.assigned => 'assigned',
    SupplierJobListFilter.accepted => 'accepted',
    SupplierJobListFilter.inProduction => 'in_production',
  };

  String get label => switch (this) {
    SupplierJobListFilter.all => 'All',
    SupplierJobListFilter.assigned => 'Assigned',
    SupplierJobListFilter.accepted => 'Accepted',
    SupplierJobListFilter.inProduction => 'In production',
  };
}

/// Production milestones for POST .../production-status
enum ProductionMilestone {
  materialsSetup,
  inProduction,
  productionComplete,
}

extension ProductionMilestoneX on ProductionMilestone {
  String get apiValue => switch (this) {
    ProductionMilestone.materialsSetup => 'materials_setup',
    ProductionMilestone.inProduction => 'in_production',
    ProductionMilestone.productionComplete => 'production_complete',
  };

  String get label => switch (this) {
    ProductionMilestone.materialsSetup => 'Materials / setup',
    ProductionMilestone.inProduction => 'In production',
    ProductionMilestone.productionComplete => 'Production complete',
  };

  String get description => switch (this) {
    ProductionMilestone.materialsSetup =>
      'Prep materials and machine setup (starts production if needed).',
    ProductionMilestone.inProduction => 'Actively printing / finishing.',
    ProductionMilestone.productionComplete =>
      'Print finished — ready for self-QC evidence.',
  };
}

/// Action keys returned by GET job detail `allowedActions`.
abstract final class SupplierJobAction {
  static const accept = 'accept';
  static const decline = 'decline';
  static const productionStatus = 'production-status';
  static const selfQc = 'self-qc';
  static const readyForPickup = 'ready-for-pickup';
}

/// Copy shown when accept succeeded but production is blocked.
abstract final class SupplierPaymentGateCopy {
  /// Short banner title for accepted jobs waiting on ops payment auth.
  static const waitingTitle = 'Waiting for payment authorization';

  /// Body explaining the payment_authorized gate before production.
  static const waitingBody =
      'Production is locked until GRIDGO ops authorizes payment '
      '(order must reach payment_authorized).';

  /// Compact gate line used in action panels / tests.
  static const needsPaymentAuthorized =
      'Needs payment_authorized before production';
}

int? parseMinorUnits(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    return int.tryParse(trimmed) ?? double.tryParse(trimmed)?.round();
  }
  return null;
}

String formatMinorAsCurrency(dynamic minor) {
  final n = parseMinorUnits(minor);
  if (n == null) return '—';
  return formatCurrency(n / 100.0);
}

int pesosToMinor(double pesos) => (pesos * 100).round();

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

String _asString(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  return value.toString();
}

int _asInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _asDouble(dynamic value, [double fallback = 0]) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

/// Inbox row from GET /supplier/jobs
class SupplierJobListItem {
  const SupplierJobListItem({
    required this.id,
    required this.orderId,
    required this.orderPublicId,
    required this.orderStatus,
    required this.decision,
    required this.acceptanceDeadline,
    required this.category,
    required this.quantity,
    required this.rankPosition,
    required this.createdAt,
    required this.paymentAuthorizationStatus,
    this.finalPriceMinor,
    this.promisedDate,
    this.decidedAt,
  });

  final int id;
  final int orderId;
  final String orderPublicId;
  final OrderStatus orderStatus;
  final String decision;
  final DateTime? acceptanceDeadline;
  final int? finalPriceMinor;
  final DateTime? promisedDate;
  final String category;
  final int quantity;
  final int rankPosition;
  final DateTime? decidedAt;
  final DateTime? createdAt;
  final String paymentAuthorizationStatus;

  bool get isPendingAccept =>
      decision == 'pending' && orderStatus == OrderStatus.supplierAssigned;

  bool get isWaitingPayment {
    if (decision != 'accepted') return false;
    return orderStatus == OrderStatus.supplierAccepted ||
        orderStatus == OrderStatus.awaitingPayment ||
        (orderStatus == OrderStatus.paymentAuthorized &&
            paymentAuthorizationStatus != 'authorized');
  }

  bool get isPaymentAuthorized =>
      paymentAuthorizationStatus == 'authorized' ||
      orderStatus == OrderStatus.paymentAuthorized ||
      orderStatus == OrderStatus.production ||
      orderStatus == OrderStatus.supplierSelfQc ||
      orderStatus == OrderStatus.readyForDispatch;

  factory SupplierJobListItem.fromJson(Map<String, dynamic> json) {
    return SupplierJobListItem(
      id: _asInt(json['id']),
      orderId: _asInt(json['orderId']),
      orderPublicId: _asString(json['orderPublicId'], '—'),
      orderStatus: parseMarketplaceOrderStatus(
        _asString(json['orderStatus']),
        fallback: OrderStatus.supplierAssigned,
      ),
      decision: _asString(json['decision'], 'pending').toLowerCase(),
      acceptanceDeadline: _parseDate(json['acceptanceDeadline']),
      finalPriceMinor: parseMinorUnits(json['finalPriceMinor']),
      promisedDate: _parseDate(json['promisedDate']),
      category: _asString(json['category'], 'print'),
      quantity: _asInt(json['quantity'], 1),
      rankPosition: _asInt(json['rankPosition'], 0),
      decidedAt: _parseDate(json['decidedAt']),
      createdAt: _parseDate(json['createdAt']),
      paymentAuthorizationStatus: _asString(
        json['paymentAuthorizationStatus'],
        'none',
      ).toLowerCase(),
    );
  }
}

class SupplierJobSpecValue {
  const SupplierJobSpecValue({
    required this.key,
    required this.label,
    required this.value,
    required this.displayValue,
    this.optionId,
    this.optionLabel,
  });

  final String key;
  final String label;
  final String value;
  final String displayValue;
  final int? optionId;
  final String? optionLabel;

  String get shownValue {
    if (displayValue.isNotEmpty) return displayValue;
    if (optionLabel != null && optionLabel!.isNotEmpty) return optionLabel!;
    return value;
  }

  factory SupplierJobSpecValue.fromJson(Map<String, dynamic> json) {
    return SupplierJobSpecValue(
      key: _asString(json['key']),
      label: _asString(json['label'], _asString(json['key'])),
      value: _asString(json['value']),
      displayValue: _asString(json['displayValue']),
      optionId: json['optionId'] == null ? null : _asInt(json['optionId']),
      optionLabel: json['optionLabel']?.toString(),
    );
  }
}

class SupplierJobItemSpecs {
  const SupplierJobItemSpecs({
    required this.id,
    required this.category,
    required this.quantity,
    required this.specs,
    this.categoryName,
    this.specialInstructions,
    this.fileName,
    this.fileMetadataId,
  });

  final int id;
  final String category;
  final String? categoryName;
  final int quantity;
  final String? specialInstructions;
  final String? fileName;
  final int? fileMetadataId;
  final List<SupplierJobSpecValue> specs;

  String get title =>
      (categoryName != null && categoryName!.isNotEmpty)
      ? categoryName!
      : category;

  factory SupplierJobItemSpecs.fromJson(Map<String, dynamic> json) {
    final rawSpecs = json['specs'];
    return SupplierJobItemSpecs(
      id: _asInt(json['id']),
      category: _asString(json['category'], 'print'),
      categoryName: json['categoryName']?.toString(),
      quantity: _asInt(json['quantity'], 1),
      specialInstructions: json['specialInstructions']?.toString(),
      fileName: json['fileName']?.toString(),
      fileMetadataId: json['fileMetadataId'] == null
          ? null
          : _asInt(json['fileMetadataId']),
      specs: rawSpecs is List
          ? rawSpecs
                .whereType<Map>()
                .map(
                  (e) =>
                      SupplierJobSpecValue.fromJson(Map<String, dynamic>.from(e)),
                )
                .toList()
          : const [],
    );
  }
}

class SupplierJobDetail {
  const SupplierJobDetail({
    required this.assignmentId,
    required this.orderInternalId,
    required this.orderPublicId,
    required this.orderStatus,
    required this.decision,
    required this.acceptanceDeadline,
    required this.category,
    required this.quantity,
    required this.totalPrice,
    required this.deliveryFee,
    required this.paymentMethod,
    required this.paymentAuthorizationStatus,
    required this.deliveryOption,
    required this.allowedActions,
    required this.items,
    this.decisionReason,
    this.finalPriceMinor,
    this.promisedDate,
    this.finalTotalMinor,
    this.deliveryFeeMinor,
    this.estimatedCompletionAt,
    this.artworkFileMetadataId,
    this.artworkFileName,
    this.artworkSignedUrl,
    this.rankPosition = 0,
    this.decidedAt,
    this.createdAt,
  });

  final int assignmentId;
  final int orderInternalId;
  final String orderPublicId;
  final OrderStatus orderStatus;
  final String decision;
  final String? decisionReason;
  final DateTime? acceptanceDeadline;
  final int? finalPriceMinor;
  final DateTime? promisedDate;
  final int rankPosition;
  final DateTime? decidedAt;
  final DateTime? createdAt;

  final String category;
  final int quantity;
  final double totalPrice;
  final double deliveryFee;
  final String? finalTotalMinor;
  final String? deliveryFeeMinor;
  final String paymentMethod;
  final String paymentAuthorizationStatus;
  final String deliveryOption;
  final DateTime? estimatedCompletionAt;

  final int? artworkFileMetadataId;
  final String? artworkFileName;
  final String? artworkSignedUrl;

  final List<SupplierJobItemSpecs> items;
  final List<String> allowedActions;

  bool hasAction(String action) => allowedActions.contains(action);

  bool get canAccept => hasAction(SupplierJobAction.accept);
  bool get canDecline => hasAction(SupplierJobAction.decline);
  bool get canProduction => hasAction(SupplierJobAction.productionStatus);
  bool get canSelfQc => hasAction(SupplierJobAction.selfQc);
  bool get canReadyForPickup => hasAction(SupplierJobAction.readyForPickup);

  /// Accepted (or payment-waiting) but production action not yet available.
  bool get isWaitingPaymentAuthorization {
    if (canProduction || canSelfQc || canReadyForPickup || canAccept) {
      return false;
    }
    if (decision != 'accepted') return false;
    return orderStatus == OrderStatus.supplierAccepted ||
        orderStatus == OrderStatus.awaitingPayment ||
        (orderStatus == OrderStatus.paymentAuthorized &&
            paymentAuthorizationStatus != 'authorized') ||
        paymentAuthorizationStatus != 'authorized';
  }

  bool get isPaymentAuthorized =>
      paymentAuthorizationStatus == 'authorized' ||
      orderStatus == OrderStatus.paymentAuthorized ||
      orderStatus == OrderStatus.production ||
      orderStatus == OrderStatus.supplierSelfQc ||
      orderStatus == OrderStatus.readyForDispatch;

  factory SupplierJobDetail.fromJson(Map<String, dynamic> json) {
    final assignment = Map<String, dynamic>.from(
      (json['assignment'] as Map?) ?? const {},
    );
    final order = Map<String, dynamic>.from(
      (json['order'] as Map?) ?? const {},
    );
    final artwork = Map<String, dynamic>.from(
      (json['artwork'] as Map?) ?? const {},
    );
    final specs = Map<String, dynamic>.from(
      (json['specs'] as Map?) ?? const {},
    );
    final rawItems = specs['items'];
    final rawActions = json['allowedActions'];

    return SupplierJobDetail(
      assignmentId: _asInt(assignment['id']),
      orderInternalId: _asInt(order['id'] ?? assignment['orderId']),
      orderPublicId: _asString(order['orderId'], '—'),
      orderStatus: parseMarketplaceOrderStatus(
        _asString(order['orderStatus']),
        fallback: OrderStatus.supplierAssigned,
      ),
      decision: _asString(assignment['decision'], 'pending').toLowerCase(),
      decisionReason: assignment['decisionReason']?.toString(),
      acceptanceDeadline: _parseDate(assignment['acceptanceDeadline']),
      finalPriceMinor: parseMinorUnits(assignment['finalPriceMinor']),
      promisedDate: _parseDate(assignment['promisedDate']),
      rankPosition: _asInt(assignment['rankPosition']),
      decidedAt: _parseDate(assignment['decidedAt']),
      createdAt: _parseDate(assignment['createdAt']),
      category: _asString(order['category'] ?? specs['category'], 'print'),
      quantity: _asInt(order['quantity'] ?? specs['quantity'], 1),
      totalPrice: _asDouble(order['totalPrice']),
      deliveryFee: _asDouble(order['deliveryFee']),
      finalTotalMinor: order['finalTotalMinor']?.toString(),
      deliveryFeeMinor: order['deliveryFeeMinor']?.toString(),
      paymentMethod: _asString(order['paymentMethod'], '—'),
      paymentAuthorizationStatus: _asString(
        order['paymentAuthorizationStatus'],
        'none',
      ).toLowerCase(),
      deliveryOption: _asString(order['deliveryOption'], '—'),
      estimatedCompletionAt: _parseDate(order['estimatedCompletionAt']),
      artworkFileMetadataId: artwork['fileMetadataId'] == null
          ? null
          : _asInt(artwork['fileMetadataId']),
      artworkFileName: artwork['fileName']?.toString(),
      artworkSignedUrl: artwork['signedUrl']?.toString(),
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (e) =>
                      SupplierJobItemSpecs.fromJson(Map<String, dynamic>.from(e)),
                )
                .toList()
          : const [],
      allowedActions: rawActions is List
          ? rawActions.map((e) => e.toString()).toList()
          : const [],
    );
  }
}
