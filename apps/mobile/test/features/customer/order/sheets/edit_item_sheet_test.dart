import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/sheets/edit_item_sheet.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';

void main() {
  testWidgets(
      'returns updated CartItem with new page count and preserved file',
      (tester) async {
    final original = CartItem(
      id: 'a',
      category: 'paper',
      fileName: 'a.pdf',
      filePath: '/tmp/a.pdf',
      fileSize: 1,
      fileMetadataId: 1,
      paperSpecs: const PaperSpecs(
        paperSize: PaperSize.a4,
        colorMode: ColorMode.fullColor,
        mediaType: MediaType.matte,
        printSides: PrintSides.frontOnly,
        binding: Binding.none,
      ),
      quantity: 1,
      pageCount: 10,
      printSubtotal: 100,
      createdAt: DateTime.now(),
    );
    CartItem? updated;
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Builder(
          builder: (ctx) => Scaffold(
            body: ElevatedButton(
              onPressed: () async {
                updated = await EditItemSheet.show(ctx, item: original);
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    // Pages field is the second TextField in the Quantity row.
    final pagesField = find
        .ancestor(of: find.text('Pages'), matching: find.byType(TextField))
        .first;
    await tester.enterText(pagesField, '20');
    await tester.ensureVisible(find.text('Save changes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(updated, isNotNull);
    expect(updated!.pageCount, 20);
    // File untouched → original file still present.
    expect(updated!.fileName, 'a.pdf');
  });
}
