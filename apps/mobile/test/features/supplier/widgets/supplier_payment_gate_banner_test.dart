import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/supplier/models/supplier_job.dart';
import 'package:printing_app/features/supplier/widgets/supplier_payment_gate_banner.dart';

void main() {
  group('SupplierPaymentGateBanner', () {
    testWidgets('full banner shows waiting title, body, and gate copy', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SupplierPaymentGateBanner(
              orderStatusLabel: 'Awaiting Payment',
            ),
          ),
        ),
      );

      expect(find.text(SupplierPaymentGateCopy.waitingTitle), findsOneWidget);
      expect(find.text(SupplierPaymentGateCopy.waitingBody), findsOneWidget);
      expect(
        find.text(SupplierPaymentGateCopy.needsPaymentAuthorized),
        findsOneWidget,
      );
      expect(find.text('Current status: Awaiting Payment'), findsOneWidget);
    });

    testWidgets('compact banner shows needsPaymentAuthorized gate line', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SupplierPaymentGateBanner(compact: true),
          ),
        ),
      );

      expect(
        find.text(SupplierPaymentGateCopy.needsPaymentAuthorized),
        findsOneWidget,
      );
      expect(find.text(SupplierPaymentGateCopy.waitingTitle), findsNothing);
    });

    test('copy constants stay stable for accept-gate regressions', () {
      expect(
        SupplierPaymentGateCopy.needsPaymentAuthorized,
        'Needs payment_authorized before production',
      );
      expect(
        SupplierPaymentGateCopy.waitingTitle,
        'Waiting for payment authorization',
      );
      expect(
        SupplierPaymentGateCopy.waitingBody,
        contains('payment_authorized'),
      );
    });
  });
}
