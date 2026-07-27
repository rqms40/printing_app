/// Google Maps API key injection for Flutter clients.
///
/// Prefer `--dart-define=GOOGLE_MAPS_API_KEY=...` (or `GOOGLE_MAPS_API`) at
/// build time. Native Android/iOS also need the key in platform manifests /
/// AppDelegate; web needs the Maps JS bootstrap in `web/index.html`.
///
/// Never commit a real key. Reusing the server `GOOGLE_MAPS_API` value is an
/// early-integration choice only.
class MapsConfig {
  MapsConfig._();

  static const String apiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: String.fromEnvironment('GOOGLE_MAPS_API', defaultValue: ''),
  );

  static bool get hasApiKey => apiKey.isNotEmpty;
}
