import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('PipelineTutorialNotifier', () {
    test('initial state is inactive at startPrintingTile', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);
    });

    test('start sets active=true at startPrintingTile', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isTrue);
      expect(state.step, PipelineStep.startPrintingTile);
    });

    test('advance moves to next step', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      container.read(pipelineTutorialProvider.notifier).advance();
      expect(
        container.read(pipelineTutorialProvider).step,
        PipelineStep.paperCategoryCard,
      );
    });

    test(
      'advance from placeOrderButton triggers finish (marks pipeline seen, clears state)',
      () async {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        final notifier = container.read(pipelineTutorialProvider.notifier);
        notifier.start();
        for (var i = 0; i < PipelineStep.placeOrderButton.index; i++) {
          notifier.advance();
        }
        expect(
          container.read(pipelineTutorialProvider).step,
          PipelineStep.placeOrderButton,
        );

        notifier.advance(); // → finish()

        final state = container.read(pipelineTutorialProvider);
        expect(state.active, isFalse);
        expect(state.step, PipelineStep.startPrintingTile);

        await Future<void>.delayed(Duration.zero);
        expect(
          container.read(tutorialProvider).contains(TutorialKey.pipeline),
          isTrue,
        );
      },
    );

    test('abandon marks pipeline seen and clears state', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      container.read(pipelineTutorialProvider.notifier).advance();
      container.read(pipelineTutorialProvider.notifier).abandon();

      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);

      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(tutorialProvider).contains(TutorialKey.pipeline),
        isTrue,
      );
    });

    test('reset clears state without marking seen', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      container.read(pipelineTutorialProvider.notifier).advance();
      container.read(pipelineTutorialProvider.notifier).reset();

      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);

      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(tutorialProvider).contains(TutorialKey.pipeline),
        isFalse,
      );
    });

    test('pipeline completion survives immediate session reset', () async {
      final repository = TutorialRepository();
      final notifier = TutorialNotifier(repository);
      addTearDown(notifier.dispose);
      await notifier.loadForAccount(
        accountId: 'customer-one',
        serverKeys: const [],
      );

      unawaited(notifier.markSeen(TutorialKey.pipeline));
      notifier.resetStateOnly();
      await notifier.flushPendingWrites();

      final nextSession = TutorialNotifier(repository);
      addTearDown(nextSession.dispose);
      await nextSession.loadForAccount(accountId: 'customer-one');
      expect(nextSession.state, contains(TutorialKey.pipeline));
    });
  });
}
