import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('TutorialRepository', () {
    test('loadLocal returns empty set when no prefs key', () async {
      final repo = TutorialRepository();
      final result = await repo.loadLocal();
      expect(result, isEmpty);
    });

    test('syncFromServer writes server keys to prefs', () async {
      final repo = TutorialRepository();
      await repo.syncFromServer(['onboarding', 'pipeline']);
      final result = await repo.loadLocal();
      expect(result, containsAll([TutorialKey.onboarding, TutorialKey.pipeline]));
    });

    test('markSeen adds key to existing set', () async {
      final repo = TutorialRepository();
      await repo.syncFromServer(['onboarding']);
      await repo.markSeen(TutorialKey.pipeline, currentKeys: {TutorialKey.onboarding});
      final result = await repo.loadLocal();
      expect(result, containsAll([TutorialKey.onboarding, TutorialKey.pipeline]));
    });

    test('resetAll clears all keys from prefs', () async {
      final repo = TutorialRepository();
      await repo.syncFromServer(['onboarding', 'pipeline', 'homeFeatures']);
      await repo.resetAll();
      final result = await repo.loadLocal();
      expect(result, isEmpty);
    });

    test('loadLocal ignores unknown key strings', () async {
      SharedPreferences.setMockInitialValues({
        'tutorial_seen_keys': '["onboarding","unknown_future_key"]',
      });
      final repo = TutorialRepository();
      final result = await repo.loadLocal();
      expect(result, contains(TutorialKey.onboarding));
      expect(result.length, 1); // unknown key silently dropped
    });
  });
}
