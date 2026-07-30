import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_radius.dart';

/// Route colors tuned to match the desktop riders map treatment.
const Color kRouteColor = Color(0xFFFFDE58);
const Color kRouteBorderColor = Color(0xFF0A0A0A);

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

  static const cartoDarkTileUrl =
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  /// Returns the shared CARTO dark tile layer used across GRIDGO maps.
  /// This mirrors the Leaflet/CARTO treatment used by the desktop riders map
  /// and keeps labels, roads, and water detail visible without an extra filter.
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
      urlTemplate: cartoDarkTileUrl,
      userAgentPackageName: 'com.gridgoprint.app',
      tileProvider: cachingProvider == null
          ? null
          : NetworkTileProvider(cachingProvider: cachingProvider),
    );
  }

  /// Bold route polyline (double-layered: dark border + GRIDGO yellow fill).
  static PolylineLayer routePolyline(List<LatLng> points) {
    return PolylineLayer(
      polylines: [
        Polyline(points: points, color: kRouteBorderColor, strokeWidth: 7.0),
        Polyline(points: points, color: kRouteColor, strokeWidth: 4.5),
      ],
    );
  }

  /// One persisted server-owned dispatch leg. Completed legs are subdued,
  /// while the current leg keeps the high-contrast GRIDGO treatment.
  static PolylineLayer persistedRouteLeg({
    Key? key,
    required List<LatLng> points,
    required bool isCompleted,
    required bool isCurrent,
  }) {
    final fill = isCompleted
        ? const Color(0xFF8B8B8B).withValues(alpha: 0.62)
        : isCurrent
        ? kRouteColor
        : kRouteColor.withValues(alpha: 0.58);
    final border = kRouteBorderColor.withValues(
      alpha: isCompleted ? 0.45 : 0.9,
    );
    return PolylineLayer(
      key: key,
      polylines: [
        Polyline(points: points, color: border, strokeWidth: isCurrent ? 7 : 6),
        Polyline(
          points: points,
          color: fill,
          strokeWidth: isCurrent ? 4.5 : 3.5,
        ),
      ],
    );
  }

  /// Required tile and routing attribution for every GRIDGO map.
  static RichAttributionWidget attribution({bool includeRouting = false}) {
    return RichAttributionWidget(
      showFlutterMapAttribution: false,
      attributions: [
        const TextSourceAttribution('OpenStreetMap contributors'),
        const TextSourceAttribution('CARTO'),
        if (includeRouting)
          const TextSourceAttribution(
            'Route data: OSRM',
            prependCopyright: false,
          ),
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
        border: Border.all(color: kRouteColor, width: 2.5),
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

  /// Destination marker — neutral circle + flag + pin tail.
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
          child: const Icon(Icons.flag_rounded, color: Colors.white, size: 20),
        ),
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

  /// Rider marker — the delivery vehicle, ride-hailing style: brand disc
  /// with a motorcycle glyph so the courier is instantly recognizable.
  static Marker riderMarker(
    LatLng point, {
    Key? semanticKey,
    String? semanticLabel,
  }) {
    final marker = Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFDE58),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF141414), width: 2.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(
        Icons.two_wheeler_rounded,
        color: Color(0xFF141414),
        size: 22,
      ),
    );
    return Marker(
      point: point,
      width: 44,
      height: 44,
      child: semanticLabel == null
          ? marker
          : Semantics(
              key: semanticKey,
              container: true,
              label: semanticLabel,
              child: marker,
            ),
    );
  }
}
