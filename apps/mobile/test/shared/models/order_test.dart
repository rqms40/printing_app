import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

void main() {
  group('Order model', () {
    final now = DateTime.now();

    final sampleOrder = Order(
      id: 'test_001',
      orderId: 'ORD-99999',
      userId: 'usr_001',
      category: 'Poster',
      fileUrl: 'https://example.com/file.pdf',
      fileName: 'file.pdf',
      paperSpecs: const PaperSpecs(
        paperSize: PaperSize.a3,
        colorMode: ColorMode.fullColor,
        mediaType: MediaType.glossy,
        printSides: PrintSides.frontOnly,
        binding: Binding.none,
      ),
      quantity: 5,
      totalPrice: 750.0,
      deliveryFee: 80.0,
      paymentMethod: PaymentMethod.gcash,
      paymentStatus: PaymentStatus.paid,
      orderStatus: OrderStatus.orderPlaced,
      deliveryOption: 'delivery',
      deliveryAddressId: 'addr_001',
      createdAt: now,
      updatedAt: now,
    );

    test('creates with required fields', () {
      expect(sampleOrder.id, 'test_001');
      expect(sampleOrder.orderId, 'ORD-99999');
      expect(sampleOrder.category, 'Poster');
      expect(sampleOrder.quantity, 5);
      expect(sampleOrder.totalPrice, 750.0);
      expect(sampleOrder.orderStatus, OrderStatus.orderPlaced);
    });

    test('optional fields default to null', () {
      final minimalOrder = Order(
        id: 'test_002',
        orderId: 'ORD-00001',
        userId: 'usr_001',
        category: 'Document',
        quantity: 1,
        totalPrice: 100.0,
        deliveryFee: 0.0,
        paymentMethod: PaymentMethod.cod,
        paymentStatus: PaymentStatus.pending,
        orderStatus: OrderStatus.orderPlaced,
        deliveryOption: 'pickup',
        createdAt: now,
        updatedAt: now,
      );

      expect(minimalOrder.fileUrl, isNull);
      expect(minimalOrder.fileName, isNull);
      expect(minimalOrder.paperSpecs, isNull);
      expect(minimalOrder.threeDSpecs, isNull);
      expect(minimalOrder.declineReason, isNull);
      expect(minimalOrder.assignedDriverId, isNull);
      expect(minimalOrder.deliveryAssignmentId, isNull);
    });

    test('copyWith updates specified fields only', () {
      final updated = sampleOrder.copyWith(
        orderStatus: OrderStatus.printingInProgress,
        assignedDriverId: 'usr_002',
        deliveryAssignmentId: 'da_001',
      );

      expect(updated.orderStatus, OrderStatus.printingInProgress);
      expect(updated.assignedDriverId, 'usr_002');
      expect(updated.deliveryAssignmentId, 'da_001');
      // Unchanged fields remain the same
      expect(updated.id, sampleOrder.id);
      expect(updated.orderId, sampleOrder.orderId);
      expect(updated.totalPrice, sampleOrder.totalPrice);
      expect(updated.paymentMethod, sampleOrder.paymentMethod);
    });

    test('equality is based on id', () {
      final duplicate = sampleOrder.copyWith(
        orderStatus: OrderStatus.delivered,
      );
      expect(sampleOrder, equals(duplicate));
    });

    test('different ids are not equal', () {
      final other = sampleOrder.copyWith(id: 'different_id');
      expect(sampleOrder, isNot(equals(other)));
    });

    test('toString contains orderId and status', () {
      final str = sampleOrder.toString();
      expect(str, contains('ORD-99999'));
      expect(str, contains('Order Placed'));
    });
  });

  group('Order enums', () {
    test('OrderStatus displayName covers all values', () {
      for (final status in OrderStatus.values) {
        expect(status.displayName, isNotEmpty);
      }
    });

    test('PaymentMethod displayName is correct', () {
      expect(PaymentMethod.gcash.displayName, 'GCash');
      expect(PaymentMethod.maya.displayName, 'Maya');
      expect(PaymentMethod.cod.displayName, 'Cash on Delivery');
    });

    test('PaperSize displayName handles special sizes', () {
      expect(PaperSize.twentyByThirty.displayName, '20x30');
      expect(PaperSize.a4.displayName, 'A4');
      expect(PaperSize.custom.displayName, 'Custom');
    });
  });

  group('PaperSpecs', () {
    test('copyWith returns a new instance with updated fields', () {
      const specs = PaperSpecs(
        paperSize: PaperSize.a4,
        colorMode: ColorMode.blackAndWhite,
        mediaType: MediaType.matte,
        printSides: PrintSides.frontOnly,
        binding: Binding.none,
      );

      final updated = specs.copyWith(
        colorMode: ColorMode.fullColor,
        binding: Binding.spiral,
      );

      expect(updated.colorMode, ColorMode.fullColor);
      expect(updated.binding, Binding.spiral);
      expect(updated.paperSize, PaperSize.a4); // unchanged
    });
  });

  group('ThreeDSpecs', () {
    test('creates with required and optional fields', () {
      const specs = ThreeDSpecs(
        fileFormat: FileFormat3D.stl,
        material: Material3D.pla,
        color: 'Red',
        infillPercentage: 80,
        layerHeight: 0.2,
        supports: false,
        notes: 'Test note',
      );

      expect(specs.fileFormat, FileFormat3D.stl);
      expect(specs.material, Material3D.pla);
      expect(specs.notes, 'Test note');
    });
  });

  group('MockData', () {
    test('provides expected number of users', () {
      expect(MockData.users.length, 3);
    });

    test('provides orders across different statuses', () {
      final statuses = MockData.orders.map((o) => o.orderStatus).toSet();
      expect(statuses.length, greaterThanOrEqualTo(8));
    });

    test('provides addresses with Filipino locations', () {
      expect(MockData.addresses.length, greaterThanOrEqualTo(3));
      expect(MockData.addresses.any((a) => a.city == 'Makati City'), isTrue);
      expect(MockData.addresses.any((a) => a.city == 'Quezon City'), isTrue);
      expect(MockData.addresses.any((a) => a.city == 'Cebu City'), isTrue);
      expect(MockData.addresses.any((a) => a.city == 'Davao City'), isTrue);
    });

    test('provides location updates with Manila coordinates', () {
      final updates = MockData.locationUpdates;
      expect(updates.length, 20);
      // All coordinates should be in the greater Manila area
      for (final update in updates) {
        expect(update.latitude, greaterThan(14.0));
        expect(update.latitude, lessThan(15.0));
        expect(update.longitude, greaterThan(121.0));
        expect(update.longitude, lessThan(122.0));
      }
    });

    test('provides notifications for all user roles', () {
      final userIds = MockData.notifications.map((n) => n.userId).toSet();
      expect(userIds, contains('usr_001')); // customer
      expect(userIds, contains('usr_002')); // driver
      expect(userIds, contains('usr_003')); // admin
    });
  });
}
