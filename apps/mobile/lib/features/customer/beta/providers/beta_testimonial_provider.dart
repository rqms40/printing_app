import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class BetaTestimonialNotifier extends StateNotifier<AsyncValue<void>> {
  BetaTestimonialNotifier() : super(const AsyncData(null));

  Future<void> submit({
    required File photo,
    required bool sharedOnSocial,
  }) async {
    state = const AsyncLoading();
    try {
      // 1. Upload the photo file
      final fileName = photo.path.split('/').last;
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(photo.path, filename: fileName),
        'purpose': 'beta_testimonial',
      });

      final uploadResp = await ApiClient.instance.post(
        '/files/upload',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );

      final uploadData = uploadResp.data as Map<String, dynamic>;
      final fileId = uploadData['id'] as int;

      // 2. Mark the testimonial on the server
      await ApiClient.instance.post(
        '/beta-mode/testimonial',
        data: {
          'fileId': fileId,
          'sharedOnSocial': sharedOnSocial,
        },
      );

      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
      rethrow;
    }
  }
}

final betaTestimonialProvider =
    StateNotifierProvider.autoDispose<BetaTestimonialNotifier, AsyncValue<void>>(
  (_) => BetaTestimonialNotifier(),
);
