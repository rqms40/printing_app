// ─────────────────────────────────────────────────────────────────────────────
// API Configuration — change kDefaultServerUrl to point to your server.
// ─────────────────────────────────────────────────────────────────────────────
//
// To override at build time without editing this file:
//   flutter build web --release --dart-define=SERVER_URL=http://192.168.x.x:3000
//
// Otherwise just update the line below.

const String kDefaultServerUrl = 'http://192.168.40.201:3000';

/// Resolved server base URL (no trailing slash, no /api).
/// Prefer --dart-define=SERVER_URL at build time for CI/production.
const String kServerUrl = String.fromEnvironment(
  'SERVER_URL',
  defaultValue: kDefaultServerUrl,
);
