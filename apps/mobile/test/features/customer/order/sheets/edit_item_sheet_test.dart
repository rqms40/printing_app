import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/sheets/edit_item_sheet.dart';

void main() {
  testWidgets('returns updated CartItem with new page count', (tester) async {
    final original = CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 10,
      printSubtotal: 100, createdAt: DateTime.now(),
    );
    CartItem? updated;
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(home: Builder(builder: (ctx) => Scaffold(
        body: ElevatedButton(
          onPressed: () async {
            updated = await EditItemSheet.show(ctx, item: original);
          },
          child: const Text('Open'),
        ),
      ))),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('edit-pages')), '20');
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();
    expect(updated?.pageCount, 20);
  });
}
