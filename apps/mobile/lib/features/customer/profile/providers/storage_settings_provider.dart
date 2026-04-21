import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';
import 'package:printing_app/shared/services/api_client.dart';

class StorageSettingsNotifier
    extends StateNotifier<AsyncValue<StorageSettings>> {
  StorageSettingsNotifier() : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final response =
          await ApiClient.instance.get('/users/me/storage-settings');
      state = AsyncValue.data(
        StorageSettings.fromJson(response.data as Map<String, dynamic>),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> update(int? fileRetentionDays) async {
    try {
      final response = await ApiClient.instance.patch(
        '/users/me/storage-settings',
        data: {'fileRetentionDays': fileRetentionDays},
      );
      state = AsyncValue.data(
        StorageSettings.fromJson(response.data as Map<String, dynamic>),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final storageSettingsProvider = StateNotifierProvider.autoDispose<
    StorageSettingsNotifier, AsyncValue<StorageSettings>>(
  (ref) => StorageSettingsNotifier(),
);
