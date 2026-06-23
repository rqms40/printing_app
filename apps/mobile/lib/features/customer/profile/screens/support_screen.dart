import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:url_launcher/url_launcher.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Support & Help',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Support & Help',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ).animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.lg),
            // Contact cards
            Text(
              'Contact Us',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.md),
            _ContactCard(
              icon: HugeIcons.strokeRoundedCall,
              title: 'Phone',
              subtitle: '+63 917 123 4567',
              onTap: () => _launchUrl('tel:+639171234567'),
            ).animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.sm),
            _ContactCard(
              icon: HugeIcons.strokeRoundedMail01,
              title: 'Email',
              subtitle: 'support@gridgo.ph',
              onTap: () => _launchUrl('mailto:support@gridgo.ph'),
            ).animate()
              .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.sm),
            _ContactCard(
              icon: HugeIcons.strokeRoundedMessage01,
              title: 'Facebook Messenger',
              subtitle: '@GRIDGOPrintPH',
              onTap: AppConstants.hasCommunityUrl
                  ? () => _launchUrl(AppConstants.communityUrl)
                  : null,
            ).animate()
              .fadeIn(duration: 400.ms, delay: 180.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 180.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.xl),
            // FAQ section
            Text(
              'Frequently Asked Questions',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.md),
            const _FaqItem(
              question: 'How do I place an order?',
              answer:
                  'To place an order, go to the Home screen and tap "New Order". '
                  'Upload your file, select your printing preferences (paper size, '
                  'color mode, quantity, etc.), choose delivery or pickup, and '
                  'proceed to payment. You will receive a confirmation once your '
                  'order is placed.',
            ),
            const _FaqItem(
              question: 'What payment methods are accepted?',
              answer:
                  'We accept GCash, Maya (formerly PayMaya), and Cash on Delivery (COD). '
                  'For GCash and Maya, you will be redirected to complete the payment '
                  'through the respective app. COD is available for delivery orders only.',
            ),
            const _FaqItem(
              question: 'How long does printing take?',
              answer:
                  'Standard document printing typically takes 1-2 hours. Poster and '
                  'banner orders may take 2-4 hours depending on size and quantity. '
                  '3D printing orders can take 4-24 hours depending on complexity. '
                  'You will receive notifications as your order progresses.',
            ),
            const _FaqItem(
              question: 'Can I cancel my order?',
              answer:
                  'You can cancel your order as long as printing has not yet started. '
                  'Once printing is in progress, cancellation is no longer available. '
                  'Refunds for cancelled orders paid via GCash or Maya are processed '
                  'within 3-5 business days.',
            ),
            const _FaqItem(
              question: 'What file formats are supported?',
              answer:
                  'For document and poster printing, we support PDF, JPEG, PNG, and '
                  'TIFF formats. For 3D printing, we support STL, OBJ, and 3MF formats. '
                  'Files should be under 50MB for standard prints and 100MB for 3D prints.',
            ),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final dynamic icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: BorderRadius.circular(20),
            ),
            child: HugeIcon(icon: icon, size: 20, color: colors.accent),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ],
            ),
          ),
          HugeIcon(
            icon: HugeIcons.strokeRoundedArrowRight01,
            size: 18,
            color: colors.onSurfaceDim,
          ),
        ],
      ),
    );
  }
}

class _FaqItem extends StatelessWidget {
  const _FaqItem({
    required this.question,
    required this.answer,
  });

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 0),
      childrenPadding: const EdgeInsets.only(
        bottom: AppSpacing.md,
      ),
      title: Text(
        question,
        style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
      ),
      iconColor: colors.onSurfaceDim,
      collapsedIconColor: colors.onSurfaceDim,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            answer,
            style: AppTypography.body.copyWith(color: colors.onSurface),
          ),
        ),
      ],
    );
  }
}
