import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/shared/services/api_client.dart';

final betaStatusProvider = FutureProvider.autoDispose<BetaStatus?>((ref) async {
  // Re-run only when AuthStatus changes (login / logout).
  // Using .select avoids re-triggering on intermediate isLoading:true
  // state changes, which would race-condition the token storage and
  // cause the 401 interceptor to wipe the newly-saved token.
  final authStatus = ref.watch(authProvider.select((s) => s.status));

  if (authStatus == AuthStatus.authenticated) {
    try {
      final response = await ApiClient.instance.get('/beta-mode/me');
      return BetaStatus.fromJson(response.data as Map<String, dynamic>);
    } catch (_) {}
  }

  // Unauthenticated and failed member requests use the public global status.
  // This shows "BETA V1" without a rank number and avoids expected 401s.
  try {
    final response = await ApiClient.instance.get('/beta-mode/status');
    final isEnabled =
        (response.data as Map<String, dynamic>)['isEnabled'] as bool;
    return BetaStatus(
      globallyEnabled: isEnabled,
      isBetaUser: false,
      rank: null,
    );
  } catch (_) {
    return null;
  }
});
