import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/driver_management/providers/drivers_provider.dart';
import 'package:printing_app/features/admin/driver_management/widgets/driver_list_tile.dart';

/// Bottom sheet listing available drivers for order assignment.
class AssignmentDialog extends ConsumerWidget {
  const AssignmentDialog({
    super.key,
    required this.orderId,
  });

  final String orderId;

  /// Show the assignment bottom sheet.
  static Future<void> show(BuildContext context, {required String orderId}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadius.lg),
        ),
      ),
      builder: (_) => AssignmentDialog(orderId: orderId),
    );
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final driversState = ref.watch(driversProvider);
    final availableDrivers = driversState.availableDrivers;

    return SafeArea(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.6,
        ),
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.disabled,
                  borderRadius: AppRadius.borderFull,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Assign Driver',
                  style:
                      AppTypography.h3.copyWith(color: colors.onBackground),
                ),
                IconButton(
                  icon: Icon(HugeIcons.strokeRoundedCancel01, color: colors.onSurfaceDim),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            // Driver list
            if (availableDrivers.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
                child: Center(
                  child: Text(
                    'No drivers available',
                    style: AppTypography.body
                        .copyWith(color: colors.onSurfaceDim),
                  ),
                ),
              )
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: availableDrivers.length,
                  separatorBuilder: (_, __) =>
                      Divider(color: colors.outlineVariant),
                  itemBuilder: (context, index) {
                    final driver = availableDrivers[index];
                    return DriverListTile(
                      driver: driver,
                      onAssign: () {
                        ref
                            .read(driversProvider.notifier)
                            .assignDriver(orderId, driver.id);
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'Driver assigned successfully',
                              style: AppTypography.body
                                  .copyWith(color: Colors.white),
                            ),
                            backgroundColor: colors.accent,
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
