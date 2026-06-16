import 'package:flutter/material.dart';

/// GRIDGO color palette.
///
/// Design philosophy: **Greyscale-dominant UI** with yellow (#FFDE58) reserved
/// strictly for the brand logo dot. The UI accent is monochrome — black in
/// light mode, white in dark mode — giving a refined, high-contrast feel
/// without competing with the brand color.
///
/// Palette: Black (#000000), White (#FEFEFE), Dark Grey (#5B5B5B),
/// Brand Yellow (#FFDE58 — logo only).
class AppColors {
  const AppColors._();

  /// Brand yellow — logo dot + minimal UI touches (links, "See All", badges).
  /// Light mode uses a deeper amber for contrast on white backgrounds.
  /// Dark mode uses the brighter yellow since it reads well on black.
  static const Color brandLight = Color(0xFFD4A017); // deep amber — readable on white
  static const Color brandDark = Color(0xFFFFDE58);  // bright yellow — pops on black
  static const Color brandLogo = Color(0xFFFFDE58);  // always bright in logo

  // ---------------------------------------------------------------------------
  // Light theme — warm whites, rich greys, black accent
  // ---------------------------------------------------------------------------
  static const light = AppColorSet(
    background: Color(0xFFF8F8F8),
    surface: Color(0xFFFFFFFF),
    surfaceVariant: Color(0xFFF0F0F0),
    surfaceDim: Color(0xFFE8E8E8),
    surfaceHigh: Color(0xFFFFFFFF),
    onBackground: Color(0xFF1A1A1A),
    onSurface: Color(0xFF4A4A4A),
    onSurfaceDim: Color(0xFF7A7A7A),
    disabled: Color(0xFFB0B0B0),
    outline: Color(0xFFDCDCDC),
    outlineVariant: Color(0xFFEEEEEE),
    accent: Color(0xFF1A1A1A),       // near-black — buttons, CTAs, active states
    accentSoft: Color(0xFF333333),    // pressed state
    accentOnColor: Color(0xFFFFFFFF), // white text on black accent bg
    brand: Color(0xFFD4A017),         // deep amber — links, "See All", subtle highlights
    success: Color(0xFF2E7D32),
    error: Color(0xFFC62828),
    warning: Color(0xFFF57F17),
    info: Color(0xFF1565C0),
  );

  // ---------------------------------------------------------------------------
  // Dark theme — true black, elevated surfaces, white accent
  // ---------------------------------------------------------------------------
  static const dark = AppColorSet(
    background: Color(0xFF000000),
    surface: Color(0xFF141414),
    surfaceVariant: Color(0xFF1E1E1E),
    surfaceDim: Color(0xFF0A0A0A),
    surfaceHigh: Color(0xFF2A2A2A),
    onBackground: Color(0xFFF0F0F0),
    onSurface: Color(0xFFCCCCCC),
    onSurfaceDim: Color(0xFF808080),
    disabled: Color(0xFF4A4A4A),
    outline: Color(0xFF2E2E2E),
    outlineVariant: Color(0xFF1E1E1E),
    accent: Color(0xFFF0F0F0),       // near-white — buttons, CTAs, active states
    accentSoft: Color(0xFFD0D0D0),    // pressed state
    accentOnColor: Color(0xFF000000), // black text on white accent bg
    brand: Color(0xFFFFDE58),         // bright yellow — links, "See All", subtle highlights
    success: Color(0xFF66BB6A),
    error: Color(0xFFEF5350),
    warning: Color(0xFFFFCA28),
    info: Color(0xFF42A5F5),
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
  final Color accentOnColor;

  /// Brand color for minimal highlights — links, badges, "See All" text.
  final Color brand;

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
    required this.accentOnColor,
    required this.brand,
    required this.success,
    required this.error,
    required this.warning,
    required this.info,
  });
}
