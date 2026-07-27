import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/maps/grid_map_models.dart';

/// Handle for imperative camera updates from product widgets.
///
/// Backed by Google Maps when available; no-ops on placeholder platforms.
class GridMapController {
  void Function(GridMapCamera camera)? _moveTo;
  void Function(List<LatLng> points, {double padding})? _fitBounds;
  void Function()? _disposeHook;

  void bind({
    required void Function(GridMapCamera camera) moveTo,
    required void Function(List<LatLng> points, {double padding}) fitBounds,
    void Function()? onDispose,
  }) {
    _moveTo = moveTo;
    _fitBounds = fitBounds;
    _disposeHook = onDispose;
  }

  void unbind() {
    _disposeHook?.call();
    _moveTo = null;
    _fitBounds = null;
    _disposeHook = null;
  }

  void moveTo(GridMapCamera camera) => _moveTo?.call(camera);

  void fitBounds(List<LatLng> points, {double padding = 48}) {
    if (points.isEmpty) return;
    _fitBounds?.call(points, padding: padding);
  }
}
