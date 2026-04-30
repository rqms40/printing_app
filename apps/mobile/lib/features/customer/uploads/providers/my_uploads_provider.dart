import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';
import 'package:printing_app/shared/services/api_client.dart';

class MyUploadsNotifier extends StateNotifier<AsyncValue<List<UploadedFile>>> {
  MyUploadsNotifier() : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final response = await ApiClient.instance.get('/files/my-uploads');
      final list = (response.data as List<dynamic>)
          .map((e) => UploadedFile.fromJson(e as Map<String, dynamic>))
          .toList();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Permanently deletes a file (server removes both the original and any
  /// preview-GLB sibling from MinIO). Optimistically removes from local
  /// state — on server failure, re-fetches to restore the truth.
  Future<bool> deleteFile(int id) async {
    final previous = state;
    final current = state.value;
    if (current != null) {
      state = AsyncValue.data(current.where((f) => f.id != id).toList());
    }
    try {
      await ApiClient.instance.dio.delete('/files/$id');
      return true;
    } catch (_) {
      state = previous;
      return false;
    }
  }
}

final myUploadsProvider =
    StateNotifierProvider.autoDispose<MyUploadsNotifier, AsyncValue<List<UploadedFile>>>(
  (ref) => MyUploadsNotifier(),
);
