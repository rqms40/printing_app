import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Privacy Policy',
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
              'Privacy Policy',
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
              'Overview',
              'GRID ("we", "our", or "us") is committed to protecting '
                  'your personal data in compliance with Republic Act No. 10173, '
                  'also known as the Data Privacy Act of 2012 of the Philippines, '
                  'and its Implementing Rules and Regulations. This Privacy Policy '
                  'explains how we collect, use, store, and protect your personal '
                  'information when you use our mobile application.',
            ),
            _section(
              colors,
              '1. Data Collection',
              'We collect the following types of personal information:\n\n'
                  'Account Information: Full name, email address, phone number, '
                  'date of birth, and gender provided during registration.\n\n'
                  'Delivery Addresses: Street address, barangay, city, province, '
                  'zip code, and landmark details for order delivery.\n\n'
                  'Order Data: Files uploaded for printing, order specifications, '
                  'and transaction history.\n\n'
                  'Payment Information: Payment method preferences and transaction '
                  'references (we do not store credit card or e-wallet credentials).\n\n'
                  'Device and Usage Data: Device type, operating system, app usage '
                  'patterns, and crash reports for service improvement.',
            ),
            _section(
              colors,
              '2. Use of Information',
              'Your personal data is used for the following purposes:\n\n'
                  'Order Fulfillment: Processing, printing, and delivering your orders.\n\n'
                  'Account Management: Maintaining your user profile and preferences.\n\n'
                  'Communication: Sending order updates, delivery notifications, '
                  'and promotional offers (with your consent).\n\n'
                  'Service Improvement: Analyzing usage patterns to enhance the app '
                  'experience and printing services.\n\n'
                  'Legal Compliance: Fulfilling obligations under Philippine law, '
                  'including tax and business regulations.',
            ),
            _section(
              colors,
              '3. Data Sharing',
              'We may share your information with:\n\n'
                  'Delivery Partners: Name, phone number, and delivery address are '
                  'shared with assigned drivers to complete deliveries.\n\n'
                  'Payment Processors: Transaction data is shared with GCash and Maya '
                  'for payment processing.\n\n'
                  'We do not sell, rent, or trade your personal data to third parties '
                  'for marketing purposes.',
            ),
            _section(
              colors,
              '4. Data Retention',
              'We retain your personal data for as long as your account is active '
                  'or as needed to provide services. Order records are retained for '
                  'a minimum of three (3) years for compliance with Philippine tax '
                  'regulations. Upon account deletion, personal data is anonymized '
                  'or deleted within thirty (30) days, except where retention is '
                  'required by law.',
            ),
            _section(
              colors,
              '5. Data Security',
              'We implement appropriate technical and organizational measures to '
                  'protect your personal data against unauthorized access, alteration, '
                  'disclosure, or destruction. This includes encryption of data in '
                  'transit and at rest, secure server infrastructure, and regular '
                  'security audits. Uploaded files are stored in encrypted cloud '
                  'storage and deleted after order completion.',
            ),
            _section(
              colors,
              '6. Your Rights',
              'Under the Data Privacy Act of 2012 (RA 10173), you have the right to:\n\n'
                  'Access: Request a copy of your personal data we hold.\n\n'
                  'Correction: Request correction of inaccurate or incomplete data.\n\n'
                  'Erasure: Request deletion of your personal data, subject to legal '
                  'retention requirements.\n\n'
                  'Object: Object to the processing of your data for specific purposes.\n\n'
                  'Portability: Request your data in a structured, machine-readable format.\n\n'
                  'To exercise these rights, contact our Data Protection Officer at '
                  'privacy@gridprint.ph.',
            ),
            _section(
              colors,
              '7. Contact Information',
              'For privacy-related inquiries or concerns, please contact:\n\n'
                  'Data Protection Officer\n'
                  'GRID\n'
                  'Email: privacy@gridprint.ph\n'
                  'Phone: +63 917 123 4567\n\n'
                  'You may also file a complaint with the National Privacy Commission '
                  'of the Philippines at https://www.privacy.gov.ph.',
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
