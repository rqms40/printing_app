import 'package:flutter/material.dart';

/// Animation duration & curve tokens for DarkastixPrint.
class AppMotion {
  const AppMotion._();

  // Durations
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);
  static const Duration emphasis = Duration(milliseconds: 600);

  // Curves
  static const Curve fastCurve = Curves.easeOut;
  static const Curve normalCurve = Curves.easeInOut;
  static const Curve slowCurve = Curves.easeInOut;
  static const Curve emphasisCurve = Curves.elasticOut;
}
