import 'package:flutter/material.dart';

/// Elevation shadow tokens for GRID (light theme only).
///
/// Dark theme uses surface lightening instead of shadows.
class AppShadows {
  const AppShadows._();

  static const List<BoxShadow> none = [];

  static const List<BoxShadow> subtle = [
    BoxShadow(
      offset: Offset(0, 1),
      blurRadius: 2,
      color: Color.fromRGBO(0, 0, 0, 0.04),
    ),
  ];

  static const List<BoxShadow> low = [
    BoxShadow(
      offset: Offset(0, 2),
      blurRadius: 8,
      color: Color.fromRGBO(0, 0, 0, 0.06),
    ),
  ];

  static const List<BoxShadow> medium = [
    BoxShadow(
      offset: Offset(0, 4),
      blurRadius: 16,
      color: Color.fromRGBO(0, 0, 0, 0.08),
    ),
  ];

  static const List<BoxShadow> high = [
    BoxShadow(
      offset: Offset(0, 8),
      blurRadius: 32,
      color: Color.fromRGBO(0, 0, 0, 0.12),
    ),
  ];
}
