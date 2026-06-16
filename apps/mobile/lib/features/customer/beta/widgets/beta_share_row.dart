import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/beta/beta_constants.dart';

/// Two-row share component:
///   Row 1 — 4 equal-width platform chips (Facebook / X / WhatsApp / More)
///   Row 2 — copy-link field with "Copied ✓" confirmation
class BetaShareRow extends StatefulWidget {
  const BetaShareRow({
    super.key,
    this.onShare,
    this.onCopyLink,
    this.onOpenChannel,
  });

  final VoidCallback? onShare;
  final VoidCallback? onCopyLink;
  final VoidCallback? onOpenChannel;

  @override
  State<BetaShareRow> createState() => _BetaShareRowState();
}

class _BetaShareRowState extends State<BetaShareRow> {
  bool _copied = false;
  Timer? _resetTimer;

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }

  Future<void> _launchFacebook(BuildContext ctx) async {
    final encodedUrl = Uri.encodeComponent(kBetaShareUrl);
    final encodedText = Uri.encodeComponent(kBetaShareText);
    final uri = Uri.parse(
      'https://www.facebook.com/sharer/sharer.php?u=$encodedUrl&quote=$encodedText',
    );
    await _tryLaunch(ctx, uri, 'Facebook');
    widget.onShare?.call();
  }

  Future<void> _launchTwitter(BuildContext ctx) async {
    final encodedText = Uri.encodeComponent(kBetaShareText);
    final encodedUrl = Uri.encodeComponent(kBetaShareUrl);
    final uri = Uri.parse(
      'https://twitter.com/intent/tweet?text=$encodedText&url=$encodedUrl&hashtags=GRIDGOprint,Davao',
    );
    await _tryLaunch(ctx, uri, 'X (Twitter)');
    widget.onShare?.call();
  }

  Future<void> _launchWhatsApp(BuildContext ctx) async {
    final encodedMsg = Uri.encodeComponent('$kBetaShareText $kBetaShareUrl');
    final uri = Uri.parse('https://wa.me/?text=$encodedMsg');
    await _tryLaunch(ctx, uri, 'WhatsApp');
    widget.onShare?.call();
  }

  Future<void> _shareNative() async {
    await Share.share(
      '$kBetaShareText $kBetaShareUrl',
      subject: 'GRIDGO Print',
    );
    widget.onShare?.call();
  }

  Future<void> _tryLaunch(BuildContext ctx, Uri uri, String appName) async {
    final messenger = ScaffoldMessenger.maybeOf(ctx);
    try {
      final ok = await canLaunchUrl(uri);
      if (ok) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        messenger?.showSnackBar(
            SnackBar(content: Text('Could not open $appName')));
      }
    } catch (_) {
      messenger
          ?.showSnackBar(SnackBar(content: Text('Could not open $appName')));
    }
  }

  Future<void> _copyLink(BuildContext ctx) async {
    final messenger = ScaffoldMessenger.maybeOf(ctx);
    await Clipboard.setData(const ClipboardData(text: kBetaShareUrl));
    messenger?.showSnackBar(
        const SnackBar(content: Text('Link copied — paste it anywhere!')));
    setState(() => _copied = true);
    _resetTimer?.cancel();
    _resetTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
    widget.onCopyLink?.call();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── 4 equal-width platform chips ──────────────────────────────────
        // Row + Expanded ensures every chip is exactly the same width,
        // regardless of label length (Facebook vs X).
        Row(
          children: [
            Expanded(
              child: Semantics(
                label: 'Share to Facebook',
                button: true,
                child: _PlatformChip(
                  icon: HugeIcons.strokeRoundedFacebook01,
                  label: 'Facebook',
                  brandColor: const Color(0xFF1877F2),
                  colors: colors,
                  onTap: () => _launchFacebook(context),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                label: 'Share to X (Twitter)',
                button: true,
                child: _PlatformChip(
                  icon: HugeIcons.strokeRoundedNewTwitter,
                  label: 'X',
                  // X brand is black-on-white; invert to near-white on dark.
                  brandColor:
                      isDark ? const Color(0xFFE0E0E0) : const Color(0xFF111111),
                  colors: colors,
                  onTap: () => _launchTwitter(context),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                label: 'Share to WhatsApp',
                button: true,
                child: _PlatformChip(
                  icon: HugeIcons.strokeRoundedWhatsapp,
                  label: 'WhatsApp',
                  brandColor: const Color(0xFF25D366),
                  colors: colors,
                  onTap: () => _launchWhatsApp(context),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                label: 'Share via other apps',
                button: true,
                child: _PlatformChip(
                  icon: HugeIcons.strokeRoundedShare05,
                  label: 'More',
                  brandColor: colors.brand,
                  colors: colors,
                  onTap: _shareNative,
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        // ── Copy-link row ──────────────────────────────────────────────────
        GestureDetector(
          onTap: () => _copyLink(context),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            height: 46,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _copied
                    ? const Color(0xFF4CAF50).withValues(alpha: 0.5)
                    : colors.outline,
              ),
            ),
            child: Row(
              children: [
                // Link icon
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: HugeIcon(
                    icon: HugeIcons.strokeRoundedLink01,
                    size: 16,
                    color: colors.onSurfaceDim,
                  ),
                ),
                // URL text
                Expanded(
                  child: Text(
                    kBetaShareUrl,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ),
                // Copy / Copied button
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: _copied
                        ? const Color(0xFF4CAF50).withValues(alpha: 0.15)
                        : colors.brand.withValues(alpha: 0.1),
                    borderRadius: const BorderRadius.only(
                      topRight: Radius.circular(11),
                      bottomRight: Radius.circular(11),
                    ),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
                  child: Center(
                    child: Text(
                      _copied ? 'Copied ✓' : 'Copy',
                      style: AppTypography.caption.copyWith(
                        color: _copied
                            ? const Color(0xFF4CAF50)
                            : colors.brand,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Platform chip — always fills its Expanded parent for equal widths.
// Fixed height + centred column keeps all chips visually identical.
// ---------------------------------------------------------------------------

class _PlatformChip extends StatelessWidget {
  const _PlatformChip({
    required this.icon,
    required this.label,
    required this.brandColor,
    required this.colors,
    required this.onTap,
  });

  final List<List<dynamic>> icon;
  final String label;
  final Color brandColor;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.outline),
          ),
          child: SizedBox(
            height: 76,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Fixed 40×40 icon circle — same size on every chip.
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: brandColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: HugeIcon(
                      icon: icon,
                      size: 22,
                      color: brandColor,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: 'Satoshi',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: colors.onSurface,
                    letterSpacing: 0.1,
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
