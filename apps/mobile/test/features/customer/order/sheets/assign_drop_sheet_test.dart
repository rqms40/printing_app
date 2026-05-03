import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/sheets/assign_drop_sheet.dart';

void main() {
  testWidgets(
    'shows saved and temporary destination labels and returns a drop id',
    (tester) async {
      String? picked;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  picked = await AssignDropSheet.show(
                    context,
                    drops: const [
                      DestinationGroup(
                        id: 'drop-1',
                        label: 'Home',
                        itemIds: [],
                        addressId: 10,
                      ),
                      DestinationGroup(
                        id: 'drop-2',
                        label: 'Drop 2',
                        itemIds: [],
                        temporaryAddress: TemporaryCheckoutAddress(
                          label: 'Event booth',
                          fullAddress: 'SMX Booth A12',
                          city: 'Davao City',
                          latitude: 7.0731,
                          longitude: 125.6128,
                        ),
                      ),
                    ],
                    itemFileName: 'poster.pdf',
                    copyIndex: 1,
                    totalCopies: 2,
                    currentDropId: 'drop-1',
                  );
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Home'), findsWidgets);
      expect(find.text('Event booth'), findsOneWidget);
      expect(find.text('Add a new drop'), findsOneWidget);

      await tester.tap(find.text('Event booth'));
      await tester.pumpAndSettle();

      expect(picked, 'drop-2');
    },
  );

  testWidgets('returns sentinel when adding a new drop', (tester) async {
    String? picked;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () async {
                picked = await AssignDropSheet.show(
                  context,
                  drops: const [
                    DestinationGroup(
                      id: 'drop-1',
                      label: 'Drop 1',
                      itemIds: [],
                    ),
                  ],
                  itemFileName: 'poster.pdf',
                  copyIndex: 0,
                  totalCopies: 1,
                  currentDropId: null,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add a new drop'));
    await tester.pumpAndSettle();

    expect(picked, AssignDropSheet.newDropSentinel);
  });
}
