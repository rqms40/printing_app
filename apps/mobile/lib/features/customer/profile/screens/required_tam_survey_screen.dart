import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';

class RequiredTamSurveyScreen extends ConsumerStatefulWidget {
  const RequiredTamSurveyScreen({super.key});

  @override
  ConsumerState<RequiredTamSurveyScreen> createState() =>
      _RequiredTamSurveyScreenState();
}

class _RequiredTamSurveyScreenState
    extends ConsumerState<RequiredTamSurveyScreen> {
  final PageController _pageController = PageController();
  final TextEditingController _featureController = TextEditingController();
  final TextEditingController _deliveryController = TextEditingController();
  final Map<int, int> _answers = {};

  int _page = 0;
  bool _submitting = false;
  bool _submitted = false;

  static const _questions = [
    'GRID allows me to manage my printing tasks more efficiently.',
    'Using GRID simplifies my entire printing process.',
    'It was easy to learn how to use the GRID app.',
    'I find the GRID app intuitive and easy to navigate.',
    'I intend to continue using GRID for my printing needs.',
    'I would recommend GRID to my peers or colleagues.',
    'Accuracy of the prints received compared to your digital order.',
    'Physical condition of the prints, including damage prevention and finish.',
    'Speed and punctuality of the delivery or pickup readiness.',
    'Clarity of the order status updates.',
    'The delivery or pickup system fits my schedule well.',
    'Color accuracy and resolution of the final product.',
    'The weight and feel of the paper or media used.',
    'Performance of the app, including loading speed and reliability.',
  ];

  static const _answerLabels = [
    'Strongly Disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly Agree',
  ];

  static const _answerShortLabels = [
    'STRONGLY\nDISAGREE',
    'DISAGREE',
    'NEUTRAL',
    'AGREE',
    'STRONGLY\nAGREE',
  ];

  static const _answerColors = [
    Color(0xFFFF6B6B),
    Color(0xFFFF9F43),
    Color(0xFFFFD93D),
    Color(0xFF6BCB77),
    Color(0xFF4CC9F0),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    _featureController.dispose();
    _deliveryController.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    HapticFeedback.selectionClick();
    if (_page < _questions.length) {
      _answers.putIfAbsent(_page, () => 2);
      await _pageController.nextPage(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
      return;
    }

    await _submit();
  }

  Future<void> _submit() async {
    final hold = ref.read(accountStateProvider).requiredSurveyHold;
    if (hold == null || _answers.length != _questions.length) return;

    setState(() => _submitting = true);
    try {
      await ApiClient.instance.post(
        '/tam-surveys/requirements/${hold.requirementId}/submit',
        data: {
          'surveyData': {
            for (final entry in _answers.entries)
              entry.key.toString(): entry.value,
          },
          'openForumFeedback': {
            'feature': _featureController.text.trim(),
            'delivery': _deliveryController.text.trim(),
          },
        },
      );

      if (!mounted) return;
      setState(() {
        _submitted = true;
        _submitting = false;
      });

      await Future.delayed(const Duration(milliseconds: 1300));
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/auth/login');
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit survey. Please retry.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final hold = ref.watch(accountStateProvider).requiredSurveyHold;
    final isQuestionPage = _page < _questions.length;
    final currentAnswer = isQuestionPage ? _answers[_page] ?? 2 : null;
    final pageBackground = isQuestionPage
        ? _answerColors[currentAnswer!]
        : colors.background;
    final questionTextColor =
        isQuestionPage &&
            ThemeData.estimateBrightnessForColor(pageBackground) ==
                Brightness.dark
        ? Colors.white
        : Colors.black87;
    final questionDimColor = questionTextColor.withValues(alpha: 0.58);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: pageBackground,
        body: SafeArea(
          child: _submitted
              ? _ThankYou(colors: colors)
              : Column(
                  children: [
                    _Header(
                      colors: colors,
                      orderRef: hold?.orderRef,
                      progress: (_page + 1) / (_questions.length + 1),
                      textColor: isQuestionPage
                          ? questionTextColor
                          : colors.onBackground,
                      dimColor: isQuestionPage
                          ? questionDimColor
                          : colors.onSurfaceDim,
                    ),
                    Expanded(
                      child: PageView.builder(
                        controller: _pageController,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _questions.length + 1,
                        onPageChanged: (value) => setState(() => _page = value),
                        itemBuilder: (context, index) {
                          if (index == _questions.length) {
                            return _OpenFeedbackPage(
                              colors: colors,
                              featureController: _featureController,
                              deliveryController: _deliveryController,
                            );
                          }

                          return _QuestionPage(
                            colors: colors,
                            textColor: questionTextColor,
                            dimColor: questionDimColor,
                            number: index + 1,
                            total: _questions.length,
                            question: _questions[index],
                            labels: _answerLabels,
                            shortLabels: _answerShortLabels,
                            selected: _answers[index] ?? 2,
                            onChanged: (value) {
                              setState(() => _answers[index] = value);
                            },
                          );
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.sm,
                        AppSpacing.xl,
                        AppSpacing.xl,
                      ),
                      child: SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton(
                          onPressed: _submitting ? null : _next,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isQuestionPage
                                ? questionTextColor.withValues(alpha: 0.14)
                                : colors.accent,
                            foregroundColor: isQuestionPage
                                ? questionTextColor
                                : colors.accentOnColor,
                            disabledBackgroundColor: isQuestionPage
                                ? questionTextColor.withValues(alpha: 0.08)
                                : colors.surfaceVariant,
                            disabledForegroundColor: isQuestionPage
                                ? questionTextColor.withValues(alpha: 0.38)
                                : colors.disabled,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: isQuestionPage
                                    ? questionTextColor.withValues(alpha: 0.3)
                                    : Colors.transparent,
                              ),
                            ),
                          ),
                          child: _submitting
                              ? SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colors.accentOnColor,
                                  ),
                                )
                              : Text(
                                  _page == _questions.length
                                      ? 'Submit Feedback'
                                      : 'Next',
                                  style: AppTypography.button,
                                ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.colors,
    required this.orderRef,
    required this.progress,
    required this.textColor,
    required this.dimColor,
  });

  final AppColorSet colors;
  final String? orderRef;
  final double progress;
  final Color textColor;
  final Color dimColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.md,
        AppSpacing.xl,
        AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Beta Feedback',
            style: AppTypography.h2.copyWith(color: textColor),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            orderRef == null
                ? 'Please complete this short survey to continue.'
                : 'Order $orderRef is complete. Please answer this short survey to finish your beta cycle.',
            style: AppTypography.body.copyWith(color: dimColor),
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: dimColor.withValues(alpha: 0.2),
              valueColor: AlwaysStoppedAnimation<Color>(textColor),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestionPage extends StatelessWidget {
  const _QuestionPage({
    required this.colors,
    required this.textColor,
    required this.dimColor,
    required this.number,
    required this.total,
    required this.question,
    required this.labels,
    required this.shortLabels,
    required this.selected,
    required this.onChanged,
  });

  final AppColorSet colors;
  final Color textColor;
  final Color dimColor;
  final int number;
  final int total;
  final String question;
  final List<String> labels;
  final List<String> shortLabels;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final expression = _FaceExpression.values[selected];

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      children: [
        Text(
          'Question $number of $total',
          textAlign: TextAlign.center,
          style: AppTypography.overline.copyWith(color: dimColor),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          question,
          textAlign: TextAlign.center,
          style: AppTypography.h3.copyWith(
            color: textColor,
            fontWeight: FontWeight.w600,
            height: 1.45,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Center(
          child: _AnimatedFace(
            expression: expression,
            color: textColor,
            size: 156,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          shortLabels[selected],
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: 'Poppins',
            fontSize: 36,
            fontWeight: FontWeight.w800,
            letterSpacing: 0,
            height: 1.1,
          ).copyWith(color: textColor),
        ),
        const SizedBox(height: AppSpacing.xl),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(labels.length, (index) {
            final isActive = index == selected;
            return Expanded(
              child: Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: isActive ? 10 : 7,
                  height: isActive ? 10 : 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActive
                        ? textColor
                        : textColor.withValues(alpha: 0.28),
                  ),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: AppSpacing.sm),
        SliderTheme(
          data: SliderThemeData(
            trackHeight: 5,
            thumbShape: _CustomThumbShape(color: textColor),
            activeTrackColor: textColor,
            inactiveTrackColor: textColor.withValues(alpha: 0.22),
            overlayColor: textColor.withValues(alpha: 0.14),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 22),
          ),
          child: Slider(
            min: 0,
            max: 4,
            divisions: 4,
            value: selected.toDouble(),
            onChanged: (value) {
              HapticFeedback.selectionClick();
              onChanged(value.round());
            },
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              labels.first.replaceFirst(' ', '\n'),
              style: AppTypography.caption.copyWith(color: dimColor),
              textAlign: TextAlign.left,
            ),
            Text(
              labels.last.replaceFirst(' ', '\n'),
              style: AppTypography.caption.copyWith(color: dimColor),
              textAlign: TextAlign.right,
            ),
          ],
        ),
      ],
    );
  }
}

enum _FaceExpression { veryBad, bad, neutral, good, veryGood }

class _CustomThumbShape extends SliderComponentShape {
  const _CustomThumbShape({required this.color});

  final Color color;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) => const Size(28, 28);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;

    canvas.drawCircle(
      center + const Offset(0, 2),
      14,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );
    canvas.drawCircle(center, 13, Paint()..color = color);
    canvas.drawCircle(
      center,
      5,
      Paint()
        ..color = (color == Colors.white ? Colors.black : Colors.white)
            .withValues(alpha: 0.35),
    );
  }
}

class _AnimatedFace extends StatelessWidget {
  const _AnimatedFace({
    required this.expression,
    required this.color,
    required this.size,
  });

  final _FaceExpression expression;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size * 0.75,
      child: CustomPaint(
        painter: _FacePainter(expression: expression, color: color),
      ),
    );
  }
}

class _FacePainter extends CustomPainter {
  const _FacePainter({required this.expression, required this.color});

  final _FaceExpression expression;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final cx = size.width / 2;
    final cy = size.height / 2;
    final eyeCy = cy - 18;

    switch (expression) {
      case _FaceExpression.veryBad:
        _drawEllipse(canvas, paint, cx - size.width * 0.23, eyeCy - 8, 20, 12);
        _drawEllipse(canvas, paint, cx + size.width * 0.23, eyeCy - 8, 20, 12);
        break;
      case _FaceExpression.bad:
        _drawRoundRect(
          canvas,
          paint,
          cx - size.width * 0.23 - 21,
          eyeCy - 7,
          42,
          15,
          7,
        );
        _drawRoundRect(
          canvas,
          paint,
          cx + size.width * 0.23 - 21,
          eyeCy - 7,
          42,
          15,
          7,
        );
        break;
      case _FaceExpression.neutral:
        _drawCircle(canvas, paint, cx - size.width * 0.23, eyeCy - 5, 20);
        _drawCircle(canvas, paint, cx + size.width * 0.23, eyeCy - 5, 20);
        break;
      case _FaceExpression.good:
        _drawCircle(canvas, paint, cx - size.width * 0.22, eyeCy, 26);
        _drawCircle(canvas, paint, cx + size.width * 0.22, eyeCy, 26);
        break;
      case _FaceExpression.veryGood:
        _drawCircle(canvas, paint, cx - size.width * 0.23, eyeCy, 31);
        _drawCircle(canvas, paint, cx + size.width * 0.23, eyeCy, 31);
        final shinePaint = Paint()
          ..color = color.withValues(alpha: 0.32)
          ..style = PaintingStyle.fill;
        _drawCircle(
          canvas,
          shinePaint,
          cx - size.width * 0.23 + 9,
          eyeCy - 10,
          8,
        );
        _drawCircle(
          canvas,
          shinePaint,
          cx + size.width * 0.23 + 9,
          eyeCy - 10,
          8,
        );
        break;
    }

    final mouthPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    final mouthWidth = size.width * 0.35;
    final mouthHeight = size.height * 0.20;
    final mouthCy = cy + 12;

    switch (expression) {
      case _FaceExpression.veryBad:
      case _FaceExpression.bad:
        canvas.drawArc(
          Rect.fromCenter(
            center: Offset(cx, mouthCy + size.height * 0.28),
            width: mouthWidth,
            height: mouthHeight,
          ),
          math.pi + 0.2,
          math.pi - 0.4,
          false,
          mouthPaint,
        );
        break;
      case _FaceExpression.neutral:
        canvas.drawLine(
          Offset(cx - mouthWidth / 2, mouthCy + size.height * 0.25),
          Offset(cx + mouthWidth / 2, mouthCy + size.height * 0.25),
          mouthPaint,
        );
        break;
      case _FaceExpression.good:
      case _FaceExpression.veryGood:
        canvas.drawArc(
          Rect.fromCenter(
            center: Offset(cx, mouthCy + size.height * 0.22),
            width: mouthWidth,
            height: mouthHeight,
          ),
          0.2,
          math.pi - 0.4,
          false,
          mouthPaint,
        );
        break;
    }
  }

  void _drawCircle(Canvas c, Paint p, double x, double y, double r) =>
      c.drawCircle(Offset(x, y), r, p);

  void _drawEllipse(
    Canvas c,
    Paint p,
    double cx,
    double cy,
    double rx,
    double ry,
  ) => c.drawOval(
    Rect.fromCenter(center: Offset(cx, cy), width: rx * 2, height: ry * 2),
    p,
  );

  void _drawRoundRect(
    Canvas c,
    Paint p,
    double x,
    double y,
    double w,
    double h,
    double r,
  ) => c.drawRRect(
    RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)),
    p,
  );

  @override
  bool shouldRepaint(covariant _FacePainter old) =>
      old.expression != expression || old.color != color;
}

class _OpenFeedbackPage extends StatelessWidget {
  const _OpenFeedbackPage({
    required this.colors,
    required this.featureController,
    required this.deliveryController,
  });

  final AppColorSet colors;
  final TextEditingController featureController;
  final TextEditingController deliveryController;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      children: [
        Text(
          'Additional Feedback',
          style: AppTypography.h2.copyWith(color: colors.onBackground),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'This part is optional. Share anything that would make GRID better.',
          style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.lg),
        TextField(
          controller: featureController,
          maxLines: 4,
          textInputAction: TextInputAction.newline,
          decoration: const InputDecoration(
            labelText: 'What feature or service should GRID add?',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        TextField(
          controller: deliveryController,
          maxLines: 4,
          textInputAction: TextInputAction.newline,
          decoration: const InputDecoration(
            labelText: 'Any comments about your order experience?',
            border: OutlineInputBorder(),
          ),
        ),
      ],
    );
  }
}

class _ThankYou extends StatelessWidget {
  const _ThankYou({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_rounded, color: colors.success, size: 72),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Thank You',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Your beta feedback was submitted. You will be logged out now.',
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }
}
