import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';

class _FakeLocationSource implements RiderLocationSource {
  _FakeLocationSource({
    this.permission = RiderLocationPermission.whileInUse,
    this.requestedPermission = RiderLocationPermission.whileInUse,
    this.serviceEnabled = true,
  });

  RiderLocationPermission permission;
  RiderLocationPermission requestedPermission;
  bool serviceEnabled;
  RiderGpsPoint current = const RiderGpsPoint(
    latitude: 7.064,
    longitude: 125.608,
  );
  final streamController = StreamController<RiderGpsPoint>.broadcast();
  int permissionChecks = 0;

  @override
  Future<RiderLocationPermission> checkPermission() async {
    permissionChecks++;
    return permission;
  }

  @override
  Stream<RiderGpsPoint> get positionStream => streamController.stream;

  @override
  Future<RiderGpsPoint> getCurrentPosition() async => current;

  @override
  Future<bool> isServiceEnabled() async => serviceEnabled;

  @override
  Future<RiderLocationPermission> requestPermission() async =>
      requestedPermission;

  Future<void> close() => streamController.close();
}

class _TestClock {
  DateTime value = DateTime.utc(2026, 7, 10, 12);

  DateTime call() => value;

  void advance(Duration duration) => value = value.add(duration);
}

Future<void> _flush() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

void main() {
  group('RiderLocationTracker', () {
    test(
      'disabled tracking performs no permission, GPS, or REST work',
      () async {
        final source = _FakeLocationSource();
        var posts = 0;
        final tracker = RiderLocationTracker(
          assignmentId: '101',
          enabled: false,
          source: source,
          postLocation: (_) async => posts++,
        );
        addTearDown(() async {
          tracker.dispose();
          await source.close();
        });

        await _flush();

        expect(tracker.state.status, RiderGpsStatus.disabled);
        expect(source.permissionChecks, 0);
        expect(posts, 0);
      },
    );

    test('permission denied is visible and never posts a mock point', () async {
      final source = _FakeLocationSource(
        permission: RiderLocationPermission.denied,
        requestedPermission: RiderLocationPermission.denied,
      );
      var posts = 0;
      final tracker = RiderLocationTracker(
        assignmentId: '101',
        enabled: true,
        source: source,
        postLocation: (_) async => posts++,
        autoStart: false,
      );
      addTearDown(() async {
        tracker.dispose();
        await source.close();
      });

      await tracker.start();

      expect(tracker.state.status, RiderGpsStatus.permissionDenied);
      expect(tracker.state.point, isNull);
      expect(tracker.state.message, contains('permission'));
      expect(posts, 0);
    });

    test('permission denied forever is visible and does not post', () async {
      final source = _FakeLocationSource(
        permission: RiderLocationPermission.deniedForever,
      );
      var posts = 0;
      final tracker = RiderLocationTracker(
        assignmentId: '101',
        enabled: true,
        source: source,
        postLocation: (_) async => posts++,
        autoStart: false,
      );
      addTearDown(() async {
        tracker.dispose();
        await source.close();
      });

      await tracker.start();

      expect(tracker.state.status, RiderGpsStatus.permissionDeniedForever);
      expect(tracker.state.point, isNull);
      expect(posts, 0);
    });

    test('disabled location service is visible and does not post', () async {
      final source = _FakeLocationSource(serviceEnabled: false);
      var posts = 0;
      final tracker = RiderLocationTracker(
        assignmentId: '101',
        enabled: true,
        source: source,
        postLocation: (_) async => posts++,
        autoStart: false,
      );
      addTearDown(() async {
        tracker.dispose();
        await source.close();
      });

      await tracker.start();

      expect(tracker.state.status, RiderGpsStatus.serviceDisabled);
      expect(tracker.state.point, isNull);
      expect(posts, 0);
    });

    test(
      'GPS stream failure is visible and preserves last real point',
      () async {
        final source = _FakeLocationSource();
        final tracker = RiderLocationTracker(
          assignmentId: '101',
          enabled: true,
          source: source,
          postLocation: (_) async {},
          autoStart: false,
        );
        addTearDown(() async {
          tracker.dispose();
          await source.close();
        });

        await tracker.start();
        await _flush();
        source.streamController.addError(StateError('receiver unavailable'));
        await _flush();

        expect(tracker.state.status, RiderGpsStatus.streamError);
        expect(tracker.state.point, const LatLng(7.064, 125.608));
        expect(tracker.state.message, contains('GPS'));
      },
    );

    test('REST failure is visible and keeps the measured point', () async {
      final source = _FakeLocationSource();
      final tracker = RiderLocationTracker(
        assignmentId: '101',
        enabled: true,
        source: source,
        postLocation: (_) async => throw StateError('network down'),
        autoStart: false,
      );
      addTearDown(() async {
        tracker.dispose();
        await source.close();
      });

      await tracker.start();
      await _flush();

      expect(tracker.state.status, RiderGpsStatus.uploadFailed);
      expect(tracker.state.point, const LatLng(7.064, 125.608));
      expect(tracker.state.message, contains('server'));
    });

    test(
      'manual GPS refresh forces a new acknowledged device reading',
      () async {
        final source = _FakeLocationSource();
        final calls = <LatLng>[];
        final tracker = RiderLocationTracker(
          assignmentId: '101',
          enabled: true,
          source: source,
          postLocation: (point) async => calls.add(point),
          autoStart: false,
        );
        addTearDown(() async {
          tracker.dispose();
          await source.close();
        });

        await tracker.start();
        await _flush();
        expect(calls, [const LatLng(7.064, 125.608)]);

        source.current = const RiderGpsPoint(
          latitude: 7.0645,
          longitude: 125.6082,
        );
        await tracker.refreshNow();
        await _flush();

        expect(calls, [
          const LatLng(7.064, 125.608),
          const LatLng(7.0645, 125.6082),
        ]);
        expect(tracker.state.status, RiderGpsStatus.live);
        expect(tracker.state.point, const LatLng(7.0645, 125.6082));
      },
    );

    test(
      'manual GPS refresh waits for its queued point to be acknowledged',
      () async {
        final source = _FakeLocationSource();
        final calls = <LatLng>[];
        final acknowledgements = <Completer<void>>[];
        Future<void> post(LatLng point) async {
          calls.add(point);
          final acknowledgement = Completer<void>();
          acknowledgements.add(acknowledgement);
          await acknowledgement.future;
        }

        final tracker = RiderLocationTracker(
          assignmentId: '101',
          enabled: true,
          source: source,
          postLocation: post,
          autoStart: false,
        );
        addTearDown(() async {
          for (final acknowledgement in acknowledgements) {
            if (!acknowledgement.isCompleted) acknowledgement.complete();
          }
          tracker.dispose();
          await source.close();
        });

        await tracker.start();
        await _flush();
        expect(calls, [const LatLng(7.064, 125.608)]);

        source.current = const RiderGpsPoint(
          latitude: 7.0645,
          longitude: 125.6082,
        );
        var refreshCompleted = false;
        final refresh = tracker.refreshNow().then((_) => refreshCompleted = true);
        await _flush();

        expect(refreshCompleted, isFalse);
        expect(tracker.state.status, RiderGpsStatus.uploading);
        expect(calls, hasLength(1));

        acknowledgements.first.complete();
        await _flush();
        expect(calls, [
          const LatLng(7.064, 125.608),
          const LatLng(7.0645, 125.6082),
        ]);
        expect(refreshCompleted, isFalse);
        expect(tracker.state.status, RiderGpsStatus.uploading);

        acknowledgements[1].complete();
        await refresh;
        expect(refreshCompleted, isTrue);
        expect(tracker.state.status, RiderGpsStatus.live);
      },
    );

    test(
      'serializes acknowledged REST posts and throttles by time plus distance',
      () async {
        final source = _FakeLocationSource();
        final clock = _TestClock();
        final calls = <LatLng>[];
        final acknowledgements = <Completer<void>>[];
        var concurrent = 0;
        var maxConcurrent = 0;
        Future<void> post(LatLng point) async {
          calls.add(point);
          concurrent++;
          maxConcurrent = maxConcurrent < concurrent
              ? concurrent
              : maxConcurrent;
          final acknowledgement = Completer<void>();
          acknowledgements.add(acknowledgement);
          await acknowledgement.future;
          concurrent--;
        }

        final tracker = RiderLocationTracker(
          assignmentId: '101',
          enabled: true,
          source: source,
          postLocation: post,
          now: clock.call,
          autoStart: false,
        );
        addTearDown(() async {
          for (final acknowledgement in acknowledgements) {
            if (!acknowledgement.isCompleted) acknowledgement.complete();
          }
          tracker.dispose();
          await source.close();
        });

        await tracker.start();
        await _flush();
        expect(calls, [const LatLng(7.064, 125.608)]);

        source.streamController.add(
          const RiderGpsPoint(latitude: 7.06401, longitude: 125.60801),
        );
        source.streamController.add(
          const RiderGpsPoint(latitude: 7.0642, longitude: 125.608),
        );
        await _flush();
        expect(calls, hasLength(1), reason: 'the first PATCH is still pending');

        acknowledgements.first.complete();
        await _flush();
        expect(calls, hasLength(2), reason: 'the latest moved point is posted');
        expect(maxConcurrent, 1);

        acknowledgements[1].complete();
        await _flush();
        clock.advance(const Duration(seconds: 14));
        source.streamController.add(
          const RiderGpsPoint(latitude: 7.0642, longitude: 125.608),
        );
        await _flush();
        expect(calls, hasLength(2));

        clock.advance(const Duration(seconds: 1));
        source.streamController.add(
          const RiderGpsPoint(latitude: 7.0642, longitude: 125.608),
        );
        await _flush();
        expect(calls, hasLength(3));
        expect(maxConcurrent, 1);
      },
    );
  });

  group('RiderLocationApi', () {
    test(
      'awaits exactly PATCH /riders/location with coordinates only',
      () async {
        String? path;
        dynamic body;
        final acknowledgement = Completer<void>();
        final api = RiderLocationApi(
          patch: (requestPath, {data}) async {
            path = requestPath;
            body = data;
            await acknowledgement.future;
            return null;
          },
        );

        var completed = false;
        final request = api
            .post(const LatLng(7.064, 125.608))
            .then((_) => completed = true);
        await _flush();

        expect(path, '/riders/location');
        expect(body, {'latitude': 7.064, 'longitude': 125.608});
        expect(completed, isFalse);

        acknowledgement.complete();
        await request;
        expect(completed, isTrue);
      },
    );

    test('rejects non-finite coordinates before making a request', () async {
      var calls = 0;
      final api = RiderLocationApi(
        patch: (path, {data}) async {
          calls++;
          return null;
        },
      );

      await expectLater(
        api.post(const LatLng(double.nan, 125.608)),
        throwsArgumentError,
      );
      await expectLater(
        api.post(const LatLng(7.064, double.infinity)),
        throwsArgumentError,
      );
      expect(calls, 0);
    });
  });
}
