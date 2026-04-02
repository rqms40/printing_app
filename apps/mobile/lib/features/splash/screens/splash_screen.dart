import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';

/// Splash screen with animated GRID logo.
///
/// Animation sequence:
///   1. Dots appear one-by-one in spiral order, each starting as a ghost
///      (pale) then filling to its final color
///   2. After all 9 dots are lit, "GRID" wordmark fades in below
///   3. Subtitle fades in
///   4. Everything fades out → navigate (auto-login or login screen)
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  // Animation controllers for each dot + wordmark + fadeout
  late final List<AnimationController> _dotControllers;
  late final AnimationController _expandController;
  late final AnimationController _yellowTextController;
  late final AnimationController _fadeOutController;
  late final AudioPlayer _introPlayer;
  late final AudioPlayer _outroPlayer;

  final GlobalKey _yellowDotKey = GlobalKey();
  final GlobalKey _stackKey = GlobalKey();
  Offset? _yellowDotPosition;

  // Dot appearance order (row, col) — spiral from bottom-left
  static const _dotOrder = [
    (2, 0), // bottom-left
    (1, 0), // left-middle
    (0, 0), // top-left
    (0, 1), // top-middle
    (1, 1), // center
    (2, 1), // bottom-middle
    (2, 2), // bottom-right (grey)
    (1, 2), // right-middle
    (0, 2), // top-right (yellow accent)
  ];

  static const _dotDelay = 90; // ms between each dot
  static const _dotDuration = 400; // ms for each dot's color-up animation

  @override
  void initState() {
    super.initState();
    _introPlayer = AudioPlayer();
    _outroPlayer = AudioPlayer();

    _dotControllers = List.generate(
      9,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: _dotDuration),
      ),
    );

    _expandController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
      reverseDuration: const Duration(milliseconds: 600),
    );

    _yellowTextController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    _fadeOutController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _startAnimation();
  }

  Future<void> _startAnimation() async {
    // Preload the audio to completely eliminate startup playback delay
    await _introPlayer.setSource(AssetSource('audio/Intro_SF.m4a'));
    _outroPlayer.setSource(AssetSource('audio/Outro_SF.m4a'));

    // Wait a beat before starting visually
    await Future.delayed(const Duration(milliseconds: 300));

    // Play intro sound synced with dot animations via resume() since it's preloaded
    _introPlayer.resume().catchError((_) {});

    // Animate dots one by one
    for (int i = 0; i < 9; i++) {
      if (!mounted) return;
      _dotControllers[i].forward();
      if (i < 8) {
        await Future.delayed(const Duration(milliseconds: _dotDelay));
      }
    }

    // The yellow dot (i=8) has just started bounding. We barely wait
    // so the zoom is triggered as soon as the dot lights up!
    await Future.delayed(const Duration(milliseconds: 120));
    if (!mounted) return;

    // Get yellow dot position and expand it relative to Stack
    final RenderBox? dotBox = _yellowDotKey.currentContext?.findRenderObject() as RenderBox?;
    final RenderBox? stackBox = _stackKey.currentContext?.findRenderObject() as RenderBox?;
    if (dotBox != null && stackBox != null) {
      setState(() {
        final globalDotCenter = dotBox.localToGlobal(dotBox.size.center(Offset.zero));
        _yellowDotPosition = stackBox.globalToLocal(globalDotCenter);
      });
    }

    _expandController.forward();
    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    // Show GRID and powered by text
    _yellowTextController.forward();

    // Play outro sound when the GRID text shows up
    _outroPlayer.resume().catchError((_) {});

    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    // Fade everything out
    _fadeOutController.forward();
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    // Try auto-login before navigating
    await ref.read(authProvider.notifier).tryAutoLogin();
    if (!mounted) return;

    final authState = ref.read(authProvider);
    if (authState.status == AuthStatus.authenticated) {
      final role = authState.user!.role;
      if (role == 'driver') {
        context.go('/driver/deliveries');
      } else if (role == 'admin') {
        context.go('/admin/dashboard');
      } else {
        context.go('/customer/home');
      }
    } else if (authState.status == AuthStatus.profileIncomplete) {
      context.go('/auth/profile-setup');
    } else {
      context.go('/auth/login');
    }
  }

  @override
  void dispose() {
    for (final c in _dotControllers) {
      c.dispose();
    }
    _expandController.dispose();
    _yellowTextController.dispose();
    _fadeOutController.dispose();
    _introPlayer.dispose();
    _outroPlayer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final fg = colors.onBackground;
    const yellow = Color(0xFFFFDE58);
    const grey = Color(0xFF5B5B5B);

    // Ghost color (very faint version of fg)
    final ghost = fg.withValues(alpha: 0.08);

    // Final colors for each dot position (row, col)
    final dotColors = [
      [fg, fg, yellow], // row 0
      [fg, fg, fg],     // row 1
      [fg, fg, grey],   // row 2
    ];

    // Build a map from (row,col) → controller index
    final controllerMap = <(int, int), int>{};
    for (int i = 0; i < _dotOrder.length; i++) {
      controllerMap[_dotOrder[i]] = i;
    }

    const logoSize = 80.0;
    const dotSize = logoSize / 4.2;
    const spacing = logoSize / 12;

    return Scaffold(
      backgroundColor: colors.background,
      body: FadeTransition(
        opacity: Tween(begin: 1.0, end: 0.0).animate(
          CurvedAnimation(parent: _fadeOutController, curve: Curves.easeIn),
        ),
        child: Stack(
          key: _stackKey,
          textDirection: TextDirection.ltr,
          children: [
            // Main Content
            SizedBox.expand(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Animated dot grid
                  SizedBox(
                    width: logoSize,
                    height: logoSize,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(3, (row) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: spacing / 2),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(3, (col) {
                              final ctrlIndex = controllerMap[(row, col)]!;
                              final finalColor = dotColors[row][col];

                              return Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: spacing / 2),
                                child: _DotAnimator(
                                  animation: CurvedAnimation(
                                    parent: _dotControllers[ctrlIndex],
                                    curve: Curves.easeOutCubic,
                                  ),
                                  builder: (context, t) {
                                    return Transform.scale(
                                      scale: 0.4 + (0.6 * t),
                                      child: Container(
                                        key: (row == 0 && col == 2) ? _yellowDotKey : null,
                                        width: dotSize,
                                        height: dotSize,
                                        decoration: BoxDecoration(
                                          color: Color.lerp(ghost, finalColor, t),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              );
                            }),
                          ),
                        );
                      }),
                    ),
                  ),
                ],
              ),
            ),

            // Expanding yellow layer placed ON TOP of content
            if (_yellowDotPosition != null)
              AnimatedBuilder(
                animation: _expandController,
                builder: (context, child) {
                  // easeIn overlaps nicely with the end of the previous bounce
                  final curvedValue = Curves.easeIn.transform(_expandController.value);
                  final scale = 1.0 + (curvedValue * 150);

                  return Positioned(
                    left: _yellowDotPosition!.dx - (dotSize / 2),
                    top: _yellowDotPosition!.dy - (dotSize / 2),
                    child: IgnorePointer(
                      child: Transform.scale(
                        scale: scale,
                        child: Container(
                          width: dotSize,
                          height: dotSize,
                          decoration: const BoxDecoration(
                            color: yellow,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),

            // Top level texts (appear after engulf)
            FadeTransition(
              opacity: CurvedAnimation(
                parent: _yellowTextController,
                curve: Curves.easeOut,
              ),
              child: SizedBox.expand(
                child: Stack(
                  children: [
                    // Center "GRID" text
                    const Align(
                      alignment: Alignment.center,
                      child: Text(
                        'GRID',
                        style: TextStyle(
                          fontFamily: 'Satoshi',
                          fontSize: 48,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 6,
                          color: Color(0xFF1E1E1E), // Dark
                        ),
                      ),
                    ),
                    
                    // Bottom "Powered by GRID" text and tagline
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Powered by GRID',
                                style: AppTypography.overline.copyWith(
                                  color: const Color(0xFF1E1E1E).withValues(alpha: 0.6),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'MAPPING THE FUTURE OF PRINTING',
                                style: AppTypography.overline.copyWith(
                                  color: const Color(0xFF1E1E1E).withValues(alpha: 0.6),
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rebuilds child whenever [animation] ticks. Thin wrapper around
/// Flutter's built-in [AnimatedBuilder] (which is actually a typedef
/// for [ListenableBuilder] with a different name in some versions).
class _DotAnimator extends AnimatedWidget {
  const _DotAnimator({
    required Animation<double> animation,
    required this.builder,
  }) : super(listenable: animation);

  final Widget Function(BuildContext context, double value) builder;

  @override
  Widget build(BuildContext context) {
    final anim = listenable as Animation<double>;
    return builder(context, anim.value);
  }
}
