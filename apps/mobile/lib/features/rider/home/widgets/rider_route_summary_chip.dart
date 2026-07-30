import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_eta.dart';

/// Compact remaining-route summary shown on the cockpit maps:
/// `2 stops left · ~4 min · 1.2 km`. Replaces the old decorative clock.
class RiderRouteSummaryChip extends StatelessWidget {
  const RiderRouteSummaryChip({super.key, required this.stops});

  final List<RiderAssignmentView> stops;

  @override
  Widget build(BuildContext context) {
    final pending = stops
        .where(
          (view) =>
              view.planStop != null &&
              view.planStop!.status == RiderDispatchStopStatus.pending,
        )
        .toList();
    if (pending.isEmpty) return const SizedBox.shrink();

    final seconds = pending.fold<int>(
      0,
      (total, view) => total + view.planStop!.legDurationSeconds,
    );
    final meters = pending.fold<int>(
      0,
      (total, view) => total + view.planStop!.legDistanceMeters,
    );
    final count = '${pending.length} ${pending.length == 1 ? 'stop' : 'stops'} left';
    final label = seconds > 0
        ? '$count · ${formatEtaMinutes(seconds)} · ${formatDistanceMeters(meters)}'
        : count;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xE6111111),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.bodyBold.copyWith(
          color: Colors.white,
          fontSize: 13,
          height: 1.1,
        ),
      ),
    );
  }
}
