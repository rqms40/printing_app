import 'package:hive_flutter/hive_flutter.dart';

/// Persists the current order draft to local storage using Hive.
///
/// All data is stored as a plain [Map<String, dynamic>] — no TypeAdapters needed.
class DraftStorageService {
  static const _boxName = 'draft_orders';
  static const _draftKey = 'current_draft';

  /// Must be called once before [runApp].
  static Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox(_boxName);
  }

  static Box get _box => Hive.box(_boxName);

  /// Saves the serialised order-flow state.
  static Future<void> saveDraft(Map<String, dynamic> data) async {
    await _box.put(_draftKey, data);
  }

  /// Loads the last saved draft, or `null` if none exists.
  static Map<String, dynamic>? loadDraft() {
    final data = _box.get(_draftKey);
    if (data == null) return null;
    return Map<String, dynamic>.from(data as Map);
  }

  /// Removes the current draft.
  static Future<void> clearDraft() async {
    await _box.delete(_draftKey);
  }

  /// Whether a draft is currently persisted.
  static bool get hasDraft => _box.containsKey(_draftKey);
}
