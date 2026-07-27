import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FlakyTutorialRepository extends TutorialRepository {
  _FlakyTutorialRepository() : super(patchServer: (_) async {});

  final failedKeys = <TutorialKey>{};
  final writtenKeys = <TutorialKey>[];
  TutorialKey? failOn;

  @override
  Future<void> markSeen(
    TutorialKey key, {
    required Set<TutorialKey> currentKeys,
    String? accountId,
  }) async {
    if (key == failOn) {
      failedKeys.add(key);
      throw StateError('SharedPreferences unavailable');
    }
    writtenKeys.add(key);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a failed write does not poison later tutorial writes', () async {
    final repository = _FlakyTutorialRepository()
      ..failOn = TutorialKey.values.first;
    final notifier = TutorialNotifier(repository);
    addTearDown(notifier.dispose);

    await notifier.markSeen(TutorialKey.values.first);
    expect(repository.failedKeys, contains(TutorialKey.values.first));

    // The next write must still reach the repository rather than inheriting
    // the rejected tail of the chain.
    await notifier.markSeen(TutorialKey.values.last);

    expect(repository.writtenKeys, contains(TutorialKey.values.last));
  });

  test('flushPendingWrites completes after a failed write', () async {
    final repository = _FlakyTutorialRepository()
      ..failOn = TutorialKey.values.first;
    final notifier = TutorialNotifier(repository);
    addTearDown(notifier.dispose);

    await notifier.markSeen(TutorialKey.values.first);

    await expectLater(notifier.flushPendingWrites(), completes);
  });

  test('optimistic state still records a key whose write failed', () async {
    final repository = _FlakyTutorialRepository()
      ..failOn = TutorialKey.values.first;
    final notifier = TutorialNotifier(repository);
    addTearDown(notifier.dispose);

    await notifier.markSeen(TutorialKey.values.first);

    expect(notifier.state, contains(TutorialKey.values.first));
  });
}
