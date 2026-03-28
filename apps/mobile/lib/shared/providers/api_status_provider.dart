import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_health_check.dart';

/// Tracks whether the NestJS API server is reachable.
/// true = connected to real server, false = using mock data.
class ApiStatusNotifier extends StateNotifier<bool> {
  ApiStatusNotifier() : super(true) {
    _check();
  }

  Future<void> _check() async {
    state = await ApiHealthCheck.isServerReachable();
  }

  Future<void> refresh() async => _check();
}

final apiStatusProvider = StateNotifierProvider<ApiStatusNotifier, bool>(
  (ref) => ApiStatusNotifier(),
);
