/// Application-wide constants for GRIDGO.
class AppConstants {
  const AppConstants._();

  // ---------------------------------------------------------------------------
  // Development-only features
  // ---------------------------------------------------------------------------
  static const bool enableDevAuth = bool.fromEnvironment(
    'ENABLE_DEV_AUTH',
    defaultValue: false,
  );

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
    'tif',
    'tiff',
    'docx',
  ];

  static const List<String> threeDTypes = ['stl', 'obj', '3mf', 'glb', 'gltf'];

  // ---------------------------------------------------------------------------
  // Community
  // ---------------------------------------------------------------------------
  static const String defaultCommunityUrl = 'https://m.me/GRIDGOPrintPH';
  static const String communityUrl = String.fromEnvironment(
    'GRID_COMMUNITY_URL',
    defaultValue: defaultCommunityUrl,
  );

  static bool get hasCommunityUrl => communityUrl.trim().isNotEmpty;

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
