import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/multidrop_groups.dart';
import 'package:printing_app/shared/models/address.dart';

void main() {
  testWidgets('renders one row per drop and "Add another drop" link', (
    tester,
  ) async {
    final container = ProviderContainer();
    final n = container.read(checkoutProvider.notifier);
    n.addItem(
      CartItem(
        id: 'a',
        category: 'paper',
        fileName: 'a.pdf',
        filePath: '/tmp/a.pdf',
        fileSize: 1,
        fileMetadataId: 1,
        quantity: 1,
        pageCount: 1,
        printSubtotal: 100,
        createdAt: DateTime.now(),
      ),
    );
    n.setDrops([
      const DestinationGroup(id: '1', label: 'Drop 1', itemIds: ['a']),
    ]);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
      ),
    );
    expect(find.text('Drop 1'), findsOneWidget);
    expect(find.text('Add another drop'), findsOneWidget);
  });

  testWidgets('+ Add another drop appends an empty group', (tester) async {
    final container = ProviderContainer();
    container.read(checkoutProvider.notifier).setDrops([
      const DestinationGroup(id: '1', label: 'Drop 1', itemIds: []),
    ]);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
      ),
    );
    await tester.tap(find.text('Add another drop'));
    await tester.pump();
    expect(container.read(checkoutProvider).drops.length, 2);
  });

  testWidgets('pin location attaches a temporary destination to the drop', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        addressProvider.overrideWith(
          (ref) => AddressNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);
    final n = container.read(checkoutProvider.notifier);
    n.addItem(
      CartItem(
        id: 'a',
        category: 'paper',
        fileName: 'a.pdf',
        filePath: '/tmp/a.pdf',
        fileSize: 1,
        fileMetadataId: 1,
        quantity: 1,
        pageCount: 1,
        printSubtotal: 100,
        createdAt: DateTime.now(),
      ),
    );
    n.setDrops([const DestinationGroup(id: '1', label: 'Drop 1', itemIds: [])]);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: Scaffold(body: MultidropGroups(mapTilesEnabled: false)),
        ),
      ),
    );

    await tester.tap(find.text('Pick address'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pin and save location'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Full Address *'),
      'SMX Booth A12',
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
    expect(find.text('Address was not saved'), findsOneWidget);
    await tester.tap(find.text('Use once'));
    await tester.pumpAndSettle();

    final drop = container.read(checkoutProvider).drops.single;
    expect(drop.addressId, isNull);
    expect(drop.temporaryAddress?.fullAddress, 'SMX Booth A12');
    expect(drop.temporaryAddress?.isValid, isTrue);
  });

  testWidgets(
    'saved address selection attaches a saved destination to the drop',
    (tester) async {
      final container = ProviderContainer(
        overrides: [
          addressProvider.overrideWith(
            (ref) => AddressNotifier(
              initialState: [_addr('22', 'Office')],
              skipBootstrap: true,
            ),
          ),
        ],
      );
      addTearDown(container.dispose);
      final n = container.read(checkoutProvider.notifier);
      n.addItem(
        CartItem(
          id: 'a',
          category: 'paper',
          fileName: 'a.pdf',
          filePath: '/tmp/a.pdf',
          fileSize: 1,
          fileMetadataId: 1,
          quantity: 1,
          pageCount: 1,
          printSubtotal: 100,
          createdAt: DateTime.now(),
        ),
      );
      n.setDrops([
        const DestinationGroup(id: '1', label: 'Drop 1', itemIds: []),
      ]);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: Scaffold(body: MultidropGroups())),
        ),
      );

      await tester.tap(find.text('Pick address'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Office'));
      await tester.pumpAndSettle();

      final drop = container.read(checkoutProvider).drops.single;
      expect(drop.addressId, 22);
      expect(drop.label, 'Office');
      expect(drop.temporaryAddress, isNull);
    },
  );

  testWidgets('reopening a pinned drop prefills the pin location form', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        addressProvider.overrideWith(
          (ref) => AddressNotifier(initialState: const [], skipBootstrap: true),
        ),
      ],
    );
    addTearDown(container.dispose);
    final n = container.read(checkoutProvider.notifier);
    n.addItem(
      CartItem(
        id: 'a',
        category: 'paper',
        fileName: 'a.pdf',
        filePath: '/tmp/a.pdf',
        fileSize: 1,
        fileMetadataId: 1,
        quantity: 1,
        pageCount: 1,
        printSubtotal: 100,
        createdAt: DateTime.now(),
      ),
    );
    n.setDrops([
      const DestinationGroup(
        id: '1',
        label: 'Event booth',
        itemIds: [],
        temporaryAddress: TemporaryCheckoutAddress(
          label: 'Event booth',
          fullAddress: 'SMX Booth A12',
          city: 'Davao City',
          landmark: 'Near loading bay',
          latitude: 7.0731,
          longitude: 125.6128,
        ),
      ),
    ]);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: Scaffold(body: MultidropGroups(mapTilesEnabled: false)),
        ),
      ),
    );

    await tester.tap(find.text('Change address'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pin and save location'));
    await tester.pumpAndSettle();

    expect(await _textFieldValue(tester, 'Label'), 'Event booth');
    expect(await _textFieldValue(tester, 'Full Address *'), 'SMX Booth A12');
    expect(await _textFieldValue(tester, 'City *'), 'Davao City');
    expect(await _textFieldValue(tester, 'Landmark'), 'Near loading bay');
  });
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

Address _addr(String id, String label) => Address(
  id: id,
  userId: '1',
  label: label,
  fullAddress: '$label address',
  city: 'Davao City',
  latitude: 7.0731,
  longitude: 125.6128,
  isDefault: false,
  createdAt: DateTime.now(),
  updatedAt: DateTime.now(),
);
