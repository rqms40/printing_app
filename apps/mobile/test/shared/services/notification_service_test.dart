import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test(
    'pending FCM deletion survives failure and clears after retry',
    () async {
      await NotificationService.markTokenDeletionPendingForTest();

      final failed = await NotificationService.retryPendingTokenDeletionForTest(
        () async => throw StateError('offline'),
      );

      expect(failed, isFalse);
      expect(
        await NotificationService.hasPendingTokenDeletionForTest(),
        isTrue,
      );

      final retried =
          await NotificationService.retryPendingTokenDeletionForTest(
            () async {},
          );

      expect(retried, isTrue);
      expect(
        await NotificationService.hasPendingTokenDeletionForTest(),
        isFalse,
      );
    },
  );

  test('APNs-unavailable token deletion succeeds without leaving work pending',
      () async {
    final deleted = await NotificationService.requestTokenDeletionForTest(
      () async => throw FirebaseException(
        plugin: 'firebase_messaging',
        code: 'apns-token-not-set',
      ),
    );

    expect(deleted, isTrue);
    expect(await NotificationService.hasPendingTokenDeletionForTest(), isFalse);
  });

  test(
    'successful reconnect retry resumes notification initialization',
    () async {
      await NotificationService.markTokenDeletionPendingForTest();
      var initializationCount = 0;

      final failed =
          await NotificationService.resumeAfterPendingDeletionForTest(
            () async => throw StateError('offline'),
            () async => initializationCount += 1,
          );

      expect(failed, isFalse);
      expect(initializationCount, 0);
      expect(
        await NotificationService.hasPendingTokenDeletionForTest(),
        isTrue,
      );

      final recovered =
          await NotificationService.resumeAfterPendingDeletionForTest(
            () async {},
            () async => initializationCount += 1,
          );

      expect(recovered, isTrue);
      expect(initializationCount, 1);
      expect(
        await NotificationService.hasPendingTokenDeletionForTest(),
        isFalse,
      );
    },
  );

  test(
    'older deletion completion cannot clear a newer failed request',
    () async {
      final olderStarted = Completer<void>();
      final releaseOlder = Completer<void>();
      await NotificationService.markTokenDeletionPendingForTest();

      final older = NotificationService.retryPendingTokenDeletionForTest(
        () async {
          olderStarted.complete();
          await releaseOlder.future;
        },
      );
      await olderStarted.future;

      final newer = NotificationService.requestTokenDeletionForTest(
        () async => throw StateError('still offline'),
      );
      releaseOlder.complete();

      expect(await older, isFalse);
      expect(await newer, isFalse);
      expect(
        await NotificationService.hasPendingTokenDeletionForTest(),
        isTrue,
      );
    },
  );

  test('token readiness waits for reconnect recovery', () async {
    final recoveryStarted = Completer<void>();
    final releaseRecovery = Completer<void>();
    var initializationCount = 0;

    final readiness = NotificationService.ensureTokenReadyForTest(
      hasPendingDeletion: () async => true,
      resumeDeletion: () async {
        recoveryStarted.complete();
        await releaseRecovery.future;
        return true;
      },
      initializeMessaging: () async {
        initializationCount += 1;
        return true;
      },
    );

    await recoveryStarted.future;
    var completed = false;
    readiness.then((_) => completed = true);
    await Future<void>.delayed(Duration.zero);
    expect(completed, isFalse);

    releaseRecovery.complete();
    expect(await readiness, isTrue);
    expect(initializationCount, 1);
  });

  test('concurrent retries wait for the latest queued deletion', () async {
    final firstStarted = Completer<void>();
    final releaseFirst = Completer<void>();
    final secondStarted = Completer<void>();
    final releaseSecond = Completer<void>();
    await NotificationService.markTokenDeletionPendingForTest();

    var firstCompleted = false;
    final first = NotificationService.retryPendingTokenDeletionForTest(
      () async {
        firstStarted.complete();
        await releaseFirst.future;
      },
    )..then((_) => firstCompleted = true);
    await firstStarted.future;

    final second = NotificationService.retryPendingTokenDeletionForTest(
      () async {
        secondStarted.complete();
        await releaseSecond.future;
      },
    );
    releaseFirst.complete();
    await secondStarted.future;
    await Future<void>.delayed(Duration.zero);
    final firstReturnedBeforeLatestDeletion = firstCompleted;

    releaseSecond.complete();
    expect(await first, isTrue);
    expect(await second, isTrue);
    expect(firstReturnedBeforeLatestDeletion, isFalse);
    expect(await NotificationService.hasPendingTokenDeletionForTest(), isFalse);
  });

  test('token lifecycle logs never contain a registration token', () {
    const secretToken = 'sensitive-device-registration-token';

    final acquired = NotificationService.tokenLifecycleLogForTest(
      'acquired',
      secretToken,
    );
    final refreshed = NotificationService.tokenLifecycleLogForTest(
      'refreshed',
      secretToken,
    );

    expect(acquired, isNot(contains(secretToken)));
    expect(refreshed, isNot(contains(secretToken)));
  });

  group('renderSpecForMessage', () {
    test('maps a delivery journey push to the delivery channel', () {
      final spec = renderSpecForMessage(
        data: const {
          'type': 'delivery_status',
          'title': 'Rider on the way',
          'body': 'Juan is heading to you',
          'orderId': 'ORD-10004',
          'progressCurrent': '4',
          'progressTotal': '5',
        },
      );

      expect(spec, isNotNull);
      expect(spec!.channelId, 'gridgo_delivery');
      expect(spec.hasProgress, isTrue);
      expect(spec.progressCurrent, 4);
      expect(spec.progressTotal, 5);
      expect(spec.title, 'Rider on the way');
    });

    test('reuses one notification id per order so updates replace', () {
      NotificationRenderSpec specFor(String body) => renderSpecForMessage(
        data: {
          'type': 'delivery_status',
          'title': 'Update',
          'body': body,
          'orderId': 'ORD-77',
        },
      )!;

      expect(specFor('first').id, specFor('second').id);
    });

    test('maps marketing pushes with an image to the marketing channel', () {
      final spec = renderSpecForMessage(
        data: const {'type': 'marketing', 'imageUrl': 'https://x/img.png'},
        notificationTitle: 'Last chance 🔥',
        notificationBody: 'Complete checkout and get 10% off 🛒',
      );

      expect(spec, isNotNull);
      expect(spec!.channelId, 'gridgo_marketing');
      expect(spec.imageUrl, 'https://x/img.png');
      expect(spec.hasProgress, isFalse);
      expect(spec.title, 'Last chance 🔥');
    });

    test('unknown types fall back to the general channel', () {
      final spec = renderSpecForMessage(
        data: const {},
        notificationTitle: 'Hello',
      );
      expect(spec!.channelId, 'gridgo_general');
    });

    test('returns null when there is nothing to show', () {
      expect(renderSpecForMessage(data: const {'type': 'marketing'}), isNull);
    });

    test('ignores malformed progress values', () {
      final spec = renderSpecForMessage(
        data: const {
          'type': 'delivery_status',
          'title': 'T',
          'body': 'B',
          'progressCurrent': 'nope',
          'progressTotal': '5',
        },
      );
      expect(spec!.hasProgress, isFalse);
    });
  });
}
