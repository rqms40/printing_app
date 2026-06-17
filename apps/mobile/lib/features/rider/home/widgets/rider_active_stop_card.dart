import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';

/// Active stop card from rider-UI.png.
class RiderActiveStopCard extends StatelessWidget {
  const RiderActiveStopCard({
    super.key,
    required this.view,
    this.onCall,
    this.onMessage,
    this.onTap,
  });

  final RiderAssignmentView view;
  final VoidCallback? onCall;
  final VoidCallback? onMessage;
  final VoidCallback? onTap;

  String get _orderSummary {
    final category = view.order.category;
    final qty = view.order.quantity;
    if (category.toLowerCase().contains('3d')) {
      return '$category, $qty ${qty == 1 ? 'Copy' : 'Copies'}';
    }
    return '$category, $qty ${qty == 1 ? 'Copy' : 'Copies'}';
  }

  @override
  Widget build(BuildContext context) {
    final customerName = view.order.customerName ?? 'Customer';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active Stop',
            style: AppTypography.bodyBold.copyWith(
              color: RiderTheme.textPrimary,
              fontSize: 18,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 6),
          Material(
            color: RiderTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.fromLTRB(8, 8, 10, 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: RiderTheme.mapLine.withValues(alpha: 0.8),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: RiderTheme.surface,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                      ),
                      child: const Icon(
                        Icons.person_rounded,
                        color: Colors.white,
                        size: 31,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customerName,
                            style: AppTypography.bodyBold.copyWith(
                              color: RiderTheme.yellow,
                              fontSize: 12,
                              letterSpacing: 0,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _orderSummary,
                            style: AppTypography.caption.copyWith(
                              color: RiderTheme.textPrimary,
                              fontSize: 10,
                              height: 1.05,
                            ),
                          ),
                          Text(
                            '#${view.order.orderRef}',
                            style: AppTypography.caption.copyWith(
                              color: RiderTheme.textPrimary,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              height: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _ActionIcon(
                      key: const ValueKey('rider-stop-message'),
                      icon: HugeIcons.strokeRoundedMail01,
                      onTap: onMessage,
                    ),
                    const SizedBox(width: 6),
                    _ActionIcon(
                      key: const ValueKey('rider-stop-call'),
                      icon: HugeIcons.strokeRoundedCall,
                      onTap: onCall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({super.key, required this.icon, this.onTap});

  final dynamic icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: RiderTheme.surface,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 28,
          height: 28,
          child: Center(
            child: HugeIcon(
              icon: icon,
              color: RiderTheme.textPrimary,
              size: 15,
            ),
          ),
        ),
      ),
    );
  }
}
