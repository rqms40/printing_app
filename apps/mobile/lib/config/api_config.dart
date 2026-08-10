import 'package:flutter/foundation.dart';

// ─────────────────────────────────────────────────────────────────────────────
// API Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// Web (LAN access): when you open the app at e.g. http://192.168.40.201:8080,
// API calls automatically target http://192.168.40.201:3000 — no rebuild needed.
//
// Local native run (recommended so flutter run hits Docker API):
//   flutter run --dart-define-from-file=dart_defines.json
// dart_defines.json example:
//   { "SERVER_URL": "http://127.0.0.1:3000" }   // desktop / iOS simulator
//   { "SERVER_URL": "http://10.0.2.2:3000" }    // Android emulator
//
// Without dart_defines, native defaults are:
//   Android → http://10.0.2.2:3000 (host machine from emulator)
//   else    → http://127.0.0.1:3000

const String kDefaultServerUrl = 'http://127.0.0.1:3000';
const String kAndroidEmulatorServerUrl = 'http://10.0.2.2:3000';
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
/// 3. Android emulator host loopback [kAndroidEmulatorServerUrl]
/// 4. [kDefaultServerUrl]
String get kServerUrl {
  if (_compileTimeServerUrl.isNotEmpty) {
    return _compileTimeServerUrl;
  }
  if (kIsWeb) {
    return _webServerUrl();
  }
  // defaultTargetPlatform is safe on native (not web).
  if (defaultTargetPlatform == TargetPlatform.android) {
    return kAndroidEmulatorServerUrl;
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
