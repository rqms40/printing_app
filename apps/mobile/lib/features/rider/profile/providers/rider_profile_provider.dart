import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/utils/file_helpers.dart';

class RiderProfileState {
  const RiderProfileState({
    this.fullName,
    this.email,
    this.phoneNumber,
    this.vehicleType,
    this.plateNumber,
    this.licenseNumber,
    this.payoutQrUrl,
    this.isAvailable = false,
    this.isLoading = true,
    this.isUploadingPayoutQr = false,
    this.errorMessage,
    this.successMessage,
  });

  final String? fullName;
  final String? email;
  final String? phoneNumber;
  final String? vehicleType;
  final String? plateNumber;
  final String? licenseNumber;
  final String? payoutQrUrl;
  final bool isAvailable;
  final bool isLoading;
  final bool isUploadingPayoutQr;
  final String? errorMessage;
  final String? successMessage;

  RiderProfileState copyWith({
    String? fullName,
    String? email,
    String? phoneNumber,
    String? vehicleType,
    String? plateNumber,
    String? licenseNumber,
    String? Function()? payoutQrUrl,
    bool? isAvailable,
    bool? isLoading,
    bool? isUploadingPayoutQr,
    String? Function()? errorMessage,
    String? Function()? successMessage,
  }) {
    return RiderProfileState(
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      vehicleType: vehicleType ?? this.vehicleType,
      plateNumber: plateNumber ?? this.plateNumber,
      licenseNumber: licenseNumber ?? this.licenseNumber,
      payoutQrUrl: payoutQrUrl != null ? payoutQrUrl() : this.payoutQrUrl,
      isAvailable: isAvailable ?? this.isAvailable,
      isLoading: isLoading ?? this.isLoading,
      isUploadingPayoutQr: isUploadingPayoutQr ?? this.isUploadingPayoutQr,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      successMessage:
          successMessage != null ? successMessage() : this.successMessage,
    );
  }
}

class RiderProfileNotifier extends StateNotifier<RiderProfileState> {
  RiderProfileNotifier() : super(const RiderProfileState()) {
    _load();
  }

  Future<void> _load() async {
    try {
      final response = await ApiClient.instance.get('/riders/profile');
      if (!mounted) return;
      final json = response.data as Map<String, dynamic>;
      final user = json['user'] as Map<String, dynamic>?;
      state = RiderProfileState(
        fullName: user?['fullName'] as String? ?? user?['full_name'] as String?,
        email: user?['email'] as String?,
        phoneNumber:
            user?['phoneNumber'] as String? ?? user?['phone_number'] as String?,
        vehicleType:
            json['vehicleType'] as String? ?? json['vehicle_type'] as String?,
        plateNumber:
            json['plateNumber'] as String? ?? json['plate_number'] as String?,
        licenseNumber:
            json['licenseNumber'] as String? ??
            json['license_number'] as String?,
        isAvailable:
            json['isAvailable'] as bool? ??
            json['is_available'] as bool? ??
            false,
        payoutQrUrl:
            json['payoutQrUrl']?.toString() ??
            json['payout_qr_url']?.toString(),
        isLoading: false,
      );
    } catch (_) {
      if (!mounted) return;
      final mock = MockData.riderProfileJuan;
      final user = MockData.riderJuan;
      state = RiderProfileState(
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        vehicleType: mock.vehicleType.displayName,
        plateNumber: mock.plateNumber,
        licenseNumber: mock.licenseNumber,
        isAvailable: mock.isAvailable,
        isLoading: false,
      );
    }
  }

  Future<void> setAvailability(bool value) async {
    state = state.copyWith(isAvailable: value);
    try {
      await ApiClient.instance.patch(
        '/riders/availability',
        data: {'isAvailable': value},
      );
    } catch (_) {}
  }

  Future<bool> updateVehicle({
    required String vehicleType,
    required String plateNumber,
  }) async {
    if (!mounted) return false;
    try {
      await ApiClient.instance.patch(
        '/riders/profile',
        data: {'vehicleType': vehicleType, 'plateNumber': plateNumber},
      );
      if (!mounted) return false;
      state = state.copyWith(
        vehicleType: vehicleType,
        plateNumber: plateNumber,
      );
      return true;
    } catch (_) {
      if (!mounted) return false;
      return false;
    }
  }

  Future<bool> updatePersonalInfo({
    required String fullName,
    required String phoneNumber,
  }) async {
    if (!mounted) return false;
    try {
      await ApiClient.instance.put(
        '/users/profile',
        data: {'fullName': fullName, 'phoneNumber': phoneNumber},
      );
      if (!mounted) return false;
      state = state.copyWith(
        fullName: fullName,
        phoneNumber: phoneNumber,
      );
      return true;
    } catch (_) {
      if (!mounted) return false;
      return false;
    }
  }

  Future<bool> uploadAndSetPayoutQr(XFile picked) async {
    if (!mounted) return false;
    state = state.copyWith(
      isUploadingPayoutQr: true,
      errorMessage: () => null,
      successMessage: () => null,
    );
    try {
      final bytes = await picked.readAsBytes();
      if (bytes.isEmpty) {
        throw StateError('Selected image is empty');
      }
      final filename = picked.name.trim().isEmpty
          ? 'rider-payout-qr.jpg'
          : picked.name;
      final extension = getFileExtension(filename);
      final contentType = DioMediaType.parse(mimeTypeForExtension(extension));
      final form = FormData.fromMap({
        'purpose': 'rider_payout_qr',
        'file': MultipartFile.fromBytes(
          bytes,
          filename: filename,
          contentType: contentType,
        ),
      });
      final uploadRes = await ApiClient.instance.post(
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
      await ApiClient.instance.patch(
        '/riders/profile',
        data: {'payoutQrFileId': id},
      );
      if (!mounted) return false;
      await _load();
      if (!mounted) return false;
      state = state.copyWith(
        isUploadingPayoutQr: false,
        successMessage: () => 'Payout QR updated',
      );
      return true;
    } catch (e) {
      if (!mounted) return false;
      String msg = e.toString();
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map && data['message'] != null) {
          msg = data['message'].toString();
        } else {
          msg = e.message ?? msg;
        }
      }
      state = state.copyWith(
        isUploadingPayoutQr: false,
        errorMessage: () => msg,
      );
      return false;
    }
  }

  Future<void> refresh() => _load();
}

final riderProfileProvider =
    StateNotifierProvider.autoDispose<RiderProfileNotifier, RiderProfileState>(
      (ref) => RiderProfileNotifier(),
    );
