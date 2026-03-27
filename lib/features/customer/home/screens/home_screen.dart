import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/customer/home/widgets/recent_orders_section.dart';
import 'package:printing_app/features/customer/home/widgets/service_card.dart';
import 'package:printing_app/shared/widgets/section_header.dart';

/// Customer home screen with editorial hero banner, service cards, and recent orders.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.lg),

              // Greeting header
              Text(
                '${_greeting()},',
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              Text(
                'Hello, Maria',
                style: AppTypography.h2.copyWith(
                  color: colors.onBackground,
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              // Hero banner
              const HeroBanner(),

              const SizedBox(height: AppSpacing.lg),

              // Services section
              SectionHeader(title: 'Services'),

              ServiceCard(
                title: 'Paper Printing',
                description: 'Documents, posters, banners & more',
                icon: HugeIcons.strokeRoundedFile02,
                onTap: () {
                  context.push('/customer/order/new');
                },
              ),

              const SizedBox(height: AppSpacing.md),

              ServiceCard(
                title: '3D Printing',
                description: 'Custom models, prototypes & figurines',
                icon: HugeIcons.strokeRoundedPackageDelivered,
                onTap: () {
                  context.push('/customer/order/new');
                },
              ),

              const SizedBox(height: AppSpacing.lg),

              // Recent orders section
              const RecentOrdersSection(),

              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}
