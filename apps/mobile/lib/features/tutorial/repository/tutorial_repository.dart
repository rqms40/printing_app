import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/shared/services/api_client.dart';

class TutorialRepository {
  static const _prefsKey = 'tutorial_seen_keys';

  Future<Set<TutorialKey>> loadLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return {};
    final list = (jsonDecode(raw) as List).cast<String>();
    return list
        .map(TutorialKey.fromString)
        .whereType<TutorialKey>()
        .toSet();
  }

  Future<void> syncFromServer(List<String> serverKeys) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(serverKeys));
  }

  Future<void> markSeen(TutorialKey key, {required Set<TutorialKey> currentKeys}) async {
    final updated = {...currentKeys, key};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(updated.map((k) => k.name).toList()));
    _patchServer(updated.map((k) => k.name).toList());
  }

  Future<void> resetAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
    _patchServer([]);
  }

  void _patchServer(List<String> keys) {
    try {
      ApiClient.instance
          .patch('/users/me/tutorials', data: {'keys': keys})
          .then((_) {}, onError: (_) {});
    } catch (_) {
      // Swallow sync errors (e.g. ApiClient not initialized in tests).
    }
  }
}
