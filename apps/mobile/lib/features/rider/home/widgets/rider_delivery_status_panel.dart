import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

enum _StopState { delivered, current, upcoming }

class _StopRow {
  const _StopRow(this.number, this.view, this.state);
  final int number;
  final RiderAssignmentView view;
  final _StopState state;
}

/// "Delivery Status" panel: header + delivered/total progress + per-stop
/// checklist (delivered check, highlighted current stop, dim upcoming).
class RiderDeliveryStatusPanel extends StatelessWidget {
  const RiderDeliveryStatusPanel({
    super.key,
    required this.deliveredStops,
    required this.currentStop,
    required this.upcomingStops,
    required this.onTapStop,
  });

  final List<RiderAssignmentView> deliveredStops;
  final RiderAssignmentView? currentStop;
  final List<RiderAssignmentView> upcomingStops;
  final void Function(RiderAssignmentView) onTapStop;

  static const _visibleCap = 4;

  static double preferredHeight({required int totalRows}) {
    if (totalRows == 0) return 92;
    final visible = totalRows < _visibleCap ? totalRows : _visibleCap;
    const chrome = 16 + 26 + 8 + 24 + 8;
    const rowHeight = 46.0;
    final viewMore = totalRows > visible ? 22.0 : 0.0;
    return chrome + (rowHeight * visible) + viewMore;
  }

  List<_StopRow> _rows() {
    final rows = <_StopRow>[];
    var n = 1;
    for (final v in deliveredStops) {
      rows.add(_StopRow(n++, v, _StopState.delivered));
    }
    if (currentStop != null) {
      rows.add(_StopRow(n++, currentStop!, _StopState.current));
    }
    for (final v in upcomingStops) {
      rows.add(_StopRow(n++, v, _StopState.upcoming));
    }
    return rows;
  }

  List<_StopRow> _windowed(List<_StopRow> rows) {
    if (rows.length <= _visibleCap) return rows;
    final curIdx = rows.indexWhere((r) => r.state == _StopState.current);
    final anchor = curIdx < 0 ? 0 : curIdx;
    final start = (anchor - 1).clamp(0, rows.length - _visibleCap);
    return rows.sublist(start, start + _visibleCap);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final rows = _rows();
    final total = rows.length;
    final deliveredCount = deliveredStops.length;
    final ratio = total == 0 ? 0.0 : deliveredCount / total;
    final percent = (ratio * 100).round();
    final windowed = _windowed(rows);

    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(color: colors.surface),
        child: total == 0
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _header(colors),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'No active route — check Orders for assignments.',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _header(colors),
                  const SizedBox(height: AppSpacing.xs),
                  _ProgressRow(
                    colors: colors,
                    label: 'Route · $deliveredCount/$total',
                    ratio: ratio,
                    percent: percent,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Expanded(
                    child: ListView(
                      padding: EdgeInsets.zero,
                      children: [
                        for (final row in windowed)
                          Padding(
                            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                            child: _StopCheckRow(
                              colors: colors,
                              row: row,
                              onTap: () => onTapStop(row.view),
                            ),
                          ),
                        if (rows.length > windowed.length)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () =>
                                  _showAllStops(context, colors, rows, onTapStop),
                              style: TextButton.styleFrom(
                                foregroundColor: colors.brand,
                                minimumSize: Size.zero,
                                padding: const EdgeInsets.symmetric(horizontal: 2),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: Text(
                                'View all stops',
                                style: AppTypography.caption.copyWith(
                                  color: colors.brand,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
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
    );
  }

  Widget _header(AppColorSet colors) => Text(
        'Delivery Status',
        maxLines: 1,
        style: AppTypography.h3.copyWith(
          color: colors.onSurface,
          fontSize: 20,
          height: 1.0,
          fontWeight: FontWeight.w800,
        ),
      );
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.colors,
    required this.label,
    required this.ratio,
    required this.percent,
  });

  final AppColorSet colors;
  final String label;
  final double ratio;
  final int percent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          maxLines: 1,
          style: AppTypography.caption.copyWith(
            color: colors.onSurface,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: AppRadius.borderFull,
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 6,
                  backgroundColor: colors.outline.withValues(alpha: 0.55),
                  valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
                ),
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '$percent%',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 8,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StopCheckRow extends StatelessWidget {
  const _StopCheckRow({
    required this.colors,
    required this.row,
    required this.onTap,
  });

  final AppColorSet colors;
  final _StopRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final view = row.view;
    final name = view.order.customerName ?? view.order.orderRef;
    final addr = view.order.destination?.shortLabel;

    late final Widget badge;
    late final String title;
    late final String subtitle;
    Color bg = Colors.transparent;

    switch (row.state) {
      case _StopState.delivered:
        badge = Container(
          width: 26,
          height: 26,
          decoration: const BoxDecoration(
            color: Color(0xFF78EC75),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded, size: 15, color: Colors.black),
        );
        title = 'Stop ${row.number} · $name';
        subtitle = 'Delivered';
      case _StopState.current:
        badge = Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(color: colors.brand, shape: BoxShape.circle),
          child: Center(
            child: Text(
              '${row.number}',
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        );
        title = 'You are at Stop ${row.number}';
        subtitle = addr == null ? name : '$name · $addr';
        bg = colors.brand.withValues(alpha: 0.08);
      case _StopState.upcoming:
        badge = Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(color: colors.onSurfaceDim, width: 1.2),
          ),
          child: Center(
            child: Text(
              '${row.number}',
              style: TextStyle(
                color: colors.onSurfaceDim,
                fontWeight: FontWeight.w800,
                fontSize: 11,
              ),
            ),
          ),
        );
        title = 'Stop ${row.number} · $name';
        subtitle = addr ?? 'Upcoming';
    }

    final isCurrent = row.state == _StopState.current;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: AppRadius.borderMd,
        ),
        padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
        child: Row(
          children: [
            badge,
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: isCurrent ? colors.brand : colors.onSurface,
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontWeight: FontWeight.w600,
                      fontSize: 9.5,
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _showAllStops(
  BuildContext context,
  AppColorSet colors,
  List<_StopRow> rows,
  void Function(RiderAssignmentView) onTapStop,
) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: colors.surface,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      final c = Theme.of(sheetContext).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;
      return SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'All stops',
                style: AppTypography.h3.copyWith(
                  color: c.onSurface,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
                  itemBuilder: (_, i) => _StopCheckRow(
                    colors: c,
                    row: rows[i],
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      onTapStop(rows[i].view);
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
