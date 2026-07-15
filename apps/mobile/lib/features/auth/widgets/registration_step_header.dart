import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/widgets/registration_mark.dart';

/// Header shared by every registration step: the registration-mark progress
/// row, a print-job coordinate (`PLATE 02 / 05`), the step title, and an
/// optional subtitle. Replaces the old undraw hero illustrations.
class RegistrationStepHeader extends StatelessWidget {
  const RegistrationStepHeader({
    super.key,
    required this.index,
    required this.total,
    required this.plateLabel,
    required this.title,
    this.subtitle,
  });

  final int index;
  final int total;
  final String plateLabel;
  final String title;
  final String? subtitle;

  String _pad(int n) => n.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RegistrationMarkRow(total: total, completed: index, current: index),
        const SizedBox(height: AppSpacing.md),
        Text(
          'PLATE ${_pad(index + 1)} / ${_pad(total)} · $plateLabel',
          style: AppTypography.overline.copyWith(
            color: colors.onSurfaceDim,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          title,
          style: AppTypography.display.copyWith(
            color: colors.onBackground,
            height: 1.05,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle!,
            style: AppTypography.bodyLarge.copyWith(color: colors.onSurface),
          ),
        ],
      ],
    );
  }
}
