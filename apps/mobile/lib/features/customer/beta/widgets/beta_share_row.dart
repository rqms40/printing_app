import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Three share chips: native Share, Copy link, Beta Channel.
class BetaShareRow extends StatelessWidget {
  const BetaShareRow({
    super.key,
    required this.onShare,
    required this.onCopyLink,
    required this.onOpenChannel,
  });

  final VoidCallback onShare;
  final VoidCallback onCopyLink;
  final VoidCallback onOpenChannel;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return Row(
      children: [
        Expanded(
          child: _ShareChip(
            icon: HugeIcons.strokeRoundedShare05,
            label: 'Share',
            colors: colors,
            onTap: onShare,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ShareChip(
            icon: HugeIcons.strokeRoundedCopy01,
            label: 'Copy link',
            colors: colors,
            onTap: onCopyLink,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ShareChip(
            icon: HugeIcons.strokeRoundedTelegram,
            label: 'Beta Channel',
            colors: colors,
            onTap: onOpenChannel,
          ),
        ),
      ],
    );
  }
}

class _ShareChip extends StatelessWidget {
  const _ShareChip({
    required this.icon,
    required this.label,
    required this.colors,
    required this.onTap,
  });

  final List<List<dynamic>> icon;
  final String label;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.outline),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              HugeIcon(
                icon: icon,
                size: 22,
                color: colors.brand,
              ),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
