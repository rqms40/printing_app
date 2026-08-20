import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
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
    this.planOrigin,
    required this.completedCount,
    required this.currentStopIndex,
    required this.onMapTap,
  });

  final List<RiderAssignmentView> mapStops;
  final RiderAssignmentView? activeStop;
  final LatLng? planOrigin;
  final int completedCount;
  final int currentStopIndex;
  final VoidCallback onMapTap;

  @override
  Widget build(BuildContext context) {
    final planned = mapStops.where((view) => view.legs.isNotEmpty).toList()
      ..sort(
        (a, b) => (a.planSequence ?? 0).compareTo(b.planSequence ?? 0),
      );
    final legs = [for (final view in planned) ...view.legs];

    return Stack(
      fit: StackFit.expand,
      children: [
        RiderRouteMapTile(
          planOrigin: planOrigin,
          stops: mapStops,
          activeStop: activeStop,
          onTap: onMapTap,
        ),
        // The rail mirrors the persisted plan; without one there is nothing
        // to sequence, so it stays hidden instead of showing phantom stops.
        if (planned.isNotEmpty)
          Positioned(
            top: 12,
            right: 8,
            // Leave the lower-right corner to the map attribution control.
            bottom: 64,
            child: RiderStopRail(
              totalStops: legs.isEmpty ? planned.length : legs.length,
              completedCount: completedCount,
              currentStopIndex: currentStopIndex,
              stopStatuses: [
                for (final leg in legs) leg.status,
              ],
            ),
          ),
      ],
    );
  }
}
