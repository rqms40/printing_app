import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Large pill-shaped button displaying the current checkpoint and next action.
class CheckpointAction extends StatelessWidget {
  const CheckpointAction({
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

  /// Returns the button label for the next action based on current status.
  String get _actionLabel {
    switch (currentStatus) {
      case DeliveryStatus.assigned:
        return 'Accept Delivery';
      case DeliveryStatus.accepted:
        return 'Mark as Picked Up';
      case DeliveryStatus.pickedUp:
        return 'Start Delivery';
      case DeliveryStatus.onTheWay:
        return 'Mark as Arrived';
      case DeliveryStatus.arrived:
        return 'Confirm Delivered';
      case DeliveryStatus.delivered:
      case DeliveryStatus.declined:
        return '';
    }
  }

  /// Returns the icon for the next action.
  IconData get _actionIcon {
    switch (currentStatus) {
      case DeliveryStatus.assigned:
        return Iconsax.tick_circle;
      case DeliveryStatus.accepted:
        return Iconsax.box;
      case DeliveryStatus.pickedUp:
        return Iconsax.truck_fast;
      case DeliveryStatus.onTheWay:
        return Iconsax.location;
      case DeliveryStatus.arrived:
        return Iconsax.verify;
      case DeliveryStatus.delivered:
      case DeliveryStatus.declined:
        return Iconsax.tick_circle;
    }
  }

  /// Whether this status has a valid next action.
  bool get hasAction =>
      currentStatus != DeliveryStatus.delivered &&
      currentStatus != DeliveryStatus.declined;

  @override
  Widget build(BuildContext context) {
    if (!hasAction) return const SizedBox.shrink();

    final colors = _colors(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Current status label
        Text(
          'Current: ${currentStatus.displayName}',
          style:
              AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.sm),
        // Next action button
        AppButton(
          label: _actionLabel,
          onTap: onAdvance,
          variant: AppButtonVariant.primary,
          isFullWidth: true,
          icon: _actionIcon,
        ),
      ],
    );
  }
}
