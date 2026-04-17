import '../models/address.dart';
import '../models/app_notification.dart';
import '../models/delivery_assignment.dart';
import '../models/driver_profile.dart';
import '../models/enums.dart';
import '../models/location_update.dart';
import '../models/order.dart';
import '../models/order_status_history.dart';
import '../models/paper_specs.dart';
import '../models/payment_transaction.dart';
import '../models/three_d_specs.dart';
import '../models/user.dart';

/// Static factory providing realistic Filipino mock data for development.
class MockData {
  MockData._();

  static final DateTime _now = DateTime(2026, 3, 27, 15, 0);

  // ─── Users ──────────────────────────────────────────────────────────

  static final User customerMaria = User(
    id: 'usr_001',
    uid: 'firebase_uid_maria',
    email: 'maria.santos@gmail.com',
    fullName: 'Maria Santos',
    phoneNumber: '+639171234567',
    gender: 'Female',
    dateOfBirth: DateTime(1995, 6, 15),
    profileCategory: 'student',
    profileField: 'architecture',
    course: 'BS Architecture',
    organization: 'Mapua University',
    printingPreferences: const ['plotting_blueprints', 'high_res_color'],
    role: UserRole.customer,
    isProfileComplete: true,
    isActive: true,
    createdAt: _now.subtract(const Duration(days: 90)),
    updatedAt: _now.subtract(const Duration(days: 2)),
  );

  static final User driverJuan = User(
    id: 'usr_002',
    uid: 'firebase_uid_juan',
    email: 'juan.reyes@gmail.com',
    fullName: 'Juan Reyes',
    phoneNumber: '+639181234567',
    gender: 'Male',
    dateOfBirth: DateTime(1990, 11, 3),
    profileCategory: 'professional',
    profileField: 'engineer_contractor',
    organization: 'Grid Logistics',
    printingPreferences: const ['technical_specs'],
    role: UserRole.driver,
    isProfileComplete: true,
    isActive: true,
    createdAt: _now.subtract(const Duration(days: 60)),
    updatedAt: _now.subtract(const Duration(days: 1)),
  );

  static final User adminUser = User(
    id: 'usr_003',
    uid: 'firebase_uid_admin',
    email: 'admin@gridprint.ph',
    fullName: 'Admin GRID',
    phoneNumber: '+639191234567',
    profileCategory: 'professional',
    profileField: 'business_corporate',
    organization: 'Grid Print HQ',
    printingPreferences: const ['marketing_materials'],
    role: UserRole.admin,
    isProfileComplete: true,
    isActive: true,
    createdAt: _now.subtract(const Duration(days: 180)),
    updatedAt: _now.subtract(const Duration(days: 1)),
  );

  static List<User> get users => [customerMaria, driverJuan, adminUser];

  // ─── Addresses ──────────────────────────────────────────────────────

  static final Address addressMakati = Address(
    id: 'addr_001',
    userId: 'usr_001',
    label: 'Home',
    fullAddress: '123 Ayala Avenue, Legazpi Village, Makati City',
    barangay: 'Legazpi Village',
    city: 'Makati City',
    province: 'Metro Manila',
    zipCode: '1229',
    landmark: 'Near Greenbelt Mall',
    latitude: 14.5547,
    longitude: 121.0244,
    isDefault: true,
    createdAt: _now.subtract(const Duration(days: 80)),
    updatedAt: _now.subtract(const Duration(days: 80)),
  );

  static final Address addressQC = Address(
    id: 'addr_002',
    userId: 'usr_001',
    label: 'Office',
    fullAddress: '456 Tomas Morato Avenue, South Triangle, Quezon City',
    barangay: 'South Triangle',
    city: 'Quezon City',
    province: 'Metro Manila',
    zipCode: '1103',
    landmark: 'Beside Tomas Morato Burger King',
    latitude: 14.6340,
    longitude: 121.0347,
    isDefault: false,
    createdAt: _now.subtract(const Duration(days: 60)),
    updatedAt: _now.subtract(const Duration(days: 60)),
  );

  static final Address addressCebu = Address(
    id: 'addr_003',
    userId: 'usr_001',
    label: 'Vacation Home',
    fullAddress: '789 Osmena Boulevard, Capitol Site, Cebu City',
    barangay: 'Capitol Site',
    city: 'Cebu City',
    province: 'Cebu',
    zipCode: '6000',
    landmark: 'Across from Cebu Provincial Capitol',
    latitude: 10.3157,
    longitude: 123.8854,
    isDefault: false,
    createdAt: _now.subtract(const Duration(days: 30)),
    updatedAt: _now.subtract(const Duration(days: 30)),
  );

  static List<Address> get addresses => [addressMakati, addressQC, addressCebu];

  // ─── Paper & 3D Specs ──────────────────────────────────────────────

  static const PaperSpecs _specsPosterA3Color = PaperSpecs(
    paperSize: PaperSize.a3,
    colorMode: ColorMode.fullColor,
    mediaType: MediaType.glossy,
    printSides: PrintSides.frontOnly,
    binding: Binding.none,
  );

  static const PaperSpecs _specsDocA4BW = PaperSpecs(
    paperSize: PaperSize.a4,
    colorMode: ColorMode.blackAndWhite,
    mediaType: MediaType.matte,
    printSides: PrintSides.backToBack,
    binding: Binding.spiral,
  );

  static const PaperSpecs _specsReportA4Color = PaperSpecs(
    paperSize: PaperSize.a4,
    colorMode: ColorMode.fullColor,
    mediaType: MediaType.matte,
    printSides: PrintSides.backToBack,
    binding: Binding.staple,
  );

  static const PaperSpecs _specsBannerA1 = PaperSpecs(
    paperSize: PaperSize.a1,
    colorMode: ColorMode.fullColor,
    mediaType: MediaType.glossy,
    printSides: PrintSides.frontOnly,
    binding: Binding.none,
  );

  static const ThreeDSpecs _specs3DKeychain = ThreeDSpecs(
    fileFormat: FileFormat3D.stl,
    material: Material3D.pla,
    color: 'Red',
    infillPercentage: 80,
    layerHeight: 0.2,
    supports: false,
    notes: 'Custom keychain with name engraving',
  );

  static const ThreeDSpecs _specs3DFigure = ThreeDSpecs(
    fileFormat: FileFormat3D.obj,
    material: Material3D.petg,
    color: 'White',
    infillPercentage: 50,
    layerHeight: 0.1,
    supports: true,
    notes: 'Miniature figurine, needs fine detail',
  );

  // ─── Orders ─────────────────────────────────────────────────────────

  static final List<Order> orders = [
    // 1. Newly placed poster order
    Order(
      id: 'ord_001',
      orderId: 'ORD-10001',
      userId: 'usr_001',
      category: 'Poster',
      fileUrl: 'https://storage.example.com/files/poster_design.pdf',
      fileName: 'poster_design.pdf',
      paperSpecs: _specsPosterA3Color,
      quantity: 5,
      totalPrice: 750.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.orderPlaced,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_001',
      createdAt: _now.subtract(const Duration(hours: 2)),
      updatedAt: _now.subtract(const Duration(hours: 2)),
    ),

    // 2. File verified, about to print
    Order(
      id: 'ord_002',
      orderId: 'ORD-10002',
      userId: 'usr_001',
      category: 'Document',
      fileUrl: 'https://storage.example.com/files/thesis_final.pdf',
      fileName: 'thesis_final.pdf',
      paperSpecs: _specsDocA4BW,
      quantity: 3,
      totalPrice: 450.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.maya,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.fileVerified,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_002',
      estimatedCompletionAt: _now.add(const Duration(hours: 4)),
      createdAt: _now.subtract(const Duration(hours: 6)),
      updatedAt: _now.subtract(const Duration(hours: 3)),
    ),

    // 3. Printing in progress
    Order(
      id: 'ord_003',
      orderId: 'ORD-10003',
      userId: 'usr_001',
      category: 'Report',
      fileUrl: 'https://storage.example.com/files/annual_report.pdf',
      fileName: 'annual_report.pdf',
      paperSpecs: _specsReportA4Color,
      quantity: 10,
      totalPrice: 1500.0,
      deliveryFee: 100.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.printingInProgress,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_001',
      estimatedCompletionAt: _now.add(const Duration(hours: 2)),
      adminNotes: 'Large order, prioritize',
      createdAt: _now.subtract(const Duration(days: 1)),
      updatedAt: _now.subtract(const Duration(hours: 1)),
    ),

    // 4. Ready for dispatch
    Order(
      id: 'ord_004',
      orderId: 'ORD-10004',
      userId: 'usr_001',
      category: 'Banner',
      fileUrl: 'https://storage.example.com/files/event_banner.pdf',
      fileName: 'event_banner.pdf',
      paperSpecs: _specsBannerA1,
      quantity: 2,
      totalPrice: 2400.0,
      deliveryFee: 150.0,
      paymentMethod: PaymentMethod.cod,
      paymentStatus: PaymentStatus.pending,
      orderStatus: OrderStatus.readyForDispatch,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_001',
      estimatedCompletionAt: _now,
      createdAt: _now.subtract(const Duration(days: 2)),
      updatedAt: _now.subtract(const Duration(hours: 4)),
    ),

    // 5. On the way
    Order(
      id: 'ord_005',
      orderId: 'ORD-10005',
      userId: 'usr_001',
      category: 'Poster',
      fileUrl: 'https://storage.example.com/files/marketing_poster.pdf',
      fileName: 'marketing_poster.pdf',
      paperSpecs: _specsPosterA3Color,
      quantity: 20,
      totalPrice: 3000.0,
      deliveryFee: 100.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.onTheWay,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_002',
      assignedDriverId: 'usr_002',
      trackingLink: 'https://track.gridprint.ph/ORD-10005',
      createdAt: _now.subtract(const Duration(days: 3)),
      updatedAt: _now.subtract(const Duration(minutes: 30)),
    ),

    // 6. Delivered
    Order(
      id: 'ord_006',
      orderId: 'ORD-10006',
      userId: 'usr_001',
      category: 'Document',
      fileUrl: 'https://storage.example.com/files/contract.pdf',
      fileName: 'contract.pdf',
      paperSpecs: _specsDocA4BW,
      quantity: 2,
      totalPrice: 200.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.maya,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.delivered,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_001',
      assignedDriverId: 'usr_002',
      createdAt: _now.subtract(const Duration(days: 7)),
      updatedAt: _now.subtract(const Duration(days: 5)),
    ),

    // 7. 3D Print — quality checked
    Order(
      id: 'ord_007',
      orderId: 'ORD-10007',
      userId: 'usr_001',
      category: '3D Print',
      fileUrl: 'https://storage.example.com/files/keychain.stl',
      fileName: 'keychain.stl',
      threeDSpecs: _specs3DKeychain,
      quantity: 10,
      totalPrice: 1200.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.qualityChecked,
      deliveryOption: 'pickup',
      estimatedCompletionAt: _now.add(const Duration(hours: 1)),
      createdAt: _now.subtract(const Duration(days: 4)),
      updatedAt: _now.subtract(const Duration(hours: 5)),
    ),

    // 8. 3D Print — file declined
    Order(
      id: 'ord_008',
      orderId: 'ORD-10008',
      userId: 'usr_001',
      category: '3D Print',
      fileUrl: 'https://storage.example.com/files/figurine.obj',
      fileName: 'figurine.obj',
      threeDSpecs: _specs3DFigure,
      quantity: 1,
      totalPrice: 850.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.cod,
      paymentStatus: PaymentStatus.pending,
      orderStatus: OrderStatus.fileDeclined,
      declineReason: 'File has non-manifold geometry. Please repair the mesh and re-upload.',
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_001',
      createdAt: _now.subtract(const Duration(days: 1)),
      updatedAt: _now.subtract(const Duration(hours: 8)),
    ),

    // 9. Cancelled order
    Order(
      id: 'ord_009',
      orderId: 'ORD-10009',
      userId: 'usr_001',
      category: 'Document',
      fileUrl: 'https://storage.example.com/files/old_report.pdf',
      fileName: 'old_report.pdf',
      paperSpecs: _specsDocA4BW,
      quantity: 5,
      totalPrice: 500.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.refunded,
      orderStatus: OrderStatus.cancelled,
      cancellationReason: 'Ordered the wrong file, need to re-upload',
      cancelledAt: _now.subtract(const Duration(days: 10)),
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_002',
      createdAt: _now.subtract(const Duration(days: 12)),
      updatedAt: _now.subtract(const Duration(days: 10)),
    ),

    // 10. Completed pickup
    Order(
      id: 'ord_010',
      orderId: 'ORD-10010',
      userId: 'usr_001',
      category: 'Poster',
      fileUrl: 'https://storage.example.com/files/birthday_poster.pdf',
      fileName: 'birthday_poster.pdf',
      paperSpecs: _specsPosterA3Color,
      quantity: 1,
      totalPrice: 150.0,
      deliveryFee: 0.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.completedPickup,
      deliveryOption: 'pickup',
      createdAt: _now.subtract(const Duration(days: 14)),
      updatedAt: _now.subtract(const Duration(days: 12)),
    ),
  ];

  // ─── Driver Profiles ───────────────────────────────────────────────

  static final DriverProfile driverProfileJuan = DriverProfile(
    id: 'dp_001',
    userId: 'usr_002',
    vehicleType: VehicleType.motorcycle,
    plateNumber: 'ABC 1234',
    licenseNumber: 'N01-23-456789',
    isAvailable: true,
    lastLatitude: 14.5580,
    lastLongitude: 121.0200,
    lastLocationUpdate: _now.subtract(const Duration(minutes: 5)),
    createdAt: _now.subtract(const Duration(days: 60)),
    updatedAt: _now.subtract(const Duration(minutes: 5)),
  );

  static final DriverProfile driverProfileCarlos = DriverProfile(
    id: 'dp_002',
    userId: 'usr_004',
    vehicleType: VehicleType.car,
    plateNumber: 'XYZ 5678',
    licenseNumber: 'N01-23-987654',
    isAvailable: false,
    lastLatitude: 14.6300,
    lastLongitude: 121.0400,
    lastLocationUpdate: _now.subtract(const Duration(hours: 1)),
    createdAt: _now.subtract(const Duration(days: 45)),
    updatedAt: _now.subtract(const Duration(hours: 1)),
  );

  static List<DriverProfile> get driverProfiles =>
      [driverProfileJuan, driverProfileCarlos];

  // ─── Delivery Assignments ──────────────────────────────────────────

  static final List<DeliveryAssignment> deliveryAssignments = [
    // Active: on the way for order 5
    DeliveryAssignment(
      id: 'da_001',
      orderId: 'ord_005',
      driverId: 'usr_002',
      status: DeliveryStatus.onTheWay,
      assignedAt: _now.subtract(const Duration(hours: 1)),
      acceptedAt: _now.subtract(const Duration(minutes: 55)),
      pickedUpAt: _now.subtract(const Duration(minutes: 40)),
      onTheWayAt: _now.subtract(const Duration(minutes: 30)),
      createdAt: _now.subtract(const Duration(hours: 1)),
      updatedAt: _now.subtract(const Duration(minutes: 30)),
    ),
    // Completed: delivered order 6
    DeliveryAssignment(
      id: 'da_002',
      orderId: 'ord_006',
      driverId: 'usr_002',
      status: DeliveryStatus.delivered,
      assignedAt: _now.subtract(const Duration(days: 5, hours: 3)),
      acceptedAt: _now.subtract(const Duration(days: 5, hours: 2, minutes: 50)),
      pickedUpAt: _now.subtract(const Duration(days: 5, hours: 2)),
      onTheWayAt: _now.subtract(const Duration(days: 5, hours: 1, minutes: 30)),
      arrivedAt: _now.subtract(const Duration(days: 5, hours: 1)),
      deliveredAt: _now.subtract(const Duration(days: 5, minutes: 45)),
      proofPhotoUrl: 'https://storage.example.com/proofs/da_002.jpg',
      createdAt: _now.subtract(const Duration(days: 5, hours: 3)),
      updatedAt: _now.subtract(const Duration(days: 5, minutes: 45)),
    ),
    // Assigned, waiting acceptance
    DeliveryAssignment(
      id: 'da_003',
      orderId: 'ord_004',
      driverId: 'usr_002',
      status: DeliveryStatus.assigned,
      assignedAt: _now.subtract(const Duration(minutes: 10)),
      createdAt: _now.subtract(const Duration(minutes: 10)),
      updatedAt: _now.subtract(const Duration(minutes: 10)),
    ),
    // Declined assignment
    DeliveryAssignment(
      id: 'da_004',
      orderId: 'ord_004',
      driverId: 'usr_004',
      status: DeliveryStatus.declined,
      assignedAt: _now.subtract(const Duration(hours: 2)),
      declineReason: 'Too far from current location',
      createdAt: _now.subtract(const Duration(hours: 2)),
      updatedAt: _now.subtract(const Duration(hours: 1, minutes: 50)),
    ),
    // Picked up, heading out
    DeliveryAssignment(
      id: 'da_005',
      orderId: 'ord_003',
      driverId: 'usr_002',
      status: DeliveryStatus.pickedUp,
      assignedAt: _now.subtract(const Duration(hours: 3)),
      acceptedAt: _now.subtract(const Duration(hours: 2, minutes: 55)),
      pickedUpAt: _now.subtract(const Duration(hours: 2, minutes: 30)),
      createdAt: _now.subtract(const Duration(hours: 3)),
      updatedAt: _now.subtract(const Duration(hours: 2, minutes: 30)),
    ),
  ];

  // ─── Location Updates (Manila GPS stream) ──────────────────────────

  static List<LocationUpdate> get locationUpdates {
    // Realistic route along actual Manila roads:
    // GRID Print Shop (Makati, Ayala Ave) → QC (Katipunan Ave)
    // Following: Ayala Ave → EDSA northbound → Ortigas → EDSA → Katipunan
    const routeCoords = [
      (14.5510, 121.0230), // Ayala Ave, Makati (start/shop)
      (14.5535, 121.0280), // Ayala Ave near Greenbelt
      (14.5570, 121.0320), // Ayala Ave → EDSA junction
      (14.5620, 121.0340), // EDSA northbound, Guadalupe
      (14.5680, 121.0360), // EDSA, Boni
      (14.5730, 121.0380), // EDSA, Pioneer
      (14.5790, 121.0390), // EDSA, Shaw Blvd junction
      (14.5850, 121.0388), // EDSA, near Shangri-La
      (14.5900, 121.0380), // EDSA, Ortigas Ave junction
      (14.5960, 121.0375), // EDSA, Robinson Galleria
      (14.6020, 121.0370), // EDSA, Santolan
      (14.6080, 121.0380), // EDSA, Camp Crame
      (14.6130, 121.0395), // EDSA, Aurora Blvd junction
      (14.6180, 121.0400), // EDSA, GMA Kamuning
      (14.6230, 121.0405), // EDSA, Timog junction
      (14.6280, 121.0420), // EDSA, near Trinoma
      (14.6310, 121.0440), // EDSA → turning east
      (14.6340, 121.0480), // Approach to Katipunan
      (14.6370, 121.0510), // Katipunan Ave, near Ateneo
      (14.6400, 121.0530), // Katipunan Ave, Loyola Heights (destination)
    ];

    final updates = <LocationUpdate>[];
    for (var i = 0; i < routeCoords.length; i++) {
      final (lat, lng) = routeCoords[i];
      updates.add(LocationUpdate(
        id: 'loc_${i.toString().padLeft(3, '0')}',
        deliveryAssignmentId: 'da_001',
        latitude: lat,
        longitude: lng,
        speed: 25.0 + (i % 5) * 5.0,
        heading: 10.0 + (i * 8.0),
        timestamp: _now.subtract(Duration(minutes: (routeCoords.length - i) * 2)),
      ));
    }

    return updates;
  }

  // ─── Order Status History ──────────────────────────────────────────

  static final List<OrderStatusHistory> orderStatusHistory = [
    // Order 5 — full lifecycle up to onTheWay
    OrderStatusHistory(
      id: 'osh_001',
      orderId: 'ord_005',
      fromStatus: OrderStatus.orderPlaced,
      toStatus: OrderStatus.fileVerified,
      changedByUserId: 'usr_003',
      notes: 'File verified, good to print',
      createdAt: _now.subtract(const Duration(days: 3, hours: -2)),
    ),
    OrderStatusHistory(
      id: 'osh_002',
      orderId: 'ord_005',
      fromStatus: OrderStatus.fileVerified,
      toStatus: OrderStatus.printingInProgress,
      changedByUserId: 'usr_003',
      createdAt: _now.subtract(const Duration(days: 2, hours: 20)),
    ),
    OrderStatusHistory(
      id: 'osh_003',
      orderId: 'ord_005',
      fromStatus: OrderStatus.printingInProgress,
      toStatus: OrderStatus.qualityChecked,
      changedByUserId: 'usr_003',
      createdAt: _now.subtract(const Duration(days: 2)),
    ),
    OrderStatusHistory(
      id: 'osh_004',
      orderId: 'ord_005',
      fromStatus: OrderStatus.qualityChecked,
      toStatus: OrderStatus.readyForDispatch,
      changedByUserId: 'usr_003',
      createdAt: _now.subtract(const Duration(days: 1, hours: 12)),
    ),
    OrderStatusHistory(
      id: 'osh_005',
      orderId: 'ord_005',
      fromStatus: OrderStatus.readyForDispatch,
      toStatus: OrderStatus.driverAssigned,
      changedByUserId: 'usr_003',
      createdAt: _now.subtract(const Duration(hours: 1)),
    ),
    OrderStatusHistory(
      id: 'osh_006',
      orderId: 'ord_005',
      fromStatus: OrderStatus.driverAssigned,
      toStatus: OrderStatus.pickedUp,
      changedByUserId: 'usr_002',
      createdAt: _now.subtract(const Duration(minutes: 40)),
    ),
    OrderStatusHistory(
      id: 'osh_007',
      orderId: 'ord_005',
      fromStatus: OrderStatus.pickedUp,
      toStatus: OrderStatus.onTheWay,
      changedByUserId: 'usr_002',
      createdAt: _now.subtract(const Duration(minutes: 30)),
    ),
    // Order 8 — declined
    OrderStatusHistory(
      id: 'osh_008',
      orderId: 'ord_008',
      fromStatus: OrderStatus.orderPlaced,
      toStatus: OrderStatus.fileDeclined,
      changedByUserId: 'usr_003',
      notes: 'Non-manifold geometry detected',
      createdAt: _now.subtract(const Duration(hours: 8)),
    ),
    // Order 9 — cancelled
    OrderStatusHistory(
      id: 'osh_009',
      orderId: 'ord_009',
      fromStatus: OrderStatus.orderPlaced,
      toStatus: OrderStatus.cancelled,
      changedByUserId: 'usr_001',
      notes: 'Customer requested cancellation',
      createdAt: _now.subtract(const Duration(days: 10)),
    ),
  ];

  // ─── Payment Transactions ──────────────────────────────────────────

  static final List<PaymentTransaction> paymentTransactions = [
    PaymentTransaction(
      id: 'pt_001',
      orderId: 'ord_001',
      paymentMethod: PaymentMethod.gcash,
      amount: 830.0,
      status: PaymentStatus.paid,
      externalReferenceId: 'GCASH-REF-001234',
      createdAt: _now.subtract(const Duration(hours: 2)),
    ),
    PaymentTransaction(
      id: 'pt_002',
      orderId: 'ord_002',
      paymentMethod: PaymentMethod.maya,
      amount: 530.0,
      status: PaymentStatus.paid,
      externalReferenceId: 'MAYA-REF-005678',
      createdAt: _now.subtract(const Duration(hours: 6)),
    ),
    PaymentTransaction(
      id: 'pt_003',
      orderId: 'ord_009',
      paymentMethod: PaymentMethod.gcash,
      amount: 580.0,
      status: PaymentStatus.refunded,
      externalReferenceId: 'GCASH-REF-009012',
      createdAt: _now.subtract(const Duration(days: 10)),
    ),
  ];

  // ─── Notifications ─────────────────────────────────────────────────

  static final List<AppNotification> notifications = [
    AppNotification(
      id: 'notif_001',
      userId: 'usr_001',
      orderId: 'ord_001',
      title: 'Order Placed',
      message: 'Your order ORD-10001 has been placed successfully.',
      type: 'order_update',
      isRead: true,
      createdAt: _now.subtract(const Duration(hours: 2)),
    ),
    AppNotification(
      id: 'notif_002',
      userId: 'usr_001',
      orderId: 'ord_002',
      title: 'File Verified',
      message: 'Your file for ORD-10002 has been verified and approved for printing.',
      type: 'order_update',
      isRead: true,
      createdAt: _now.subtract(const Duration(hours: 3)),
    ),
    AppNotification(
      id: 'notif_003',
      userId: 'usr_001',
      orderId: 'ord_003',
      title: 'Printing Started',
      message: 'Your order ORD-10003 is now being printed.',
      type: 'order_update',
      isRead: false,
      createdAt: _now.subtract(const Duration(hours: 1)),
    ),
    AppNotification(
      id: 'notif_004',
      userId: 'usr_001',
      orderId: 'ord_005',
      title: 'Driver On the Way',
      message: 'Juan Reyes is on the way with your order ORD-10005.',
      type: 'delivery_update',
      isRead: false,
      createdAt: _now.subtract(const Duration(minutes: 30)),
    ),
    AppNotification(
      id: 'notif_005',
      userId: 'usr_001',
      orderId: 'ord_006',
      title: 'Order Delivered',
      message: 'Your order ORD-10006 has been delivered. Thank you!',
      type: 'delivery_update',
      isRead: true,
      createdAt: _now.subtract(const Duration(days: 5)),
    ),
    AppNotification(
      id: 'notif_006',
      userId: 'usr_001',
      orderId: 'ord_008',
      title: 'File Declined',
      message: 'Your file for ORD-10008 was declined. Please check the details and re-upload.',
      type: 'order_update',
      isRead: false,
      createdAt: _now.subtract(const Duration(hours: 8)),
    ),
    AppNotification(
      id: 'notif_007',
      userId: 'usr_001',
      orderId: 'ord_009',
      title: 'Refund Processed',
      message: 'Your refund of P580.00 for ORD-10009 has been processed to your GCash account.',
      type: 'payment',
      isRead: true,
      createdAt: _now.subtract(const Duration(days: 10)),
    ),
    AppNotification(
      id: 'notif_008',
      userId: 'usr_001',
      title: 'Welcome to GRID!',
      message: 'Start your first order and enjoy premium printing services delivered to your doorstep.',
      type: 'promo',
      isRead: true,
      createdAt: _now.subtract(const Duration(days: 90)),
    ),
    AppNotification(
      id: 'notif_009',
      userId: 'usr_002',
      orderId: 'ord_005',
      title: 'New Delivery Assignment',
      message: 'You have been assigned to deliver ORD-10005 to Quezon City.',
      type: 'delivery_assignment',
      isRead: true,
      createdAt: _now.subtract(const Duration(hours: 1)),
    ),
    AppNotification(
      id: 'notif_010',
      userId: 'usr_002',
      orderId: 'ord_004',
      title: 'New Delivery Assignment',
      message: 'You have been assigned to deliver ORD-10004 to Makati City.',
      type: 'delivery_assignment',
      isRead: false,
      createdAt: _now.subtract(const Duration(minutes: 10)),
    ),
    AppNotification(
      id: 'notif_011',
      userId: 'usr_001',
      orderId: 'ord_004',
      title: 'Ready for Dispatch',
      message: 'Your order ORD-10004 is ready and a driver will be assigned shortly.',
      type: 'order_update',
      isRead: false,
      createdAt: _now.subtract(const Duration(hours: 4)),
    ),
    AppNotification(
      id: 'notif_012',
      userId: 'usr_001',
      orderId: 'ord_007',
      title: 'Quality Check Passed',
      message: 'Your 3D print order ORD-10007 has passed quality inspection and is ready for pickup.',
      type: 'order_update',
      isRead: false,
      createdAt: _now.subtract(const Duration(hours: 5)),
    ),
    AppNotification(
      id: 'notif_013',
      userId: 'usr_003',
      orderId: 'ord_001',
      title: 'New Order Received',
      message: 'New order ORD-10001 from Maria Santos. Please verify the uploaded file.',
      type: 'admin_alert',
      isRead: false,
      createdAt: _now.subtract(const Duration(hours: 2)),
    ),
    AppNotification(
      id: 'notif_014',
      userId: 'usr_001',
      title: '20% Off This Weekend!',
      message: 'Enjoy 20% off on all A3 poster prints this weekend. Use code POSTER20.',
      type: 'promo',
      isRead: false,
      createdAt: _now.subtract(const Duration(hours: 12)),
    ),
    AppNotification(
      id: 'notif_015',
      userId: 'usr_001',
      orderId: 'ord_010',
      title: 'Ready for Pickup',
      message: 'Your order ORD-10010 is ready for pickup at our Makati branch.',
      type: 'order_update',
      isRead: true,
      createdAt: _now.subtract(const Duration(days: 13)),
    ),
    AppNotification(
      id: 'notif_016',
      userId: 'usr_002',
      title: 'Weekly Summary',
      message: 'You completed 8 deliveries this week. Great job!',
      type: 'system',
      isRead: true,
      createdAt: _now.subtract(const Duration(days: 1)),
    ),
  ];
}
