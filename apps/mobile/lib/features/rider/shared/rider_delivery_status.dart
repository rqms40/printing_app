import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

class RiderDeliveryVisual {
  const RiderDeliveryVisual({
    required this.icon,
    required this.tint,
    required this.label,
    required this.badgeVariant,
  });

  final dynamic icon;
  final Color tint;
  final String label;
  final StatusBadgeVariant badgeVariant;
}

RiderDeliveryVisual riderDeliveryVisual(
  DeliveryStatus status,
  AppColorSet colors,
) {
  switch (status) {
    case DeliveryStatus.assigned:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedNotification02,
        tint: colors.warning,
        label: 'New assignment',
        badgeVariant: StatusBadgeVariant.warning,
      );
    case DeliveryStatus.accepted:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedCheckmarkCircle02,
        tint: colors.info,
        label: 'Accepted',
        badgeVariant: StatusBadgeVariant.info,
      );
    case DeliveryStatus.pickedUp:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedPackage,
        tint: colors.info,
        label: 'Picked up',
        badgeVariant: StatusBadgeVariant.info,
      );
    case DeliveryStatus.onTheWay:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedDeliveryTruck02,
        tint: colors.brand,
        label: 'On the way',
        badgeVariant: StatusBadgeVariant.info,
      );
    case DeliveryStatus.arrived:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedLocation01,
        tint: colors.success,
        label: 'Arrived',
        badgeVariant: StatusBadgeVariant.success,
      );
    case DeliveryStatus.delivered:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedCheckmarkBadge01,
        tint: colors.success,
        label: 'Delivered',
        badgeVariant: StatusBadgeVariant.success,
      );
    case DeliveryStatus.declined:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedCancelCircle,
        tint: colors.error,
        label: 'Declined',
        badgeVariant: StatusBadgeVariant.error,
      );
    case DeliveryStatus.failed:
      return RiderDeliveryVisual(
        icon: HugeIcons.strokeRoundedAlert02,
        tint: colors.error,
        label: 'Failed delivery',
        badgeVariant: StatusBadgeVariant.error,
      );
  }
}

const riderCheckpoints = [
  DeliveryStatus.accepted,
  DeliveryStatus.pickedUp,
  DeliveryStatus.onTheWay,
  DeliveryStatus.arrived,
  DeliveryStatus.delivered,
];

String riderCheckpointActionLabel(DeliveryStatus status) {
  return switch (status) {
    DeliveryStatus.assigned => 'Accept delivery',
    DeliveryStatus.accepted => 'Open pickup proof',
    DeliveryStatus.pickedUp => 'Start delivery',
    DeliveryStatus.onTheWay => 'Mark as arrived',
    DeliveryStatus.arrived => 'Confirm delivered',
    _ => '',
  };
}

dynamic riderCheckpointActionIcon(DeliveryStatus status) {
  return switch (status) {
    DeliveryStatus.assigned => HugeIcons.strokeRoundedCheckmarkCircle02,
    DeliveryStatus.accepted => HugeIcons.strokeRoundedPackage,
    DeliveryStatus.pickedUp => HugeIcons.strokeRoundedDeliveryTruck02,
    DeliveryStatus.onTheWay => HugeIcons.strokeRoundedLocation01,
    DeliveryStatus.arrived => HugeIcons.strokeRoundedCheckmarkBadge01,
    _ => HugeIcons.strokeRoundedCheckmarkCircle02,
  };
}