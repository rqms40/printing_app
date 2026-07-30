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
    this.paddingFocus,
  });

  final GlobalKey targetKey;
  final dynamic icon;
  final String title;
  final String body;
  final ShapeLightFocus shape;

  /// If null, align is auto-resolved per-step from target Y position.
  final ContentAlign? align;

  /// True for steps where tapping the spotlighted widget performs the action.
  /// The bubble also exposes an accessible "Got it →" fallback that performs
  /// the same action after closing the coach mark.
  final bool advanceOnSpotlightTap;

  /// Fires when the user taps the spotlighted target. Use this to trigger
  /// the underlying widget's action (navigate / select) AND advance the
  /// pipeline state in one step — avoids the "double tap required" bug.
  final VoidCallback? onSpotlightTap;

  /// Override the default paddingFocus (8) for this step's spotlight.
  /// Use a smaller value (e.g. 4) to tighten the spotlight around a
  /// widget that is smaller than its Expanded/Row share, or a larger
  /// value to give extra breathing room.
  final double? paddingFocus;
}

ContentAlign _resolveAlign(GlobalKey key, BuildContext ctx) {
  final box = key.currentContext?.findRenderObject() as RenderBox?;
  if (box == null) return ContentAlign.bottom;
  final topY = box.localToGlobal(Offset.zero).dy;
  final bottomY = topY + box.size.height;
  final screenH = MediaQuery.of(ctx).size.height;
  // Generous bubble-height estimate so we never anchor on a side that
  // can't fit the bubble within the visible viewport.
  const bubbleHeight = 220.0;
  final canFitAbove = topY > bubbleHeight;
  final canFitBelow = (screenH - bottomY) > bubbleHeight;
  final centerY = (topY + bottomY) / 2;
  final preferTop = centerY > screenH * 0.5;
  if (preferTop && canFitAbove) return ContentAlign.top;
  if (!preferTop && canFitBelow) return ContentAlign.bottom;
  // Preferred side has no room — use the other side.
  if (canFitBelow) return ContentAlign.bottom;
  if (canFitAbove) return ContentAlign.top;
  return ContentAlign.bottom;
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
      paddingFocus: step.paddingFocus ?? 8,
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
            onAdvance: step.advanceOnSpotlightTap
                ? () {
                    controller.next();
                    step.onSpotlightTap?.call();
                  }
                : controller.next,
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
    hideSkip: true,
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
