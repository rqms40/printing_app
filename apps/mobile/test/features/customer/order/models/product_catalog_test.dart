import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';

void main() {
  group('ProductCatalog.fallback', () {
    test('uses UV printer unit cost instead of the eco-solvent base rate', () {
      final stickers = ProductCategory(
        id: 30,
        name: 'Vinyl stickers',
        slug: 'stickers-vinyl',
        fileProcessingType: 'generic_file',
        pricingModel: 'per_page_modifiers',
        baseRate: 63.5,
        quantityUnit: 'sq_ft',
        maxFileSizeMb: 50,
        allowedExtensions: const ['png'],
        isActive: true,
        sortOrder: 1,
        specs: [
          const ProductSpecDefinition.select(
            id: 1,
            categoryId: 30,
            key: 'printer',
            label: 'Printer',
            pricingRole: 'unit_cost',
            sortOrder: 5,
            options: [
              ProductSpecOption(
                label: 'Eco-solvent',
                value: 'eco_solvent',
                unitCost: 63.5,
              ),
              ProductSpecOption(
                label: 'UV Printer',
                value: 'uv_printer',
                unitCost: 162,
              ),
            ],
          ),
          const ProductSpecDefinition.select(
            id: 2,
            categoryId: 30,
            key: 'size',
            label: 'Size',
            pricingRole: 'estimated_quantity',
            sortOrder: 20,
            options: [
              ProductSpecOption(
                label: '2x2',
                value: '2x2',
                estimatedQuantity: 4,
                isDefault: true,
              ),
            ],
          ),
        ],
      );

      expect(
        stickers.estimatePrice({
          'printer': 'eco_solvent',
          'size': '2x2',
        }, 1),
        254,
      );
      expect(
        stickers.estimatePrice({
          'printer': 'uv_printer',
          'size': '2x2',
        }, 1),
        648,
      );
    });

    test('grays out finishes that do not match the selected printer', () {
      final finish = const ProductSpecOption(
        label: 'Matte',
        value: 'matte',
        metadata: {
          'compatiblePrinters': ['eco_solvent'],
        },
      );
      final category = ProductCategory(
        id: 1,
        name: 'Stickers',
        slug: 'stickers-vinyl',
        fileProcessingType: 'generic_file',
        pricingModel: 'per_page_modifiers',
        baseRate: 63.5,
        quantityUnit: 'sq_ft',
        maxFileSizeMb: 50,
        allowedExtensions: const ['png'],
        isActive: true,
        sortOrder: 1,
        specs: const [],
      );
      expect(category.optionEnabledForPrinter(finish, null), isFalse);
      expect(category.optionEnabledForPrinter(finish, 'eco_solvent'), isTrue);
      expect(category.optionEnabledForPrinter(finish, 'uv_printer'), isFalse);
    });

    test('keeps print mode in the visible paper specifications', () {
      final paper = ProductCatalog.fallback().categoryBySlug('paper')!;
      final printMode = paper.visibleSpecs
          .where((spec) => spec.key == 'print_mode')
          .single;

      expect(printMode.label, 'Print Mode');
      expect(
        printMode.options.map((option) => option.label),
        containsAllInOrder(['Fit to Scale', 'Actual Size']),
      );
    });
  });
}
