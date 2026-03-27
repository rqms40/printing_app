import 'package:flutter/material.dart';

/// Greyscale/monochrome color palette for DarkastixPrint.
class AppColors {
  const AppColors._();

  // ---------------------------------------------------------------------------
  // Light theme palette
  // ---------------------------------------------------------------------------
  static const light = AppColorSet(
    background: Color(0xFFFAFAFA),
    surface: Color(0xFFFFFFFF),
    surfaceVariant: Color(0xFFF5F5F5),
    surfaceDim: Color(0xFFEEEEEE),
    surfaceHigh: Color(0xFFFFFFFF), // not used in light; mirrors surface
    onBackground: Color(0xFF121212),
    onSurface: Color(0xFF424242),
    onSurfaceDim: Color(0xFF616161),
    disabled: Color(0xFFBDBDBD),
    outline: Color(0xFFE0E0E0),
    outlineVariant: Color(0xFFEEEEEE),
    accent: Color(0xFF1A1A1A),
    accentSoft: Color(0xFF333333),
    success: Color(0xFF43A047),
    error: Color(0xFFE53935),
    warning: Color(0xFFF9A825),
    info: Color(0xFF1E88E5),
  );

  // ---------------------------------------------------------------------------
  // Dark theme palette
  // ---------------------------------------------------------------------------
  static const dark = AppColorSet(
    background: Color(0xFF121212),
    surface: Color(0xFF1E1E1E),
    surfaceVariant: Color(0xFF2C2C2C),
    surfaceDim: Color(0xFF1E1E1E), // mirrors surface in dark
    surfaceHigh: Color(0xFF333333),
    onBackground: Color(0xFFF5F5F5),
    onSurface: Color(0xFFE0E0E0),
    onSurfaceDim: Color(0xFFBDBDBD),
    disabled: Color(0xFF616161),
    outline: Color(0xFF424242),
    outlineVariant: Color(0xFF303030),
    accent: Color(0xFFF5F5F5),
    accentSoft: Color(0xFFE0E0E0),
    success: Color(0xFF81C784),
    error: Color(0xFFEF9A9A),
    warning: Color(0xFFFFE082),
    info: Color(0xFF90CAF9),
  );

  // ---------------------------------------------------------------------------
  // Interaction state opacities
  // ---------------------------------------------------------------------------
  static const double hoverOpacity = 0.04;
  static const double pressedOpacity = 0.08;
  static const double disabledOpacity = 0.38;
  static const double overlayOpacity = 0.12;
  static const double draggingOpacity = 0.16;
}

/// Holds a complete set of themed colors.
class AppColorSet {
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color surfaceDim;
  final Color surfaceHigh;
  final Color onBackground;
  final Color onSurface;
  final Color onSurfaceDim;
  final Color disabled;
  final Color outline;
  final Color outlineVariant;
  final Color accent;
  final Color accentSoft;

  // Semantic status
  final Color success;
  final Color error;
  final Color warning;
  final Color info;

  const AppColorSet({
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.surfaceDim,
    required this.surfaceHigh,
    required this.onBackground,
    required this.onSurface,
    required this.onSurfaceDim,
    required this.disabled,
    required this.outline,
    required this.outlineVariant,
    required this.accent,
    required this.accentSoft,
    required this.success,
    required this.error,
    required this.warning,
    required this.info,
  });
}
