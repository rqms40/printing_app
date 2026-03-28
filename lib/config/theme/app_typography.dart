import 'package:flutter/material.dart';

/// Typography scale for GRID.
///
/// [display] uses Archivo ExtraBold for authoritative brand moments.
/// All other headings and UI text use Satoshi (geometric sans-serif)
/// with weight differentiation for hierarchy.
class AppTypography {
  const AppTypography._();

  static const String _instrumentSerif = 'InstrumentSerif';
  static const String _archivo = 'Archivo';
  static const String _satoshi = 'Satoshi';

  /// Brand / editorial display — Archivo ExtraBold.
  /// Strong, authoritative sans-serif for hero banners and splash screen.
  static const TextStyle display = TextStyle(
    fontFamily: _archivo,
    fontSize: 32,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.7,
  );

  /// Elegant editorial style — Instrument Serif.
  /// Use for decorative/accent text where a softer serif feel is needed.
  static const TextStyle displaySerif = TextStyle(
    fontFamily: _instrumentSerif,
    fontSize: 32,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.5,
  );

  /// Page title — Satoshi Bold, clean and modern.
  static const TextStyle h1 = TextStyle(
    fontFamily: _satoshi,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
  );

  /// Section title — Satoshi Bold.
  static const TextStyle h2 = TextStyle(
    fontFamily: _satoshi,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: 0,
  );

  /// Card / subsection title — Satoshi Medium.
  static const TextStyle h3 = TextStyle(
    fontFamily: _satoshi,
    fontSize: 20,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: _satoshi,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.1,
  );

  static const TextStyle body = TextStyle(
    fontFamily: _satoshi,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.1,
  );

  static const TextStyle bodyBold = TextStyle(
    fontFamily: _satoshi,
    fontSize: 14,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.1,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: _satoshi,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.2,
  );

  static const TextStyle button = TextStyle(
    fontFamily: _satoshi,
    fontSize: 14,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.5,
  );

  static const TextStyle overline = TextStyle(
    fontFamily: _satoshi,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    letterSpacing: 1.5,
  );
}
