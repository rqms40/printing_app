import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Borderless section. Big bold heading on the left, optional trailing action
/// on the right. Content sits flush below the heading. Sections are separated
/// from each other by the screen's background gap, not by a card border.
class CheckoutSectionCard extends StatelessWidget {
  const CheckoutSectionCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
    this.titleKey,
    @Deprecated('icon is no longer rendered; kept for back-compat')
    this.icon,
    this.padding,
  });

  final String title;
  final Widget child;
  final Widget? trailing;

  /// Optional key applied to the title row widget. Pass a [GlobalKey] here
  /// to use it as a small, top-anchored tutorial spotlight target.
  final GlobalKey? titleKey;
  final List<List<dynamic>>? icon;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.lg),
      decoration: BoxDecoration(color: colors.surface),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyedSubtree(
            key: titleKey,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: AppTypography.h2.copyWith(
                      color: colors.onBackground,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      height: 1.1,
                    ),
                  ),
                ),
                ?trailing,
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
