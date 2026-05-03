import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';

void main() {
  group('ProductCatalog.fallback', () {
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
