import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/features/customer/order/widgets/payment_qr_code.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/marketplace_order_actions.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

Order _order({
  required OrderStatus status,
  String? adminNotes,
  String? adminStatusNote,
  PaymentMethod paymentMethod = PaymentMethod.gridCredits,
  AssignedSupplierContact? assignedSupplier,
}) {
  return Order(
    id: '42',
    orderId: 'ORD-10042',
    userId: '1',
    category: 'paper',
    fileName: 'art.pdf',
    quantity: 1,
    totalPrice: 200,
    deliveryFee: 0,
    paymentMethod: paymentMethod,
    paymentStatus: PaymentStatus.pending,
    orderStatus: status,
    deliveryOption: 'delivery',
    assignedSupplier: assignedSupplier,
    adminNotes: adminNotes,
    adminStatusNote: adminStatusNote,
    createdAt: DateTime(2026, 5, 2),
    updatedAt: DateTime(2026, 5, 2),
  );
}

Widget _wrap(Order order) {
  return ProviderScope(
    overrides: [
      ordersProvider.overrideWith(
        (_) => OrdersNotifier(initialState: [order], skipBootstrap: true),
      ),
      deliveryFeeSettingsProvider.overrideWith(
        (ref) async => DeliveryFeeSettings.fallback,
      ),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: MarketplaceOrderActions(order: order),
        ),
      ),
    ),
  );
}

void main() {
  test('correctionChecklistItems splits admin notes into bullets', () {
    final order = _order(
      status: OrderStatus.clientCorrection,
      adminNotes: '- Increase bleed\n* Fix resolution\nSafe area too tight',
      adminStatusNote: 'Increase bleed',
    );
    expect(correctionChecklistItems(order), [
      'Increase bleed',
      'Fix resolution',
      'Safe area too tight',
    ]);
  });

  testWidgets('correction state shows checklist and re-upload CTA', (
    tester,
  ) async {
    final order = _order(
      status: OrderStatus.clientCorrection,
      adminNotes: 'Increase bleed to 3mm\nRaise resolution to 300dpi',
    );
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(find.text('Artwork correction needed'), findsOneWidget);
    expect(find.text('Ops checklist'), findsOneWidget);
    expect(find.text('Increase bleed to 3mm'), findsOneWidget);
    expect(find.text('Raise resolution to 300dpi'), findsOneWidget);
    expect(find.text('Upload revised artwork'), findsOneWidget);
  });

  testWidgets('proof state shows approve and request changes', (tester) async {
    final order = _order(
      status: OrderStatus.proofApproval,
      adminStatusNote: 'Confirm crop marks',
    );
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(find.text('Proof approval needed'), findsOneWidget);
    expect(find.text('Approve proof'), findsOneWidget);
    expect(find.text('Request changes'), findsOneWidget);
    expect(find.text('Confirm crop marks'), findsOneWidget);
  });

  testWidgets('payment wait state shows ops authorization messaging', (
    tester,
  ) async {
    final order = _order(status: OrderStatus.supplierAccepted);
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(find.text('Waiting for payment authorization'), findsOneWidget);
    expect(find.textContaining('ops'), findsWidgets);
    expect(find.textContaining('24'), findsWidgets);
    // Client no longer authorizes payment — ops/super only.
    expect(find.text('Authorize payment'), findsNothing);
  });

  testWidgets('hides when order is not in a client action gate', (tester) async {
    final order = _order(status: OrderStatus.production);
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();
    expect(find.byType(MarketplaceOrderActions), findsOneWidget);
    expect(find.text('Authorize payment'), findsNothing);
    expect(find.text('Approve proof'), findsNothing);
    expect(find.text('Upload revised artwork'), findsNothing);
    expect(find.text('Report a Concern'), findsNothing);
  });

  testWidgets('collected order shows Report a Concern', (tester) async {
    final order = _order(status: OrderStatus.collectedByCustomer);
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(find.text('Check your order'), findsOneWidget);
    expect(find.text('Report a Concern'), findsOneWidget);
    expect(find.textContaining('24 hours'), findsWidgets);
    expect(canReportConcern(OrderStatus.collectedByCustomer), isTrue);
    expect(canReportConcern(OrderStatus.issueWindowOpen), isTrue);
    expect(canReportConcern(OrderStatus.delivered), isTrue);
    expect(canReportConcern(OrderStatus.production), isFalse);
  });

  testWidgets('issue window open shows Report a Concern', (tester) async {
    final order = _order(status: OrderStatus.issueWindowOpen);
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(find.text('Report a Concern'), findsOneWidget);
    expect(find.text('Print quality defect'), findsOneWidget);
  });

  testWidgets('quoted Pilot Credits order shows the pay action', (tester) async {
    final order = _order(
      status: OrderStatus.supplierAssigned,
      paymentMethod: PaymentMethod.gridCredits,
      assignedSupplier: const AssignedSupplierContact(
        supplierId: 1,
        businessName: 'Polymedia Printing Services',
        quotedPriceMinor: 28000,
      ),
    );
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(order.awaitingSupplierQuotePayment, isTrue);
    expect(find.text('Pay the final print price'), findsOneWidget);
    expect(find.text('Pay ₱280.00'), findsOneWidget);
  });

  testWidgets('quoted QR order shows Payment_QR.jpg for the customer to scan', (
    tester,
  ) async {
    final order = _order(
      status: OrderStatus.supplierAssigned,
      paymentMethod: PaymentMethod.qrPhInstapay,
      assignedSupplier: const AssignedSupplierContact(
        supplierId: 1,
        businessName: 'Polymedia Printing Services',
        quotedPriceMinor: 15000,
      ),
    );
    await tester.pumpWidget(_wrap(order));
    await tester.pumpAndSettle();

    expect(find.text('Pay the final print price'), findsOneWidget);
    expect(find.byType(PaymentQrCode), findsOneWidget);
    expect(find.text('Download / Share QR'), findsOneWidget);
    expect(find.text('Upload payment receipt'), findsOneWidget);
  });
}
