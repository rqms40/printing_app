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

class BetaLockedScreen extends ConsumerStatefulWidget {
  const BetaLockedScreen({super.key});

  @override
  ConsumerState<BetaLockedScreen> createState() => _BetaLockedScreenState();
}

class _BetaLockedScreenState extends ConsumerState<BetaLockedScreen> {
  File? _photoFile;
  bool _sharedOnSocial = false;
  bool _submitting = false;
  bool _photoSubmitted = false;

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
      setState(() {
        _submitting = false;
        _photoSubmitted = true;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Thanks! See you at launch.')),
        );
      }
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    }
  }

  Future<void> _signOut() async {
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final betaLocked = ref.watch(authProvider).betaLocked;
    final fullName = betaLocked?.fullName ?? 'Beta Tester';
    final photoAlreadyUploaded =
        _photoSubmitted || (betaLocked?.betaPhotoUploaded ?? false);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: Stack(
            children: [
              SingleChildScrollView(
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
                          // Greeting
                          Text(
                            'Hi $fullName, thanks for testing.',
                            style: AppTypography.h2.copyWith(
                              color: colors.onBackground,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Your full-release access opens at launch.',
                            style: AppTypography.body.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                            textAlign: TextAlign.center,
                          ),

                          const SizedBox(height: AppSpacing.lg),

                          // Conditional: photo card or success badge
                          if (photoAlreadyUploaded) ...[
                            _PhotoReceivedBadge(colors: colors),
                          ] else ...[
                            BetaPhotoUploadCard(
                              photoFile: _photoFile,
                              onPick: _pickPhoto,
                              onReplace: _pickPhoto,
                            ),
                            if (_photoFile != null) ...[
                              const SizedBox(height: AppSpacing.md),
                              SizedBox(
                                height: 52,
                                child: ElevatedButton(
                                  onPressed:
                                      _submitting ? null : _submit,
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
                                          'Submit photo',
                                          style: AppTypography.button.copyWith(
                                            color: colors.accentOnColor,
                                          ),
                                        ),
                                ),
                              ),
                            ],
                          ],

                          const SizedBox(height: AppSpacing.md),

                          // Share row (always shown)
                          BetaShareRow(
                            onShare: _handleShare,
                            onCopyLink: _handleCopyLink,
                            onOpenChannel: _handleOpenChannel,
                          ),

                          // Extra bottom padding for sign-out link
                          const SizedBox(height: AppSpacing.xxl),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Corner sign-out link
              Positioned(
                top: 12,
                right: 16,
                child: SafeArea(
                  child: TextButton(
                    onPressed: _signOut,
                    child: Text(
                      'Sign out',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhotoReceivedBadge extends StatelessWidget {
  const _PhotoReceivedBadge({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.success.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle_rounded, size: 18, color: colors.success),
          const SizedBox(width: 8),
          Text(
            'Photo received',
            style: AppTypography.body.copyWith(
              color: colors.success,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
