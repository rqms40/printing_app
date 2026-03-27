import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// Provides mock GPS location updates, emitting a new [LocationUpdate]
/// every 2 seconds from [MockData.locationUpdates].
class LocationNotifier extends StateNotifier<LocationUpdate?> {
  LocationNotifier() : super(null) {
    _start();
  }

  Timer? _timer;
  int _index = 0;

  void _start() {
    final updates = MockData.locationUpdates;
    if (updates.isEmpty) return;

    // Emit the first location immediately.
    state = updates[0];
    _index = 1;

    _timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (_index < updates.length) {
        state = updates[_index];
        _index++;
      } else {
        // Loop back to start.
        _index = 0;
        state = updates[_index];
        _index++;
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final locationProvider =
    StateNotifierProvider<LocationNotifier, LocationUpdate?>(
  (ref) => LocationNotifier(),
);
