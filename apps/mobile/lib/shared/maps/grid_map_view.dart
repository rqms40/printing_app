import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/maps/google_grid_map_view.dart';
import 'package:printing_app/shared/maps/grid_map_controller.dart';
import 'package:printing_app/shared/maps/grid_map_models.dart';
import 'package:printing_app/shared/maps/placeholder_grid_map_view.dart';

export 'package:printing_app/shared/maps/grid_map_controller.dart';
export 'package:printing_app/shared/maps/grid_map_models.dart';

/// Whether this build target can host a real Google Map widget.
bool get supportsGoogleMaps {
  // Widget tests must never spin up the native Google Maps plugin.
  if (const bool.fromEnvironment('FLUTTER_TEST')) return false;
  if (kIsWeb) return true;
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
    case TargetPlatform.iOS:
      return true;
    default:
      return false;
  }
}

/// GRIDGO map host: Google Maps on Android/iOS/Web, placeholder elsewhere.
///
/// Product screens should depend on this widget (and [GridMapController]),
/// never on `flutter_map` or `GoogleMap` directly — keeps tests and desktop safe.
class GridMapView extends StatelessWidget {
  const GridMapView({
    super.key,
    required this.initialCamera,
    this.controller,
    this.markers = const [],
    this.polylines = const [],
    this.circles = const [],
    this.interactive = true,
    this.myLocationEnabled = false,
    this.onTap,
    this.onCameraMove,
    this.padding = EdgeInsets.zero,
    this.forcePlaceholder = false,
    this.placeholderMessage,
  });

  final GridMapCamera initialCamera;
  final GridMapController? controller;
  final List<GridMapMarker> markers;
  final List<GridMapPolyline> polylines;
  final List<GridMapCircle> circles;
  final bool interactive;
  final bool myLocationEnabled;
  final void Function(LatLng point)? onTap;
  final void Function(GridMapCamera camera)? onCameraMove;
  final EdgeInsets padding;

  /// Force placeholder (widget tests).
  final bool forcePlaceholder;
  final String? placeholderMessage;

  @override
  Widget build(BuildContext context) {
    if (forcePlaceholder || !supportsGoogleMaps) {
      return PlaceholderGridMapView(
        initialCamera: initialCamera,
        controller: controller,
        markers: markers,
        polylines: polylines,
        message: placeholderMessage ??
            (supportsGoogleMaps
                ? 'Map loading…'
                : 'Map preview unavailable on this platform'),
      );
    }

    return GoogleGridMapView(
      initialCamera: initialCamera,
      controller: controller,
      markers: markers,
      polylines: polylines,
      circles: circles,
      interactive: interactive,
      myLocationEnabled: myLocationEnabled,
      onTap: onTap,
      onCameraMove: onCameraMove,
      padding: padding,
    );
  }
}
