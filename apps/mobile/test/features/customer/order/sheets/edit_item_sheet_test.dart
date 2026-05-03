import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/sheets/edit_item_sheet.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/utils/pricing_engine.dart';

void main() {
  testWidgets('returns updated CartItem with preserved page count and file', (
    tester,
  ) async {
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
      specialInstructions: 'Keep original staple position.',
      createdAt: DateTime.now(),
    );
    CartItem? updated;
    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.text('Pages'), findsNothing);
    await tester.ensureVisible(find.text('Special Instructions / Notes'));
    await tester.pumpAndSettle();
    final notesField = find
        .ancestor(
          of: find.text('Special Instructions / Notes'),
          matching: find.byType(TextField),
        )
        .first;
    await tester.enterText(notesField, 'Fold after printing.');
    await tester.ensureVisible(find.text('Save changes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(updated, isNotNull);
    expect(updated!.pageCount, 10);
    expect(updated!.specialInstructions, 'Fold after printing.');
    // File untouched: original file still present.
    expect(updated!.fileName, 'a.pdf');
  });

  testWidgets('returns edited paper specs and recalculated print price', (
    tester,
  ) async {
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
      quantity: 2,
      pageCount: 10,
      printSubtotal: 100,
      createdAt: DateTime.now(),
    );
    CartItem? updated;

    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    await _selectDropdown<PaperSize>(tester, 'A3');
    await _selectDropdown<ColorMode>(tester, 'Black & White');
    await _selectDropdown<MediaType>(tester, 'Glossy');
    await _selectDropdown<PrintSides>(tester, 'Back to Back');
    await _selectDropdown<Binding>(tester, 'Staple');

    expect(find.text('Pages'), findsNothing);
    await tester.ensureVisible(find.text('Save changes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    final expectedSubtotal = PricingEngine.calculatePaperPrice(
      size: PaperSize.a3,
      colorMode: ColorMode.blackAndWhite,
      mediaType: MediaType.glossy,
      printSides: PrintSides.backToBack,
      binding: Binding.staple,
      quantity: 2,
      pageCount: 10,
    );

    expect(updated, isNotNull);
    expect(updated!.paperSpecs?.paperSize, PaperSize.a3);
    expect(updated!.paperSpecs?.colorMode, ColorMode.blackAndWhite);
    expect(updated!.paperSpecs?.mediaType, MediaType.glossy);
    expect(updated!.paperSpecs?.printSides, PrintSides.backToBack);
    expect(updated!.paperSpecs?.binding, Binding.staple);
    expect(updated!.specs['paper_size'], 'a3');
    expect(updated!.specs['color_mode'], 'black_and_white');
    expect(updated!.specs['media_type'], 'glossy');
    expect(updated!.specs['print_sides'], 'back_to_back');
    expect(updated!.specs['binding'], 'staple');
    expect(updated!.pageCount, 10);
    expect(updated!.specs['page_count'], 10);
    expect(updated!.specDisplayValues['media_type'], 'Glossy');
    expect(updated!.specDisplayValues['print_sides'], 'Back to Back');
    expect(updated!.printSubtotal, expectedSubtotal);
    expect(updated!.unitPrice, expectedSubtotal / 2);
  });

  testWidgets('preserves catalog-only paper specs when saving edits', (
    tester,
  ) async {
    final original = CartItem(
      id: 'a',
      category: 'paper',
      fileName: 'a.pdf',
      filePath: '/tmp/a.pdf',
      fileSize: 1,
      fileMetadataId: 1,
      specs: const {
        'paper_size': 'a4',
        'color_mode': 'full_color',
        'media_type': 'matte',
        'print_sides': 'front_only',
        'binding': 'none',
        'page_count': 10,
        'print_mode': 'actualSize',
      },
      specDisplayValues: const {
        'paper_size': 'A4',
        'color_mode': 'Full Color',
        'media_type': 'Matte',
        'print_sides': 'Front Only',
        'binding': 'No Binding',
        'page_count': '10 pages',
        'print_mode': 'Actual size',
      },
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

    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.text('Pages'), findsNothing);
    await tester.ensureVisible(find.text('Save changes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(updated, isNotNull);
    expect(updated!.pageCount, 10);
    expect(updated!.specs['page_count'], 10);
    expect(updated!.specs['print_mode'], 'actualSize');
    expect(updated!.specDisplayValues['page_count'], '10 pages');
    expect(updated!.specDisplayValues['print_mode'], 'Actual size');
  });

  testWidgets('returns edited 3D specs and recalculated print price', (
    tester,
  ) async {
    final original = CartItem(
      id: 'a',
      category: '3d',
      fileName: 'model.stl',
      filePath: '/tmp/model.stl',
      fileSize: 1,
      fileMetadataId: 1,
      specs: const {
        'file_format': 'stl',
        'material': 'pla',
        'color': 'white',
        'infill_percentage': 20,
        'layer_height': 0.2,
        'supports': true,
        'finish': 'smooth',
      },
      specDisplayValues: const {
        'file_format': 'STL',
        'material': 'PLA',
        'color': 'White',
        'infill_percentage': '20%',
        'layer_height': '0.2mm',
        'supports': 'Yes',
        'finish': 'Smooth',
      },
      threeDSpecs: const ThreeDSpecs(
        fileFormat: FileFormat3D.stl,
        material: Material3D.pla,
        color: 'White',
        infillPercentage: 20,
        layerHeight: 0.2,
        supports: true,
      ),
      quantity: 1,
      pageCount: 1,
      printSubtotal: 100,
      createdAt: DateTime.now(),
    );
    CartItem? updated;

    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    await _selectDropdown<FileFormat3D>(tester, 'OBJ');
    await _selectDropdown<Material3D>(tester, 'ABS');

    final colorField = find
        .ancestor(of: find.text('Color'), matching: find.byType(TextField))
        .first;
    await tester.enterText(colorField, 'Blue');
    await _selectDropdown<int>(tester, '50%');
    await _selectDropdown<double>(tester, '0.3mm');
    await tester.ensureVisible(find.byType(SwitchListTile).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(SwitchListTile).first);

    final notesField = find
        .ancestor(
          of: find.text('Notes (optional)'),
          matching: find.byType(TextField),
        )
        .first;
    await tester.enterText(notesField, 'Use light supports.');

    final quantityField = find
        .ancestor(of: find.text('Copies'), matching: find.byType(TextField))
        .first;
    await tester.enterText(quantityField, '3');
    await tester.ensureVisible(find.text('Save changes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    final expectedSubtotal = PricingEngine.calculate3DPrice(
      material: Material3D.abs,
      infillPercentage: 50,
      quantity: 3,
    );

    expect(updated, isNotNull);
    expect(updated!.threeDSpecs?.fileFormat, FileFormat3D.obj);
    expect(updated!.threeDSpecs?.material, Material3D.abs);
    expect(updated!.threeDSpecs?.color, 'Blue');
    expect(updated!.threeDSpecs?.infillPercentage, 50);
    expect(updated!.threeDSpecs?.layerHeight, 0.3);
    expect(updated!.threeDSpecs?.supports, isFalse);
    expect(updated!.threeDSpecs?.notes, 'Use light supports.');
    expect(updated!.specs['file_format'], 'obj');
    expect(updated!.specs['material'], 'abs');
    expect(updated!.specs['color'], 'blue');
    expect(updated!.specs['infill_percentage'], 50);
    expect(updated!.specs['layer_height'], 0.3);
    expect(updated!.specs['supports'], isFalse);
    expect(updated!.specs['notes'], 'Use light supports.');
    expect(updated!.specs['finish'], 'smooth');
    expect(updated!.specDisplayValues['file_format'], 'OBJ');
    expect(updated!.specDisplayValues['material'], 'ABS');
    expect(updated!.specDisplayValues['color'], 'Blue');
    expect(updated!.specDisplayValues['infill_percentage'], '50%');
    expect(updated!.specDisplayValues['layer_height'], '0.3mm');
    expect(updated!.specDisplayValues['supports'], 'No');
    expect(updated!.specDisplayValues['finish'], 'Smooth');
    expect(updated!.printSubtotal, expectedSubtotal);
    expect(updated!.unitPrice, expectedSubtotal / 3);
  });

  testWidgets('uploads replacement file and returns new file metadata', (
    tester,
  ) async {
    final original = CartItem(
      id: 'a',
      category: 'paper',
      fileName: 'old.pdf',
      filePath: '/tmp/old.pdf',
      fileSize: 100,
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

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  updated = await EditItemSheet.show(
                    ctx,
                    item: original,
                    pickReplacementFile: (_) async =>
                        const EditItemReplacementFile(
                          name: 'new.pdf',
                          path: '/tmp/new.pdf',
                          size: 2048,
                          extension: 'pdf',
                        ),
                    uploadReplacementFile: (file, item, onProgress) async {
                      onProgress(1);
                      return EditItemUploadedFile(
                        fileName: file.name,
                        filePath: 'https://cdn.test/new.pdf',
                        fileSize: file.size,
                        fileMetadataId: 99,
                      );
                    },
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

    await tester.tap(find.text('Replace'));
    await tester.pumpAndSettle();
    expect(find.text('new.pdf'), findsOneWidget);

    await tester.ensureVisible(find.text('Save changes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(updated, isNotNull);
    expect(updated!.fileName, 'new.pdf');
    expect(updated!.filePath, 'https://cdn.test/new.pdf');
    expect(updated!.fileSize, 2048);
    expect(updated!.fileMetadataId, 99);
  });
}

Future<void> _selectDropdown<T>(WidgetTester tester, String optionText) async {
  await tester.tap(find.byType(DropdownButton<T>));
  await tester.pumpAndSettle();
  await tester.tap(find.text(optionText).last);
  await tester.pumpAndSettle();
}
