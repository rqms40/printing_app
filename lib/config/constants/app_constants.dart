/// Application-wide constants for DarkastixPrint.
class AppConstants {
  const AppConstants._();

  // ---------------------------------------------------------------------------
  // File size limits (in MB)
  // ---------------------------------------------------------------------------
  static const int paperMaxSizeMB = 50;
  static const int threeDMaxSizeMB = 200;

  // ---------------------------------------------------------------------------
  // Allowed file types
  // ---------------------------------------------------------------------------
  static const List<String> paperTypes = [
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'docx',
  ];

  static const List<String> threeDTypes = ['stl', 'obj', '3mf'];

  // ---------------------------------------------------------------------------
  // Pricing
  // ---------------------------------------------------------------------------
  static const double paperBaseRate = 2.0;
  static const double threeDBaseRate = 50.0;
  static const double materialCostPerGram = 3.0;

  // ---------------------------------------------------------------------------
  // Binding fees
  // ---------------------------------------------------------------------------
  static const double bindingSpiralFee = 25;
  static const double bindingStapleFee = 10;
  static const double bindingPremiumFee = 50;
}
