import 'package:flutter/material.dart';

/// Typography scale for DarkastixPrint.
///
/// Display & headings use Instrument Serif; body & UI use Satoshi.
class AppTypography {
  const AppTypography._();

  static const String _instrumentSerif = 'InstrumentSerif';
  static const String _satoshi = 'Satoshi';

  static const TextStyle display = TextStyle(
    fontFamily: _instrumentSerif,
    fontSize: 32,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.5,
  );

  static const TextStyle h1 = TextStyle(
    fontFamily: _instrumentSerif,
    fontSize: 28,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.3,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: _satoshi,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: 0,
  );

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
