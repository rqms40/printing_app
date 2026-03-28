import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/shared/models/enums.dart';

/// Calculates pricing for paper and 3D print orders.
class PricingEngine {
  const PricingEngine._();

  /// Calculates the total price for a paper printing order.
  ///
  /// Formula: (base * sizeMultiplier * colorMultiplier * mediaMultiplier
  ///           * sidesMultiplier + bindingFee) * quantity
  static double calculatePaperPrice({
    required PaperSize size,
    required ColorMode colorMode,
    required MediaType mediaType,
    required PrintSides printSides,
    required Binding binding,
    required int quantity,
    required int pageCount,
  }) {
    final double base = AppConstants.paperBaseRate * pageCount;

    final double sizeMultiplier = _sizeMultiplier(size);
    final double colorMultiplier = _colorMultiplier(colorMode);
    final double mediaMultiplier = _mediaMultiplier(mediaType);
    final double sidesMultiplier = _sidesMultiplier(printSides);
    final double bindingFee = _bindingFee(binding);

    return (base *
                sizeMultiplier *
                colorMultiplier *
                mediaMultiplier *
                sidesMultiplier +
            bindingFee) *
        quantity;
  }

  /// Calculates the total price for a 3D print order.
  ///
  /// Formula: (baseRate + estimatedGrams * materialCostPerGram) * quantity
  static double calculate3DPrice({
    required Material3D material,
    required int infillPercentage,
    required int quantity,
  }) {
    final double estimatedGrams = _estimateGrams(infillPercentage);
    return (AppConstants.threeDBaseRate +
            estimatedGrams * AppConstants.materialCostPerGram) *
        quantity;
  }

  // ---------------------------------------------------------------------------
  // Paper multipliers
  // ---------------------------------------------------------------------------

  static double _sizeMultiplier(PaperSize size) {
    switch (size) {
      case PaperSize.a5:
        return 0.8;
      case PaperSize.a4:
        return 1.0;
      case PaperSize.a3:
        return 1.5;
      case PaperSize.a2:
        return 2.5;
      case PaperSize.a1:
        return 4.0;
      case PaperSize.twentyByThirty:
        return 3.0;
      case PaperSize.custom:
        return 2.0;
    }
  }

  static double _colorMultiplier(ColorMode colorMode) {
    switch (colorMode) {
      case ColorMode.blackAndWhite:
        return 1.0;
      case ColorMode.fullColor:
        return 2.5;
    }
  }

  static double _mediaMultiplier(MediaType mediaType) {
    switch (mediaType) {
      case MediaType.matte:
        return 1.0;
      case MediaType.glossy:
        return 1.3;
    }
  }

  static double _sidesMultiplier(PrintSides printSides) {
    switch (printSides) {
      case PrintSides.frontOnly:
        return 1.0;
      case PrintSides.backToBack:
        return 1.8;
    }
  }

  static double _bindingFee(Binding binding) {
    switch (binding) {
      case Binding.none:
        return 0;
      case Binding.spiral:
        return AppConstants.bindingSpiralFee;
      case Binding.staple:
        return AppConstants.bindingStapleFee;
      case Binding.premium:
        return AppConstants.bindingPremiumFee;
    }
  }

  // ---------------------------------------------------------------------------
  // 3D helpers
  // ---------------------------------------------------------------------------

  static double _estimateGrams(int infillPercentage) {
    if (infillPercentage <= 10) return 20;
    if (infillPercentage <= 20) return 40;
    if (infillPercentage <= 50) return 100;
    return 200;
  }
}
