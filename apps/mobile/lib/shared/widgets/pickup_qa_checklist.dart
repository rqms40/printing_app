import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/pickup_qa_checklist.dart';
import 'package:printing_app/shared/widgets/signature_pad.dart';

/// Interactive Pickup QA checklist (supplier self-QC / rider pre-pickup).
class PickupQaChecklistWidget extends StatelessWidget {
  const PickupQaChecklistWidget({
    super.key,
    required this.value,
    required this.onChanged,
    required this.onSignatureChanged,
    this.signaturePadKey,
    this.enabled = true,
    this.signOffHint =
        'Draw your signature to confirm this quality check.',
  });

  final Map<String, bool> value;
  final ValueChanged<Map<String, bool>> onChanged;
  final ValueChanged<String?> onSignatureChanged;
  final GlobalKey<SignaturePadState>? signaturePadKey;
  final bool enabled;
  final String signOffHint;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Pickup QA Checklist',
          style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
        ),
        const SizedBox(height: 4),
        Text(
          'All checks must pass, including a drawn digital signature.',
          style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.md),
        ...pickupQaCheckboxItems.map((item) {
          final checked = value[item.key] == true;
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Material(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
              child: InkWell(
                borderRadius: AppRadius.borderMd,
                onTap: enabled
                    ? () {
                        final next = Map<String, bool>.from(value);
                        next[item.key] = !checked;
                        onChanged(next);
                      }
                    : null,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        checked
                            ? Icons.check_box
                            : Icons.check_box_outline_blank,
                        size: 22,
                        color: checked ? colors.accent : colors.onSurfaceDim,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.label,
                              style: AppTypography.caption.copyWith(
                                color: colors.onBackground,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.whatToVerify,
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: AppSpacing.sm),
        SignaturePad(
          key: signaturePadKey,
          enabled: enabled,
          onChanged: onSignatureChanged,
          hint: signOffHint,
        ),
      ],
    );
  }
}
