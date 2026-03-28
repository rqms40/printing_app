import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Tracks network connectivity state.
///
/// Emits `true` when online, `false` when offline.
/// Uses `connectivity_plus` to listen for real-time changes.
class ConnectivityNotifier extends StateNotifier<bool> {
  ConnectivityNotifier() : super(true) {
    _init();
  }

  StreamSubscription<List<ConnectivityResult>>? _subscription;

  Future<void> _init() async {
    // Check current state
    final result = await Connectivity().checkConnectivity();
    state = _isOnline(result);

    // Listen for changes
    _subscription = Connectivity().onConnectivityChanged.listen((result) {
      state = _isOnline(result);
    });
  }

  bool _isOnline(List<ConnectivityResult> results) {
    return results.any((r) => r != ConnectivityResult.none);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

/// `true` = online, `false` = offline.
final connectivityProvider =
    StateNotifierProvider<ConnectivityNotifier, bool>(
  (ref) => ConnectivityNotifier(),
);
