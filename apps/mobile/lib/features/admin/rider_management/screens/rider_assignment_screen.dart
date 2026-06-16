import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/rider_management/providers/riders_provider.dart';
import 'package:printing_app/features/admin/rider_management/widgets/rider_list_tile.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

/// Full screen rider list with availability filter toggle.
class RiderAssignmentScreen extends ConsumerStatefulWidget {
  const RiderAssignmentScreen({super.key});

  @override
  ConsumerState<RiderAssignmentScreen> createState() =>
      _RiderAssignmentScreenState();
}

class _RiderAssignmentScreenState
    extends ConsumerState<RiderAssignmentScreen> {
  bool _onlineOnly = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final ridersState = ref.watch(ridersProvider);
    final riders = _onlineOnly
        ? ridersState.availableRiders
        : ridersState.riders;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        foregroundColor: colors.onBackground,
        elevation: 0,
        title: Text(
          'Riders',
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
                  activeTrackColor: colors.accent,
                ),
              ],
            ),
          ),
          Divider(color: colors.outlineVariant, height: 1),

          // Rider list
          Expanded(
            child: riders.isEmpty
                ? EmptyState(
                    heading: 'No riders found',
                    body: _onlineOnly
                        ? 'No riders are currently online.'
                        : 'No riders registered yet.',
                    icon: HugeIcons.strokeRoundedDeliveryTruck02,
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    itemCount: riders.length,
                    separatorBuilder: (_, _) =>
                        Divider(color: colors.outlineVariant),
                    itemBuilder: (context, index) {
                      return RiderListTile(
                        rider: riders[index],
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
