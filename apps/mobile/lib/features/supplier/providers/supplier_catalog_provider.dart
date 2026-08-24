import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/supplier/models/supplier_catalog.dart';
import 'package:printing_app/features/supplier/providers/supplier_jobs_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/utils/file_helpers.dart';

class SupplierCatalogState {
  const SupplierCatalogState({
    this.offerings = const [],
    this.isLoading = false,
    this.isSaving = false,
    this.errorMessage,
    this.successMessage,
    this.lastWarnings = const [],
  });

  final List<SupplierCatalogOffering> offerings;
  final bool isLoading;
  final bool isSaving;
  final String? errorMessage;
  final String? successMessage;
  final List<String> lastWarnings;

  SupplierCatalogState copyWith({
    List<SupplierCatalogOffering>? offerings,
    bool? isLoading,
    bool? isSaving,
    String? Function()? errorMessage,
    String? Function()? successMessage,
    List<String>? lastWarnings,
  }) {
    return SupplierCatalogState(
      offerings: offerings ?? this.offerings,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      successMessage:
          successMessage != null ? successMessage() : this.successMessage,
      lastWarnings: lastWarnings ?? this.lastWarnings,
    );
  }
}

class SupplierCatalogNotifier extends StateNotifier<SupplierCatalogState> {
  SupplierCatalogNotifier({ApiClient? apiClient})
    : _api = apiClient ?? ApiClient.instance,
      super(const SupplierCatalogState(isLoading: true)) {
    refresh();
  }

  final ApiClient _api;

  Future<void> refresh() async {
    state = state.copyWith(
      isLoading: true,
      errorMessage: () => null,
    );
    try {
      final res = await _api.get('/suppliers/me/catalog');
      final raw = res.data;
      final list = <SupplierCatalogOffering>[];
      if (raw is List) {
        for (final item in raw) {
          if (item is Map) {
            list.add(
              SupplierCatalogOffering.fromJson(Map<String, dynamic>.from(item)),
            );
          }
        }
      }
      state = state.copyWith(offerings: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: () => extractSupplierApiError(e),
      );
    }
  }

  Future<bool> upsert({
    required String title,
    required List<String> categorySlugs,
    Map<String, List<String>> specOptions = const {},
  }) async {
    state = state.copyWith(isSaving: true, errorMessage: () => null);
    try {
      final res = await _api.post(
        '/suppliers/me/catalog',
        data: {
          'title': title,
          'categorySlugs': categorySlugs,
          'specOptions': specOptions,
        },
      );
      final raw = res.data;
      final list = <SupplierCatalogOffering>[];
      if (raw is List) {
        for (final item in raw) {
          if (item is Map) {
            list.add(
              SupplierCatalogOffering.fromJson(Map<String, dynamic>.from(item)),
            );
          }
        }
      }
      state = state.copyWith(
        offerings: list,
        isSaving: false,
        successMessage: () => 'Catalog item saved',
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

  Future<bool> remove(int offeringId) async {
    try {
      await _api.delete('/suppliers/me/catalog/$offeringId');
      await refresh();
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: () => extractSupplierApiError(e));
      return false;
    }
  }

  Future<bool> importFile(PlatformFile file) async {
    final bytes = file.bytes;
    if (bytes == null || bytes.isEmpty) {
      state = state.copyWith(
        errorMessage: () => 'Could not read that catalog file',
      );
      return false;
    }
    state = state.copyWith(isSaving: true, errorMessage: () => null);
    try {
      final filename = file.name.trim().isEmpty ? 'catalog.docx' : file.name;
      final extension = getFileExtension(filename);
      final form = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          bytes,
          filename: filename,
          contentType: DioMediaType.parse(mimeTypeForExtension(extension)),
        ),
      });
      final res = await _api.post('/suppliers/me/catalog/import', data: form);
      final data = res.data;
      final warnings = <String>[];
      if (data is Map) {
        final parsed = data['parsed'];
        if (parsed is Map && parsed['warnings'] is List) {
          for (final w in parsed['warnings'] as List) {
            final s = w?.toString().trim() ?? '';
            if (s.isNotEmpty) warnings.add(s);
          }
        }
      }
      await refresh();
      state = state.copyWith(
        isSaving: false,
        lastWarnings: warnings,
        successMessage: () => 'Catalog imported',
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
}

final supplierCatalogProvider =
    StateNotifierProvider<SupplierCatalogNotifier, SupplierCatalogState>(
      (ref) => SupplierCatalogNotifier(),
    );
