import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/shared/providers/api_status_provider.dart';
import 'package:printing_app/shared/providers/connectivity_provider.dart';
import 'package:printing_app/shared/widgets/offline_banner.dart';
import 'app_bottom_nav.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ScaffoldWithNav
// ─────────────────────────────────────────────────────────────────────────────

/// Shell widget that wraps each role's tab navigation.
///
/// Owns:
/// - Online/API banners
/// - Quick-action panel animation + backdrop
/// - Teardrop connector between the panel and the close-FAB
/// - Close-FAB overlay (pastel-red ×) that replaces the nav bar FAB when open
class ScaffoldWithNav extends ConsumerStatefulWidget {
  const ScaffoldWithNav({
    super.key,
    required this.child,
    required this.currentIndex,
    required this.items,
    required this.onTap,
    this.showFab = false,
  });

  final Widget child;
  final int currentIndex;
  final List<NavItem> items;
  final ValueChanged<int> onTap;

  /// When true the yellow floating FAB, quick-action panel, and backdrop are
  /// rendered. Set false for driver / admin shells.
  final bool showFab;

  @override
  ConsumerState<ScaffoldWithNav> createState() => _ScaffoldWithNavState();
}

class _ScaffoldWithNavState extends ConsumerState<ScaffoldWithNav>
    with SingleTickerProviderStateMixin {
  bool _isOpen = false;

  late final AnimationController _panelCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;
  late final Animation<double> _blurAnim;
  // Scale animation for the teardrop growing upward from the FAB
  late final Animation<double> _tearScaleAnim;

  // ── Nav-bar geometry (matches AppBottomNav's SafeArea + Padding layout) ──
  // content row height = 56px, top-padding = 6px, SafeArea min-bottom = 4px
  static const _navContentH = 56.0;
  static const _navTopPad = 6.0;
  static const _navMinBot = 4.0;
  static const _navIntrinsicH = _navContentH + _navTopPad + _navMinBot; // 66

  static const _fabR = 24.0;    // radius of the close-FAB circle (48/2)

  @override
  void initState() {
    super.initState();
    _panelCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _fadeAnim =
        CurvedAnimation(parent: _panelCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.22),
      end: Offset.zero,
    ).animate(
        CurvedAnimation(parent: _panelCtrl, curve: Curves.easeOutCubic));
    _blurAnim = Tween<double>(begin: 0, end: 8).animate(
        CurvedAnimation(parent: _panelCtrl, curve: Curves.easeOut));
    _tearScaleAnim = Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(parent: _panelCtrl, curve: Curves.easeOutBack));
  }

  @override
  void dispose() {
    _panelCtrl.dispose();
    super.dispose();
  }

  void _onToggle(bool open) {
    setState(() => _isOpen = open);
    open ? _panelCtrl.forward() : _panelCtrl.reverse();
  }

  void _close() => _onToggle(false);

  void _handleActionTap(QuickActionItem qa) {
    _close();
    Future.delayed(const Duration(milliseconds: 200), () {
      if (!mounted) return;
      if (qa.isComingSoon) {
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(
            SnackBar(
              content: const Text('Coming soon!'),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 1),
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          );
        return;
      }
      if (qa.route != null) {
        qa.useGo ? context.go(qa.route!) : context.push(qa.route!);
      }
    });
  }

  // Floating FAB dimensions
  static const _openFabSize = 56.0;
  static const _openFabR = _openFabSize / 2; // 28

  @override
  Widget build(BuildContext context) {
    final isOnline = ref.watch(connectivityProvider);
    final isApiUp = ref.watch(apiStatusProvider);

    final bottomInset = MediaQuery.of(context).viewPadding.bottom;

    // Total nav bar height (reported by SafeArea + padding)
    final navBarHeight = _navIntrinsicH + bottomInset;

    // Open-FAB: bottom edge 20 px inside the nav bar so the button rises
    // above the bar — centre is ~8 px above the bar's top edge.
    final openFabBottom = navBarHeight - 20;

    // Close-FAB:
    //   Centre from screen bottom = 38 + bottomInset
    //   Container height = fabDiameter = 48
    //   Container bottom from screen = centre - fabR = 14 + bottomInset
    final closeFabBottom = 14.0 + bottomInset;

    return Scaffold(
      body: Stack(
        children: [
          // ── Main content ─────────────────────────────────────────────────
          Column(
            children: [
              AnimatedSize(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                child: isOnline
                    ? const SizedBox.shrink()
                    : const OfflineBanner(),
              ),
              AnimatedSize(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                child: isOnline && !isApiUp
                    ? const OfflineBanner(
                        message: 'Demo mode — server offline',
                        useInfoColor: true,
                      )
                    : const SizedBox.shrink(),
              ),
              Expanded(
                child: MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                    padding: MediaQuery.of(context).padding.copyWith(
                          bottom: navBarHeight,
                        ),
                  ),
                  child: widget.child,
                ),
              ),
            ],
          ),

          // ── Backdrop (blur + dark tint, tap to close) ────────────────────
          if (widget.showFab)
            AnimatedBuilder(
              animation: _panelCtrl,
              builder: (context, child) {
                if (_panelCtrl.value == 0) return const SizedBox.shrink();
                return Positioned.fill(
                  child: GestureDetector(
                    onTap: _close,
                    child: BackdropFilter(
                      filter: ImageFilter.blur(
                        sigmaX: _blurAnim.value,
                        sigmaY: _blurAnim.value,
                      ),
                      child: FadeTransition(
                        opacity: _fadeAnim,
                        child: Container(
                            color: Colors.black.withValues(alpha: 0.32)),
                      ),
                    ),
                  ),
                );
              },
            ),

          // ── Yellow quick-action panel ───────────────────────────────────
          if (widget.showFab)
            QuickActionPanel(
              slideAnim: _slideAnim,
              fadeAnim: _fadeAnim,
              navBarHeight: navBarHeight,
              onActionTap: _handleActionTap,
            ),

          // ── Nav bar ──────────────────────────────────────────────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AppBottomNav(
              items: widget.items,
              currentIndex: widget.currentIndex,
              showFab: widget.showFab,
              onTap: (i) {
                _close();
                widget.onTap(i);
              },
            ),
          ),

          // ── Floating open-FAB (yellow +, rises above the nav bar) ────────
          if (widget.showFab)
            Positioned(
              bottom: openFabBottom,
              left: 0,
              right: 0,
              height: _openFabSize,
              child: Center(
                child: AnimatedOpacity(
                  opacity: _isOpen ? 0.0 : 1.0,
                  duration: const Duration(milliseconds: 200),
                  child: IgnorePointer(
                    ignoring: _isOpen,
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        _onToggle(true);
                      },
                      child: Container(
                        width: _openFabSize,
                        height: _openFabSize,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFDE58),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFFFDE58)
                                  .withValues(alpha: 0.55),
                              blurRadius: 18,
                              spreadRadius: 0,
                              offset: const Offset(0, 4),
                            ),
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.14),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.add_rounded,
                          size: 30,
                          color: Colors.black,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // ── Close-FAB (pastel-red ×, centred on teardrop bottom circle) ─
          if (widget.showFab)
            Positioned(
              bottom: closeFabBottom,
              left: 0,
              right: 0,
              height: _fabR * 2, // 48px
              child: AnimatedBuilder(
                animation: _panelCtrl,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _tearScaleAnim.value,
                    child: FadeTransition(opacity: _fadeAnim, child: child),
                  );
                },
                child: Center(
                  child: GestureDetector(
                    onTap: _close,
                    child: Container(
                      width: _fabR * 2,
                      height: _fabR * 2,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFF6B6B), // pastel red
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color:
                                const Color(0xFFFF6B6B).withValues(alpha: 0.5),
                            blurRadius: 14,
                            spreadRadius: 1,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 24,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
