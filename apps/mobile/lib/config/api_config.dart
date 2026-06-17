import 'package:flutter/foundation.dart';

// ─────────────────────────────────────────────────────────────────────────────
// API Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// Web (LAN access): when you open the app at e.g. http://192.168.40.201:8080,
// API calls automatically target http://192.168.40.201:3000 — no rebuild needed.
//
// Mobile / override: keep a local apps/mobile/dart_defines.json (gitignored):
//   { "SERVER_URL": "http://192.168.x.x:3000" }
//
// Build / run with override:
//   flutter build web --release --no-tree-shake-icons --dart-define-from-file=dart_defines.json
//   flutter run -d chrome --dart-define-from-file=dart_defines.json

const String kDefaultServerUrl = 'http://localhost:3000';
const int kDefaultApiPort = 3000;

const String _compileTimeServerUrl = String.fromEnvironment(
  'SERVER_URL',
  defaultValue: '',
);

/// Resolved server base URL (no trailing slash, no /api).
///
/// Priority:
/// 1. `--dart-define=SERVER_URL=...` (or dart_defines.json) at build time
/// 2. On web: same host as the page, API port [kDefaultApiPort]
/// 3. [kDefaultServerUrl]
String get kServerUrl {
  if (_compileTimeServerUrl.isNotEmpty) {
    return _compileTimeServerUrl;
  }
  if (kIsWeb) {
    return _webServerUrl();
  }
  return kDefaultServerUrl;
}

String _webServerUrl() {
  final base = Uri.base;
  final host = base.host;
  if (host.isEmpty) return kDefaultServerUrl;

  // App and API share the same origin (e.g. http://192.168.x.x:3000).
  if (base.port == kDefaultApiPort) {
    return base.origin;
  }

  // Dev server or static host on another port — API stays on :3000.
  if (host != 'localhost' && host != '127.0.0.1') {
    return '${base.scheme}://$host:$kDefaultApiPort';
  }

  return kDefaultServerUrl;
}