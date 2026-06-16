import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb, Uint8List;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
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

class _BetaSuccessWallScreenState extends ConsumerState<BetaSuccessWallScreen>
    with TickerProviderStateMixin {
  // Native path (non-web)
  File? _photoFile;
  // Web bytes + filename
  Uint8List? _photoBytes;
  String? _photoFileName;

  final bool _sharedOnSocial = true;

  // Staggered entrance controller
  late final AnimationController _enter;
  late final Animation<double> _fadeHeadline;
  late final Animation<double> _fadePhoto;
  late final Animation<double> _fadeShare;
  late final Animation<double> _fadeCta;

  @override
  void initState() {
    super.initState();
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..forward();

    _fadeHeadline = CurvedAnimation(
      parent: _enter,
      curve: const Interval(0.0, 0.55, curve: Curves.easeOut),
    );
    _fadePhoto = CurvedAnimation(
      parent: _enter,
      curve: const Interval(0.18, 0.68, curve: Curves.easeOut),
    );
    _fadeShare = CurvedAnimation(
      parent: _enter,
      curve: const Interval(0.32, 0.82, curve: Curves.easeOut),
    );
    _fadeCta = CurvedAnimation(
      parent: _enter,
      curve: const Interval(0.48, 1.0, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  // Wraps [child] in a fade + upward slide using [anim].
  Widget _animated(Animation<double> anim, Widget child) {
    return FadeTransition(
      opacity: anim,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.06),
          end: Offset.zero,
        ).animate(anim),
        child: child,
      ),
    );
  }

  Future<void> _pickPhoto() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1920,
      );
      if (picked == null) return;

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
                'Could not open the photo library. Please check permissions.'),
          ),
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
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/auth/login');
    } catch (_) {
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

  bool get _hasPhoto => _photoBytes != null || _photoFile != null;

  @override
  Widget build(BuildContext context) {
    final uploadState = ref.watch(betaTestimonialProvider);
    final isUploading = uploadState.isUploading;
    final canSubmit = _hasPhoto && !isUploading && !uploadState.submitted;

    // Force dark/celebratory aesthetic for this one-time milestone screen
    // regardless of the device's active theme.
    return PopScope(
      canPop: false,
      child: Theme(
        data: ThemeData(brightness: Brightness.dark),
        child: Builder(
          builder: (ctx) => Scaffold(
            backgroundColor: const Color(0xFF0A0A0A),
            body: SafeArea(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const BetaHeroIllustration(),

                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 32),

                          // ── Headline ─────────────────────────────────────
                          _animated(
                            _fadeHeadline,
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'YOU MADE\nGRIDGO BETTER.',
                                  style: TextStyle(
                                    fontFamily: 'Poppins',
                                    fontSize: 38,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFFF0F0F0),
                                    letterSpacing: -1.0,
                                    height: 1.05,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Your prints, your feedback — that\'s what it took.',
                                  style: TextStyle(
                                    fontFamily: 'Satoshi',
                                    fontSize: 15,
                                    color: Color(0xFF808080),
                                    height: 1.5,
                                  ),
                                ),
                                const SizedBox(height: 20),
                                Container(
                                  width: 32,
                                  height: 3,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFDE58),
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 32),

                          // ── Photo section ─────────────────────────────────
                          _animated(
                            _fadePhoto,
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const _SectionLabel('YOUR PHOTO'),
                                const SizedBox(height: 6),
                                const Text(
                                  'Add a photo of your prints — we\'ll feature the best ones at launch.',
                                  style: TextStyle(
                                    fontFamily: 'Satoshi',
                                    fontSize: 13,
                                    color: Color(0xFF666666),
                                    height: 1.5,
                                  ),
                                ),
                                const SizedBox(height: 14),
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
                              ],
                            ),
                          ),

                          const SizedBox(height: 28),

                          // ── Share section ─────────────────────────────────
                          _animated(
                            _fadeShare,
                            const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _SectionLabel('SPREAD THE WORD'),
                                SizedBox(height: 6),
                                Text(
                                  'Tell your crew GRIDGO is coming to Davao.',
                                  style: TextStyle(
                                    fontFamily: 'Satoshi',
                                    fontSize: 13,
                                    color: Color(0xFF666666),
                                    height: 1.5,
                                  ),
                                ),
                                SizedBox(height: 14),
                                BetaShareRow(),
                              ],
                            ),
                          ),

                          const SizedBox(height: 36),

                          // ── CTA ───────────────────────────────────────────
                          _animated(
                            _fadeCta,
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                SizedBox(
                                  height: 54,
                                  child: Material(
                                    color: canSubmit
                                        ? const Color(0xFFFFDE58)
                                        : const Color(0xFF1E1E1E),
                                    borderRadius: BorderRadius.circular(14),
                                    child: InkWell(
                                      onTap: canSubmit ? _submit : null,
                                      borderRadius: BorderRadius.circular(14),
                                      child: Center(
                                        child: isUploading
                                            ? const SizedBox(
                                                width: 20,
                                                height: 20,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  color: Color(0xFF0A0A0A),
                                                ),
                                              )
                                            : Text(
                                                'Submit & complete beta',
                                                style: TextStyle(
                                                  fontFamily: 'Satoshi',
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w700,
                                                  color: canSubmit
                                                      ? const Color(0xFF0A0A0A)
                                                      : const Color(0xFF3A3A3A),
                                                  letterSpacing: 0.3,
                                                ),
                                              ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Center(
                                  child: GestureDetector(
                                    onTap: isUploading ? null : _skip,
                                    child: Text(
                                      'Skip for now',
                                      style: TextStyle(
                                        fontFamily: 'Satoshi',
                                        fontSize: 14,
                                        color: isUploading
                                            ? const Color(0xFF2A2A2A)
                                            : const Color(0xFF555555),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 32),
                              ],
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
        ),
      ),
    );
  }
}

/// Yellow vertical-bar + caps label used for section headings.
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 14,
          decoration: BoxDecoration(
            color: const Color(0xFFFFDE58),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          text,
          style: const TextStyle(
            fontFamily: 'Satoshi',
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFFFFDE58),
            letterSpacing: 2.5,
          ),
        ),
      ],
    );
  }
}
