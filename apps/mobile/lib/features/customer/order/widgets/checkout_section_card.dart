import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Shared card shell for Checkout sections.
/// Header has an icon chip on the left, a title in the middle, and an optional
/// trailing widget (link, badge, etc.) on the right.
class CheckoutSectionCard extends StatelessWidget {
  const CheckoutSectionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.child,
    this.trailing,
    this.padding,
  });

  final List<List<dynamic>> icon;
  final String title;
  final Widget child;
  final Widget? trailing;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: padding ?? const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.12),
                  borderRadius: AppRadius.borderSm,
                ),
                child: Center(
                  child: HugeIcon(icon: icon, size: 16, color: colors.brand),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
