import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';

enum PipelineStep {
  startPrintingTile,
  catalogGroup,
  catalogProduct,
  catalogRequirements,
  uploadCard,
  checkoutItems,
  checkoutDelivery,
  checkoutPayment,
  placeOrderButton,
  done;

  // Historical screens remain compilable while the live tutorial uses the
  // catalog vocabulary above.
  @Deprecated('Use catalogGroup')
  static const paperCategoryCard = catalogGroup;
  @Deprecated('Use catalogProduct')
  static const paperSpecsForm = catalogProduct;
  @Deprecated('Use catalogRequirements')
  static const paperSpecsContinue = catalogRequirements;
}

class PipelineState {
  const PipelineState({
    this.active = false,
    this.step = PipelineStep.startPrintingTile,
  });

  final bool active;
  final PipelineStep step;

  PipelineState copyWith({bool? active, PipelineStep? step}) =>
      PipelineState(active: active ?? this.active, step: step ?? this.step);
}

class PipelineTutorialNotifier extends StateNotifier<PipelineState> {
  PipelineTutorialNotifier(this._ref) : super(const PipelineState());

  final Ref _ref;

  void start() {
    state = const PipelineState(
      active: true,
      step: PipelineStep.startPrintingTile,
    );
  }

  void advance() {
    const values = PipelineStep.values;
    final nextIndex = state.step.index + 1;
    if (nextIndex >= values.length) {
      finish();
      return;
    }
    final next = values[nextIndex];
    if (next == PipelineStep.done) {
      finish();
      return;
    }
    state = state.copyWith(step: next);
  }

  void finish() {
    _ref.read(tutorialProvider.notifier).markSeen(TutorialKey.pipeline);
    state = const PipelineState();
  }

  void abandon() {
    // May be invoked from a deferred callback after teardown (e.g. a screen
    // disposed while the app is shutting down).
    if (!mounted) return;
    _ref.read(tutorialProvider.notifier).markSeen(TutorialKey.pipeline);
    state = const PipelineState();
  }

  void reset() {
    state = const PipelineState();
  }
}

final pipelineTutorialProvider =
    StateNotifierProvider<PipelineTutorialNotifier, PipelineState>(
      (ref) => PipelineTutorialNotifier(ref),
    );
