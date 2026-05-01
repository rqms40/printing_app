import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/printer_profile.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

final printerProfileProvider =
    FutureProvider.autoDispose<PrinterProfile?>((ref) async {
  final dio = ref.read(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/printer-profile');
    if (res.data == null) return null;
    return PrinterProfile.fromJson(res.data!);
  } catch (_) {
    return null;
  }
});
