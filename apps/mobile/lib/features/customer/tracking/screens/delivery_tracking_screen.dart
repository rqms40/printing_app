import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/tracking/widgets/delivery_map.dart';
import 'package:printing_app/features/customer/tracking/widgets/driver_info_card.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';

class DeliveryTrackingScreen extends ConsumerStatefulWidget {
  const DeliveryTrackingScreen({super.key});

  @override
  ConsumerState<DeliveryTrackingScreen> createState() =>
      _DeliveryTrackingScreenState();
}

class _DeliveryTrackingScreenState
    extends ConsumerState<DeliveryTrackingScreen> {
  final _mapKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _maybeShowTrackingTutorial());
  }

  void _maybeShowTrackingTutorial() {
    if (!mounted) return;
    final pipelineSeen = ref.read(tutorialSeenProvider(TutorialKey.pipeline));
    if (!pipelineSeen) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.tracking));
    if (seen) return;

    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _mapKey,
          icon: HugeIcons.strokeRoundedLocation01,
          title: 'Live Driver Tracking',
          body:
              "Your rider's GPS updates in real time. The ETA badge top-right refreshes live.",
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.tracking),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Track Delivery',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: Column(
        children: [
          // Map placeholder
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: DeliveryMap(tutorialKey: _mapKey),
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          // Driver info card at bottom
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: DriverInfoCard(),
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(
                begin: 0.03,
                duration: 400.ms,
                delay: 60.ms,
                curve: Curves.easeOut,
              ),
        ],
      ),
    );
  }
}
