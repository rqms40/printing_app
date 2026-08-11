import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/shared/services/api_client.dart';

typedef TutorialServerPatcher = Future<void> Function(List<String> keys);

class TutorialRepository {
  TutorialRepository({TutorialServerPatcher? patchServer})
    : _patchServer = patchServer ?? _patchServerDefault;

  static const _prefsKey = 'tutorial_seen_keys';
  final TutorialServerPatcher _patchServer;

  String _storageKey(String? accountId) {
    if (accountId == null || accountId.isEmpty) return _prefsKey;
    return '${_prefsKey}_${Uri.encodeComponent(accountId)}';
  }

  String _dirtyStorageKey(String? accountId) =>
      '${_storageKey(accountId)}_dirty';

  Future<Set<TutorialKey>> _loadKeys(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null) return {};
    final list = (jsonDecode(raw) as List).cast<String>();
    return list.map(TutorialKey.fromString).whereType<TutorialKey>().toSet();
  }

  Future<Set<TutorialKey>> loadLocal({String? accountId}) async {
    return _loadKeys(_storageKey(accountId));
  }

  Future<void> syncFromServer(
    List<String> serverKeys, {
    String? accountId,
  }) async {
    final dirty = await _loadKeys(_dirtyStorageKey(accountId));
    final reconciled = {
      ...serverKeys.map(TutorialKey.fromString).whereType<TutorialKey>(),
      ...dirty,
    };
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _storageKey(accountId),
      jsonEncode(reconciled.map((key) => key.name).toList()),
    );
    if (dirty.isNotEmpty) {
      try {
        await _patchServer(reconciled.map((key) => key.name).toList());
        await prefs.remove(_dirtyStorageKey(accountId));
      } catch (_) {
        // Keep the account-scoped dirty keys for the next authenticated sync.
      }
    }
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
    try {
      await _patchServer(updated.map((k) => k.name).toList());
      await prefs.remove(_dirtyStorageKey(accountId));
    } catch (_) {
      final dirty = await _loadKeys(_dirtyStorageKey(accountId));
      await prefs.setString(
        _dirtyStorageKey(accountId),
        jsonEncode({...dirty, key}.map((item) => item.name).toList()),
      );
    }
  }

  Future<void> resetAll({String? accountId}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey(accountId));
    await prefs.remove(_dirtyStorageKey(accountId));
    try {
      await _patchServer([]);
    } catch (_) {
      // Reset remains local when the server is unavailable.
    }
  }

  static Future<void> _patchServerDefault(List<String> keys) async {
    await ApiClient.instance.patch('/users/me/tutorials', data: {'keys': keys});
  }
}
