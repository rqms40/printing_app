import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/section_header.dart';

/// Horizontal scrollable row of circular quick-action buttons.
class QuickActionsStrip extends StatelessWidget {
  const QuickActionsStrip({super.key});

  static const _actions = <_QuickActionData>[
    _QuickActionData(
      label: 'New\nOrder',
      icon: HugeIcons.strokeRoundedAdd01,
      route: '/customer/order/new',
      isPrimary: true,
    ),
    _QuickActionData(
      label: 'Reprint\nLast',
      icon: HugeIcons.strokeRoundedRepeat,
      isComingSoon: true,
    ),
    _QuickActionData(
      label: 'Upload\nFile',
      icon: HugeIcons.strokeRoundedUpload03,
      route: '/customer/order/new',
    ),
    _QuickActionData(
      label: 'Scan\nQR',
      icon: HugeIcons.strokeRoundedQrCode,
      isComingSoon: true,
    ),
    _QuickActionData(
      label: 'Track\nOrder',
      icon: HugeIcons.strokeRoundedSearch01,
      route: '/customer/orders',
    ),
  ];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Quick Actions'),
        SizedBox(
          height: 90,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _actions.length,
            separatorBuilder: (_, _) =>
                const SizedBox(width: AppSpacing.md),
            itemBuilder: (context, index) {
              final action = _actions[index];
              return _QuickActionItem(
                data: action,
                colors: colors,
              )
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: (50 * index).ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.15,
                    duration: 400.ms,
                    delay: (50 * index).ms,
                    curve: Curves.easeOut,
                  );
            },
          ),
        ),
      ],
    );
  }
}

class _QuickActionData {
  final String label;
  final dynamic icon;
  final String? route;
  final bool isPrimary;
  final bool isComingSoon;

  const _QuickActionData({
    required this.label,
    required this.icon,
    this.route,
    this.isPrimary = false,
    this.isComingSoon = false,
  });
}

class _QuickActionItem extends StatelessWidget {
  const _QuickActionItem({
    required this.data,
    required this.colors,
  });

  final _QuickActionData data;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (data.isComingSoon) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Coming soon!',
                style: AppTypography.body.copyWith(color: colors.accentOnColor),
              ),
              backgroundColor: colors.accent,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 1),
            ),
          );
          return;
        }
        if (data.route != null) {
          context.push(data.route!);
        }
      },
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: data.isPrimary ? colors.brand : colors.surface,
                border: data.isPrimary
                    ? null
                    : Border.all(
                        color: colors.outline,
                        width: 1.5,
                      ),
              ),
              child: HugeIcon(
                icon: data.icon,
                size: 22,
                color: data.isPrimary
                    ? colors.accentOnColor
                    : colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              data.label,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontWeight: FontWeight.w500,
                fontSize: 11,
                height: 1.3,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
  }
}
