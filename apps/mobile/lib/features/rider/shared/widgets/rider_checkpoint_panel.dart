import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Bottom checkpoint controls with progress rail and swipe-to-deliver.
class RiderCheckpointPanel extends StatelessWidget {
  const RiderCheckpointPanel({
    super.key,
    required this.status,
    required this.onAdvance,
    this.isLoading = false,
    this.onAccept,
    this.onDecline,
  });

  final DeliveryStatus status;
  final VoidCallback onAdvance;
  final bool isLoading;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  int get _currentIndex {
    final idx = riderCheckpoints.indexOf(status);
    return idx >= 0 ? idx : 0;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    if (status == DeliveryStatus.delivered ||
        status == DeliveryStatus.declined ||
        status == DeliveryStatus.failed) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outline, width: 0.5)),
        boxShadow: [
          BoxShadow(
            color: colors.onBackground.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ProgressRail(
              currentIndex: status == DeliveryStatus.assigned
                  ? -1
                  : _currentIndex,
              colors: colors,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              status.displayName,
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (status == DeliveryStatus.assigned) ...[
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Decline',
                      variant: AppButtonVariant.ghost,
                      onTap: onDecline,
                      icon: riderCheckpointActionIcon(status),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: AppButton(
                      label: 'Accept',
                      variant: AppButtonVariant.primary,
                      onTap: onAccept,
                      isLoading: isLoading,
                      icon: riderCheckpointActionIcon(status),
                    ),
                  ),
                ],
              ),
            ] else if (status == DeliveryStatus.arrived)
              _SwipeToConfirm(onConfirmed: onAdvance, isLoading: isLoading)
            else
              AppButton(
                label: riderCheckpointActionLabel(status),
                onTap: onAdvance,
                variant: AppButtonVariant.primary,
                isFullWidth: true,
                isLoading: isLoading,
                icon: riderCheckpointActionIcon(status),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProgressRail extends StatelessWidget {
  const _ProgressRail({required this.currentIndex, required this.colors});

  final int currentIndex;
  final AppColorSet colors;

  static const _labels = ['Accepted', 'Pickup', 'En route', 'Arrived', 'Done'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(_labels.length, (index) {
        final isComplete = currentIndex >= index;
        final isActive = currentIndex == index;
        return Expanded(
          child: Column(
            children: [
              Container(
                height: 4,
                margin: EdgeInsets.only(
                  right: index < _labels.length - 1 ? AppSpacing.xs : 0,
                ),
                decoration: BoxDecoration(
                  color: isComplete ? colors.accent : colors.outline,
                  borderRadius: AppRadius.borderFull,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _labels[index],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(
                  fontSize: 9,
                  color: isActive ? colors.onBackground : colors.onSurfaceDim,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

class _SwipeToConfirm extends StatefulWidget {
  const _SwipeToConfirm({required this.onConfirmed, required this.isLoading});

  final VoidCallback onConfirmed;
  final bool isLoading;

  @override
  State<_SwipeToConfirm> createState() => _SwipeToConfirmState();
}

class _SwipeToConfirmState extends State<_SwipeToConfirm> {
  double _dragExtent = 0;
  static const double _threshold = 0.72;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxDrag = constraints.maxWidth - 56;
        final progress = maxDrag <= 0
            ? 0.0
            : (_dragExtent / maxDrag).clamp(0.0, 1.0);

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Opacity(
              opacity: widget.isLoading ? 0.6 : 1,
              child: Semantics(
                button: true,
                enabled: !widget.isLoading,
                label: 'Swipe to open proof of delivery',
                hint: 'Opens the proof form to finish this delivery',
                onTap: widget.isLoading ? null : widget.onConfirmed,
                child: ExcludeSemantics(
                  child: Container(
                    key: const ValueKey('rider-delivery-confirm-slider'),
                    width: double.infinity,
                    height: 56,
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      borderRadius: AppRadius.borderFull,
                      border: Border.all(
                        color: colors.outline.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        FractionallySizedBox(
                          widthFactor: progress,
                          alignment: Alignment.centerLeft,
                          child: Container(
                            decoration: BoxDecoration(
                              color: colors.success.withValues(alpha: 0.22),
                              borderRadius: AppRadius.borderFull,
                            ),
                          ),
                        ),
                        Text(
                          'Swipe to open proof of delivery',
                          style: AppTypography.button.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                        Positioned(
                          left: _dragExtent + 4,
                          child: GestureDetector(
                            onHorizontalDragUpdate: widget.isLoading
                                ? null
                                : (details) {
                                    setState(() {
                                      _dragExtent =
                                          (_dragExtent + details.delta.dx)
                                              .clamp(0, maxDrag);
                                    });
                                  },
                            onHorizontalDragEnd: widget.isLoading
                                ? null
                                : (_) {
                                    final releasedProgress = maxDrag <= 0
                                        ? 0.0
                                        : (_dragExtent / maxDrag).clamp(
                                            0.0,
                                            1.0,
                                          );
                                    if (releasedProgress >= _threshold) {
                                      widget.onConfirmed();
                                    }
                                    setState(() => _dragExtent = 0);
                                  },
                            child: Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: colors.accent,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.check_rounded,
                                color: colors.accentOnColor,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
