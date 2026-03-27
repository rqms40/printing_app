import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';

/// Standardized icon container sizes.
enum IconContainerSize {
  /// 32 x 32 container, 14px icon
  sm(32, 14),

  /// 40 x 40 container, 18px icon
  md(40, 18),

  /// 48 x 48 container, 22px icon
  lg(48, 22),

  /// 64 x 64 container, 28px icon
  xl(64, 28);

  const IconContainerSize(this.containerSize, this.iconSize);

  final double containerSize;
  final double iconSize;
}

/// Shape of the icon container.
enum IconContainerShape {
  /// Circular container.
  circle,

  /// Rounded-square container.
  rounded,
}

/// A consistent, themed container that wraps an [IconData].
///
/// Use across cards, lists and empty states for visual cohesion.
class IconContainer extends StatelessWidget {
  const IconContainer({
    super.key,
    required this.icon,
    this.size = IconContainerSize.md,
    this.shape = IconContainerShape.circle,
    this.backgroundColor,
    this.iconColor,
  });

  /// Can be [IconData] (Material) or HugeIcons SVG data (List).
  final dynamic icon;
  final IconContainerSize size;
  final IconContainerShape shape;

  /// Falls back to [AppColorSet.surfaceVariant] when null.
  final Color? backgroundColor;

  /// Falls back to [AppColorSet.onSurface] when null.
  final Color? iconColor;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final bg = backgroundColor ?? colors.surfaceVariant;
    final fg = iconColor ?? colors.onSurface;

    return Container(
      width: size.containerSize,
      height: size.containerSize,
      decoration: BoxDecoration(
        color: bg,
        shape: shape == IconContainerShape.circle
            ? BoxShape.circle
            : BoxShape.rectangle,
        borderRadius: shape == IconContainerShape.rounded
            ? AppRadius.borderMd
            : null,
      ),
      child: Center(
        child: icon is IconData
            ? Icon(icon as IconData, size: size.iconSize, color: fg)
            : HugeIcon(icon: icon, size: size.iconSize, color: fg),
      ),
    );
  }
}
