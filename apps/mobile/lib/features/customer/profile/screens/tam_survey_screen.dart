import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ---------------------------------------------------------------------------
// TAM Questionnaire Data
// ---------------------------------------------------------------------------

enum LikertScale {
  stronglyDisagree,
  disagree,
  neutral,
  agree,
  stronglyAgree,
}

extension LikertScaleExt on LikertScale {
  String get label {
    switch (this) {
      case LikertScale.stronglyDisagree:
        return 'Strongly\nDisagree';
      case LikertScale.disagree:
        return 'Disagree';
      case LikertScale.neutral:
        return 'Neutral';
      case LikertScale.agree:
        return 'Agree';
      case LikertScale.stronglyAgree:
        return 'Strongly\nAgree';
    }
  }

  String get shortLabel {
    switch (this) {
      case LikertScale.stronglyDisagree:
        return 'STRONGLY\nDISAGREE';
      case LikertScale.disagree:
        return 'DISAGREE';
      case LikertScale.neutral:
        return 'NEUTRAL';
      case LikertScale.agree:
        return 'AGREE';
      case LikertScale.stronglyAgree:
        return 'STRONGLY\nAGREE';
    }
  }

  int get value => index + 1;

  Color get faceColor {
    switch (this) {
      case LikertScale.stronglyDisagree:
        return const Color(0xFFFF6B6B);
      case LikertScale.disagree:
        return const Color(0xFFFF9F43);
      case LikertScale.neutral:
        return const Color(0xFFFFD93D);
      case LikertScale.agree:
        return const Color(0xFF6BCB77);
      case LikertScale.stronglyAgree:
        return const Color(0xFF4CC9F0);
    }
  }

  // ignore: library_private_types_in_public_api
  _FaceExpression get expression {
    switch (this) {
      case LikertScale.stronglyDisagree:
        return _FaceExpression.veryBad;
      case LikertScale.disagree:
        return _FaceExpression.bad;
      case LikertScale.neutral:
        return _FaceExpression.neutral;
      case LikertScale.agree:
        return _FaceExpression.good;
      case LikertScale.stronglyAgree:
        return _FaceExpression.veryGood;
    }
  }
}

enum _FaceExpression { veryBad, bad, neutral, good, veryGood }

class TamQuestion {
  final String category;
  final String question;
  TamQuestion({required this.category, required this.question});
}

final _tamQuestions = [
  // SURVEY
  TamQuestion(
    category: 'SURVEY',
    question: 'GRID allows me to manage my printing tasks more efficiently.',
  ),
  TamQuestion(
    category: 'SURVEY',
    question: 'Using GRID simplifies my entire printing process.',
  ),
  TamQuestion(
    category: 'SURVEY',
    question: 'It was easy to learn how to use the GRID app.',
  ),
  TamQuestion(
    category: 'SURVEY',
    question: 'I find the GRID app intuitive and easy to navigate.',
  ),
  TamQuestion(
    category: 'SURVEY',
    question: 'I intend to continue using GRID for my printing needs.',
  ),
  TamQuestion(
    category: 'SURVEY',
    question: 'I would recommend GRID to my peers or colleagues.',
  ),
  // LOGISTICS & SERVICE
  TamQuestion(
    category: 'LOGISTICS & SERVICE',
    question: 'Accuracy of the prints received compared to your digital order.',
  ),
  TamQuestion(
    category: 'LOGISTICS & SERVICE',
    question: 'Physical condition of the prints (no damage, clean finish).',
  ),
  TamQuestion(
    category: 'LOGISTICS & SERVICE',
    question: 'Speed and punctuality of the delivery/pickup readiness.',
  ),
  TamQuestion(
    category: 'LOGISTICS & SERVICE',
    question: 'Clarity of the status updates (Order Received, Printing... delivery).',
  ),
  TamQuestion(
    category: 'LOGISTICS & SERVICE',
    question: 'The delivery/pickup system fits my schedule perfectly.',
  ),
  // PRODUCT & TECHNICAL SPECIFICS
  TamQuestion(
    category: 'PRODUCT & TECHNICAL SPECIFICS',
    question: 'Color accuracy and resolution of the final product.',
  ),
  TamQuestion(
    category: 'PRODUCT & TECHNICAL SPECIFICS',
    question: 'The weight and feel of the paper/media used.',
  ),
  TamQuestion(
    category: 'PRODUCT & TECHNICAL SPECIFICS',
    question: 'Performance of the app (no crashes or slow loading).',
  ),
];

// ---------------------------------------------------------------------------
// TAM Survey Screen – standalone page navigated from Profile
// ---------------------------------------------------------------------------

class TamSurveyScreen extends ConsumerStatefulWidget {
  const TamSurveyScreen({super.key});

  @override
  ConsumerState<TamSurveyScreen> createState() => _TamSurveyScreenState();
}

class _TamSurveyScreenState extends ConsumerState<TamSurveyScreen>
    with TickerProviderStateMixin {
  final Map<int, LikertScale> _answers = {};
  String? _comment;
  bool _submitted = false;
  bool _isSubmitting = false;

  late AnimationController _checkController;

  @override
  void initState() {
    super.initState();
    _checkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
  }

  @override
  void dispose() {
    _checkController.dispose();
    super.dispose();
  }

  void _openQuestion(int index) {
    Navigator.of(context).push(
      _SurveyFlowRoute(
        startIndex: index,
        questions: _tamQuestions,
        answers: _answers,
        initialComment: _comment,
        onAnswer: (idx, scale) {
          setState(() => _answers[idx] = scale);
        },
        onComment: (text) {
          setState(() => _comment = text);
          _submit(); // auto submit when finished
        },
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      final formattedAnswers = {};
      _answers.forEach((key, value) {
        formattedAnswers[key.toString()] = value.index;
      });

      await ApiClient.instance.post(
        '/tam-surveys',
        data: {
          'survey_data': formattedAnswers,
          'open_forum_feedback': _comment ?? '',
        },
      );

      setState(() => _submitted = true);
      _checkController.forward();
      HapticFeedback.mediumImpact();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit survey. Please try again.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    final answered = _answers.length;
    final total = _tamQuestions.length;
    final progress = total == 0 ? 0.0 : answered / total;
    final allAnswered = answered == total;

    if (_submitted) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.background,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: colors.onBackground),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: _SubmittedView(
          colors: colors,
          onReset: () {
            setState(() {
              _answers.clear();
              _comment = null;
              _submitted = false;
              _checkController.reset();
            });
          },
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: colors.onBackground),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Survey',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        centerTitle: false,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header + progress
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.sm,
              AppSpacing.xl,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Help us improve GRID by sharing your experience.',
                  style:
                      AppTypography.body.copyWith(color: colors.onSurfaceDim),
                ),
                const SizedBox(height: AppSpacing.md),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: progress),
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOut,
                    builder: (context, value, _) {
                      return LinearProgressIndicator(
                        value: value,
                        minHeight: 6,
                        backgroundColor: colors.outlineVariant,
                        valueColor: AlwaysStoppedAnimation<Color>(colors.accent),
                      );
                    },
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '$answered / $total answered',
                  style: AppTypography.caption
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ],
            ),
          ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.02, duration: 350.ms),

          // Question list
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xl,
                vertical: AppSpacing.sm,
              ),
              itemCount: _tamQuestions.length + 2,
              itemBuilder: (context, i) {
                if (i == _tamQuestions.length + 1) {
                  return const SizedBox.shrink(); // Automatically handled by modal now
                }

                if (i == _tamQuestions.length) {
                  final hasComment = _comment != null && _comment!.trim().isNotEmpty;
                  final faceColor = const Color(0xFF4CC9F0);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: AppSpacing.lg),
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Text(
                          'OPEN FORUM',
                          style: AppTypography.overline.copyWith(
                            color: colors.onSurfaceDim,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _openQuestion(i),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeOut,
                          decoration: BoxDecoration(
                            color: hasComment ? faceColor.withValues(alpha: 0.1) : colors.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: hasComment ? faceColor.withValues(alpha: 0.4) : colors.outline,
                              width: hasComment ? 1.5 : 1,
                            ),
                          ),
                          padding: const EdgeInsets.all(AppSpacing.md),
                          child: Row(
                            children: [
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 300),
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: hasComment ? faceColor : colors.surfaceVariant,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: hasComment
                                      ? const Icon(Icons.check, size: 16, color: Colors.white)
                                      : Icon(Icons.comment_rounded, size: 16, color: colors.onSurfaceDim),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Additional Feedback',
                                      style: AppTypography.body.copyWith(color: colors.onBackground),
                                    ),
                                    if (hasComment) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        _comment!.length > 40 ? '${_comment!.substring(0, 40).replaceAll('\n', ' ')}...' : _comment!.replaceAll('\n', ' '),
                                        style: AppTypography.caption.copyWith(
                                          color: faceColor,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Icon(
                                hasComment ? Icons.edit_rounded : Icons.chevron_right_rounded,
                                size: 20,
                                color: hasComment ? faceColor : colors.onSurfaceDim,
                              ),
                            ],
                          ),
                        ),
                      ).animate().fadeIn(delay: Duration(milliseconds: 40 * i), duration: 350.ms).slideX(begin: 0.04, duration: 350.ms),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  );
                }

                final question = _tamQuestions[i];
                final answer = _answers[i];
                final showCategory = i == 0 ||
                    _tamQuestions[i - 1].category != question.category;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showCategory) ...[
                      if (i != 0) const SizedBox(height: AppSpacing.lg),
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Text(
                          question.category.toUpperCase(),
                          style: AppTypography.overline.copyWith(
                            color: colors.onSurfaceDim,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ),
                    ],
                    _QuestionCard(
                      number: i + 1,
                      question: question.question,
                      answer: answer,
                      colors: colors,
                      onTap: () => _openQuestion(i),
                    )
                        .animate()
                        .fadeIn(
                          delay: Duration(milliseconds: 40 * i),
                          duration: 350.ms,
                        )
                        .slideX(begin: 0.04, duration: 350.ms),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Question Card
// ---------------------------------------------------------------------------

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.number,
    required this.question,
    required this.answer,
    required this.colors,
    required this.onTap,
  });

  final int number;
  final String question;
  final LikertScale? answer;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasAnswer = answer != null;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          color: hasAnswer
              ? answer!.faceColor.withValues(alpha: 0.1)
              : colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: hasAnswer
                ? answer!.faceColor.withValues(alpha: 0.4)
                : colors.outline,
            width: hasAnswer ? 1.5 : 1,
          ),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: hasAnswer ? answer!.faceColor : colors.surfaceVariant,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: hasAnswer
                    ? const Icon(Icons.check, size: 16, color: Colors.white)
                    : Text(
                        '$number',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    question,
                    style: AppTypography.body
                        .copyWith(color: colors.onBackground),
                  ),
                  if (hasAnswer) ...[
                    const SizedBox(height: 4),
                    Text(
                      answer!.shortLabel.replaceAll('\n', ' '),
                      style: AppTypography.caption.copyWith(
                        color: answer!.faceColor,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(
              hasAnswer ? Icons.edit_rounded : Icons.chevron_right_rounded,
              size: 20,
              color: hasAnswer ? answer!.faceColor : colors.onSurfaceDim,
            ),
          ],
        ),
      ),
    );
  }
}

// Removed _SubmitButton

// ---------------------------------------------------------------------------
// Submitted / Thank-you View
// ---------------------------------------------------------------------------

class _SubmittedView extends StatelessWidget {
  const _SubmittedView({required this.colors, required this.onReset});

  final AppColorSet colors;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: const Duration(milliseconds: 700),
              curve: Curves.elasticOut,
              builder: (context, v, child) =>
                  Transform.scale(scale: v, child: child),
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(0xFF6BCB77).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF6BCB77),
                  size: 60,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Thank You!',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ).animate().fadeIn(delay: 300.ms, duration: 400.ms),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Your feedback helps us improve GRID for everyone.',
              textAlign: TextAlign.center,
              style:
                  AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ).animate().fadeIn(delay: 450.ms, duration: 400.ms),
            const SizedBox(height: AppSpacing.xxl),
            GestureDetector(
              onTap: onReset,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.md,
                ),
                decoration: BoxDecoration(
                  border: Border.all(color: colors.outline),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Retake Survey',
                  style: AppTypography.button
                      .copyWith(color: colors.onSurface),
                ),
              ),
            ).animate().fadeIn(delay: 600.ms, duration: 400.ms),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Survey Flow Route & Screen
// ---------------------------------------------------------------------------

class _SurveyFlowRoute extends PageRoute<void> {
  _SurveyFlowRoute({
    required this.startIndex,
    required this.questions,
    required this.answers,
    required this.initialComment,
    required this.onAnswer,
    required this.onComment,
  }) : super(fullscreenDialog: true);

  final int startIndex;
  final List<TamQuestion> questions;
  final Map<int, LikertScale> answers;
  final String? initialComment;
  final void Function(int, LikertScale) onAnswer;
  final void Function(String) onComment;

  @override
  Color? get barrierColor => Colors.black87;

  @override
  bool get barrierDismissible => false;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 450);

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.08),
          end: Offset.zero,
        ).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOut),
        ),
        child: _SurveyFlowScreen(
          startIndex: startIndex,
          questions: questions,
          answers: answers,
          initialComment: initialComment,
          onAnswer: onAnswer,
          onComment: onComment,
        ),
      ),
    );
  }

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return child;
  }
}

class _SurveyFlowScreen extends StatefulWidget {
  const _SurveyFlowScreen({
    required this.startIndex,
    required this.questions,
    required this.answers,
    required this.initialComment,
    required this.onAnswer,
    required this.onComment,
  });

  final int startIndex;
  final List<TamQuestion> questions;
  final Map<int, LikertScale> answers;
  final String? initialComment;
  final void Function(int, LikertScale) onAnswer;
  final void Function(String) onComment;

  @override
  State<_SurveyFlowScreen> createState() => _SurveyFlowScreenState();
}

class _SurveyFlowScreenState extends State<_SurveyFlowScreen> {
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: widget.startIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_pageController.page!.toInt() < widget.questions.length) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOutCubic,
      );
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      controller: _pageController,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: widget.questions.length + 1,
      itemBuilder: (context, index) {
        if (index < widget.questions.length) {
          return _SurveyQuestionPage(
            question: widget.questions[index],
            questionNumber: index + 1,
            totalQuestions: widget.questions.length,
            initialValue: widget.answers[index],
            onConfirm: (scale) {
              widget.onAnswer(index, scale);
              _nextPage();
            },
            onClose: () => Navigator.of(context).pop(),
          );
        } else {
          return _OpenForumPage(
            initialText: widget.initialComment,
            onConfirm: (text) {
              widget.onComment(text);
              Navigator.of(context).pop();
            },
            onClose: () => Navigator.of(context).pop(),
          );
        }
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Survey Question Page – the interactive slider + face screen
// ---------------------------------------------------------------------------

class _SurveyQuestionPage extends StatefulWidget {
  const _SurveyQuestionPage({
    required this.question,
    required this.questionNumber,
    required this.totalQuestions,
    this.initialValue,
    required this.onConfirm,
    required this.onClose,
  });

  final TamQuestion question;
  final int questionNumber;
  final int totalQuestions;
  final LikertScale? initialValue;
  final void Function(LikertScale) onConfirm;
  final VoidCallback onClose;

  @override
  State<_SurveyQuestionPage> createState() => _SurveyQuestionPageState();
}

class _SurveyQuestionPageState extends State<_SurveyQuestionPage>
    with TickerProviderStateMixin {
  late double _sliderValue;
  late LikertScale _currentScale;

  late AnimationController _faceController;
  late AnimationController _labelController;
  late AnimationController _pulseController;

  late Animation<double> _faceScale;
  late Animation<double> _labelFade;
  late Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _currentScale = widget.initialValue ?? LikertScale.neutral;
    _sliderValue = _currentScale.index.toDouble();

    _faceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _labelController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _faceScale = Tween<double>(begin: 0.82, end: 1.0).animate(
      CurvedAnimation(parent: _faceController, curve: Curves.elasticOut),
    );
    _labelFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _labelController, curve: Curves.easeOut),
    );
    _pulse = Tween<double>(begin: 0.97, end: 1.04).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _faceController.forward();
    _labelController.forward();
  }

  @override
  void dispose() {
    _faceController.dispose();
    _labelController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _onSliderChanged(double value) {
    final newIndex = value.round();
    final newScale = LikertScale.values[newIndex];

    if (newScale != _currentScale) {
      HapticFeedback.selectionClick();
      setState(() {
        _sliderValue = value;
        _currentScale = newScale;
      });
      _faceController
        ..reset()
        ..forward();
      _labelController
        ..reset()
        ..forward();
    } else {
      setState(() => _sliderValue = value);
    }
  }

  void _confirm() {
    HapticFeedback.mediumImpact();
    widget.onConfirm(_currentScale);
  }

  @override
  Widget build(BuildContext context) {
    final bg = _currentScale.faceColor;
    final isDark =
        ThemeData.estimateBrightnessForColor(bg) == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final dimColor = textColor.withValues(alpha: 0.55);

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.md,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: widget.onClose,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: textColor.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.close_rounded,
                        color: textColor,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.question.category.toUpperCase(),
                          style: AppTypography.overline.copyWith(
                            color: dimColor,
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'Question ${widget.questionNumber} of ${widget.totalQuestions}',
                          style: AppTypography.caption
                              .copyWith(color: dimColor),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // ── Question text ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xxl),
              child: Text(
                widget.question.question,
                textAlign: TextAlign.center,
                style: AppTypography.h3.copyWith(
                  color: textColor,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                ),
              ),
            ),

            const Spacer(),

            // ── Animated face ──────────────────────────────────────────
            AnimatedBuilder(
              animation: Listenable.merge(
                  [_faceController, _pulseController]),
              builder: (_, _) => Transform.scale(
                scale: _faceScale.value * _pulse.value,
                child: _AnimatedFace(
                  expression: _currentScale.expression,
                  color: textColor,
                  size: 160,
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // ── Big label ──────────────────────────────────────────────
            AnimatedBuilder(
              animation: _labelController,
              builder: (_, child) =>
                  Opacity(opacity: _labelFade.value, child: child),
              child: Text(
                _currentScale.shortLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Poppins',
                  fontSize: 38,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                  height: 1.1,
                ).copyWith(color: textColor),
              ),
            ),

            const Spacer(),

            // ── Slider controls ────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                children: [
                  // Dot indicators
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: LikertScale.values.map((s) {
                      final isActive = s == _currentScale;
                      return Expanded(
                        child: Center(
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
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
                    }).toList(),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // The slider
                  SliderTheme(
                    data: SliderThemeData(
                      trackHeight: 5,
                      thumbShape: _CustomThumbShape(color: textColor),
                      activeTrackColor: textColor,
                      inactiveTrackColor: textColor.withValues(alpha: 0.22),
                      overlayColor: textColor.withValues(alpha: 0.14),
                      overlayShape:
                          const RoundSliderOverlayShape(overlayRadius: 22),
                    ),
                    child: Slider(
                      min: 0,
                      max: 4,
                      divisions: 4,
                      value: _sliderValue,
                      onChanged: _onSliderChanged,
                    ),
                  ),

                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Strongly\nDisagree',
                        style: AppTypography.caption
                            .copyWith(color: dimColor),
                        textAlign: TextAlign.left,
                      ),
                      Text(
                        'Strongly\nAgree',
                        style: AppTypography.caption
                            .copyWith(color: dimColor),
                        textAlign: TextAlign.right,
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // ── Confirm button ─────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: _ConfirmButton(
                onTap: _confirm,
                textColor: textColor,
                bgColor: textColor.withValues(alpha: 0.14),
                label: 'Next',
              ),
            ),

            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Custom Slider Thumb Shape
// ---------------------------------------------------------------------------

class _CustomThumbShape extends SliderComponentShape {
  const _CustomThumbShape({required this.color});

  final Color color;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      const Size(28, 28);

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

    // Shadow
    canvas.drawCircle(
      center + const Offset(0, 2),
      14,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );

    // Thumb
    canvas.drawCircle(center, 13, Paint()..color = color);

    // Inner highlight
    canvas.drawCircle(
      center,
      5,
      Paint()
        ..color = (color == Colors.white
                ? Colors.black
                : Colors.white)
            .withValues(alpha: 0.35),
    );
  }
}

// ---------------------------------------------------------------------------
// Animated Face (CustomPainter)
// ---------------------------------------------------------------------------

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

    final eyeCy = cy - 18; // Pull eyes up for more padding

    switch (expression) {
      case _FaceExpression.veryBad:
        // Squinting small ovals
        _drawEllipse(canvas, paint, cx - size.width * 0.23, eyeCy - 8, 20, 12);
        _drawEllipse(canvas, paint, cx + size.width * 0.23, eyeCy - 8, 20, 12);
        break;
      case _FaceExpression.bad:
        // Sleepy pill rectangles
        _drawRoundRect(
            canvas, paint, cx - size.width * 0.23 - 21, eyeCy - 7, 42, 15, 7);
        _drawRoundRect(
            canvas, paint, cx + size.width * 0.23 - 21, eyeCy - 7, 42, 15, 7);
        break;
      case _FaceExpression.neutral:
        // Medium circles
        _drawCircle(canvas, paint, cx - size.width * 0.23, eyeCy - 5, 20);
        _drawCircle(canvas, paint, cx + size.width * 0.23, eyeCy - 5, 20);
        break;
      case _FaceExpression.good:
        // Larger open circles
        _drawCircle(canvas, paint, cx - size.width * 0.22, eyeCy, 26);
        _drawCircle(canvas, paint, cx + size.width * 0.22, eyeCy, 26);
        break;
      case _FaceExpression.veryGood:
        // Big bright circles + shine
        _drawCircle(canvas, paint, cx - size.width * 0.23, eyeCy, 31);
        _drawCircle(canvas, paint, cx + size.width * 0.23, eyeCy, 31);
        final shinePaint = Paint()
          ..color = color.withValues(alpha: 0.32)
          ..style = PaintingStyle.fill;
        _drawCircle(
            canvas, shinePaint, cx - size.width * 0.23 + 9, eyeCy - 10, 8);
        _drawCircle(
            canvas, shinePaint, cx + size.width * 0.23 + 9, eyeCy - 10, 8);
        break;
    }

    // Mouth
    final mouthPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    final mouthWidth = size.width * 0.35;
    final mouthHeight = size.height * 0.20;
    final mouthCy = cy + 12; // Push mouth down for more padding

    switch (expression) {
      case _FaceExpression.veryBad:
      case _FaceExpression.bad:
        // Sad face (arc curving downwards)
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
        // Straight line
        canvas.drawLine(
          Offset(cx - mouthWidth / 2, mouthCy + size.height * 0.25),
          Offset(cx + mouthWidth / 2, mouthCy + size.height * 0.25),
          mouthPaint,
        );
        break;
      case _FaceExpression.good:
      case _FaceExpression.veryGood:
        // Happy face (arc curving upwards)
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
      Canvas c, Paint p, double cx, double cy, double rx, double ry) =>
      c.drawOval(
        Rect.fromCenter(
            center: Offset(cx, cy), width: rx * 2, height: ry * 2),
        p,
      );

  void _drawRoundRect(Canvas c, Paint p, double x, double y, double w,
      double h, double r) =>
      c.drawRRect(
        RRect.fromRectAndRadius(
            Rect.fromLTWH(x, y, w, h), Radius.circular(r)),
        p,
      );

  @override
  bool shouldRepaint(covariant _FacePainter old) =>
      old.expression != expression || old.color != color;
}

// ---------------------------------------------------------------------------
// Confirm Button
// ---------------------------------------------------------------------------

class _ConfirmButton extends StatefulWidget {
  const _ConfirmButton({
    required this.onTap,
    required this.textColor,
    required this.bgColor,
    this.label = 'Confirm',
    this.icon = Icons.arrow_forward_rounded,
  });

  final VoidCallback onTap;
  final Color textColor;
  final Color bgColor;
  final String label;
  final IconData icon;

  @override
  State<_ConfirmButton> createState() => _ConfirmButtonState();
}

class _ConfirmButtonState extends State<_ConfirmButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: widget.bgColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: widget.textColor.withValues(alpha: 0.3),
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                widget.label,
                style: AppTypography.button.copyWith(
                  color: widget.textColor,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Icon(
                widget.icon,
                color: widget.textColor,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Open Forum Page
// ---------------------------------------------------------------------------

class _OpenForumPage extends StatefulWidget {
  const _OpenForumPage({
    this.initialText,
    required this.onConfirm,
    required this.onClose,
  });

  final String? initialText;
  final void Function(String) onConfirm;
  final VoidCallback onClose;

  @override
  State<_OpenForumPage> createState() => _OpenForumPageState();
}

class _OpenForumPageState extends State<_OpenForumPage> {
  late TextEditingController _featureController;
  late TextEditingController _deliveryController;

  @override
  void initState() {
    super.initState();
    String feature = '';
    String delivery = '';
    if (widget.initialText != null && widget.initialText!.isNotEmpty) {
      try {
        final map = jsonDecode(widget.initialText!);
        feature = map['feature'] ?? '';
        delivery = map['delivery'] ?? '';
      } catch (e) {
        feature = widget.initialText!;
      }
    }
    _featureController = TextEditingController(text: feature);
    _deliveryController = TextEditingController(text: delivery);
  }

  @override
  void dispose() {
    _featureController.dispose();
    _deliveryController.dispose();
    super.dispose();
  }

  void _confirm() {
    HapticFeedback.mediumImpact();
    final data = jsonEncode({
      'feature': _featureController.text,
      'delivery': _deliveryController.text,
    });
    widget.onConfirm(data);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF8F9FA);
    final textColor = isDark ? Colors.white : Colors.black87;
    final dimColor = textColor.withValues(alpha: 0.55);

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.md,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: widget.onClose,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: textColor.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.close_rounded,
                        color: textColor,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'OPEN FORUM',
                          style: AppTypography.overline.copyWith(
                            color: dimColor,
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'Additional Feedback',
                          style: AppTypography.caption.copyWith(color: dimColor),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Column(
                  children: [
                    Text(
                      'What is one feature or service you wish GRID would add in the future?',
                      textAlign: TextAlign.left,
                      style: AppTypography.body.copyWith(
                        color: textColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Expanded(
                      flex: 3,
                      child: Container(
                        decoration: BoxDecoration(
                          color: textColor.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: textColor.withValues(alpha: 0.1),
                          ),
                        ),
                        child: TextField(
                          controller: _featureController,
                          maxLines: null,
                          expands: true,
                          style: AppTypography.body.copyWith(color: textColor),
                          decoration: InputDecoration(
                            hintText: 'Share your thoughts...',
                            hintStyle: AppTypography.body.copyWith(color: dimColor),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.all(AppSpacing.md),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      '(Optional) Any additional comments regarding your experience?',
                      textAlign: TextAlign.left,
                      style: AppTypography.body.copyWith(
                        color: textColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Expanded(
                      flex: 2,
                      child: Container(
                        decoration: BoxDecoration(
                          color: textColor.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: textColor.withValues(alpha: 0.1),
                          ),
                        ),
                        child: TextField(
                          controller: _deliveryController,
                          maxLines: null,
                          expands: true,
                          style: AppTypography.body.copyWith(color: textColor),
                          decoration: InputDecoration(
                            hintText: 'Optional comments...',
                            hintStyle: AppTypography.body.copyWith(color: dimColor),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.all(AppSpacing.md),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: _ConfirmButton(
                onTap: _confirm,
                textColor: textColor,
                bgColor: textColor.withValues(alpha: 0.14),
                label: 'Submit Feedback',
                icon: Icons.check_rounded,
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}
