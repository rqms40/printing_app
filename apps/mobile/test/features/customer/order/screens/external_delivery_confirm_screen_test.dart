import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/screens/external_delivery_confirm_screen.dart';

void main() {
  testWidgets('shows confirm card and back button', (tester) async {
    await tester.pumpWidget(const ProviderScope(
      child: MaterialApp(home: ExternalDeliveryConfirmScreen()),
    ));
    expect(find.textContaining('partner courier'), findsOneWidget);
    expect(find.text('Confirm'), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);
  });
}
