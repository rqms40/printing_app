import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

enum PasswordStrength { empty, weak, fair, strong }

/// Scores a password for the strength meter. Mirrors the 8-char minimum the
/// flow enforces: under 8 is weak, 8+ is fair, and 10+ with both a letter and
/// a digit is strong.
PasswordStrength scorePassword(String password) {
  if (password.isEmpty) return PasswordStrength.empty;
  if (password.length < 8) return PasswordStrength.weak;
  final hasLetter = password.contains(RegExp(r'[A-Za-z]'));
  final hasDigit = password.contains(RegExp(r'\d'));
  if (password.length >= 10 && hasLetter && hasDigit) {
    return PasswordStrength.strong;
  }
  return PasswordStrength.fair;
}

/// Three-segment bar + label reflecting [scorePassword].
class PasswordStrengthMeter extends StatelessWidget {
  const PasswordStrengthMeter({super.key, required this.strength});

  final PasswordStrength strength;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final (filled, label, color) = switch (strength) {
      PasswordStrength.empty => (0, '', colors.onSurfaceDim),
      PasswordStrength.weak => (1, 'Too short', colors.error),
      PasswordStrength.fair => (2, 'Fair', colors.warning),
      PasswordStrength.strong => (3, 'Strong', colors.success),
    };
    return Semantics(
      label: strength == PasswordStrength.empty
          ? null
          : 'Password strength: $label',
      child: Row(
        children: [
          for (var i = 0; i < 3; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: i < filled
                      ? color
                      : colors.outline.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ],
          if (label.isNotEmpty) ...[
            const SizedBox(width: 8),
            Text(
              label,
              style: AppTypography.caption.copyWith(color: color, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}
