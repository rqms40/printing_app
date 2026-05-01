import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';

class TutorialNotifier extends StateNotifier<Set<TutorialKey>> {
  TutorialNotifier(this._repo) : super({});

  final TutorialRepository _repo;

  // Called after login/autoLogin — loads server-synced prefs into state
  Future<void> loadFromPrefs() async {
    final keys = await _repo.loadLocal();
    state = keys;
  }

  Future<void> markSeen(TutorialKey key) async {
    // Optimistic update first
    state = {...state, key};
    await _repo.markSeen(key, currentKeys: state);
  }

  Future<void> resetAll() async {
    state = {};
    await _repo.resetAll();
  }

  // Clears in-memory state only — no API call. Used on logout.
  void resetStateOnly() => state = {};
}

final _tutorialRepositoryProvider = Provider<TutorialRepository>(
  (_) => TutorialRepository(),
);

final tutorialProvider = StateNotifierProvider<TutorialNotifier, Set<TutorialKey>>(
  (ref) => TutorialNotifier(ref.read(_tutorialRepositoryProvider)),
);

// Per-screen: true = already seen (don't show), false = first time (show tutorial).
// State is populated by loadFromPrefs() during login/autoLogin before any
// customer screen is reached, so empty state == new user (show tutorials).
final tutorialSeenProvider = Provider.family<bool, TutorialKey>((ref, key) {
  return ref.watch(tutorialProvider).contains(key);
});
