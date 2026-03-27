import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/utils/pricing_engine.dart';

void main() {
  group('PricingEngine', () {
    group('calculatePaperPrice', () {
      test('A4, B&W, Matte, Front, None, qty 1, 10 pages = 20', () {
        final price = PricingEngine.calculatePaperPrice(
          size: PaperSize.a4,
          colorMode: ColorMode.blackAndWhite,
          mediaType: MediaType.matte,
          printSides: PrintSides.frontOnly,
          binding: Binding.none,
          quantity: 1,
          pageCount: 10,
        );
        // base = 2 * 10 = 20
        // 20 * 1.0 (A4) * 1.0 (B&W) * 1.0 (Matte) * 1.0 (Front) + 0 (none) = 20
        // 20 * 1 (qty) = 20
        expect(price, equals(20.0));
      });

      test('A4, B&W, Matte, Front, Spiral, qty 1, 10 pages = 45', () {
        final price = PricingEngine.calculatePaperPrice(
          size: PaperSize.a4,
          colorMode: ColorMode.blackAndWhite,
          mediaType: MediaType.matte,
          printSides: PrintSides.frontOnly,
          binding: Binding.spiral,
          quantity: 1,
          pageCount: 10,
        );
        // base = 2 * 10 = 20
        // 20 * 1.0 * 1.0 * 1.0 * 1.0 + 25 (spiral) = 45
        // 45 * 1 (qty) = 45
        expect(price, equals(45.0));
      });
    });

    group('calculate3DPrice', () {
      test('PLA, 20% infill, qty 1 = 170', () {
        final price = PricingEngine.calculate3DPrice(
          material: Material3D.pla,
          infillPercentage: 20,
          quantity: 1,
        );
        // base = 50
        // estimatedGrams(20%) = 40
        // (50 + 40 * 3) * 1 = 170
        expect(price, equals(170.0));
      });
    });
  });
}
