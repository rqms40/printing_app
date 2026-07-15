import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/services/api_client.dart';

enum RiderLocationPermission { denied, deniedForever, whileInUse, always }

enum RiderGpsStatus {
  disabled,
  requestingPermission,
  serviceDisabled,
  permissionDenied,
  permissionDeniedForever,
  locating,
  uploading,
  live,
  uploadFailed,
  streamError,
}

@immutable
class RiderGpsPoint {
  const RiderGpsPoint({
    required this.latitude,
    required this.longitude,
    this.speed,
    this.heading,
    this.accuracyMeters,
  });

  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final double? accuracyMeters;

  LatLng get latLng => LatLng(latitude, longitude);
}

abstract interface class RiderLocationSource {
  Future<RiderLocationPermission> checkPermission();
  Future<RiderLocationPermission> requestPermission();
  Future<bool> isServiceEnabled();
  Future<RiderGpsPoint> getCurrentPosition();
  Stream<RiderGpsPoint> get positionStream;
}

class GeolocatorRiderLocationSource implements RiderLocationSource {
  const GeolocatorRiderLocationSource();

  @override
  Future<RiderLocationPermission> checkPermission() async =>
      _permission(await Geolocator.checkPermission());

  @override
  Future<RiderLocationPermission> requestPermission() async =>
      _permission(await Geolocator.requestPermission());

  @override
  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();

  @override
  Future<RiderGpsPoint> getCurrentPosition() async =>
      _point(await Geolocator.getCurrentPosition());

  @override
  Stream<RiderGpsPoint> get positionStream => Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 12,
    ),
  ).map(_point);

  static RiderGpsPoint _point(Position position) => RiderGpsPoint(
    latitude: position.latitude,
    longitude: position.longitude,
    speed: position.speed,
    heading: position.heading,
    accuracyMeters: position.accuracy,
  );

  static RiderLocationPermission _permission(LocationPermission permission) =>
      switch (permission) {
        LocationPermission.denied => RiderLocationPermission.denied,
        LocationPermission.deniedForever =>
          RiderLocationPermission.deniedForever,
        LocationPermission.always => RiderLocationPermission.always,
        LocationPermission.whileInUse => RiderLocationPermission.whileInUse,
        LocationPermission.unableToDetermine => RiderLocationPermission.denied,
      };
}

@immutable
class RiderLocationTrackerState {
  const RiderLocationTrackerState({
    required this.status,
    this.point,
    this.error,
    this.headingDegrees,
    this.speedMetersPerSecond,
    this.accuracyMeters,
  });

  final RiderGpsStatus status;
  final LatLng? point;
  final Object? error;
  final double? headingDegrees;
  final double? speedMetersPerSecond;
  final double? accuracyMeters;

  String get message => switch (status) {
    RiderGpsStatus.disabled => 'GPS sharing starts when dispatch begins',
    RiderGpsStatus.requestingPermission => 'Requesting location permission',
    RiderGpsStatus.serviceDisabled => 'Location services are disabled',
    RiderGpsStatus.permissionDenied => 'Location permission was denied',
    RiderGpsStatus.permissionDeniedForever =>
      'Location permission is blocked in device settings',
    RiderGpsStatus.locating => 'Waiting for a GPS fix',
    RiderGpsStatus.uploading => 'Sending GPS location to the server',
    RiderGpsStatus.live => 'Live GPS is being shared',
    RiderGpsStatus.uploadFailed => 'Could not send GPS location to the server',
    RiderGpsStatus.streamError => 'GPS signal is unavailable',
  };

  RiderLocationTrackerState withPoint(
    LatLng value,
    RiderGpsStatus nextStatus, {
    Object? nextError,
    double? headingDegrees,
    double? speedMetersPerSecond,
    double? accuracyMeters,
  }) => RiderLocationTrackerState(
    status: nextStatus,
    point: value,
    error: nextError,
    headingDegrees: headingDegrees ?? this.headingDegrees,
    speedMetersPerSecond: speedMetersPerSecond ?? this.speedMetersPerSecond,
    accuracyMeters: accuracyMeters ?? this.accuracyMeters,
  );
}

typedef RiderLocationPoster = Future<void> Function(LatLng point);
typedef RiderLocationClock = DateTime Function();
typedef RiderApiPatch = Future<dynamic> Function(String path, {dynamic data});

class RiderLocationApi {
  RiderLocationApi({RiderApiPatch? patch})
    : _patch = patch ?? ApiClient.instance.patch;

  final RiderApiPatch _patch;

  Future<void> post(LatLng point) async {
    if (!point.latitude.isFinite ||
        !point.longitude.isFinite ||
        point.latitude < -90 ||
        point.latitude > 90 ||
        point.longitude < -180 ||
        point.longitude > 180) {
      throw ArgumentError.value(point, 'point', 'must be finite coordinates');
    }
    await _patch(
      '/riders/location',
      data: {'latitude': point.latitude, 'longitude': point.longitude},
    );
  }
}

/// Tracks only physical device GPS and publishes it through the acknowledged
/// rider REST endpoint. Dispatch position is never simulated client-side.
class RiderLocationTracker extends StateNotifier<RiderLocationTrackerState> {
  RiderLocationTracker({
    required this.assignmentId,
    required this.enabled,
    RiderLocationSource? source,
    RiderLocationPoster? postLocation,
    RiderLocationClock? now,
    bool autoStart = true,
  }) : _source = source ?? const GeolocatorRiderLocationSource(),
       _postLocation = postLocation ?? RiderLocationApi().post,
       _now = now ?? DateTime.now,
       super(
         RiderLocationTrackerState(
           status: enabled
               ? RiderGpsStatus.requestingPermission
               : RiderGpsStatus.disabled,
         ),
       ) {
    if (enabled && autoStart) unawaited(start());
  }

  static const _minimumPostInterval = Duration(seconds: 15);
  static const _minimumPostDistanceMeters = 12.0;
  static const _distance = Distance();

  final String assignmentId;
  final bool enabled;
  final RiderLocationSource _source;
  final RiderLocationPoster _postLocation;
  final RiderLocationClock _now;

  StreamSubscription<RiderGpsPoint>? _subscription;
  LatLng? _lastAcknowledgedPoint;
  DateTime? _lastAcknowledgedAt;
  LatLng? _pendingPoint;
  bool _posting = false;
  bool _forcePendingPost = false;
  Completer<void>? _drainCompleter;
  bool _started = false;
  bool _disposed = false;

  Future<void> start() async {
    if (!enabled || _started || _disposed) return;
    _started = true;
    _setStatus(RiderGpsStatus.requestingPermission);
    try {
      var permission = await _source.checkPermission();
      if (permission == RiderLocationPermission.denied) {
        permission = await _source.requestPermission();
      }
      if (_disposed) return;
      if (permission == RiderLocationPermission.deniedForever) {
        _setStatus(RiderGpsStatus.permissionDeniedForever);
        return;
      }
      if (permission == RiderLocationPermission.denied) {
        _setStatus(RiderGpsStatus.permissionDenied);
        return;
      }
      if (!await _source.isServiceEnabled()) {
        if (!_disposed) _setStatus(RiderGpsStatus.serviceDisabled);
        return;
      }
      if (_disposed) return;
      _setStatus(RiderGpsStatus.locating);
      _acceptPoint(await _source.getCurrentPosition());
      if (_disposed) return;
      _subscription = _source.positionStream.listen(
        _acceptPoint,
        onError: _handleStreamError,
      );
    } catch (error) {
      if (!_disposed) {
        state = RiderLocationTrackerState(
          status: RiderGpsStatus.streamError,
          point: state.point,
          error: error,
        );
      }
    }
  }

  Future<void> refreshNow() async {
    if (!enabled || _disposed) return;
    try {
      final point = (await _source.getCurrentPosition()).latLng;
      if (_disposed) return;
      state = state.withPoint(point, RiderGpsStatus.uploading);
      _pendingPoint = point;
      _forcePendingPost = true;
      await _drainPosts();
    } catch (error) {
      if (_disposed) return;
      state = RiderLocationTrackerState(
        status: RiderGpsStatus.streamError,
        point: state.point,
        error: error,
      );
    }
  }

  void _acceptPoint(RiderGpsPoint gps) {
    if (_disposed) return;
    final point = gps.latLng;
    final shouldPost = _shouldPost(point, _now());
    state = state.withPoint(
      point,
      shouldPost ? RiderGpsStatus.uploading : RiderGpsStatus.live,
      headingDegrees: gps.heading,
      speedMetersPerSecond: gps.speed,
      accuracyMeters: gps.accuracyMeters,
    );
    if (!shouldPost) return;
    _pendingPoint = point;
    if (!_posting) unawaited(_drainPosts());
  }

  bool _shouldPost(LatLng point, DateTime at) {
    final lastPoint = _lastAcknowledgedPoint;
    final lastAt = _lastAcknowledgedAt;
    if (lastPoint == null || lastAt == null) return true;
    final elapsed = at.difference(lastAt);
    final movedMeters = _distance.as(LengthUnit.Meter, lastPoint, point);
    return elapsed >= _minimumPostInterval ||
        movedMeters >= _minimumPostDistanceMeters;
  }

  Future<void> _drainPosts() {
    if (_disposed) return Future<void>.value();
    final activeDrain = _drainCompleter;
    if (activeDrain != null) return activeDrain.future;

    final completer = Completer<void>();
    _drainCompleter = completer;
    _posting = true;
    unawaited(_runDrain(completer));
    return completer.future;
  }

  Future<void> _runDrain(Completer<void> completer) async {
    try {
      while (!_disposed && _pendingPoint != null) {
        final point = _pendingPoint!;
        _pendingPoint = null;
        final forcePost = _forcePendingPost;
        _forcePendingPost = false;
        if (!forcePost && !_shouldPost(point, _now())) continue;
        try {
          await _postLocation(point);
          if (_disposed) return;
          _lastAcknowledgedPoint = point;
          _lastAcknowledgedAt = _now();
          state = state.withPoint(
            state.point ?? point,
            _pendingPoint == null
                ? RiderGpsStatus.live
                : RiderGpsStatus.uploading,
          );
        } catch (error) {
          if (_disposed) return;
          state = RiderLocationTrackerState(
            status: RiderGpsStatus.uploadFailed,
            point: state.point ?? point,
            error: error,
          );
        }
      }
    } finally {
      _posting = false;
      if (identical(_drainCompleter, completer)) {
        _drainCompleter = null;
      }
      if (!completer.isCompleted) completer.complete();
    }
  }

  void _handleStreamError(Object error, StackTrace stackTrace) {
    if (_disposed) return;
    state = RiderLocationTrackerState(
      status: RiderGpsStatus.streamError,
      point: state.point,
      error: error,
    );
  }

  void _setStatus(RiderGpsStatus status) {
    if (_disposed) return;
    state = RiderLocationTrackerState(status: status, point: state.point);
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription?.cancel());
    _pendingPoint = null;
    _forcePendingPost = false;
    super.dispose();
  }
}

final riderLocationTrackerProvider = StateNotifierProvider.autoDispose
    .family<
      RiderLocationTracker,
      RiderLocationTrackerState,
      RiderLocationTrackerArgs
    >((ref, args) {
      return RiderLocationTracker(
        assignmentId: args.assignmentId,
        enabled: args.enabled,
      );
    });

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
