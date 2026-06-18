import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/features/rider/home/widgets/rider_delivery_status_panel.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Full-width rider home section: Delivery Status panel above a big route map.
/// Mirrors the customer delivery-status + map layout, with rider semantics.
class RiderRouteStatusSection extends StatelessWidget {
  const RiderRouteStatusSection({
    super.key,
    required this.deliveredStops,
    required this.currentStop,
    required this.upcomingStops,
    required this.mapStops,
    required this.onMapTap,
    required this.onTapStop,
  });

  final List<RiderAssignmentView> deliveredStops;
  final RiderAssignmentView? currentStop;
  final List<RiderAssignmentView> upcomingStops;
  final List<RiderAssignmentView> mapStops;
  final VoidCallback onMapTap;
  final void Function(RiderAssignmentView) onTapStop;

  static const _gap = AppSpacing.sm;
  static const _minMapHeight = 240.0;

  @override
  Widget build(BuildContext context) {
    final total = deliveredStops.length +
        (currentStop != null ? 1 : 0) +
        upcomingStops.length;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight =
            constraints.hasBoundedHeight ? constraints.maxHeight : 460.0;
        final preferred =
            RiderDeliveryStatusPanel.preferredHeight(totalRows: total);
        final maxStatus =
            (maxHeight - _gap - _minMapHeight).clamp(0.0, maxHeight).toDouble();
        final statusHeight = preferred
            .clamp(0.0, maxStatus <= 0 ? maxHeight : maxStatus)
            .toDouble();
        final mapHeight = (maxHeight - statusHeight - _gap)
            .clamp(0.0, double.infinity)
            .toDouble();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: statusHeight,
              child: RiderDeliveryStatusPanel(
                deliveredStops: deliveredStops,
                currentStop: currentStop,
                upcomingStops: upcomingStops,
                onTapStop: onTapStop,
              ),
            ),
            const SizedBox(height: _gap),
            SizedBox(
              height: mapHeight,
              child: RiderRouteMapTile(
                stops: mapStops,
                activeStop: currentStop,
                onTap: onMapTap,
              ),
            ),
          ],
        );
      },
    );
  }
}
