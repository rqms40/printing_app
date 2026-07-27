import 'dart:js_interop';
import 'dart:js_interop_unsafe';

bool _flagTrue(String name) {
  try {
    if (!globalContext.has(name)) return false;
    final v = globalContext[name];
    if (v == null) return false;
    final dart = v.dartify();
    return dart == true;
  } catch (_) {
    return false;
  }
}

/// True only after web/index.html preflight sets `__gridgoMapsReady`.
///
/// Checking `MapTypeId.ROADMAP` alone is not enough: the JS bundle can load
/// while auth is blocked (ApiTargetBlockedMapError), which produces Google's
/// "Oops! Something went wrong" map tile.
bool isGoogleMapsJsReady() {
  if (_flagTrue('__gridgoMapsReady')) return true;

  // If preflight has not finished, report not-ready (caller will poll).
  // If it finished with an error, stay not-ready.
  if (googleMapsJsBlockReason() != null) return false;

  return false;
}

/// Reason string from web/index.html when Maps JS failed.
String? googleMapsJsBlockReason() {
  try {
    if (!globalContext.has('__gridgoMapsError')) return null;
    final err = globalContext['__gridgoMapsError'];
    if (err == null) return null;
    final text = err.dartify()?.toString();
    if (text == null || text.isEmpty || text == 'null') return null;
    return text;
  } catch (_) {
    return null;
  }
}
