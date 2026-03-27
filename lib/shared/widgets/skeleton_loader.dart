import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:shimmer/shimmer.dart';

/// Shimmer-based skeleton loader for placeholder UI while data loads.
///
/// Provides named constructors for common shapes:
/// - [SkeletonLoader.text] -- thin horizontal rectangle.
/// - [SkeletonLoader.circle] -- circular placeholder.
/// - [SkeletonLoader.card] -- card-shaped rectangle.
class SkeletonLoader extends StatelessWidget {
  const SkeletonLoader({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius,
  });

  /// Thin text-line skeleton.
  const SkeletonLoader.text({
    super.key,
    this.width = 120,
    this.height = 12,
  }) : borderRadius = null;

  /// Circular skeleton (e.g. avatar).
  const SkeletonLoader.circle({
    super.key,
    double size = 48,
  })  : width = size,
        height = size,
        borderRadius = null;

  /// Card-shaped skeleton.
  const SkeletonLoader.card({
    super.key,
    this.width,
    this.height = 120,
  }) : borderRadius = null;

  final double? width;
  final double height;
  final BorderRadius? borderRadius;

  bool _isCircle() {
    // Circle when width == height and constructed via .circle
    return width != null && width == height && borderRadius == null && width! > 16;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    final baseColor = isDark
        ? colors.surfaceVariant
        : colors.surfaceDim;
    final highlightColor = isDark
        ? colors.surfaceHigh
        : colors.surface;

    final resolvedRadius = borderRadius ??
        (_isCircle()
            ? AppRadius.borderFull
            : height > AppSpacing.md
                ? AppRadius.borderMd
                : AppRadius.borderSm);

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: baseColor,
          borderRadius: resolvedRadius,
        ),
      ),
    );
  }
}
