import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/shared/services/api_client.dart';

final betaStatusProvider = FutureProvider.autoDispose<BetaStatus?>((ref) async {
  try {
    final response = await ApiClient.instance.get('/beta-mode/me');
    return BetaStatus.fromJson(response.data as Map<String, dynamic>);
  } catch (_) {
    return null;
  }
});
