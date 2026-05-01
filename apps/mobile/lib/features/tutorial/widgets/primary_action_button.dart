import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';

class PrimaryActionButton extends StatelessWidget {
  const PrimaryActionButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.brand,
          foregroundColor: Colors.black,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          elevation: 0,
          shadowColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          textStyle: const TextStyle(
            fontFamily: 'Satoshi',
            fontWeight: FontWeight.w800,
            fontSize: 14,
            letterSpacing: 0.3,
          ),
        ),
        child: Text(label),
      ),
    );
  }
}
