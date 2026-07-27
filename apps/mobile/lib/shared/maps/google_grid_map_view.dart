import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/maps/grid_map_controller.dart';
import 'package:printing_app/shared/maps/grid_map_models.dart';
import 'package:printing_app/shared/maps/grid_map_style.dart';
import 'package:printing_app/shared/maps/maps_js_ready.dart';
import 'package:printing_app/shared/maps/placeholder_grid_map_view.dart';

gmaps.LatLng _toGoogle(LatLng p) => gmaps.LatLng(p.latitude, p.longitude);

gmaps.BitmapDescriptor _iconForKind(GridMarkerKind kind) {
  switch (kind) {
    case GridMarkerKind.shop:
      return gmaps.BitmapDescriptor.defaultMarkerWithHue(
        gmaps.BitmapDescriptor.hueAzure,
      );
    case GridMarkerKind.destination:
      return gmaps.BitmapDescriptor.defaultMarkerWithHue(
        gmaps.BitmapDescriptor.hueYellow,
      );
    case GridMarkerKind.rider:
      return gmaps.BitmapDescriptor.defaultMarkerWithHue(
        gmaps.BitmapDescriptor.hueOrange,
      );
    case GridMarkerKind.stop:
      return gmaps.BitmapDescriptor.defaultMarkerWithHue(
        gmaps.BitmapDescriptor.hueGreen,
      );
    case GridMarkerKind.custom:
      return gmaps.BitmapDescriptor.defaultMarkerWithHue(
        gmaps.BitmapDescriptor.hueYellow,
      );
  }
}

/// Google Maps implementation of the GRIDGO map host.
class GoogleGridMapView extends StatefulWidget {
  const GoogleGridMapView({
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

  @override
  State<GoogleGridMapView> createState() => _GoogleGridMapViewState();
}

class _GoogleGridMapViewState extends State<GoogleGridMapView> {
  gmaps.GoogleMapController? _mapController;
  Timer? _readyPoll;
  bool _jsReady = !kIsWeb;
  bool _jsFailed = false;
  String? _failMessage;
  int _pollTicks = 0;

  static const _maxPollTicks = 48; // ~12s at 250ms

  static const _gcpHelp =
      'Google Maps is blocked for this API key.\n\n'
      'In Google Cloud Console:\n'
      '1) Enable billing on the project\n'
      '2) Enable "Maps JavaScript API"\n'
      '3) Key restrictions → allow Maps JavaScript API\n'
      '4) App restrictions → None, or HTTP referrers:\n'
      '   http://127.0.0.1:8080/*  and  http://127.0.0.1:5173/*\n'
      '5) Hard-refresh Chrome (Ctrl+Shift+R)';

  @override
  void initState() {
    super.initState();
    widget.controller?.bind(
      moveTo: _moveTo,
      fitBounds: _fitBounds,
      onDispose: () => _mapController = null,
    );
    if (kIsWeb) {
      _jsReady = isGoogleMapsJsReady();
      final alreadyFailed = googleMapsJsBlockReason();
      if (alreadyFailed != null) {
        _jsFailed = true;
        _failMessage = '$alreadyFailed\n\n$_gcpHelp';
      } else if (!_jsReady) {
        _readyPoll = Timer.periodic(const Duration(milliseconds: 250), (_) {
          _pollTicks += 1;
          final reason = googleMapsJsBlockReason();
          if (isGoogleMapsJsReady()) {
            _readyPoll?.cancel();
            if (mounted) setState(() => _jsReady = true);
            return;
          }
          if (reason != null || _pollTicks >= _maxPollTicks) {
            _readyPoll?.cancel();
            if (mounted) {
              setState(() {
                _jsFailed = true;
                _failMessage = reason != null
                    ? '$reason\n\n$_gcpHelp'
                    : 'Google Maps did not become ready in time.\n\n$_gcpHelp';
              });
            }
          }
        });
      }
    }
  }

  @override
  void didUpdateWidget(covariant GoogleGridMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?.unbind();
      widget.controller?.bind(
        moveTo: _moveTo,
        fitBounds: _fitBounds,
        onDispose: () => _mapController = null,
      );
    }
  }

  @override
  void dispose() {
    _readyPoll?.cancel();
    widget.controller?.unbind();
    _mapController?.dispose();
    super.dispose();
  }

  void _moveTo(GridMapCamera camera) {
    try {
      _mapController?.animateCamera(
        gmaps.CameraUpdate.newCameraPosition(
          gmaps.CameraPosition(
            target: _toGoogle(camera.target),
            zoom: camera.zoom,
            bearing: camera.bearing,
            tilt: camera.tilt,
          ),
        ),
      );
    } catch (e) {
      debugPrint('GoogleGridMapView.moveTo skipped: $e');
    }
  }

  void _fitBounds(List<LatLng> points, {double padding = 48}) {
    if (points.isEmpty || _mapController == null) return;
    try {
      if (points.length == 1) {
        _moveTo(GridMapCamera(target: points.first, zoom: 15));
        return;
      }
      var minLat = points.first.latitude;
      var maxLat = points.first.latitude;
      var minLng = points.first.longitude;
      var maxLng = points.first.longitude;
      for (final p in points) {
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
      }
      _mapController!.animateCamera(
        gmaps.CameraUpdate.newLatLngBounds(
          gmaps.LatLngBounds(
            southwest: gmaps.LatLng(minLat, minLng),
            northeast: gmaps.LatLng(maxLat, maxLng),
          ),
          padding,
        ),
      );
    } catch (e) {
      debugPrint('GoogleGridMapView.fitBounds skipped: $e');
    }
  }

  Set<gmaps.Marker> get _markers => {
        for (final m in widget.markers)
          gmaps.Marker(
            markerId: gmaps.MarkerId(m.id),
            position: _toGoogle(m.point),
            icon: _iconForKind(m.kind),
            anchor: m.anchor,
            rotation: m.rotation,
            zIndexInt: m.zIndex.round(),
            infoWindow: gmaps.InfoWindow(
              title: m.semanticLabel ?? m.label,
            ),
          ),
      };

  Set<gmaps.Polyline> get _polylines => {
        for (final p in widget.polylines)
          gmaps.Polyline(
            polylineId: gmaps.PolylineId(p.id),
            points: p.points.map(_toGoogle).toList(growable: false),
            color: p.color,
            width: p.width.round().clamp(1, 24),
            zIndex: p.zIndex.round(),
          ),
      };

  Set<gmaps.Circle> get _circles => {
        for (final c in widget.circles)
          gmaps.Circle(
            circleId: gmaps.CircleId(c.id),
            center: _toGoogle(c.center),
            radius: c.radiusMeters,
            fillColor: c.fillColor,
            strokeColor: c.strokeColor,
            strokeWidth: c.strokeWidth.round().clamp(0, 12),
          ),
      };

  @override
  Widget build(BuildContext context) {
    if (kIsWeb && _jsFailed) {
      return PlaceholderGridMapView(
        initialCamera: widget.initialCamera,
        controller: widget.controller,
        markers: widget.markers,
        polylines: widget.polylines,
        message: _failMessage ?? 'Google Maps unavailable',
      );
    }

    if (kIsWeb && !_jsReady) {
      return PlaceholderGridMapView(
        initialCamera: widget.initialCamera,
        controller: widget.controller,
        markers: widget.markers,
        polylines: widget.polylines,
        message: 'Loading Google Maps…',
      );
    }

    // Guard again right before construct — avoids ROADMAP TypeError when the
    // JS SDK failed mid-frame (ApiTargetBlockedMapError).
    if (kIsWeb && !isGoogleMapsJsReady()) {
      return PlaceholderGridMapView(
        initialCamera: widget.initialCamera,
        controller: widget.controller,
        markers: widget.markers,
        polylines: widget.polylines,
        message:
            'Google Maps JS not ready. Enable Maps JavaScript API for this key.',
      );
    }

    try {
      return gmaps.GoogleMap(
        initialCameraPosition: gmaps.CameraPosition(
          target: _toGoogle(widget.initialCamera.target),
          zoom: widget.initialCamera.zoom,
          bearing: widget.initialCamera.bearing,
          tilt: widget.initialCamera.tilt,
        ),
        mapType: gmaps.MapType.normal,
        onMapCreated: (controller) {
          _mapController = controller;
        },
        // Dark style can fail if Maps JS is partial; apply only after create.
        style: kIsWeb ? null : kGridGoogleMapDarkStyle,
        markers: _markers,
        polylines: _polylines,
        circles: _circles,
        myLocationEnabled: widget.myLocationEnabled && !kIsWeb,
        myLocationButtonEnabled: false,
        zoomControlsEnabled: false,
        mapToolbarEnabled: false,
        compassEnabled: widget.interactive,
        rotateGesturesEnabled: widget.interactive,
        scrollGesturesEnabled: widget.interactive,
        tiltGesturesEnabled: widget.interactive,
        zoomGesturesEnabled: widget.interactive,
        liteModeEnabled: !widget.interactive &&
            defaultTargetPlatform == TargetPlatform.android,
        padding: widget.padding,
        onTap: widget.onTap == null
            ? null
            : (pos) => widget.onTap!(LatLng(pos.latitude, pos.longitude)),
        onCameraMove: widget.onCameraMove == null
            ? null
            : (position) => widget.onCameraMove!(
                  GridMapCamera(
                    target: LatLng(
                      position.target.latitude,
                      position.target.longitude,
                    ),
                    zoom: position.zoom,
                    bearing: position.bearing,
                    tilt: position.tilt,
                  ),
                ),
      );
    } catch (e, st) {
      debugPrint('GoogleGridMapView build failed: $e\n$st');
      return PlaceholderGridMapView(
        initialCamera: widget.initialCamera,
        controller: widget.controller,
        markers: widget.markers,
        polylines: widget.polylines,
        message: 'Map failed to render. Check Maps JavaScript API / API key.',
      );
    }
  }
}
