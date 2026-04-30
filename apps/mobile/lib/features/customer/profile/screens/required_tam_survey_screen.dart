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
    final canContinue = !isQuestionPage || _answers[_page] != null;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: _submitted
              ? _ThankYou(colors: colors)
              : Column(
                  children: [
                    _Header(
                      colors: colors,
                      orderRef: hold?.orderRef,
                      progress: (_page + 1) / (_questions.length + 1),
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
                            number: index + 1,
                            total: _questions.length,
                            question: _questions[index],
                            labels: _answerLabels,
                            selected: _answers[index],
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
                          onPressed: _submitting || !canContinue ? null : _next,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors.accent,
                            foregroundColor: colors.accentOnColor,
                            disabledBackgroundColor: colors.surfaceVariant,
                            disabledForegroundColor: colors.disabled,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
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
  });

  final AppColorSet colors;
  final String? orderRef;
  final double progress;

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
            style: AppTypography.h2.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            orderRef == null
                ? 'Please complete this short survey to continue.'
                : 'Order $orderRef is complete. Please answer this short survey to finish your beta cycle.',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: colors.outlineVariant,
              valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
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
    required this.number,
    required this.total,
    required this.question,
    required this.labels,
    required this.selected,
    required this.onChanged,
  });

  final AppColorSet colors;
  final int number;
  final int total;
  final String question;
  final List<String> labels;
  final int? selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.sm,
        AppSpacing.xl,
        AppSpacing.sm,
      ),
      children: [
        Text(
          'Question $number of $total',
          style: AppTypography.overline.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          question,
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        const SizedBox(height: AppSpacing.md),
        for (var i = 0; i < labels.length; i += 1)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: _AnswerTile(
              colors: colors,
              label: labels[i],
              selected: selected == i,
              onTap: () => onChanged(i),
            ),
          ),
      ],
    );
  }
}

class _AnswerTile extends StatelessWidget {
  const _AnswerTile({
    required this.colors,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final AppColorSet colors;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? colors.accent : colors.surface,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: selected ? colors.accent : colors.outline,
            ),
          ),
          child: Text(
            label,
            style: AppTypography.bodyBold.copyWith(
              color: selected ? colors.accentOnColor : colors.onSurface,
            ),
          ),
        ),
      ),
    );
  }
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
