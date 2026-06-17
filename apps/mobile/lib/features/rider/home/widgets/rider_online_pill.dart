import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';

/// Online/Offline availability toggle. Occupies the header slot where the
/// customer home shows its credits chip.
class RiderOnlinePill extends ConsumerWidget {
  const RiderOnlinePill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final online = ref.watch(riderProfileProvider).isAvailable;
    final accent = online ? colors.success : colors.onSurfaceDim;

    return GestureDetector(
      onTap: () =>
          ref.read(riderProfileProvider.notifier).setAvailability(!online),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: online
              ? colors.success.withValues(alpha: 0.14)
              : colors.surfaceVariant,
          borderRadius: AppRadius.borderMd,
          border: Border.all(
            color: online
                ? colors.success.withValues(alpha: 0.55)
                : colors.outline.withValues(alpha: 0.3),
            width: 0.75,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(
              online ? 'Online' : 'Offline',
              style: AppTypography.bodyBold.copyWith(
                color: accent,
                fontSize: 12,
                height: 1.0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
