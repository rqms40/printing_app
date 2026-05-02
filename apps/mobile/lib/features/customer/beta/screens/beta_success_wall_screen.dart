import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb, Uint8List;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/providers/beta_testimonial_provider.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_hero_illustration.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_photo_upload_card.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_share_row.dart';

class BetaSuccessWallScreen extends ConsumerStatefulWidget {
  const BetaSuccessWallScreen({super.key});

  @override
  ConsumerState<BetaSuccessWallScreen> createState() =>
      _BetaSuccessWallScreenState();
}

class _BetaSuccessWallScreenState
    extends ConsumerState<BetaSuccessWallScreen> {
  // Native path (non-web)
  File? _photoFile;
  // Web bytes + filename
  Uint8List? _photoBytes;
  String? _photoFileName;

  final bool _sharedOnSocial = true; // BetaShareRow tracks this internally now

  Future<void> _pickPhoto() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1920,
      );
      if (picked == null) return; // user cancelled — do nothing

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
      // Clear any previous upload error so the card resets
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

  Future<void> _submit() async {
    final notifier = ref.read(betaTestimonialProvider.notifier);
    try {
      await notifier.submit(
        photo: kIsWeb ? null : _photoFile,
        photoBytes: kIsWeb ? _photoBytes : null,
        photoFileName: kIsWeb ? _photoFileName : null,
        sharedOnSocial: _sharedOnSocial,
      );
      // On success the provider state has submitted=true; now sign out
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/auth/login');
    } catch (_) {
      // Error is stored in provider state; card shows the retry button.
      // The snackbar is a belt-and-suspenders fallback.
      final errMsg =
          ref.read(betaTestimonialProvider).error ?? 'Upload failed';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(errMsg)));
      }
    }
  }

  Future<void> _skip() async {
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

    final uploadState = ref.watch(betaTestimonialProvider);
    final isUploading = uploadState.isUploading;
    final canSubmit = _hasPhoto && !isUploading && !uploadState.submitted;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: SingleChildScrollView(
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
                        'You made GRID better.',
                        style: AppTypography.h1
                            .copyWith(color: colors.onBackground),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Thanks for testing — your account reopens at full release.',
                        style: AppTypography.body
                            .copyWith(color: colors.onSurfaceDim),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: AppSpacing.lg),

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

                      const SizedBox(height: AppSpacing.md),

                      const BetaShareRow(),

                      const SizedBox(height: AppSpacing.lg),

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
                                  'Submit & complete beta',
                                  style: AppTypography.button.copyWith(
                                    color: colors.accentOnColor,
                                  ),
                                ),
                        ),
                      ),

                      const SizedBox(height: AppSpacing.sm),

                      Center(
                        child: TextButton(
                          onPressed: isUploading ? null : _skip,
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
