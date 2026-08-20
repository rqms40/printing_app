import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Interactive map for picking a delivery address by dragging the map
/// under a fixed center pin.
class MapPinPicker extends StatefulWidget {
  const MapPinPicker({
    super.key,
    // GRIDGO shop / Davao service area — keep in sync with MapHelpers.shopPoint.
    this.initialCenter = const LatLng(7.064, 125.6079),
    this.height = 200,
    this.mapTilesEnabled = true,
    this.onChanged,
  });

  final LatLng initialCenter;
  final double height;
  final bool mapTilesEnabled;
  final ValueChanged<LatLng>? onChanged;

  @override
  State<MapPinPicker> createState() => _MapPinPickerState();
}

class _MapPinPickerState extends State<MapPinPicker> {
  final MapController _mapController = MapController();
  late LatLng _center;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _center = widget.initialCenter;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onChanged?.call(_center);
    });
  }

  @override
  void didUpdateWidget(covariant MapPinPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialCenter.latitude == widget.initialCenter.latitude &&
        oldWidget.initialCenter.longitude == widget.initialCenter.longitude) {
      return;
    }
    setState(() => _center = widget.initialCenter);
    _moveTo(widget.initialCenter);
  }

  void _moveTo(LatLng point) {
    if (!_mapReady) return;
    _mapController.move(point, 15);
  }

  void _updateCenter(LatLng center) {
    setState(() => _center = center);
    widget.onChanged?.call(center);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        width: double.infinity,
        height: widget.height,
        decoration: BoxDecoration(
          border: Border.all(color: colors.outline, width: 0.5),
          borderRadius: AppRadius.borderLg,
        ),
        child: ClipRRect(
          borderRadius: AppRadius.borderLg,
          child: Stack(
            children: [
              // Interactive OpenStreetMap
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: widget.initialCenter,
                  initialZoom: 15.0,
                  onMapReady: () {
                    _mapReady = true;
                    _moveTo(_center);
                  },
                  onPositionChanged: (camera, hasGesture) {
                    if (hasGesture) _updateCenter(camera.center);
                  },
                  onTap: (_, point) {
                    _moveTo(point);
                    _updateCenter(point);
                  },
                ),
                children: [
                  if (widget.mapTilesEnabled)
                    MapHelpers.tileLayer(
                      Theme.of(context).brightness,
                      cachingProvider: const DisabledMapCachingProvider(),
                    )
                  else
                    ColoredBox(color: colors.surfaceVariant),
                ],
              ),

              // Center pin overlay — fixed position, map moves under it
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Icon(
                        Icons.location_on,
                        size: 48,
                        color: Colors.black.withValues(alpha: 0.24),
                      ),
                      Icon(
                        Icons.location_on,
                        size: 44,
                        color: colors.surface.withValues(alpha: 0.96),
                      ),
                      const Icon(
                        Icons.location_on,
                        size: 40,
                        color: Color(0xFF202124),
                      ),
                    ],
                  ),
                ),
              ),

              // "Drag map to set location" label at bottom
              Positioned(
                bottom: AppSpacing.sm,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surface.withValues(alpha: 0.9),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Text(
                      'Drag map to set location',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ),
                ),
              ),

              Positioned(
                top: AppSpacing.sm,
                left: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.9),
                    borderRadius: AppRadius.borderFull,
                  ),
                  child: Text(
                    '${_center.latitude.toStringAsFixed(5)}, '
                    '${_center.longitude.toStringAsFixed(5)}',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
