import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_radius.dart';
import 'app_typography.dart';

/// Provides complete [ThemeData] for light and dark modes.
class AppTheme {
  const AppTheme._();

  // ---------------------------------------------------------------------------
  // Light theme
  // ---------------------------------------------------------------------------
  static ThemeData get light {
    const colors = AppColors.light;
    return _buildTheme(colors, Brightness.light);
  }

  // ---------------------------------------------------------------------------
  // Dark theme
  // ---------------------------------------------------------------------------
  static ThemeData get dark {
    const colors = AppColors.dark;
    return _buildTheme(colors, Brightness.dark);
  }

  // ---------------------------------------------------------------------------
  // Shared builder
  // ---------------------------------------------------------------------------
  static ThemeData _buildTheme(AppColorSet colors, Brightness brightness) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: colors.accent,
      onPrimary: colors.accentOnColor,
      secondary: colors.accentSoft,
      onSecondary: colors.accentOnColor,
      error: colors.error,
      onError: colors.surface,
      surface: colors.surface,
      onSurface: colors.onSurface,
      surfaceContainerHighest: colors.surfaceVariant,
      outline: colors.outline,
    );

    final textTheme = TextTheme(
      displayLarge: AppTypography.display.copyWith(color: colors.onBackground),
      headlineLarge: AppTypography.h1.copyWith(color: colors.onBackground),
      headlineMedium: AppTypography.h2.copyWith(color: colors.onBackground),
      headlineSmall: AppTypography.h3.copyWith(color: colors.onBackground),
      bodyLarge: AppTypography.bodyLarge.copyWith(color: colors.onSurface),
      bodyMedium: AppTypography.body.copyWith(color: colors.onSurface),
      bodySmall: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
      labelLarge: AppTypography.button.copyWith(color: colors.onBackground),
      labelSmall: AppTypography.overline.copyWith(color: colors.onSurfaceDim),
    );

    return ThemeData(
      brightness: brightness,
      scaffoldBackgroundColor: colors.background,
      colorScheme: colorScheme,
      textTheme: textTheme,

      // AppBar
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: colors.surface,
        foregroundColor: colors.onBackground,
        titleTextStyle:
            AppTypography.h3.copyWith(color: colors.onBackground),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),

      // Elevated button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.accent,
          foregroundColor: colors.accentOnColor,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.borderMd,
          ),
          textStyle: AppTypography.button,
          elevation: 0,
        ),
      ),

      // Outlined button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.onBackground,
          backgroundColor: Colors.transparent,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.borderMd,
          ),
          side: BorderSide(color: colors.outline),
          textStyle: AppTypography.button,
        ),
      ),

      // Text button (ghost)
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.onBackground,
          textStyle: AppTypography.button,
        ),
      ),

      // Input decoration (underline style)
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        border: UnderlineInputBorder(
          borderSide: BorderSide(color: colors.outline),
        ),
        enabledBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: colors.outline),
        ),
        focusedBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: colors.accent, width: 2),
        ),
        errorBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: colors.error),
        ),
        focusedErrorBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: colors.error, width: 2),
        ),
        hintStyle: AppTypography.body.copyWith(color: colors.onSurfaceDim),
        labelStyle: AppTypography.body.copyWith(color: colors.onSurfaceDim),
      ),

      // Card
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.borderMd,
        ),
        margin: EdgeInsets.zero,
      ),

      // Bottom navigation bar
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colors.surface,
        selectedItemColor: colors.accent,
        unselectedItemColor: colors.onSurfaceDim,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),

      // Bottom sheet
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(AppRadius.lg),
            topRight: Radius.circular(AppRadius.lg),
          ),
        ),
      ),

      // Dialog
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.borderXl,
        ),
      ),

      // Chip
      chipTheme: ChipThemeData(
        backgroundColor: colors.surfaceVariant,
        labelStyle: AppTypography.caption.copyWith(color: colors.onSurface),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.borderSm,
        ),
        side: BorderSide.none,
      ),

      // Tab bar
      tabBarTheme: TabBarThemeData(
        indicatorColor: colors.accent,
        labelColor: colors.onBackground,
        unselectedLabelColor: colors.onSurfaceDim,
        labelStyle: AppTypography.bodyBold,
        unselectedLabelStyle: AppTypography.body,
      ),

      // Divider
      dividerTheme: DividerThemeData(
        color: colors.surfaceDim,
        thickness: 1,
        space: 0,
      ),

      // Icon
      iconTheme: IconThemeData(
        color: colors.onSurface,
      ),
    );
  }
}
