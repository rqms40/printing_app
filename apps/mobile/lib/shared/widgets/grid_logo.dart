import 'package:flutter/material.dart';

/// The GRIDGO brand logo — a 3×3 dot matrix.
///
/// Matches the brand identity: mostly white/foreground dots with one
/// yellow (#FFDE58) accent dot and grey (#5B5B5B) secondary dots.
///
/// Layout:
/// ```
/// ○ ○ ●   (● = yellow accent)
/// ○ ○ ○
/// ○ ○ ◐   (◐ = grey)
/// ```
class GridLogo extends StatelessWidget {
  const GridLogo({
    super.key,
    this.size = 48,
    this.foregroundColor,
    this.accentColor = const Color(0xFFFFDE58),
    this.secondaryColor = const Color(0xFF5B5B5B),
  });

  /// Overall size of the logo (width and height).
  final double size;

  /// Color for the primary dots. Defaults to onBackground from theme.
  final Color? foregroundColor;

  /// The yellow accent dot color.
  final Color accentColor;

  /// The grey secondary dot color.
  final Color secondaryColor;

  @override
  Widget build(BuildContext context) {
    final fg = foregroundColor ??
        (Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFFFEFEFE)
            : const Color(0xFF000000));

    final dotSize = size / 4.2;
    final spacing = size / 12;

    // 3×3 grid — each cell is (dotColor)
    // Row 0: fg, fg, accent (yellow)
    // Row 1: fg, fg, fg
    // Row 2: fg, fg, secondary (grey)
    final grid = [
      [fg, fg, accentColor],
      [fg, fg, fg],
      [fg, fg, secondaryColor],
    ];

    return SizedBox(
      width: size,
      height: size,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(3, (row) {
          return Padding(
            padding: EdgeInsets.symmetric(vertical: spacing / 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (col) {
                return Padding(
                  padding: EdgeInsets.symmetric(horizontal: spacing / 2),
                  child: Container(
                    width: dotSize,
                    height: dotSize,
                    decoration: BoxDecoration(
                      color: grid[row][col],
                      shape: BoxShape.circle,
                    ),
                  ),
                );
              }),
            ),
          );
        }),
      ),
    );
  }
}

/// GRIDGO wordmark + logo combined.
///
/// Displays the dot grid logo above or beside the "GRIDGO" text.
class GridBrandMark extends StatelessWidget {
  const GridBrandMark({
    super.key,
    this.logoSize = 48,
    this.fontSize = 32,
    this.color,
    this.direction = Axis.vertical,
    this.spacing = 12,
  });

  final double logoSize;
  final double fontSize;
  final Color? color;
  final Axis direction;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final fg = color ??
        (Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFFFEFEFE)
            : const Color(0xFF000000));

    final logo = GridLogo(
      size: logoSize,
      foregroundColor: fg,
    );

    final wordmark = Text(
      'GRIDGO',
      style: TextStyle(
        fontFamily: 'Satoshi',
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        letterSpacing: 4,
        color: fg,
      ),
    );

    if (direction == Axis.horizontal) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          logo,
          SizedBox(width: spacing),
          wordmark,
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        logo,
        SizedBox(height: spacing),
        wordmark,
      ],
    );
  }
}
