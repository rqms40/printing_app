import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/utils/formatters.dart';

/// Yellow-border tile: left icon panel, title/subtitle, chevron.
/// Local copy of the customer home tile pattern.
class RiderBorderTile extends StatefulWidget {
  const RiderBorderTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  final dynamic icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  State<RiderBorderTile> createState() => _RiderBorderTileState();
}

class _RiderBorderTileState extends State<RiderBorderTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderXl,
            border: Border.all(
              color: colors.outline.withValues(alpha: 0.4),
              width: 0.5,
            ),
          ),
          child: ClipRRect(
            borderRadius: AppRadius.borderXl,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 52,
                  child: Center(
                    child: HugeIcon(
                      icon: widget.icon,
                      size: 26,
                      color: colors.brand,
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          widget.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.onBackground,
                            fontSize: 12,
                            height: 1.2,
                          ),
                        ),
                        if (widget.subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            widget.subtitle!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 14,
                    color: colors.disabled,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Tile 1 — Active Stop (primary). Shows customer + order ref.
class RiderActiveStopTile extends StatelessWidget {
  const RiderActiveStopTile({
    super.key,
    required this.customerName,
    required this.orderRef,
    required this.onTap,
  });

  final String? customerName;
  final String? orderRef;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasActive = orderRef != null;
    return RiderBorderTile(
      icon: HugeIcons.strokeRoundedLocation01,
      title: hasActive ? (customerName ?? 'Active stop') : 'No active stop',
      subtitle: hasActive ? orderRef : 'Check Orders',
      onTap: onTap,
    );
  }
}

/// Tile 2 — My Deliveries count.
class RiderDeliveriesCountTile extends StatelessWidget {
  const RiderDeliveriesCountTile({
    super.key,
    required this.count,
    required this.onTap,
  });

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return RiderBorderTile(
      icon: HugeIcons.strokeRoundedLeftToRightListDash,
      title: 'My Deliveries',
      subtitle: count == 0 ? 'None active' : '$count active',
      onTap: onTap,
    );
  }
}

/// Tile 3 — Earnings (mirrors the bordered Feed tile shape).
class RiderEarningsTile extends StatelessWidget {
  const RiderEarningsTile({super.key, required this.todayAmount});

  final double todayAmount;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Earnings',
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
            height: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              borderRadius: AppRadius.borderMd,
              border: Border.all(
                color: colors.brand.withValues(alpha: 0.8),
                width: 0.75,
              ),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'TODAY',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 9,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    formatCurrency(todayAmount),
                    style: AppTypography.display.copyWith(
                      color: colors.brand,
                      fontSize: 22,
                      height: 1.0,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
