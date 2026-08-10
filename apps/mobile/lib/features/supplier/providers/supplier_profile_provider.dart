import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/features/supplier/models/supplier_profile.dart';
import 'package:printing_app/features/supplier/providers/supplier_jobs_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/utils/file_helpers.dart';

class SupplierProfileState {
  const SupplierProfileState({
    this.profile,
    this.isLoading = false,
    this.isSaving = false,
    this.isUploadingLogo = false,
    this.errorMessage,
    this.successMessage,
  });

  final SupplierProfile? profile;
  final bool isLoading;
  final bool isSaving;
  final bool isUploadingLogo;
  final String? errorMessage;
  final String? successMessage;

  SupplierProfileState copyWith({
    SupplierProfile? Function()? profile,
    bool? isLoading,
    bool? isSaving,
    bool? isUploadingLogo,
    String? Function()? errorMessage,
    String? Function()? successMessage,
  }) {
    return SupplierProfileState(
      profile: profile != null ? profile() : this.profile,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      isUploadingLogo: isUploadingLogo ?? this.isUploadingLogo,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      successMessage:
          successMessage != null ? successMessage() : this.successMessage,
    );
  }
}

class SupplierProfileNotifier extends StateNotifier<SupplierProfileState> {
  SupplierProfileNotifier({
    ApiClient? apiClient,
    bool bootstrap = true,
  })  : _api = apiClient ?? ApiClient.instance,
        super(const SupplierProfileState(isLoading: true)) {
    if (bootstrap) {
      refresh();
    }
  }

  final ApiClient _api;

  Future<void> refresh() async {
    state = state.copyWith(
      isLoading: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      final res = await _api.get('/suppliers/me');
      final data = res.data;
      if (data is! Map) {
        throw StateError('Invalid supplier profile response');
      }
      final profile = SupplierProfile.fromJson(
        Map<String, dynamic>.from(data),
      );
      state = state.copyWith(
        profile: () => profile,
        isLoading: false,
        errorMessage: () => null,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: () => extractSupplierApiError(e),
      );
    }
  }

  /// Updates shop details, attributes map, service zones, and/or logo file id.
  Future<bool> updateProfile({
    String? businessName,
    String? description,
    String? contactPhone,
    String? contactEmail,
    String? address,
    List<String>? serviceZones,
    List<String>? serviceFocusRanks,
    Map<String, String>? attributes,
    int? logoFileId,
    bool clearLogo = false,
  }) async {
    state = state.copyWith(
      isSaving: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      final body = <String, dynamic>{};
      if (businessName != null) body['businessName'] = businessName;
      if (description != null) body['description'] = description;
      if (contactPhone != null) body['contactPhone'] = contactPhone;
      if (contactEmail != null) body['contactEmail'] = contactEmail;
      if (address != null) body['address'] = address;
      if (serviceZones != null) body['serviceZones'] = serviceZones;
      if (serviceFocusRanks != null) {
        body['serviceFocusRanks'] = serviceFocusRanks;
      }
      if (attributes != null) body['attributes'] = attributes;
      if (clearLogo) {
        body['logoFileId'] = null;
      } else if (logoFileId != null) {
        body['logoFileId'] = logoFileId;
      }

      final res = await _api.patch('/suppliers/me', data: body);
      final data = res.data;
      if (data is Map) {
        final profile = SupplierProfile.fromJson(
          Map<String, dynamic>.from(data),
        );
        state = state.copyWith(
          profile: () => profile,
          isSaving: false,
          successMessage: () => 'Profile saved',
        );
      } else {
        await refresh();
        state = state.copyWith(
          isSaving: false,
          successMessage: () => 'Profile saved',
        );
      }
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => extractSupplierApiError(e),
      );
      return false;
    }
  }

  /// Onboarding + settings: ordered service focuses (works for pending suppliers).
  Future<bool> updateServiceFocusRanks(List<String> ranks) async {
    state = state.copyWith(
      isSaving: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      final res = await _api.patch(
        '/suppliers/me/service-focus',
        data: {'serviceFocusRanks': ranks},
      );
      final data = res.data;
      if (data is Map) {
        final profile = SupplierProfile.fromJson(
          Map<String, dynamic>.from(data),
        );
        state = state.copyWith(
          profile: () => profile,
          isSaving: false,
          successMessage: () => 'Service focus saved',
        );
      } else {
        await refresh();
        state = state.copyWith(
          isSaving: false,
          successMessage: () => 'Service focus saved',
        );
      }
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => extractSupplierApiError(e),
      );
      return false;
    }
  }

  /// Picks and uploads a logo, then attaches it via PATCH /suppliers/me.
  Future<bool> uploadAndSetLogo(XFile picked) async {
    state = state.copyWith(
      isUploadingLogo: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      final bytes = await picked.readAsBytes();
      if (bytes.isEmpty) {
        throw StateError('Selected image is empty');
      }
      final filename = picked.name.trim().isEmpty
          ? 'supplier-logo.jpg'
          : picked.name;
      final extension = getFileExtension(filename);
      final contentType = DioMediaType.parse(mimeTypeForExtension(extension));

      final form = FormData.fromMap({
        'purpose': 'general',
        'file': MultipartFile.fromBytes(
          bytes,
          filename: filename,
          contentType: contentType,
        ),
      });

      // Do not set Content-Type manually — Dio must attach multipart boundary.
      final uploadRes = await _api.post(
        '/files/upload',
        data: form,
      );
      final uploadData = uploadRes.data;
      if (uploadData is! Map) {
        throw StateError('Upload did not return metadata');
      }
      final fileId = uploadData['id'];
      final id = fileId is int
          ? fileId
          : int.tryParse(fileId?.toString() ?? '');
      if (id == null) {
        throw StateError('Upload did not return a file id');
      }

      final ok = await updateProfile(logoFileId: id);
      state = state.copyWith(isUploadingLogo: false);
      if (ok) {
        state = state.copyWith(
          successMessage: () => 'Profile picture updated',
        );
      }
      return ok;
    } catch (e) {
      state = state.copyWith(
        isUploadingLogo: false,
        errorMessage: () => extractSupplierApiError(e),
      );
      return false;
    }
  }

  Future<bool> addCapability({
    required String productFamily,
    List<String> materials = const [],
    int? maxCapacity,
    int? leadTimeDays,
  }) async {
    state = state.copyWith(
      isSaving: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      await _api.post(
        '/suppliers/me/capabilities',
        data: {
          'productFamily': productFamily.trim(),
          if (materials.isNotEmpty) 'materials': materials,
          'maxCapacity': ?maxCapacity,
          'leadTimeDays': ?leadTimeDays,
        },
      );
      await refresh();
      state = state.copyWith(
        isSaving: false,
        successMessage: () => 'Capability added',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => extractSupplierApiError(e),
      );
      return false;
    }
  }

  Future<bool> removeCapability(int capabilityId) async {
    state = state.copyWith(
      isSaving: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      await _api.delete('/suppliers/me/capabilities/$capabilityId');
      await refresh();
      state = state.copyWith(
        isSaving: false,
        successMessage: () => 'Capability removed',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => extractSupplierApiError(e),
      );
      return false;
    }
  }

  void clearMessages() {
    state = state.copyWith(
      errorMessage: () => null,
      successMessage: () => null,
    );
  }
}

final supplierProfileProvider =
    StateNotifierProvider<SupplierProfileNotifier, SupplierProfileState>((ref) {
  return SupplierProfileNotifier();
});

/// Debug-friendly factory used in widget tests.
@visibleForTesting
SupplierProfileNotifier createSupplierProfileNotifierForTest({
  ApiClient? apiClient,
  bool bootstrap = false,
}) {
  return SupplierProfileNotifier(apiClient: apiClient, bootstrap: bootstrap);
}
