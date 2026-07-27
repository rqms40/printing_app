import 'package:shared_preferences/shared_preferences.dart';

class RulerScalePreferences {
  static const defaultDenominator = 100;
  static const _keyPrefix = 'ruler_metric_scale_denominator_';

  Future<int> load(String? userId) async {
    if (userId == null || userId.trim().isEmpty) return defaultDenominator;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt('$_keyPrefix$userId');
    return saved != null && saved > 0 ? saved : defaultDenominator;
  }

  Future<void> save(String? userId, int denominator) async {
    if (userId == null || userId.trim().isEmpty || denominator <= 0) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('$_keyPrefix$userId', denominator);
  }
}
