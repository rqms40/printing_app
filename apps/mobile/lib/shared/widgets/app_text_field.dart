import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Editorial-style text field with underline border for GRIDGO.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.label,
    this.hintText,
    this.errorText,
    this.obscureText = false,
    this.prefixIcon,
    this.suffixIcon,
    this.onChanged,
    this.onSubmitted,
    this.keyboardType,
    this.textInputAction,
    this.maxLines = 1,
    this.enabled = true,
    this.autofocus = false,
    this.focusNode,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hintText;
  final String? errorText;
  final bool obscureText;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final int maxLines;
  final bool enabled;
  final bool autofocus;
  final FocusNode? focusNode;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final hasError = errorText != null && errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            onChanged: onChanged,
            onSubmitted: onSubmitted,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            maxLines: maxLines,
            enabled: enabled,
            autofocus: autofocus,
            focusNode: focusNode,
            style: AppTypography.body.copyWith(color: colors.onBackground),
            cursorColor: colors.accent,
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: AppTypography.body.copyWith(
                color: colors.onSurfaceDim,
              ),
              prefixIcon: prefixIcon,
              suffixIcon: suffixIcon,
              contentPadding: const EdgeInsets.symmetric(
                vertical: AppSpacing.sm,
              ),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: colors.outline),
              ),
              focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: colors.accent, width: 2),
              ),
              errorBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: colors.error),
              ),
              focusedErrorBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: colors.error, width: 2),
              ),
              disabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: colors.disabled),
              ),
              errorText: hasError ? errorText : null,
              errorStyle: AppTypography.caption.copyWith(color: colors.error),
            ),
          ),
        ),
      ],
    );
  }
}
