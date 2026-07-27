import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/maps/grid_map_models.dart';

/// Route colors tuned for dark Google basemap + GRIDGO brand yellow.
const Color kRouteColor = Color(0xFFFFDE58);
const Color kRouteBorderColor = Color(0xFF0A0A0A);

/// Shared map constants and overlay builders for all map screens.
///
/// Geometry uses [latlong2.LatLng] (server GeoJSON). Rendering goes through
/// [GridMapView] (Google Maps on Android/iOS/Web).
class MapHelpers {
  MapHelpers._();

  /// GRIDGO shop pickup — Davao (matches server GRIDGO_STORE_*).
  static const shopPoint = LatLng(7.064, 125.6079);

  /// Legacy demo destination (Manila) — fallback only.
  static const destinationPoint = LatLng(14.6400, 121.0530);

  /// Center between shop and destination.
  static const mapCenter = LatLng(7.127, 125.531);

  /// Davao City center — used for idle state on home map tile.
  static const davaoCenter = LatLng(7.1907, 125.4553);

  static GridMapCamera camera(
    LatLng target, {
    double zoom = 14,
  }) =>
      GridMapCamera(target: target, zoom: zoom);

  static GridMapMarker shopMarker({LatLng? point}) => GridMapMarker(
        id: 'shop',
        point: point ?? shopPoint,
        kind: GridMarkerKind.shop,
        semanticLabel: 'Shop',
        zIndex: 1,
      );

  static GridMapMarker destinationMarker({
    LatLng? point,
    String id = 'destination',
  }) =>
      GridMapMarker(
        id: id,
        point: point ?? destinationPoint,
        kind: GridMarkerKind.destination,
        semanticLabel: 'Destination',
        zIndex: 2,
      );

  static GridMapMarker riderMarker(
    LatLng point, {
    String id = 'rider',
    String? semanticLabel,
    double rotation = 0,
  }) =>
      GridMapMarker(
        id: id,
        point: point,
        kind: GridMarkerKind.rider,
        semanticLabel: semanticLabel ?? 'Rider',
        rotation: rotation,
        zIndex: 10,
      );

  static GridMapMarker stopMarker({
    required int sequence,
    required LatLng point,
    bool isCurrent = false,
  }) =>
      GridMapMarker(
        id: 'stop-$sequence',
        point: point,
        kind: GridMarkerKind.stop,
        label: '$sequence',
        semanticLabel: 'Stop $sequence',
        zIndex: isCurrent ? 5 : 3,
      );

  /// Bold route polylines (border + yellow fill) for a customer-safe leg.
  static List<GridMapPolyline> routePolylines(
    List<LatLng> points, {
    String idPrefix = 'route',
  }) {
    if (points.length < 2) return const [];
    return [
      GridMapPolyline(
        id: '$idPrefix-border',
        points: points,
        color: kRouteBorderColor,
        width: 7,
        zIndex: 1,
      ),
      GridMapPolyline(
        id: '$idPrefix-fill',
        points: points,
        color: kRouteColor,
        width: 4.5,
        zIndex: 2,
      ),
    ];
  }

  /// One persisted server-owned dispatch leg.
  static List<GridMapPolyline> persistedRouteLeg({
    required String id,
    required List<LatLng> points,
    required bool isCompleted,
    required bool isCurrent,
  }) {
    if (points.length < 2) return const [];
    final fill = isCompleted
        ? const Color(0xFF8B8B8B).withValues(alpha: 0.62)
        : isCurrent
            ? kRouteColor
            : kRouteColor.withValues(alpha: 0.58);
    final border = kRouteBorderColor.withValues(
      alpha: isCompleted ? 0.45 : 0.9,
    );
    return [
      GridMapPolyline(
        id: '$id-border',
        points: points,
        color: border,
        width: isCurrent ? 7 : 6,
        zIndex: 1,
      ),
      GridMapPolyline(
        id: '$id-fill',
        points: points,
        color: fill,
        width: isCurrent ? 4.5 : 3.5,
        zIndex: 2,
      ),
    ];
  }

  /// Attribution chip for Google Maps basemap (replaces OSM/CARTO/OSRM).
  static Widget attribution({bool includeRouting = false}) {
    return Align(
      alignment: Alignment.bottomLeft,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xCC0A0A0A),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            child: Text(
              includeRouting
                  ? '© Google · Routes'
                  : '© Google',
              style: const TextStyle(
                color: Color(0xFFB0B0B0),
                fontSize: 10,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
