import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// Tracks rider GPS for an active delivery and broadcasts to customers.
class RiderLocationTracker extends StateNotifier<LatLng?> {
  RiderLocationTracker({
    required this.assignmentId,
    required this.enabled,
  }) : super(null) {
    if (enabled) {
      unawaited(_start());
    }
  }

  final String assignmentId;
  final bool enabled;

  StreamSubscription<Position>? _subscription;
  Timer? _mockTimer;
  int _mockIndex = 0;
  DateTime? _lastRestUpdate;

  Future<void> _start() async {
    await WebSocketService.instance.connectLocation();
    try {
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
        final current = await Geolocator.getCurrentPosition();
        _emitPosition(current);
        _subscription = Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 12,
          ),
        ).listen(_emitPosition, onError: (_) => _startMockUpdates());
        return;
      }
    } catch (e) {
      debugPrint('RiderLocationTracker: $e');
    }
    _startMockUpdates();
  }

  void _emitPosition(Position position) {
    final point = LatLng(position.latitude, position.longitude);
    state = point;
    _broadcast(point);
  }

  void _broadcast(LatLng point) {
    WebSocketService.instance.sendRiderLocation({
      'assignmentId': assignmentId,
      'latitude': point.latitude,
      'longitude': point.longitude,
      'timestamp': DateTime.now().toIso8601String(),
    });

    final now = DateTime.now();
    if (_lastRestUpdate != null &&
        now.difference(_lastRestUpdate!) < const Duration(seconds: 15)) {
      return;
    }
    _lastRestUpdate = now;
    unawaited(
      ApiClient.instance
          .patch(
            '/riders/location',
            data: {
              'latitude': point.latitude,
              'longitude': point.longitude,
            },
          )
          .then((_) => null, onError: (_) => null),
    );
  }

  void _startMockUpdates() {
    final updates = MockData.locationUpdates;
    if (updates.isEmpty) return;

    void emitAt(int index) {
      final update = updates[index % updates.length];
      final point = LatLng(update.latitude, update.longitude);
      state = point;
      _broadcast(point);
    }

    emitAt(0);
    _mockIndex = 1;
    _mockTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      emitAt(_mockIndex);
      _mockIndex++;
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _mockTimer?.cancel();
    super.dispose();
  }
}

final riderLocationTrackerProvider = StateNotifierProvider.autoDispose
    .family<RiderLocationTracker, LatLng?, RiderLocationTrackerArgs>(
  (ref, args) => RiderLocationTracker(
    assignmentId: args.assignmentId,
    enabled: args.enabled,
  ),
);

class RiderLocationTrackerArgs {
  const RiderLocationTrackerArgs({
    required this.assignmentId,
    required this.enabled,
  });

  final String assignmentId;
  final bool enabled;

  @override
  bool operator ==(Object other) =>
      other is RiderLocationTrackerArgs &&
      other.assignmentId == assignmentId &&
      other.enabled == enabled;

  @override
  int get hashCode => Object.hash(assignmentId, enabled);
}