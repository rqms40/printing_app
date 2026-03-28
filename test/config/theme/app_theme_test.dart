import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/config/theme/app_typography.dart';

void main() {
  group('AppTheme', () {
    test('light theme scaffold background is #F8F8F8', () {
      final theme = AppTheme.light;
      expect(theme.scaffoldBackgroundColor, const Color(0xFFF8F8F8));
    });

    test('dark theme scaffold background is #000000', () {
      final theme = AppTheme.dark;
      expect(theme.scaffoldBackgroundColor, const Color(0xFF000000));
    });

    test('light theme accent is near-black #1A1A1A', () {
      expect(AppColors.light.accent, const Color(0xFF1A1A1A));
    });

    test('dark theme accent is near-white #F0F0F0', () {
      expect(AppColors.dark.accent, const Color(0xFFF0F0F0));
    });
  });

  group('AppTypography', () {
    test('display uses Poppins font', () {
      expect(AppTypography.display.fontFamily, 'Poppins');
    });
  });

  group('AppSpacing', () {
    test('md equals 16.0', () {
      expect(AppSpacing.md, 16.0);
    });
  });
}
