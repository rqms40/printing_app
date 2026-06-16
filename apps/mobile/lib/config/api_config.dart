// ─────────────────────────────────────────────────────────────────────────────
// API Configuration — do NOT hardcode your IP here.
// ─────────────────────────────────────────────────────────────────────────────
//
// Each developer keeps a local apps/mobile/dart_defines.json (gitignored):
//   { "SERVER_URL": "http://192.168.x.x:3000" }
//
// Build / run commands:
//   flutter build web --release --no-tree-shake-icons --dart-define-from-file=dart_defines.json
//   flutter run -d chrome --dart-define-from-file=dart_defines.json
//
// Copy dart_defines.json.example -> dart_defines.json and set your LAN IP.

const String kDefaultServerUrl = 'http://localhost:3000';

/// Resolved server base URL (no trailing slash, no /api).
/// Prefer --dart-define=SERVER_URL at build time for CI/production.
const String kServerUrl = String.fromEnvironment(
  'SERVER_URL',
  defaultValue: kDefaultServerUrl,
);
