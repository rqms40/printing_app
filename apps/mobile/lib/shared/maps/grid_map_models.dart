import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

/// Built-in marker kinds (reliable default Google pin hues).
enum GridMarkerKind {
  shop,
  destination,
  rider,
  stop,
  custom,
}

/// Platform-agnostic map marker for [GridMapView].
class GridMapMarker {
  const GridMapMarker({
    required this.id,
    required this.point,
    this.kind = GridMarkerKind.custom,
    this.icon,
    this.label,
    this.anchor = const Offset(0.5, 0.5),
    this.zIndex = 0,
    this.rotation = 0,
    this.semanticLabel,
  });

  final String id;
  final LatLng point;
  final GridMarkerKind kind;

  /// Optional custom widget (encoded when kind == custom). Prefer [kind].
  final Widget? icon;

  /// Optional number/text for stop markers.
  final String? label;
  final Offset anchor;
  final double zIndex;
  final double rotation;
  final String? semanticLabel;
}

/// Platform-agnostic polyline for [GridMapView].
class GridMapPolyline {
  const GridMapPolyline({
    required this.id,
    required this.points,
    required this.color,
    this.width = 4.5,
    this.zIndex = 0,
  });

  final String id;
  final List<LatLng> points;
  final Color color;
  final double width;
  final double zIndex;
}

/// Platform-agnostic circle (e.g. GPS accuracy).
class GridMapCircle {
  const GridMapCircle({
    required this.id,
    required this.center,
    required this.radiusMeters,
    required this.fillColor,
    required this.strokeColor,
    this.strokeWidth = 1,
  });

  final String id;
  final LatLng center;
  final double radiusMeters;
  final Color fillColor;
  final Color strokeColor;
  final double strokeWidth;
}

/// Initial / controlled camera target.
class GridMapCamera {
  const GridMapCamera({
    required this.target,
    this.zoom = 14,
    this.bearing = 0,
    this.tilt = 0,
  });

  final LatLng target;
  final double zoom;
  final double bearing;
  final double tilt;
}
