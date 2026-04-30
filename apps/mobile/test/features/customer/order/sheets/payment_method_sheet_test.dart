import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/sheets/payment_method_sheet.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('lists 4 methods, returns chosen one', (tester) async {
    PaymentMethod? picked;
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Builder(builder: (ctx) => Scaffold(
          body: ElevatedButton(
            onPressed: () async {
              picked = await PaymentMethodSheet.show(ctx, current: null);
            },
            child: const Text('Open'),
          ),
        )),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('GCash'), findsOneWidget);
    expect(find.text('Maya'), findsOneWidget);
    expect(find.text('Cash on Delivery'), findsOneWidget);
    expect(find.text('GRID Credits'), findsOneWidget);
    await tester.tap(find.text('Maya'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();
    expect(picked, PaymentMethod.maya);
  });
}
