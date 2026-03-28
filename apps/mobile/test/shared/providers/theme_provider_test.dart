import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // Use SharedPreferences test helper to set initial values
    SharedPreferences.setMockInitialValues({});
  });

  group('ThemeNotifier', () {
    late ThemeNotifier notifier;

    setUp(() {
      notifier = ThemeNotifier();
    });

    test('initial state is ThemeMode.system', () {
      expect(notifier.state, ThemeMode.system);
    });

    test('setThemeMode changes to dark', () async {
      await notifier.setThemeMode(ThemeMode.dark);
      expect(notifier.state, ThemeMode.dark);
    });

    test('setThemeMode changes to light', () async {
      await notifier.setThemeMode(ThemeMode.light);
      expect(notifier.state, ThemeMode.light);
    });

    test('setThemeMode changes back to system', () async {
      await notifier.setThemeMode(ThemeMode.dark);
      await notifier.setThemeMode(ThemeMode.system);
      expect(notifier.state, ThemeMode.system);
    });

    test('toggleFrom dark brightness switches to light mode', () async {
      await notifier.toggleFrom(Brightness.dark);
      expect(notifier.state, ThemeMode.light);
    });

    test('toggleFrom light brightness switches to dark mode', () async {
      await notifier.toggleFrom(Brightness.light);
      expect(notifier.state, ThemeMode.dark);
    });

    test('isDark returns true only for dark mode', () async {
      expect(notifier.isDark, false); // initially system

      await notifier.setThemeMode(ThemeMode.dark);
      expect(notifier.isDark, true);

      await notifier.setThemeMode(ThemeMode.light);
      expect(notifier.isDark, false);
    });

    test('persists theme and loads on restart', () async {
      // Set theme to dark
      await notifier.setThemeMode(ThemeMode.dark);
      expect(notifier.state, ThemeMode.dark);

      // Create a new notifier simulating app restart
      // Need to wait for _loadSavedTheme to complete
      final newNotifier = ThemeNotifier();
      await Future.delayed(const Duration(milliseconds: 100));
      expect(newNotifier.state, ThemeMode.dark);
    });
  });
}
