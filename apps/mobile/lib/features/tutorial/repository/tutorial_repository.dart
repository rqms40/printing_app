import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/shared/services/api_client.dart';

class TutorialRepository {
  static const _prefsKey = 'tutorial_seen_keys';

  String _storageKey(String? accountId) {
    if (accountId == null || accountId.isEmpty) return _prefsKey;
    return '${_prefsKey}_${Uri.encodeComponent(accountId)}';
  }

  Future<Set<TutorialKey>> loadLocal({String? accountId}) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey(accountId));
    if (raw == null) return {};
    final list = (jsonDecode(raw) as List).cast<String>();
    return list.map(TutorialKey.fromString).whereType<TutorialKey>().toSet();
  }

  Future<void> syncFromServer(
    List<String> serverKeys, {
    String? accountId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey(accountId), jsonEncode(serverKeys));
  }

  Future<void> markSeen(
    TutorialKey key, {
    required Set<TutorialKey> currentKeys,
    String? accountId,
  }) async {
    final updated = {...currentKeys, key};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _storageKey(accountId),
      jsonEncode(updated.map((k) => k.name).toList()),
    );
    await _patchServer(updated.map((k) => k.name).toList());
  }

  Future<void> resetAll({String? accountId}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey(accountId));
    await _patchServer([]);
  }

  Future<void> _patchServer(List<String> keys) async {
    try {
      await ApiClient.instance.patch(
        '/users/me/tutorials',
        data: {'keys': keys},
      );
    } catch (_) {
      // Swallow sync errors (e.g. ApiClient not initialized in tests).
    }
  }
}
