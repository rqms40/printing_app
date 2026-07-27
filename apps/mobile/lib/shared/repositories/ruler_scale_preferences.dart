import 'package:printing_app/shared/widgets/ruler_overlay.dart';
import 'package:shared_preferences/shared_preferences.dart';

class RulerScalePreferences {
  static const defaultDenominator = 100;
  static const _keyPrefix = 'ruler_metric_scale_denominator_';

  Future<int> load(String? userId) async {
    if (userId == null || userId.trim().isEmpty) return defaultDenominator;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt('$_keyPrefix$userId');
    // A value outside the supported range can only come from a build that
    // predates the range check; fall back rather than restoring an unusable
    // ruler the user cannot recover from in-app.
    return saved != null && isSupportedMetricScaleDenominator(saved)
        ? saved
        : defaultDenominator;
  }

  Future<void> save(String? userId, int denominator) async {
    if (userId == null ||
        userId.trim().isEmpty ||
        !isSupportedMetricScaleDenominator(denominator)) {
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('$_keyPrefix$userId', denominator);
  }
}
