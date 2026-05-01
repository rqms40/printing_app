import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';

const double _badgeWidth = 108;
const double _badgeHeight = 26;
const double _edgePadding = 12;
const double _navOffset = 80; // ~66 nav + breathing room, above safe-area

final betaIndicatorOffsetProvider = StateProvider<Offset?>((_) => null);

class BetaIndicatorOverlay extends ConsumerWidget {
  const BetaIndicatorOverlay({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final betaAsync = ref.watch(betaStatusProvider);
    final visible = betaAsync.maybeWhen(
      data: (s) => s != null && s.globallyEnabled && s.isBetaUser,
      orElse: () => false,
    );

    if (!visible) return child;

    return Stack(
      children: [
        child,
        const Positioned.fill(child: _DraggableBetaBadge()),
      ],
    );
  }
}

class _DraggableBetaBadge extends ConsumerStatefulWidget {
  const _DraggableBetaBadge();

  @override
  ConsumerState<_DraggableBetaBadge> createState() =>
      _DraggableBetaBadgeState();
}

class _DraggableBetaBadgeState extends ConsumerState<_DraggableBetaBadge> {
  late final ValueNotifier<Offset> _pos = ValueNotifier(Offset.zero);
  late final ValueNotifier<bool> _dragging = ValueNotifier(false);
  bool _initialized = false;
  Size _last = Size.zero;

  @override
  void dispose() {
    _pos.dispose();
    _dragging.dispose();
    super.dispose();
  }

  Offset _defaultFor(Size size, EdgeInsets safeArea) => Offset(
        _edgePadding,
        size.height - _badgeHeight - _navOffset - safeArea.bottom,
      );

  Offset _clamp(Offset o, Size size) => Offset(
        o.dx.clamp(0.0, size.width - _badgeWidth),
        o.dy.clamp(0.0, size.height - _badgeHeight),
      );

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        final mq = MediaQuery.of(ctx);

        if (!_initialized || size != _last) {
          _last = size;
          final stored = ref.read(betaIndicatorOffsetProvider);
          final base = stored ?? _defaultFor(size, mq.padding);
          _pos.value = _clamp(base, size);
          _initialized = true;
        }

        return ValueListenableBuilder<Offset>(
          valueListenable: _pos,
          builder: (_, offset, _) {
            return Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedPositioned(
                  duration: _dragging.value
                      ? Duration.zero
                      : const Duration(milliseconds: 280),
                  curve: Curves.easeOutCubic,
                  left: offset.dx,
                  top: offset.dy,
                  child: ValueListenableBuilder<bool>(
                    valueListenable: _dragging,
                    builder: (_, dragging, child) => AnimatedScale(
                      scale: dragging ? 1.08 : 1.0,
                      duration: const Duration(milliseconds: 140),
                      curve: Curves.easeOut,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 140),
                        decoration: BoxDecoration(
                          borderRadius: AppRadius.borderFull,
                          boxShadow: dragging
                              ? [
                                  BoxShadow(
                                    color:
                                        Colors.black.withValues(alpha: 0.35),
                                    blurRadius: 16,
                                    offset: const Offset(0, 6),
                                  ),
                                ]
                              : [
                                  BoxShadow(
                                    color:
                                        Colors.black.withValues(alpha: 0.22),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                        ),
                        child: child,
                      ),
                    ),
                    child: Listener(
                      behavior: HitTestBehavior.opaque,
                      onPointerDown: (_) => _dragging.value = true,
                      onPointerMove: (e) {
                        _pos.value = _clamp(_pos.value + e.delta, size);
                      },
                      onPointerUp: (_) => _settle(size),
                      onPointerCancel: (_) => _settle(size),
                      child: const _BetaBadge(),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _settle(Size size) {
    _dragging.value = false;
    final cur = _pos.value;
    final snapLeft = cur.dx + _badgeWidth / 2 < size.width / 2;
    final snappedX =
        snapLeft ? _edgePadding : size.width - _badgeWidth - _edgePadding;
    final snapped = _clamp(Offset(snappedX, cur.dy), size);
    _pos.value = snapped;
    ref.read(betaIndicatorOffsetProvider.notifier).state = snapped;
  }
}

class _BetaBadge extends ConsumerWidget {
  const _BetaBadge();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final betaAsync = ref.watch(betaStatusProvider);

    return betaAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (status) {
        if (status == null || !status.globallyEnabled || !status.isBetaUser) {
          return const SizedBox.shrink();
        }

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final brandColor =
            isDark ? AppColors.brandDark : AppColors.brandLight;
        final rankText = status.rank != null
            ? '#${status.rank!.toString().padLeft(3, '0')}'
            : null;

        return Material(
          color: Colors.transparent,
          child: Container(
            width: _badgeWidth,
            height: _badgeHeight,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A1A),
              borderRadius: AppRadius.borderFull,
              border: Border.all(
                color: AppColors.brandDark.withValues(alpha: 0.25),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'BETA',
                  style: AppTypography.overline.copyWith(
                    color: brandColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xs,
                  ),
                  child: Text(
                    '|',
                    style: AppTypography.overline.copyWith(
                      color: Colors.white.withValues(alpha: 0.25),
                      fontSize: 10,
                    ),
                  ),
                ),
                Text(
                  'V1',
                  style: AppTypography.overline.copyWith(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                  ),
                ),
                if (rankText != null) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xs,
                    ),
                    child: Text(
                      '·',
                      style: AppTypography.overline.copyWith(
                        color: Colors.white.withValues(alpha: 0.25),
                        fontSize: 10,
                      ),
                    ),
                  ),
                  Text(
                    rankText,
                    style: AppTypography.overline.copyWith(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 10,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ],
            ),
          )
              .animate(onPlay: (c) => c.repeat())
              .shimmer(
                duration: const Duration(seconds: 3),
                color: const Color(0xFFFFDE58).withValues(alpha: 0.2),
              ),
        );
      },
    );
  }
}

class BetaIndicator extends StatelessWidget {
  const BetaIndicator({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
