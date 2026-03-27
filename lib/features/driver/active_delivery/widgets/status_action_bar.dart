import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Bottom bar showing checkpoint progress and the next action button.
class StatusActionBar extends StatelessWidget {
  const StatusActionBar({
    super.key,
    required this.currentStatus,
    required this.onAdvance,
  });

  final DeliveryStatus currentStatus;
  final VoidCallback onAdvance;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  /// The ordered list of delivery checkpoints.
  static const _checkpoints = [
    DeliveryStatus.accepted,
    DeliveryStatus.pickedUp,
    DeliveryStatus.onTheWay,
    DeliveryStatus.arrived,
    DeliveryStatus.delivered,
  ];

  int get _currentIndex {
    final idx = _checkpoints.indexOf(currentStatus);
    return idx >= 0 ? idx : 0;
  }

  String get _actionLabel {
    switch (currentStatus) {
      case DeliveryStatus.accepted:
        return 'Mark as Picked Up';
      case DeliveryStatus.pickedUp:
        return 'Start Delivery';
      case DeliveryStatus.onTheWay:
        return 'Mark as Arrived';
      case DeliveryStatus.arrived:
        return 'Confirm Delivered';
      case DeliveryStatus.delivered:
      case DeliveryStatus.assigned:
      case DeliveryStatus.declined:
        return '';
    }
  }

  IconData get _actionIcon {
    switch (currentStatus) {
      case DeliveryStatus.accepted:
        return Iconsax.box;
      case DeliveryStatus.pickedUp:
        return Iconsax.truck_fast;
      case DeliveryStatus.onTheWay:
        return Iconsax.location;
      case DeliveryStatus.arrived:
        return Iconsax.verify;
      default:
        return Iconsax.tick_circle;
    }
  }

  bool get _hasAction =>
      currentStatus != DeliveryStatus.delivered &&
      currentStatus != DeliveryStatus.declined &&
      currentStatus != DeliveryStatus.assigned;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          top: BorderSide(color: colors.outline, width: 0.5),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Progress indicator
            Row(
              children: List.generate(_checkpoints.length, (index) {
                final isCompleted = index <= _currentIndex;
                return Expanded(
                  child: Container(
                    margin: EdgeInsets.only(
                      right: index < _checkpoints.length - 1
                          ? AppSpacing.xs
                          : 0,
                    ),
                    height: 4,
                    decoration: BoxDecoration(
                      color: isCompleted ? colors.accent : colors.outline,
                      borderRadius: AppRadius.borderFull,
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: AppSpacing.sm),

            // Status text
            Text(
              currentStatus.displayName,
              style: AppTypography.caption
                  .copyWith(color: colors.onSurfaceDim),
            ),
            const SizedBox(height: AppSpacing.sm),

            // Action button
            if (_hasAction)
              AppButton(
                label: _actionLabel,
                onTap: onAdvance,
                variant: AppButtonVariant.primary,
                isFullWidth: true,
                icon: _actionIcon,
              ),
          ],
        ),
      ),
    );
  }
}
