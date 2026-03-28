import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/driver_management/providers/drivers_provider.dart';
import 'package:printing_app/features/admin/driver_management/widgets/driver_list_tile.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

/// Full screen driver list with availability filter toggle.
class DriverAssignmentScreen extends ConsumerStatefulWidget {
  const DriverAssignmentScreen({super.key});

  @override
  ConsumerState<DriverAssignmentScreen> createState() =>
      _DriverAssignmentScreenState();
}

class _DriverAssignmentScreenState
    extends ConsumerState<DriverAssignmentScreen> {
  bool _onlineOnly = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final driversState = ref.watch(driversProvider);
    final drivers = _onlineOnly
        ? driversState.availableDrivers
        : driversState.drivers;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        foregroundColor: colors.onBackground,
        elevation: 0,
        title: Text(
          'Drivers',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: Column(
        children: [
          // Online filter toggle
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedFilterHorizontal,
                  size: 18,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Online only',
                  style:
                      AppTypography.body.copyWith(color: colors.onSurface),
                ),
                const Spacer(),
                Switch.adaptive(
                  value: _onlineOnly,
                  onChanged: (v) => setState(() => _onlineOnly = v),
                  activeColor: colors.accent,
                ),
              ],
            ),
          ),
          Divider(color: colors.outlineVariant, height: 1),

          // Driver list
          Expanded(
            child: drivers.isEmpty
                ? EmptyState(
                    heading: 'No drivers found',
                    body: _onlineOnly
                        ? 'No drivers are currently online.'
                        : 'No drivers registered yet.',
                    icon: HugeIcons.strokeRoundedDeliveryTruck02,
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    itemCount: drivers.length,
                    separatorBuilder: (_, __) =>
                        Divider(color: colors.outlineVariant),
                    itemBuilder: (context, index) {
                      return DriverListTile(
                        driver: drivers[index],
                        showAssignButton: false,
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
