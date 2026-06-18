import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_radius.dart';

/// Route color — bold teal, visible on any map tile.
const Color kRouteColor = Color(0xFF00897B);
const Color kRouteBorderColor = Color(0xFF004D40);

/// Shared map builders for all map screens.
class MapHelpers {
  MapHelpers._();

  /// GRIDGO shop pickup — Davao (matches server SHOP_LOCATION).
  static const shopPoint = LatLng(7.064, 125.6079);

  /// Legacy demo destination (Manila) — fallback only.
  static const destinationPoint = LatLng(14.6400, 121.0530);

  /// Center between shop and destination.
  static const mapCenter = LatLng(7.127, 125.531);

  /// Davao City center — used for idle state on home map tile.
  static const davaoCenter = LatLng(7.1907, 125.4553);

  static const openStreetMapTileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// Returns the shared OpenStreetMap tile layer used across GRIDGO maps.
  /// The same stable OSM source is used in both themes to avoid provider-
  /// specific failures from third-party styled tile endpoints.
  ///
  /// Pass [cachingProvider] (e.g. `const DisabledMapCachingProvider()`) to opt
  /// out of flutter_map's built-in disk cache, which depends on `path_provider`
  /// and is unavailable in widget tests. When null, the default built-in cache
  /// is used.
  static TileLayer tileLayer(
    Brightness brightness, {
    MapCachingProvider? cachingProvider,
  }) {
    return TileLayer(
      urlTemplate: openStreetMapTileUrl,
      userAgentPackageName: 'com.gridgoprint.app',
      tileProvider: cachingProvider == null
          ? null
          : NetworkTileProvider(cachingProvider: cachingProvider),
      // Theme-following basemap: dark mode applies an invert+hue filter to the
      // light OSM tiles for a dark map; light mode shows them as-is. Route and
      // marker layers are drawn separately and keep their full colour.
      tileBuilder: brightness == Brightness.dark ? _darkTileBuilder : null,
    );
  }

  /// Filters the light OSM tiles into a dark basemap (invert + 180° hue
  /// rotation) so the map matches the app's dark theme.
  static Widget _darkTileBuilder(
    BuildContext context,
    Widget tileWidget,
    TileImage tile,
  ) {
    return ColorFiltered(
      colorFilter: const ColorFilter.matrix(<double>[
        0.574, -1.43, -0.144, 0, 255,
        -0.426, -0.43, -0.144, 0, 255,
        -0.426, -1.43, 0.856, 0, 255,
        0, 0, 0, 1, 0,
      ]),
      child: tileWidget,
    );
  }

  /// Bold route polyline (double-layered: dark border + teal fill).
  static PolylineLayer routePolyline(List<LatLng> points) {
    return PolylineLayer(
      polylines: [
        Polyline(points: points, color: kRouteBorderColor, strokeWidth: 7.0),
        Polyline(points: points, color: kRouteColor, strokeWidth: 4.5),
      ],
    );
  }

  /// Shop marker — white circle + store icon + shadow.
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
              BoxShadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 2)),
            ],
          ),
          child: const Icon(Icons.store_rounded, color: kRouteBorderColor, size: 22),
        ),
      );

  /// Destination marker — teal circle + flag + pin tail.
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
                  BoxShadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 2)),
                ],
              ),
              child: const Icon(Icons.flag_rounded, color: Colors.white, size: 20),
            ),
            Container(
              width: 3,
              height: 8,
              decoration: BoxDecoration(color: kRouteColor, borderRadius: AppRadius.borderFull),
            ),
          ],
        ),
      );

  /// Rider marker — dark circle + navigation arrow.
  static Marker riderMarker(LatLng point) => Marker(
        point: point,
        width: 44,
        height: 44,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: const [
              BoxShadow(color: Color(0x40000000), blurRadius: 8, offset: Offset(0, 2)),
            ],
          ),
          child: const Icon(Icons.navigation_rounded, color: Colors.white, size: 20),
        ),
      );
}
