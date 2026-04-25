import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';

class BetaIndicator extends ConsumerWidget {
  const BetaIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final betaAsync = ref.watch(betaStatusProvider);

    return betaAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (status) {
        if (status == null || !status.globallyEnabled || !status.isBetaUser) {
          return const SizedBox.shrink();
        }

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final brandColor =
            isDark ? AppColors.brandDark : AppColors.brandLight;

        return Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: AppRadius.borderFull,
            border: Border.all(
              color: AppColors.brandDark.withValues(alpha: 0.25),
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'BETA',
                style: AppTypography.overline.copyWith(
                  color: brandColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              if (status.rank != null) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xs,
                  ),
                  child: Text(
                    '|',
                    style: AppTypography.overline.copyWith(
                      color: Colors.white.withValues(alpha: 0.25),
                      fontSize: 10,
                    ),
                  ),
                ),
                Text(
                  '#${status.rank}',
                  style: AppTypography.overline.copyWith(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ],
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .shimmer(
              duration: const Duration(seconds: 3),
              color: const Color(0xFFFFDE58).withValues(alpha: 0.2),
            );
      },
    );
  }
}
