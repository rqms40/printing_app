import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:printing_app/shared/models/address.dart';

Address _addr(String id, String label, String full) => Address(
  id: id,
  userId: 'u1',
  label: label,
  fullAddress: full,
  city: 'Makati',
  latitude: 0,
  longitude: 0,
  isDefault: false,
  createdAt: DateTime.now(),
  updatedAt: DateTime.now(),
);

void main() {
  testWidgets('shows saved addresses, returns chosen one', (tester) async {
    final container = ProviderContainer(
      overrides: [
        addressProvider.overrideWith(
          (ref) => AddressNotifier(
            initialState: [
              _addr('1', 'Home', '12 Sampaguita St'),
              _addr('2', 'Office', 'Salcedo Tower'),
            ],
            skipBootstrap: true,
          ),
        ),
      ],
    );

    Address? picked;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  picked = await AddressPickerSheet.show(ctx);
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Office'), findsOneWidget);
    await tester.tap(find.text('Office'));
    await tester.pumpAndSettle();
    expect(picked?.id, '2');
  });

  testWidgets('pin location flow returns a temporary checkout address', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        addressProvider.overrideWith(
          (ref) => AddressNotifier(
            initialState: [_addr('1', 'Home', '12 Sampaguita St')],
            skipBootstrap: true,
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

    CheckoutAddressSelection? picked;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  picked = await AddressPickerSheet.showSelection(
                    ctx,
                    mapTilesEnabled: false,
                  );
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pin Location'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Full Address *'),
      'Unit 12, Jacinto Extension',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'City *'),
      'Davao City',
    );
    final useButton = find.text('Use this location', skipOffstage: false);
    await tester.drag(find.byType(ListView).last, const Offset(0, -360));
    await tester.pumpAndSettle();
    await tester.ensureVisible(useButton);
    await tester.pumpAndSettle();
    await tester.tap(useButton);
    await tester.pumpAndSettle();

    expect(picked?.temporaryAddress?.fullAddress, 'Unit 12, Jacinto Extension');
    expect(picked?.temporaryAddress?.city, 'Davao City');
    expect(picked?.temporaryAddress?.isValid, isTrue);
  });

  testWidgets(
    'pin location form is prefilled from an initial temporary address',
    (tester) async {
      final container = ProviderContainer(
        overrides: [
          addressProvider.overrideWith(
            (ref) => AddressNotifier(
              initialState: [_addr('1', 'Home', '12 Sampaguita St')],
              skipBootstrap: true,
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Builder(
              builder: (ctx) => Scaffold(
                body: ElevatedButton(
                  onPressed: () {
                    AddressPickerSheet.showSelection(
                      ctx,
                      mapTilesEnabled: false,
                      initialTemporaryAddress: const TemporaryCheckoutAddress(
                        label: 'Event booth',
                        fullAddress: 'SMX Booth A12',
                        city: 'Davao City',
                        landmark: 'Near loading bay',
                        latitude: 7.0731,
                        longitude: 125.6128,
                      ),
                    );
                  },
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pin Location'));
      await tester.pumpAndSettle();

      expect(await _textFieldValue(tester, 'Label'), 'Event booth');
      expect(await _textFieldValue(tester, 'Full Address *'), 'SMX Booth A12');
      expect(await _textFieldValue(tester, 'City *'), 'Davao City');
      expect(await _textFieldValue(tester, 'Landmark'), 'Near loading bay');
    },
  );
}

Future<String?> _textFieldValue(WidgetTester tester, String labelText) async {
  for (var attempt = 0; attempt < 6; attempt++) {
    final matches = find.widgetWithText(TextFormField, labelText).evaluate();
    if (matches.isNotEmpty) {
      final field = matches.first.widget as TextFormField;
      return field.controller?.text;
    }
    await tester.drag(find.byType(ListView).last, const Offset(0, -120));
    await tester.pumpAndSettle();
  }
  fail('No TextFormField with label "$labelText" was built');
}
