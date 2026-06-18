import 'package:flutter/material.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_rail.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Cockpit map: the route map tile filling the area, with the numbered stop
/// rail overlaid on the right edge.
class RiderCockpitMap extends StatelessWidget {
  const RiderCockpitMap({
    super.key,
    required this.mapStops,
    required this.activeStop,
    required this.completedCount,
    required this.currentStopIndex,
    required this.onMapTap,
  });

  final List<RiderAssignmentView> mapStops;
  final RiderAssignmentView? activeStop;
  final int completedCount;
  final int currentStopIndex;
  final VoidCallback onMapTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        RiderRouteMapTile(
          stops: mapStops,
          activeStop: activeStop,
          onTap: onMapTap,
        ),
        Positioned(
          top: 12,
          right: 8,
          bottom: 36,
          child: RiderStopRail(
            totalStops: mapStops.length,
            completedCount: completedCount,
            currentStopIndex: currentStopIndex,
          ),
        ),
      ],
    );
  }
}
