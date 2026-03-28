import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// Provides GPS location updates with fallback to mock data.
///
/// Attempts real GPS via [Geolocator] first. Falls back to mock data
/// when GPS is unavailable (desktop, WSL2, permission denied, etc.).
class LocationNotifier extends StateNotifier<LocationUpdate?> {
  LocationNotifier() : super(null) {
    _init();
  }

  StreamSubscription<Position>? _subscription;
  Timer? _mockTimer;
  int _mockIndex = 0;

  Future<void> _init() async {
    try {
      // Try real GPS
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        _startMockUpdates();
        return;
      }

      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (serviceEnabled) {
        _subscription = Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 10,
          ),
        ).listen((position) {
          state = LocationUpdate(
            id: 'live',
            deliveryAssignmentId: 'active',
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            heading: position.heading,
            timestamp: DateTime.now(),
          );
          // Send to server via WebSocket
          WebSocketService.instance.sendDriverLocation({
            'latitude': position.latitude,
            'longitude': position.longitude,
          });
        }, onError: (_) {
          // GPS stream error -- fall back to mock
          _startMockUpdates();
        });
        return; // Real GPS working
      }
    } catch (e) {
      debugPrint('GPS init failed: $e');
    }

    // Fallback to mock data (desktop/WSL2/permission denied)
    _startMockUpdates();
  }

  void _startMockUpdates() {
    final updates = MockData.locationUpdates;
    if (updates.isEmpty) return;

    // Emit the first location immediately.
    state = updates[0];
    _mockIndex = 1;

    _mockTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (_mockIndex < updates.length) {
        state = updates[_mockIndex];
        _mockIndex++;
      } else {
        // Loop back to start.
        _mockIndex = 0;
        state = updates[_mockIndex];
        _mockIndex++;
      }
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _mockTimer?.cancel();
    super.dispose();
  }
}

final locationProvider =
    StateNotifierProvider<LocationNotifier, LocationUpdate?>(
  (ref) => LocationNotifier(),
);
