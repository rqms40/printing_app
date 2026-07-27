import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/maps/grid_map_view.dart';

/// Interactive map for picking a delivery address by dragging the map
/// under a fixed center pin (Google Maps on Android/iOS/Web).
class MapPinPicker extends StatefulWidget {
  const MapPinPicker({
    super.key,
    this.initialCenter = const LatLng(7.0731, 125.6128),
    this.height = 200,
    this.mapTilesEnabled = true,
    this.forcePlaceholder = false,
    this.onChanged,
  });

  final LatLng initialCenter;
  final double height;
  final bool mapTilesEnabled;
  final bool forcePlaceholder;
  final ValueChanged<LatLng>? onChanged;

  @override
  State<MapPinPicker> createState() => _MapPinPickerState();
}

class _MapPinPickerState extends State<MapPinPicker> {
  final GridMapController _mapController = GridMapController();
  late LatLng _center;

  @override
  void initState() {
    super.initState();
    _center = widget.initialCenter;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onChanged?.call(_center);
    });
  }

  @override
  void dispose() {
    _mapController.unbind();
    super.dispose();
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
              if (!widget.mapTilesEnabled)
                ColoredBox(color: colors.surfaceVariant)
              else
                GridMapView(
                  controller: _mapController,
                  forcePlaceholder: widget.forcePlaceholder,
                  initialCamera: GridMapCamera(
                    target: widget.initialCenter,
                    zoom: 15,
                  ),
                  interactive: true,
                  onCameraMove: (camera) => _updateCenter(camera.target),
                  onTap: (point) {
                    _mapController.moveTo(
                      GridMapCamera(target: point, zoom: 15),
                    );
                    _updateCenter(point);
                  },
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

              Positioned(
                left: 0,
                right: 0,
                bottom: AppSpacing.sm,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surface.withValues(alpha: 0.92),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Text(
                      'Drag map to set location',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
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
