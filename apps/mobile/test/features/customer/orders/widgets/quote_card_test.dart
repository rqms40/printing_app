import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/quote_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

Order _order({
  required PricingStatus pricingStatus,
  BigInt? totalMinor,
  BigInt? deliveryMinor,
  DateTime? promisedAt,
  int? quoteAssignmentId,
  bool codEligible = false,
  PaymentMethod paymentMethod = PaymentMethod.gridCredits,
}) {
  return Order(
    id: '42',
    orderId: 'ORD-10042',
    userId: '1',
    category: 'flyers',
    categoryName: 'Flyers',
    quantity: 100,
    totalPrice: 0,
    deliveryFee: 0,
    pricingStatus: pricingStatus,
    quotedTotalMinor: totalMinor,
    deliveryFeeMinor: deliveryMinor,
    promisedCompletionAt: promisedAt,
    quoteAssignmentId: quoteAssignmentId,
    codEligible: codEligible,
    paymentMethod: paymentMethod,
    paymentStatus: PaymentStatus.pending,
    orderStatus: pricingStatus == PricingStatus.pendingQuote
        ? OrderStatus.submitted
        : pricingStatus == PricingStatus.quoted
        ? OrderStatus.supplierAccepted
        : OrderStatus.awaitingPayment,
    deliveryOption: 'delivery',
    createdAt: DateTime.utc(2026, 8, 12),
    updatedAt: DateTime.utc(2026, 8, 12),
  );
}

Widget _wrap(
  Order order, {
  bool isOwner = true,
  Future<void> Function(String, int, PaymentMethod)? onAccept,
  VoidCallback? onRefresh,
}) {
  return MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(
        child: QuoteCard(
          order: order,
          isOwner: isOwner,
          onAccept: onAccept,
          onRefresh: onRefresh,
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('pending quote has no amount, payment rail, or accept action', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(_order(pricingStatus: PricingStatus.pendingQuote)),
    );

    expect(find.text('Price and turnaround pending review'), findsOneWidget);
    expect(find.textContaining('₱'), findsNothing);
    expect(find.text('Pilot Credits'), findsNothing);
    expect(find.text('Cash on Delivery'), findsNothing);
    expect(find.text('Accept quote'), findsNothing);
  });

  testWidgets(
    'quoted state shows exact totals, date, eligible rails, and one action',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          _order(
            pricingStatus: PricingStatus.quoted,
            totalMinor: BigInt.from(12700),
            deliveryMinor: BigInt.from(2700),
            promisedAt: DateTime.utc(2026, 8, 20),
            quoteAssignmentId: 77,
            codEligible: true,
          ),
          onAccept: (_, _, _) async {},
        ),
      );

      expect(find.text('₱100.00'), findsOneWidget);
      expect(find.text('₱27.00'), findsOneWidget);
      expect(find.text('₱127.00'), findsOneWidget);
      expect(find.textContaining('Aug 20, 2026'), findsOneWidget);
      expect(find.text('Pilot Credits'), findsOneWidget);
      expect(find.text('Cash on Delivery'), findsOneWidget);
      expect(find.text('Accept quote'), findsOneWidget);
      expect(find.textContaining('77'), findsNothing);
    },
  );

  testWidgets('quoted state omits missing monetary parts and promised date', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        _order(
          pricingStatus: PricingStatus.quoted,
          totalMinor: BigInt.from(10000),
          quoteAssignmentId: 77,
        ),
        onAccept: (_, _, _) async {},
      ),
    );

    expect(find.text('₱100.00'), findsOneWidget);
    expect(find.text('Goods'), findsNothing);
    expect(find.text('Delivery'), findsNothing);
    expect(find.textContaining('Promised'), findsNothing);
    expect(find.text('Cash on Delivery'), findsNothing);
  });

  testWidgets('non-owner sees quote terms without acceptance controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        _order(
          pricingStatus: PricingStatus.quoted,
          totalMinor: BigInt.from(12700),
          deliveryMinor: BigInt.from(2700),
          promisedAt: DateTime.utc(2026, 8, 20),
          quoteAssignmentId: 77,
        ),
        isOwner: false,
        onAccept: (_, _, _) async {},
      ),
    );

    expect(find.text('₱127.00'), findsOneWidget);
    expect(find.text('Pilot Credits'), findsNothing);
    expect(find.text('Accept quote'), findsNothing);
  });

  testWidgets('stale conflict preserves rail selection and offers refresh', (
    tester,
  ) async {
    var refreshes = 0;
    await tester.pumpWidget(
      _wrap(
        _order(
          pricingStatus: PricingStatus.quoted,
          totalMinor: BigInt.from(12700),
          deliveryMinor: BigInt.from(2700),
          promisedAt: DateTime.utc(2026, 8, 20),
          quoteAssignmentId: 77,
          codEligible: true,
        ),
        onAccept: (_, _, _) async => throw const QuoteAcceptanceException(
          code: 'stale_quote',
          message: 'The selected quote changed',
        ),
        onRefresh: () => refreshes++,
      ),
    );
    await tester.tap(find.text('Cash on Delivery'));
    await tester.pump();
    await tester.tap(find.text('Accept quote'));
    await tester.pumpAndSettle();

    expect(find.textContaining('quote changed'), findsOneWidget);
    expect(find.text('Refresh quote'), findsOneWidget);
    final paymentGroup = tester.widget<RadioGroup<PaymentMethod>>(
      find.byType(RadioGroup<PaymentMethod>),
    );
    expect(paymentGroup.groupValue, PaymentMethod.cod);
    await tester.tap(find.text('Refresh quote'));
    expect(refreshes, 1);
  });

  testWidgets(
    'accepted state remains consistent without another accept action',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          _order(
            pricingStatus: PricingStatus.accepted,
            totalMinor: BigInt.from(12700),
            deliveryMinor: BigInt.from(2700),
            promisedAt: DateTime.utc(2026, 8, 20),
            quoteAssignmentId: 77,
            paymentMethod: PaymentMethod.gridCredits,
          ),
        ),
      );

      expect(find.text('Quote accepted'), findsOneWidget);
      expect(find.textContaining('Pilot Credits'), findsOneWidget);
      expect(find.text('Accept quote'), findsNothing);
    },
  );
}
