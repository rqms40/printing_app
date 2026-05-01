import 'package:flutter/material.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:printing_app/features/tutorial/widgets/tutorial_bubble.dart';

class TutorialStep {
  const TutorialStep({
    required this.targetKey,
    required this.icon,
    required this.title,
    required this.body,
    this.shape = ShapeLightFocus.RRect,
    this.align,
    this.advanceOnSpotlightTap = true,
    this.onSpotlightTap,
  });

  final GlobalKey targetKey;
  final dynamic icon;
  final String title;
  final String body;
  final ShapeLightFocus shape;

  /// If null, align is auto-resolved per-step from target Y position.
  final ContentAlign? align;

  /// True for steps where the user taps the spotlighted widget itself
  /// to advance (the bubble shows only Skip). False for sections that
  /// need an explicit "Got it →" button (passed as `onAdvance` to the bubble).
  final bool advanceOnSpotlightTap;

  /// Fires when the user taps the spotlighted target. Use this to trigger
  /// the underlying widget's action (navigate / select) AND advance the
  /// pipeline state in one step — avoids the "double tap required" bug.
  final VoidCallback? onSpotlightTap;
}

ContentAlign _resolveAlign(GlobalKey key, BuildContext ctx) {
  final box = key.currentContext?.findRenderObject() as RenderBox?;
  if (box == null) return ContentAlign.bottom;
  final centerY = box.localToGlobal(Offset.zero).dy + box.size.height / 2;
  final screenH = MediaQuery.of(ctx).size.height;
  return centerY > screenH * 0.5 ? ContentAlign.top : ContentAlign.bottom;
}

void showCoachMark(
  BuildContext context,
  List<TutorialStep> steps,
  VoidCallback onFinish, {
  VoidCallback? onSkip,
}) {
  final stepsByIdentify = <String, TutorialStep>{};
  final targets = steps.asMap().entries.map((entry) {
    final i = entry.key;
    final step = entry.value;
    final identify = '${step.title}-$i';
    stepsByIdentify[identify] = step;
    final align = step.align ?? _resolveAlign(step.targetKey, context);

    return TargetFocus(
      identify: identify,
      keyTarget: step.targetKey,
      shape: step.shape,
      radius: 8,
      paddingFocus: 8,
      enableOverlayTab: false,
      contents: [
        TargetContent(
          align: align,
          builder: (context, controller) => TutorialBubble(
            icon: step.icon,
            title: step.title,
            body: step.body,
            step: i + 1,
            totalSteps: steps.length,
            onSkip: controller.skip,
            onAdvance: step.advanceOnSpotlightTap ? null : controller.next,
          ),
        ),
      ],
    );
  }).toList();

  TutorialCoachMark(
    targets: targets,
    colorShadow: Colors.black,
    opacityShadow: 0.75,
    pulseEnable: false,
    onFinish: onFinish,
    onSkip: () {
      (onSkip ?? onFinish).call();
      return true;
    },
    onClickTarget: (target) {
      stepsByIdentify[target.identify]?.onSpotlightTap?.call();
    },
  ).show(context: context);
}
