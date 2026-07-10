import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Upload + submit state for the beta testimonial flow.
class BetaTestimonialState {
  const BetaTestimonialState({
    this.uploadProgress,
    this.error,
    this.submitted = false,
    this.sharedOnSocial = false,
    this.shareRecorded = false,
  });

  /// 0.0–1.0 while uploading; null when idle or done.
  final double? uploadProgress;

  /// Non-null when an error has occurred (retryable).
  final String? error;

  /// True once the full submit (upload + POST testimonial) succeeded.
  final bool submitted;
  final bool sharedOnSocial;
  final bool shareRecorded;

  bool get isUploading => uploadProgress != null;
  bool get hasError => error != null;

  BetaTestimonialState copyWith({
    double? uploadProgress,
    String? error,
    bool clearProgress = false,
    bool clearError = false,
    bool? submitted,
    bool? sharedOnSocial,
    bool? shareRecorded,
  }) => BetaTestimonialState(
    uploadProgress: clearProgress
        ? null
        : (uploadProgress ?? this.uploadProgress),
    error: clearError ? null : (error ?? this.error),
    submitted: submitted ?? this.submitted,
    sharedOnSocial: sharedOnSocial ?? this.sharedOnSocial,
    shareRecorded: shareRecorded ?? this.shareRecorded,
  );
}

typedef MarkBetaShared = Future<void> Function();

class BetaTestimonialNotifier extends StateNotifier<BetaTestimonialState> {
  BetaTestimonialNotifier({MarkBetaShared? markShared})
    : _markShared = markShared ?? _markSharedWithApi,
      super(const BetaTestimonialState());

  final MarkBetaShared _markShared;

  Future<void> recordConfirmedShare({
    required bool photoAlreadyUploaded,
  }) async {
    if (!state.sharedOnSocial) {
      state = state.copyWith(sharedOnSocial: true);
    }
    if (!photoAlreadyUploaded || state.shareRecorded) return;

    try {
      await _markShared();
      state = state.copyWith(sharedOnSocial: true, shareRecorded: true);
    } on DioException catch (error) {
      state = state.copyWith(error: _friendlyDioError(error));
      rethrow;
    } catch (error) {
      state = state.copyWith(error: error.toString());
      rethrow;
    }
  }

  /// Submit a testimonial. On web [photoBytes] is used instead of [photo].
  Future<void> submit({
    File? photo,
    Uint8List? photoBytes,
    String? photoFileName,
    required bool sharedOnSocial,
  }) async {
    assert(
      photo != null || (photoBytes != null && photoFileName != null),
      'Either photo (native) or photoBytes+photoFileName (web) must be provided',
    );

    state = state.copyWith(
      uploadProgress: 0.0,
      clearError: true,
      submitted: false,
    );

    try {
      // ── 1. Build form data ────────────────────────────────────────────────
      final MultipartFile multipart;
      if (photo != null) {
        final fileName = photo.path.split('/').last;
        multipart = await MultipartFile.fromFile(
          photo.path,
          filename: fileName,
        );
      } else {
        multipart = MultipartFile.fromBytes(
          photoBytes!,
          filename: photoFileName!,
        );
      }

      final formData = FormData.fromMap({
        'file': multipart,
        'purpose': 'beta_testimonial',
      });

      // ── 2. Upload with progress ───────────────────────────────────────────
      final uploadResp = await ApiClient.instance.post(
        '/files/upload',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
        onSendProgress: (sent, total) {
          if (total > 0 && mounted) {
            state = BetaTestimonialState(uploadProgress: sent / total);
          }
        },
      );

      final uploadData = uploadResp.data as Map<String, dynamic>;
      // Server returns the full FileMetadata entity; the PK field is 'id'.
      final fileId = uploadData['id'] as int;

      // ── 3. Record testimonial ─────────────────────────────────────────────
      await ApiClient.instance.post(
        '/beta-mode/testimonial',
        data: {
          'fileId': fileId,
          'sharedOnSocial': state.sharedOnSocial || sharedOnSocial,
        },
      );

      state = state.copyWith(
        clearProgress: true,
        clearError: true,
        submitted: true,
        sharedOnSocial: state.sharedOnSocial || sharedOnSocial,
        shareRecorded: state.sharedOnSocial || sharedOnSocial,
      );
    } on DioException catch (e) {
      final msg = _friendlyDioError(e);
      state = state.copyWith(clearProgress: true, error: msg);
      rethrow;
    } catch (e) {
      state = state.copyWith(clearProgress: true, error: e.toString());
      rethrow;
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true, clearProgress: true);
  }

  static Future<void> _markSharedWithApi() async {
    await ApiClient.instance.patch('/beta-mode/me/share');
  }

  static String _friendlyDioError(DioException e) {
    final status = e.response?.statusCode;
    if (status == 401) return 'Session expired — please sign in again.';
    if (status == 413)
      return 'Photo is too large. Please choose a smaller image.';
    if (status == 400) {
      final msg = e.response?.data?['message'];
      return (msg is String)
          ? msg
          : 'Invalid file. Please choose a JPEG, PNG, or WebP image.';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Upload timed out — check your connection and try again.';
    }
    if (status == 500) return 'Server error — please try again later.';
    return 'Upload failed. Please try again.';
  }
}

final betaTestimonialProvider =
    StateNotifierProvider.autoDispose<
      BetaTestimonialNotifier,
      BetaTestimonialState
    >((_) => BetaTestimonialNotifier());
