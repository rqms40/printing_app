/// All domain enums for GRIDGO with displayName extensions.
library;

enum UserRole {
  client,
  supplier,
  rider,
  opsAdmin,
  superAdmin,
  /// Legacy aliases accepted when parsing API payloads during cutover.
  customer,
  admin,
}

/// Marketplace client metadata only — not an auth role or shell.
enum ClientAccountType {
  business,
  organization,
  teacher,
}

extension ClientAccountTypeX on ClientAccountType {
  String get apiValue {
    switch (this) {
      case ClientAccountType.business:
        return 'business';
      case ClientAccountType.organization:
        return 'organization';
      case ClientAccountType.teacher:
        return 'teacher';
    }
  }

  String get displayName {
    switch (this) {
      case ClientAccountType.business:
        return 'Business';
      case ClientAccountType.organization:
        return 'Organization';
      case ClientAccountType.teacher:
        return 'Teacher';
    }
  }
}

ClientAccountType? parseClientAccountType(String? raw) {
  switch (raw) {
    case 'business':
      return ClientAccountType.business;
    case 'organization':
      return ClientAccountType.organization;
    case 'teacher':
      return ClientAccountType.teacher;
    default:
      return null;
  }
}

extension UserRoleX on UserRole {
  String get displayName {
    switch (this) {
      case UserRole.client:
      case UserRole.customer:
        return 'Client';
      case UserRole.supplier:
        return 'Supplier';
      case UserRole.rider:
        return 'Rider';
      case UserRole.opsAdmin:
        return 'Ops Admin';
      case UserRole.superAdmin:
        return 'Super Admin';
      case UserRole.admin:
        return 'Admin';
    }
  }

  /// API wire value (snake_case).
  String get apiValue {
    switch (this) {
      case UserRole.client:
      case UserRole.customer:
        return 'client';
      case UserRole.supplier:
        return 'supplier';
      case UserRole.rider:
        return 'rider';
      case UserRole.opsAdmin:
        return 'ops_admin';
      case UserRole.superAdmin:
        return 'super_admin';
      case UserRole.admin:
        return 'ops_admin';
    }
  }

  /// Collapse legacy/marketplace role strings into routing buckets.
  String get effectiveShell {
    switch (this) {
      case UserRole.rider:
        return 'rider';
      case UserRole.opsAdmin:
      case UserRole.superAdmin:
      case UserRole.admin:
        return 'admin';
      case UserRole.client:
      case UserRole.customer:
      case UserRole.supplier:
        return 'customer';
    }
  }
}

UserRole? parseUserRole(String? raw) {
  switch (raw) {
    case 'client':
      return UserRole.client;
    case 'supplier':
      return UserRole.supplier;
    case 'rider':
      return UserRole.rider;
    case 'ops_admin':
      return UserRole.opsAdmin;
    case 'super_admin':
      return UserRole.superAdmin;
    case 'customer':
      return UserRole.customer;
    case 'admin':
      return UserRole.admin;
    default:
      return null;
  }
}

/// Marketplace order lifecycle. API values are snake_case (e.g. `needs_qa`).
enum OrderStatus {
  draft,
  submitted,
  needsQa,
  clientCorrection,
  proofApproval,
  approvedForMatching,
  supplierAssigned,
  supplierAccepted,
  awaitingPayment,
  paymentAuthorized,
  production,
  supplierSelfQc,
  readyForDispatch,
  riderAssigned,
  pickedUp,
  outForDelivery,
  delivered,
  deliveryFailed,
  collectedByCustomer,
  issueWindowOpen,
  completed,
  cancelled,
  fileRejected,
}

extension OrderStatusX on OrderStatus {
  String get apiValue {
    switch (this) {
      case OrderStatus.draft:
        return 'draft';
      case OrderStatus.submitted:
        return 'submitted';
      case OrderStatus.needsQa:
        return 'needs_qa';
      case OrderStatus.clientCorrection:
        return 'client_correction';
      case OrderStatus.proofApproval:
        return 'proof_approval';
      case OrderStatus.approvedForMatching:
        return 'approved_for_matching';
      case OrderStatus.supplierAssigned:
        return 'supplier_assigned';
      case OrderStatus.supplierAccepted:
        return 'supplier_accepted';
      case OrderStatus.awaitingPayment:
        return 'awaiting_payment';
      case OrderStatus.paymentAuthorized:
        return 'payment_authorized';
      case OrderStatus.production:
        return 'production';
      case OrderStatus.supplierSelfQc:
        return 'supplier_self_qc';
      case OrderStatus.readyForDispatch:
        return 'ready_for_dispatch';
      case OrderStatus.riderAssigned:
        return 'rider_assigned';
      case OrderStatus.pickedUp:
        return 'picked_up';
      case OrderStatus.outForDelivery:
        return 'out_for_delivery';
      case OrderStatus.delivered:
        return 'delivered';
      case OrderStatus.deliveryFailed:
        return 'delivery_failed';
      case OrderStatus.collectedByCustomer:
        return 'collected_by_customer';
      case OrderStatus.issueWindowOpen:
        return 'issue_window_open';
      case OrderStatus.completed:
        return 'completed';
      case OrderStatus.cancelled:
        return 'cancelled';
      case OrderStatus.fileRejected:
        return 'file_rejected';
    }
  }

  String get displayName {
    switch (this) {
      case OrderStatus.draft:
        return 'Draft';
      case OrderStatus.submitted:
        return 'Submitted';
      case OrderStatus.needsQa:
        return 'Under review';
      case OrderStatus.clientCorrection:
        return 'Needs your update';
      case OrderStatus.proofApproval:
        return 'Proof approval';
      case OrderStatus.approvedForMatching:
        return 'Approved for matching';
      case OrderStatus.supplierAssigned:
        return 'Supplier assigned';
      case OrderStatus.supplierAccepted:
        return 'Supplier accepted';
      case OrderStatus.awaitingPayment:
        return 'Awaiting payment';
      case OrderStatus.paymentAuthorized:
        return 'Payment authorized';
      case OrderStatus.production:
        return 'In production';
      case OrderStatus.supplierSelfQc:
        return 'Supplier quality check';
      case OrderStatus.readyForDispatch:
        return 'Ready for dispatch';
      case OrderStatus.riderAssigned:
        return 'Rider assigned';
      case OrderStatus.pickedUp:
        return 'Picked up';
      case OrderStatus.outForDelivery:
        return 'Out for delivery';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.deliveryFailed:
        return 'Delivery failed';
      case OrderStatus.collectedByCustomer:
        return 'Collected';
      case OrderStatus.issueWindowOpen:
        return 'Issue window open';
      case OrderStatus.completed:
        return 'Completed';
      case OrderStatus.cancelled:
        return 'Cancelled';
      case OrderStatus.fileRejected:
        return 'File rejected';
    }
  }

  /// Short client-facing explanation under the status badge.
  String get customerSummary {
    switch (this) {
      case OrderStatus.draft:
        return 'This order is still a draft and has not been submitted.';
      case OrderStatus.submitted:
        return 'We received your order and will review the files next.';
      case OrderStatus.needsQa:
        return 'Ops is reviewing your artwork and specifications.';
      case OrderStatus.clientCorrection:
        return 'Please update your files or specs so review can continue.';
      case OrderStatus.proofApproval:
        return 'Review and approve the proof when you are ready.';
      case OrderStatus.approvedForMatching:
        return 'Your order is approved and will be matched to a supplier.';
      case OrderStatus.supplierAssigned:
        return 'A print supplier has been assigned to your order.';
      case OrderStatus.supplierAccepted:
        return 'The supplier accepted the job and will prepare production.';
      case OrderStatus.awaitingPayment:
        return 'Authorize payment so production can start.';
      case OrderStatus.paymentAuthorized:
        return 'Payment is authorized. Production can begin.';
      case OrderStatus.production:
        return 'Your order is being printed and finished.';
      case OrderStatus.supplierSelfQc:
        return 'The supplier is running a final quality check.';
      case OrderStatus.readyForDispatch:
        return 'Print is ready and waiting for dispatch.';
      case OrderStatus.riderAssigned:
        return 'A rider has been assigned for pickup or delivery.';
      case OrderStatus.pickedUp:
        return 'The rider picked up your order from the supplier.';
      case OrderStatus.outForDelivery:
        return 'Your order is on the way.';
      case OrderStatus.delivered:
        return 'Your order was delivered.';
      case OrderStatus.deliveryFailed:
        return 'Delivery could not be completed. Support will follow up.';
      case OrderStatus.collectedByCustomer:
        return 'You collected this order.';
      case OrderStatus.issueWindowOpen:
        return 'You can still report an issue for a limited time.';
      case OrderStatus.completed:
        return 'This order is fully complete.';
      case OrderStatus.cancelled:
        return 'This order was cancelled.';
      case OrderStatus.fileRejected:
        return 'The submitted file was rejected during review.';
    }
  }

  /// Linear progress rank for customer timelines (higher = further along).
  /// Terminal branch statuses (cancelled, rejected, failed) are not ranked.
  int? get timelineRank {
    switch (this) {
      case OrderStatus.draft:
        return 0;
      case OrderStatus.submitted:
        return 10;
      case OrderStatus.needsQa:
        return 20;
      case OrderStatus.clientCorrection:
        return 25;
      case OrderStatus.proofApproval:
        return 30;
      case OrderStatus.approvedForMatching:
        return 40;
      case OrderStatus.supplierAssigned:
        return 50;
      case OrderStatus.supplierAccepted:
        return 60;
      case OrderStatus.awaitingPayment:
        return 70;
      case OrderStatus.paymentAuthorized:
        return 80;
      case OrderStatus.production:
        return 90;
      case OrderStatus.supplierSelfQc:
        return 100;
      case OrderStatus.readyForDispatch:
        return 110;
      case OrderStatus.riderAssigned:
        return 120;
      case OrderStatus.pickedUp:
        return 130;
      case OrderStatus.outForDelivery:
        return 140;
      case OrderStatus.delivered:
      case OrderStatus.collectedByCustomer:
        return 150;
      case OrderStatus.issueWindowOpen:
        return 160;
      case OrderStatus.completed:
        return 170;
      case OrderStatus.cancelled:
      case OrderStatus.fileRejected:
      case OrderStatus.deliveryFailed:
        return null;
    }
  }
}

/// Builds the customer-visible marketplace status pipeline for an order.
///
/// Always includes supplier matching/payment steps so statuses like
/// `supplier_assigned` and `supplier_accepted` appear on the timeline.
List<OrderStatus> customerOrderStatusPipeline({
  required bool isPickup,
  Set<OrderStatus> includeOptional = const {},
}) {
  final steps = <OrderStatus>[
    OrderStatus.submitted,
    OrderStatus.needsQa,
  ];

  if (includeOptional.contains(OrderStatus.clientCorrection)) {
    steps.add(OrderStatus.clientCorrection);
  }
  if (includeOptional.contains(OrderStatus.proofApproval)) {
    steps.add(OrderStatus.proofApproval);
  }

  steps.addAll([
    OrderStatus.approvedForMatching,
    OrderStatus.supplierAssigned,
    OrderStatus.supplierAccepted,
    OrderStatus.awaitingPayment,
    OrderStatus.paymentAuthorized,
    OrderStatus.production,
    OrderStatus.supplierSelfQc,
  ]);

  if (isPickup) {
    steps.add(OrderStatus.collectedByCustomer);
  } else {
    steps.addAll([
      OrderStatus.readyForDispatch,
      OrderStatus.riderAssigned,
      OrderStatus.pickedUp,
      OrderStatus.outForDelivery,
      OrderStatus.delivered,
    ]);
  }

  if (includeOptional.contains(OrderStatus.issueWindowOpen) ||
      includeOptional.contains(OrderStatus.completed)) {
    steps.add(OrderStatus.issueWindowOpen);
  }
  if (includeOptional.contains(OrderStatus.completed)) {
    steps.add(OrderStatus.completed);
  }

  return steps;
}

/// Parse API snake_case (or camelCase) including legacy shop-queue labels.
OrderStatus parseMarketplaceOrderStatus(
  String value, {
  OrderStatus fallback = OrderStatus.submitted,
}) {
  // camelCase → snake_case, then normalize separators.
  final withSnake = value
      .trim()
      .replaceAllMapped(
        RegExp(r'([a-z0-9])([A-Z])'),
        (m) => '${m[1]}_${m[2]}',
      )
      .toLowerCase()
      .replaceAll('-', '_')
      .replaceAll(' ', '_');
  final normalized = withSnake;
  switch (normalized) {
    // Legacy → marketplace
    case 'order_placed':
      return OrderStatus.submitted;
    case 'file_verified':
      return OrderStatus.approvedForMatching;
    case 'file_declined':
      return OrderStatus.fileRejected;
    case 'printing_in_progress':
    case 'finishing_mounting':
      return OrderStatus.production;
    case 'quality_checked':
      return OrderStatus.supplierSelfQc;
    case 'on_the_way':
    case 'arrived_at_destination':
      return OrderStatus.outForDelivery;
    case 'completed_pickup':
      return OrderStatus.collectedByCustomer;
    // Marketplace + same-name
    case 'draft':
      return OrderStatus.draft;
    case 'submitted':
      return OrderStatus.submitted;
    case 'needs_qa':
      return OrderStatus.needsQa;
    case 'client_correction':
      return OrderStatus.clientCorrection;
    case 'proof_approval':
      return OrderStatus.proofApproval;
    case 'approved_for_matching':
      return OrderStatus.approvedForMatching;
    case 'supplier_assigned':
      return OrderStatus.supplierAssigned;
    case 'supplier_accepted':
      return OrderStatus.supplierAccepted;
    case 'awaiting_payment':
      return OrderStatus.awaitingPayment;
    case 'payment_authorized':
      return OrderStatus.paymentAuthorized;
    case 'production':
      return OrderStatus.production;
    case 'supplier_self_qc':
      return OrderStatus.supplierSelfQc;
    case 'ready_for_dispatch':
      return OrderStatus.readyForDispatch;
    case 'rider_assigned':
      return OrderStatus.riderAssigned;
    case 'picked_up':
      return OrderStatus.pickedUp;
    case 'out_for_delivery':
      return OrderStatus.outForDelivery;
    case 'delivered':
      return OrderStatus.delivered;
    case 'delivery_failed':
      return OrderStatus.deliveryFailed;
    case 'collected_by_customer':
      return OrderStatus.collectedByCustomer;
    case 'issue_window_open':
      return OrderStatus.issueWindowOpen;
    case 'completed':
      return OrderStatus.completed;
    case 'cancelled':
      return OrderStatus.cancelled;
    case 'file_rejected':
      return OrderStatus.fileRejected;
    default:
      return fallback;
  }
}

enum DeliveryStatus {
  assigned,
  accepted,
  declined,
  pickedUp,
  onTheWay,
  arrived,
  delivered,
  failed,
}

extension DeliveryStatusX on DeliveryStatus {
  String get displayName {
    switch (this) {
      case DeliveryStatus.assigned:
        return 'Assigned';
      case DeliveryStatus.accepted:
        return 'Accepted';
      case DeliveryStatus.declined:
        return 'Declined';
      case DeliveryStatus.pickedUp:
        return 'Picked Up';
      case DeliveryStatus.onTheWay:
        return 'On the Way';
      case DeliveryStatus.arrived:
        return 'Arrived';
      case DeliveryStatus.delivered:
        return 'Delivered';
      case DeliveryStatus.failed:
        return 'Failed';
    }
  }
}

enum PaymentMethod { gcash, maya, cod, gridCredits }

extension PaymentMethodX on PaymentMethod {
  String get displayName {
    switch (this) {
      case PaymentMethod.gcash:
        return 'GCash';
      case PaymentMethod.maya:
        return 'Maya';
      case PaymentMethod.cod:
        return 'Cash on Delivery';
      case PaymentMethod.gridCredits:
        return 'Pilot Credits';
    }
  }

  /// Wire value for order create / batch checkout (server marketplace rails).
  /// Server expects `pilot_credit` | `cod` (| sandbox `gcash`/`maya`).
  String get orderApiValue {
    switch (this) {
      case PaymentMethod.gridCredits:
        return 'pilot_credit';
      case PaymentMethod.cod:
        return 'cod';
      case PaymentMethod.gcash:
        return 'gcash';
      case PaymentMethod.maya:
        return 'maya';
    }
  }

  /// Wire value for `PATCH /users/me/default-payment-method`.
  /// Profile still accepts legacy `credits` (not pilot_credit).
  String get defaultApiValue {
    switch (this) {
      case PaymentMethod.gridCredits:
        return 'credits';
      case PaymentMethod.cod:
        return 'cod';
      case PaymentMethod.gcash:
        return 'gcash';
      case PaymentMethod.maya:
        return 'maya';
    }
  }

  bool get isLiveWallet =>
      this == PaymentMethod.gcash || this == PaymentMethod.maya;
}

enum PaymentStatus { pending, paid, failed, refunded }

extension PaymentStatusX on PaymentStatus {
  String get displayName {
    switch (this) {
      case PaymentStatus.pending:
        return 'Pending';
      case PaymentStatus.paid:
        return 'Paid';
      case PaymentStatus.failed:
        return 'Failed';
      case PaymentStatus.refunded:
        return 'Refunded';
    }
  }
}

enum VehicleType { motorcycle, bicycle, car }

extension VehicleTypeX on VehicleType {
  String get displayName {
    switch (this) {
      case VehicleType.motorcycle:
        return 'Motorcycle';
      case VehicleType.bicycle:
        return 'Bicycle';
      case VehicleType.car:
        return 'Car';
    }
  }
}

enum PaperSize { a1, a2, a3, a4, a5, twentyByThirty, custom }

extension PaperSizeX on PaperSize {
  String get displayName {
    switch (this) {
      case PaperSize.a1:
        return 'A1';
      case PaperSize.a2:
        return 'A2';
      case PaperSize.a3:
        return 'A3';
      case PaperSize.a4:
        return 'A4';
      case PaperSize.a5:
        return 'A5';
      case PaperSize.twentyByThirty:
        return '20x30';
      case PaperSize.custom:
        return 'Custom';
    }
  }
}

enum ColorMode { blackAndWhite, fullColor }

extension ColorModeX on ColorMode {
  String get displayName {
    switch (this) {
      case ColorMode.blackAndWhite:
        return 'Black & White';
      case ColorMode.fullColor:
        return 'Full Color';
    }
  }
}

enum MediaType { glossy, matte }

extension MediaTypeX on MediaType {
  String get displayName {
    switch (this) {
      case MediaType.glossy:
        return 'Glossy';
      case MediaType.matte:
        return 'Matte';
    }
  }
}

enum PrintSides { frontOnly, backToBack }

extension PrintSidesX on PrintSides {
  String get displayName {
    switch (this) {
      case PrintSides.frontOnly:
        return 'Front Only';
      case PrintSides.backToBack:
        return 'Back to Back';
    }
  }
}

enum Binding { none, spiral, staple, premium }

extension BindingX on Binding {
  String get displayName {
    switch (this) {
      case Binding.none:
        return 'None';
      case Binding.spiral:
        return 'Spiral';
      case Binding.staple:
        return 'Staple';
      case Binding.premium:
        return 'Premium';
    }
  }
}

enum Material3D { pla, abs, petg }

extension Material3DX on Material3D {
  String get displayName {
    switch (this) {
      case Material3D.pla:
        return 'PLA';
      case Material3D.abs:
        return 'ABS';
      case Material3D.petg:
        return 'PETG';
    }
  }
}

enum FileFormat3D { stl, obj, threeMf, glb, gltf }

extension FileFormat3DX on FileFormat3D {
  String get displayName {
    switch (this) {
      case FileFormat3D.stl:
        return 'STL';
      case FileFormat3D.obj:
        return 'OBJ';
      case FileFormat3D.threeMf:
        return '3MF';
      case FileFormat3D.glb:
        return 'GLB';
      case FileFormat3D.gltf:
        return 'GLTF';
    }
  }
}
