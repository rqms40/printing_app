import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/providers/beta_testimonial_provider.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_hero_illustration.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_photo_upload_card.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_share_row.dart';

const _kBetaChannelUrl = 'https://t.me/gridbeta';
const _kBetaShareUrl = 'https://gridprint.ph/beta';
const _kBetaShareMessage =
    'I just tested GRID — print delivery in Davao! Check it out: $_kBetaShareUrl';

class BetaSuccessWallScreen extends ConsumerStatefulWidget {
  const BetaSuccessWallScreen({super.key});

  @override
  ConsumerState<BetaSuccessWallScreen> createState() =>
      _BetaSuccessWallScreenState();
}

class _BetaSuccessWallScreenState extends ConsumerState<BetaSuccessWallScreen> {
  File? _photoFile;
  bool _sharedOnSocial = false;
  bool _submitting = false;

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      setState(() => _photoFile = File(picked.path));
    }
  }

  Future<void> _handleShare() async {
    await Share.share(_kBetaShareMessage);
    setState(() => _sharedOnSocial = true);
  }

  Future<void> _handleCopyLink() async {
    await Clipboard.setData(const ClipboardData(text: _kBetaShareUrl));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Link copied')),
      );
    }
    setState(() => _sharedOnSocial = true);
  }

  Future<void> _handleOpenChannel() async {
    final uri = Uri.parse(_kBetaChannelUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    setState(() => _sharedOnSocial = true);
  }

  Future<void> _submit() async {
    if (_photoFile == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(betaTestimonialProvider.notifier).submit(
            photo: _photoFile!,
            sharedOnSocial: _sharedOnSocial,
          );
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/auth/login');
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    }
  }

  Future<void> _skip() async {
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final canSubmit = _photoFile != null && !_submitting;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Hero block
                const BetaHeroIllustration(),

                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl,
                    vertical: AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Title + subtitle
                      Text(
                        'You made GRID better.',
                        style: AppTypography.h1.copyWith(
                          color: colors.onBackground,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Thanks for testing — your account reopens at full release.',
                        style: AppTypography.body.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: AppSpacing.lg),

                      // Photo upload card
                      BetaPhotoUploadCard(
                        photoFile: _photoFile,
                        onPick: _pickPhoto,
                        onReplace: _pickPhoto,
                      ),

                      const SizedBox(height: AppSpacing.md),

                      // Share row
                      BetaShareRow(
                        onShare: _handleShare,
                        onCopyLink: _handleCopyLink,
                        onOpenChannel: _handleOpenChannel,
                      ),

                      const SizedBox(height: AppSpacing.lg),

                      // CTA
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: canSubmit ? _submit : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors.accent,
                            disabledBackgroundColor: colors.disabled,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: _submitting
                              ? SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colors.accentOnColor,
                                  ),
                                )
                              : Text(
                                  'Submit & complete beta',
                                  style: AppTypography.button.copyWith(
                                    color: colors.accentOnColor,
                                  ),
                                ),
                        ),
                      ),

                      const SizedBox(height: AppSpacing.sm),

                      // Skip
                      Center(
                        child: TextButton(
                          onPressed: _submitting ? null : _skip,
                          child: Text(
                            'Skip for now',
                            style: AppTypography.body.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
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
  }
}
