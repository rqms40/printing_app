import 'dart:async';
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class AdminStatusBanner extends StatefulWidget {
  const AdminStatusBanner({
    super.key,
    required this.note,
    this.estimatedCompletionAt,
  });

  final String note;
  final DateTime? estimatedCompletionAt;

  @override
  State<AdminStatusBanner> createState() => _AdminStatusBannerState();
}

class _AdminStatusBannerState extends State<AdminStatusBanner> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    if (widget.estimatedCompletionAt != null) {
      _ticker = Timer.periodic(
        const Duration(seconds: 30),
        (_) => setState(() {}),
      );
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _countdown(DateTime target) {
    final diff = target.difference(DateTime.now());
    if (diff.isNegative) return 'Awaiting completion';
    final h = diff.inHours;
    final m = diff.inMinutes.remainder(60);
    if (h > 0) return '~${h}h ${m}m remaining';
    return '~${m}m remaining';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.brand.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.brand.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedInformationCircle,
            size: 20,
            color: colors.brand,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.note,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                if (widget.estimatedCompletionAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _countdown(widget.estimatedCompletionAt!),
                    style: AppTypography.caption.copyWith(color: colors.brand),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
