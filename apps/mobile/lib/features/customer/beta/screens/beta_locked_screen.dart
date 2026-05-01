import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
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
  // Native path (non-web)
  File? _photoFile;
  // Web bytes + filename
  Uint8List? _photoBytes;
  String? _photoFileName;

  bool _sharedOnSocial = false;

  Future<void> _pickPhoto() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1920,
      );
      if (picked == null) return; // user cancelled

      if (kIsWeb) {
        final bytes = await picked.readAsBytes();
        setState(() {
          _photoBytes = bytes;
          _photoFileName = picked.name;
          _photoFile = null;
        });
      } else {
        setState(() {
          _photoFile = File(picked.path);
          _photoBytes = null;
          _photoFileName = null;
        });
      }
      ref.read(betaTestimonialProvider.notifier).clearError();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Could not open the photo library. Please check permissions.')),
        );
      }
    }
  }

  Future<void> _handleShare() async {
    await Share.share(_kBetaShareMessage);
    setState(() => _sharedOnSocial = true);
  }

  Future<void> _handleCopyLink() async {
    await Clipboard.setData(const ClipboardData(text: _kBetaShareUrl));
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Link copied')));
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
    final notifier = ref.read(betaTestimonialProvider.notifier);
    try {
      await notifier.submit(
        photo: kIsWeb ? null : _photoFile,
        photoBytes: kIsWeb ? _photoBytes : null,
        photoFileName: kIsWeb ? _photoFileName : null,
        sharedOnSocial: _sharedOnSocial,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Thanks! See you at launch.')),
        );
      }
    } catch (_) {
      final errMsg =
          ref.read(betaTestimonialProvider).error ?? 'Upload failed';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(errMsg)));
      }
    }
  }

  Future<void> _signOut() async {
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/auth/login');
  }

  bool get _hasPhoto =>
      (kIsWeb ? _photoBytes != null : _photoFile != null) ||
      _photoBytes != null ||
      _photoFile != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final betaLocked = ref.watch(authProvider).betaLocked;
    final fullName = betaLocked?.fullName ?? 'Beta Tester';

    final uploadState = ref.watch(betaTestimonialProvider);
    final isUploading = uploadState.isUploading;
    // Photo was already uploaded if: server flag OR provider just succeeded
    final photoAlreadyUploaded =
        uploadState.submitted || (betaLocked?.betaPhotoUploaded ?? false);

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
                    const BetaHeroIllustration(),

                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xl,
                        vertical: AppSpacing.lg,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Hi $fullName, thanks for testing.',
                            style: AppTypography.h2
                                .copyWith(color: colors.onBackground),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Your full-release access opens at launch.',
                            style: AppTypography.body
                                .copyWith(color: colors.onSurfaceDim),
                            textAlign: TextAlign.center,
                          ),

                          const SizedBox(height: AppSpacing.lg),

                          if (photoAlreadyUploaded) ...[
                            _PhotoReceivedBadge(colors: colors),
                          ] else ...[
                            BetaPhotoUploadCard(
                              photoFile: _photoFile,
                              photoBytes: _photoBytes,
                              uploadProgress: uploadState.uploadProgress,
                              uploadError: uploadState.error,
                              uploadDone: uploadState.submitted,
                              onPick: _pickPhoto,
                              onReplace: _pickPhoto,
                              onRetry: _submit,
                            ),
                            if (_hasPhoto) ...[
                              const SizedBox(height: AppSpacing.md),
                              SizedBox(
                                height: 52,
                                child: ElevatedButton(
                                  onPressed:
                                      isUploading ? null : _submit,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: colors.accent,
                                    disabledBackgroundColor: colors.disabled,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                  child: isUploading
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

                          BetaShareRow(
                            onShare: _handleShare,
                            onCopyLink: _handleCopyLink,
                            onOpenChannel: _handleOpenChannel,
                          ),

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
