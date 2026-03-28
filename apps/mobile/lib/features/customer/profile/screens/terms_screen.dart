import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Terms of Service',
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
              'Terms of Service',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Last updated: March 27, 2026',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _section(
              colors,
              '1. Acceptance of Terms',
              'By accessing and using the GRID mobile application '
                  '("the App"), you agree to be bound by these Terms of Service '
                  '("Terms"). If you do not agree to these Terms, please do not '
                  'use the App. GRID reserves the right to modify these '
                  'Terms at any time, and your continued use of the App constitutes '
                  'acceptance of any changes.',
            ),
            _section(
              colors,
              '2. Services Provided',
              'GRID provides an online platform for ordering printing '
                  'services, including but not limited to document printing, poster '
                  'printing, banner printing, and 3D printing. Orders may be '
                  'fulfilled through delivery or in-store pickup at designated '
                  'locations within the Philippines.',
            ),
            _section(
              colors,
              '3. User Accounts',
              'To use certain features of the App, you must create an account. '
                  'You are responsible for maintaining the confidentiality of your '
                  'account credentials and for all activities that occur under your '
                  'account. You agree to provide accurate, current, and complete '
                  'information during registration and to update such information '
                  'as necessary.',
            ),
            _section(
              colors,
              '4. Orders and Payment',
              'All orders are subject to acceptance and availability. Prices are '
                  'displayed in Philippine Pesos (PHP) and are subject to change '
                  'without notice. Payment may be made through GCash, Maya, or '
                  'Cash on Delivery. Orders are confirmed only upon successful '
                  'payment verification or acceptance of COD terms.',
            ),
            _section(
              colors,
              '5. File Upload and Intellectual Property',
              'By uploading files to the App, you represent and warrant that you '
                  'own or have the necessary rights and permissions to reproduce the '
                  'content. GRID is not responsible for verifying the '
                  'copyright status of uploaded materials. Files are stored securely '
                  'and used solely for order fulfillment.',
            ),
            _section(
              colors,
              '6. Cancellation and Refunds',
              'Orders may be cancelled before printing begins. Once printing has '
                  'started, cancellations are no longer accepted. Refunds for '
                  'eligible cancellations will be processed within 3-5 business '
                  'days to the original payment method. Delivery fees are '
                  'non-refundable once a driver has been assigned.',
            ),
            _section(
              colors,
              '7. Delivery Terms',
              'Delivery is available within serviceable areas in the Philippines. '
                  'Estimated delivery times are provided for reference only and are '
                  'not guaranteed. GRID is not liable for delays caused by '
                  'traffic, weather, or other circumstances beyond our control.',
            ),
            _section(
              colors,
              '8. Limitation of Liability',
              'GRID shall not be liable for any indirect, incidental, '
                  'special, or consequential damages arising out of or in connection '
                  'with the use of the App or services. Our total liability shall '
                  'not exceed the amount paid by you for the specific order giving '
                  'rise to the claim.',
            ),
            _section(
              colors,
              '9. Governing Law',
              'These Terms shall be governed by and construed in accordance with '
                  'the laws of the Republic of the Philippines. Any disputes arising '
                  'from these Terms shall be resolved in the courts of Metro Manila.',
            ),
            _section(
              colors,
              '10. Contact Information',
              'For questions or concerns regarding these Terms, please contact us '
                  'at support@gridprint.ph or call +63 917 123 4567.',
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _section(AppColorSet colors, String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: AppTypography.body.copyWith(
              color: colors.onSurface,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
