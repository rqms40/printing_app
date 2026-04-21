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
}

final myUploadsProvider =
    StateNotifierProvider.autoDispose<MyUploadsNotifier, AsyncValue<List<UploadedFile>>>(
  (ref) => MyUploadsNotifier(),
);
