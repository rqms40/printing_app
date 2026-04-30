import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:printing_app/shared/models/address.dart';

Address _addr(String id, String label, String full) => Address(
      id: id, userId: 'u1', label: label, fullAddress: full,
      city: 'Makati', latitude: 0, longitude: 0, isDefault: false,
      createdAt: DateTime.now(), updatedAt: DateTime.now(),
    );

void main() {
  testWidgets('shows saved addresses, returns chosen one', (tester) async {
    final container = ProviderContainer(overrides: [
      addressProvider.overrideWith((ref) => AddressNotifier(
            initialState: [
              _addr('1', 'Home', '12 Sampaguita St'),
              _addr('2', 'Office', 'Salcedo Tower'),
            ],
            skipBootstrap: true,
          )),
    ]);

    Address? picked;
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Builder(builder: (ctx) => Scaffold(
          body: ElevatedButton(
            onPressed: () async {
              picked = await AddressPickerSheet.show(ctx);
            },
            child: const Text('Open'),
          ),
        )),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Office'), findsOneWidget);
    await tester.tap(find.text('Office'));
    await tester.pumpAndSettle();
    expect(picked?.id, '2');
  });
}
