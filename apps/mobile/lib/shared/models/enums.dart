/// All domain enums for GRID with displayName extensions.
library;

enum UserRole { customer, driver, admin }

extension UserRoleX on UserRole {
  String get displayName {
    switch (this) {
      case UserRole.customer:
        return 'Customer';
      case UserRole.driver:
        return 'Driver';
      case UserRole.admin:
        return 'Admin';
    }
  }
}

enum OrderStatus {
  orderPlaced,
  fileVerified,
  fileDeclined,
  printingInProgress,
  finishingMounting,
  qualityChecked,
  readyForDispatch,
  driverAssigned,
  pickedUp,
  onTheWay,
  arrivedAtDestination,
  delivered,
  completedPickup,
  cancelled,
}

extension OrderStatusX on OrderStatus {
  String get displayName {
    switch (this) {
      case OrderStatus.orderPlaced:
        return 'Order Placed';
      case OrderStatus.fileVerified:
        return 'File Verified';
      case OrderStatus.fileDeclined:
        return 'File Declined';
      case OrderStatus.printingInProgress:
        return 'Printing in Progress';
      case OrderStatus.finishingMounting:
        return 'Finishing & Mounting';
      case OrderStatus.qualityChecked:
        return 'Quality Checked';
      case OrderStatus.readyForDispatch:
        return 'Ready for Dispatch';
      case OrderStatus.driverAssigned:
        return 'Driver Assigned';
      case OrderStatus.pickedUp:
        return 'Picked Up';
      case OrderStatus.onTheWay:
        return 'On the Way';
      case OrderStatus.arrivedAtDestination:
        return 'Arrived at Destination';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.completedPickup:
        return 'Completed (Pickup)';
      case OrderStatus.cancelled:
        return 'Cancelled';
    }
  }
}

enum DeliveryStatus { assigned, accepted, declined, pickedUp, onTheWay, arrived, delivered }

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
        return 'GRID Credits';
    }
  }
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

enum FileFormat3D { stl, obj, threeMf }

extension FileFormat3DX on FileFormat3D {
  String get displayName {
    switch (this) {
      case FileFormat3D.stl:
        return 'STL';
      case FileFormat3D.obj:
        return 'OBJ';
      case FileFormat3D.threeMf:
        return '3MF';
    }
  }
}
