import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
/// Rider home header — date overline + greeting + bell.
/// Mirrors the customer home header layout.
class RiderHomeHeader extends StatelessWidget {
  const RiderHomeHeader({super.key, required this.firstName});

  final String firstName;

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }

  String _formattedDate() {
    final now = DateTime.now();
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
        'SATURDAY', 'SUNDAY'];
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _formattedDate(),
                style: AppTypography.overline.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 2),
              Text.rich(
                TextSpan(
                  style: AppTypography.h2.copyWith(color: colors.onBackground),
                  children: [
                    TextSpan(text: '${_greeting()} '),
                    TextSpan(
                      text: firstName,
                      style: AppTypography.h2.copyWith(color: colors.brand),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => context.go('/rider/notifications'),
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
            ),
            child: Center(
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedNotification02,
                size: 22,
                color: colors.onBackground,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
