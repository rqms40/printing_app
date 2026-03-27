import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/config/theme/app_typography.dart';

void main() {
  group('AppTheme', () {
    test('light theme scaffold background is #FAFAFA', () {
      final theme = AppTheme.light;
      expect(theme.scaffoldBackgroundColor, const Color(0xFFFAFAFA));
    });

    test('dark theme scaffold background is #121212', () {
      final theme = AppTheme.dark;
      expect(theme.scaffoldBackgroundColor, const Color(0xFF121212));
    });

    test('light theme accent is #1A1A1A', () {
      expect(AppColors.light.accent, const Color(0xFF1A1A1A));
    });

    test('dark theme accent is #F5F5F5', () {
      expect(AppColors.dark.accent, const Color(0xFFF5F5F5));
    });
  });

  group('AppTypography', () {
    test('display uses InstrumentSerif font', () {
      expect(AppTypography.display.fontFamily, 'InstrumentSerif');
    });
  });

  group('AppSpacing', () {
    test('md equals 16.0', () {
      expect(AppSpacing.md, 16.0);
    });
  });
}
