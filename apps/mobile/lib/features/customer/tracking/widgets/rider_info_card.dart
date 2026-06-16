import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:url_launcher/url_launcher.dart';

/// Card displaying rider info, vehicle details, and call action.
class RiderInfoCard extends StatelessWidget {
  const RiderInfoCard({
    super.key,
    this.riderName = 'Juan Reyes',
    this.vehicleType = 'Motorcycle',
    this.plateNumber = 'ABC 1234',
    this.phoneNumber = '+639181234567',
    this.eta = '~10 min',
    this.onChat,
  });

  final String riderName;
  final String vehicleType;
  final String plateNumber;
  final String phoneNumber;
  final String eta;
  final VoidCallback? onChat;

  Future<void> _callRider() async {
    final uri = Uri.parse('tel:$phoneNumber');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Rider avatar
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    riderName.isNotEmpty ? riderName[0].toUpperCase() : 'D',
                    style: AppTypography.h3.copyWith(color: colors.accent),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      riderName,
                      style: AppTypography.h3.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '$vehicleType  ·  $plateNumber',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),
              // ETA badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Arriving in $eta',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          // Phone number
          Row(
            children: [
              HugeIcon(
                icon: HugeIcons.strokeRoundedCall,
                size: 16,
                color: colors.onSurfaceDim,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                phoneNumber,
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (onChat != null) ...[
            AppButton(
              label: 'Chat Rider',
              icon: HugeIcons.strokeRoundedMessage01,
              variant: AppButtonVariant.primary,
              isFullWidth: true,
              onTap: onChat,
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          AppButton(
            label: 'Call Rider',
            icon: HugeIcons.strokeRoundedCall,
            variant: AppButtonVariant.secondary,
            isFullWidth: true,
            onTap: _callRider,
          ),
        ],
      ),
    );
  }
}
