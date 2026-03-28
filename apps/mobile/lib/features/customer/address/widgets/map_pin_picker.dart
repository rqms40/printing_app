import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Interactive map for picking a delivery address by dragging the map
/// under a fixed center pin.
class MapPinPicker extends StatelessWidget {
  const MapPinPicker({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        width: double.infinity,
        height: 200,
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
                options: const MapOptions(
                  initialCenter: LatLng(14.5547, 121.0244), // Manila / Makati
                  initialZoom: 15.0,
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.gridprint.app',
                  ),
                ],
              ),

              // Center pin overlay — fixed position, map moves under it
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Icon(
                    Icons.location_on,
                    size: 40,
                    color: colors.accent,
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
            ],
          ),
        ),
      ),
    );
  }
}
