import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// Route color for delivery tracking — bold teal, visible on any map tile.
const Color kRouteColor = Color(0xFF00897B); // teal 600
const Color kRouteBorderColor = Color(0xFF004D40); // teal 900

/// Shared map configuration and builders for all map screens.
class MapHelpers {
  MapHelpers._();

  /// The realistic Manila route points from mock data.
  static List<LatLng> get routePoints => MockData.locationUpdates
      .map((loc) => LatLng(loc.latitude, loc.longitude))
      .toList();

  /// Shop pickup location (Makati, Ayala Ave).
  static const shopPoint = LatLng(14.5510, 121.0230);

  /// Destination (QC, Katipunan Ave).
  static const destinationPoint = LatLng(14.6400, 121.0530);

  /// Map center between shop and destination.
  static const mapCenter = LatLng(14.5940, 121.0380);

  /// Standard OSM tile layer.
  static TileLayer tileLayer() => TileLayer(
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        userAgentPackageName: 'com.gridprint.app',
      );

  /// Bold route polyline with border (like Grab/DoorDash).
  /// Renders two polylines — a thick dark border underneath and a
  /// colored line on top for the outline/fill effect.
  static PolylineLayer routePolyline({List<LatLng>? points}) {
    final pts = points ?? routePoints;
    return PolylineLayer(
      polylines: [
        // Border/shadow (thicker, darker)
        Polyline(
          points: pts,
          color: kRouteBorderColor,
          strokeWidth: 7.0,
          borderStrokeWidth: 0,
        ),
        // Main route (thinner, brighter on top)
        Polyline(
          points: pts,
          color: kRouteColor,
          strokeWidth: 5.0,
          borderStrokeWidth: 0,
        ),
      ],
    );
  }

  /// Shop/pickup marker — dark circle with store icon.
  static Marker shopMarker({LatLng? point}) => Marker(
        point: point ?? shopPoint,
        width: 44,
        height: 44,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: kRouteBorderColor, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.store_rounded,
            color: kRouteBorderColor,
            size: 22,
          ),
        ),
      );

  /// Destination marker — colored pin with flag.
  static Marker destinationMarker({LatLng? point}) => Marker(
        point: point ?? destinationPoint,
        width: 44,
        height: 54,
        alignment: Alignment.topCenter,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: kRouteColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x40000000),
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(
                Icons.flag_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            // Pin tail
            Container(
              width: 3,
              height: 8,
              decoration: BoxDecoration(
                color: kRouteColor,
                borderRadius: AppRadius.borderFull,
              ),
            ),
          ],
        ),
      );

  /// Driver position marker — pulsing dark circle with navigation arrow.
  static Marker driverMarker(LatLng point) => Marker(
        point: point,
        width: 44,
        height: 44,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.navigation_rounded,
            color: Colors.white,
            size: 20,
          ),
        ),
      );
}
