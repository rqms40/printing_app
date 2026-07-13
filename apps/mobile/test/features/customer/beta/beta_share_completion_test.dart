import 'dart:ui';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/models/beta_locked_info.dart';
import 'package:printing_app/features/customer/beta/providers/beta_testimonial_provider.dart';
import 'package:printing_app/features/customer/beta/screens/beta_locked_screen.dart';
import 'package:printing_app/features/customer/beta/screens/beta_success_wall_screen.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_share_row.dart';
import 'package:url_launcher/url_launcher.dart';

class _FakeShareLauncher implements BetaShareLauncher {
  _FakeShareLauncher({required this.urlResult, required this.nativeResult});

  final ShareLaunchResult urlResult;
  final ShareLaunchResult nativeResult;
  final List<Uri> openedUris = [];
  var copyCalls = 0;

  @override
  Future<ShareLaunchResult> openUrl(Uri uri) async {
    openedUris.add(uri);
    return urlResult;
  }

  @override
  Future<ShareLaunchResult> shareNative({
    required String text,
    required String subject,
  }) async => nativeResult;

  @override
  Future<bool> copyText(String text) async {
    copyCalls += 1;
    return true;
  }
}

Widget _wrap(BetaShareRow row) => MaterialApp(
  home: Scaffold(body: SizedBox(width: 480, child: row)),
);

class _HeldAuthNotifier extends AuthNotifier {
  _HeldAuthNotifier() : super() {
    state = const AuthState(
      betaLocked: BetaLockedInfo(
        fullName: 'Mark Prado',
        email: 'mark@example.com',
        betaPhotoUploaded: true,
        betaSharedOnSocial: false,
      ),
    );
  }
}

void main() {
  group('BetaShareRow confirmed launch semantics', () {
    test('system URL shares explicitly open in a new browser tab', () async {
      LaunchMode? observedMode;
      String? observedTarget;
      final launcher = SystemBetaShareLauncher(
        urlOpener:
            (
              uri, {
              mode = LaunchMode.platformDefault,
              webOnlyWindowName,
            }) async {
              observedMode = mode;
              observedTarget = webOnlyWindowName;
              return true;
            },
      );

      final result = await launcher.openUrl(
        Uri.parse('https://www.facebook.com/sharer/sharer.php'),
      );

      expect(result, ShareLaunchResult.opened);
      expect(observedMode, LaunchMode.externalApplication);
      expect(observedTarget, '_blank');
    });

    testWidgets('exposes one actionable control for each share destination', (
      tester,
    ) async {
      final launcher = _FakeShareLauncher(
        urlResult: ShareLaunchResult.opened,
        nativeResult: ShareLaunchResult.opened,
      );
      await tester.pumpWidget(_wrap(BetaShareRow(launcher: launcher)));

      for (final label in [
        'Share to Facebook',
        'Share to X (Twitter)',
        'Share to WhatsApp',
        'Share via other apps',
      ]) {
        final control = find.bySemanticsLabel(
          RegExp('^${RegExp.escape(label)}'),
        );
        expect(control, findsOneWidget);
        expect(
          tester
              .getSemantics(control)
              .getSemanticsData()
              .hasAction(SemanticsAction.tap),
          isTrue,
        );
      }
    });

    testWidgets('records a WhatsApp share only after the URL opens', (
      tester,
    ) async {
      final launcher = _FakeShareLauncher(
        urlResult: ShareLaunchResult.opened,
        nativeResult: ShareLaunchResult.dismissed,
      );
      var confirmed = 0;
      await tester.pumpWidget(
        _wrap(
          BetaShareRow(
            launcher: launcher,
            onShareConfirmed: () async => confirmed += 1,
          ),
        ),
      );

      await tester.tap(find.text('WhatsApp'));
      await tester.pump();

      expect(launcher.openedUris, hasLength(1));
      expect(
        launcher.openedUris.single.toString(),
        startsWith('https://wa.me/'),
      );
      expect(confirmed, 1);
    });

    for (final result in [
      ShareLaunchResult.dismissed,
      ShareLaunchResult.failed,
    ]) {
      testWidgets('does not record a WhatsApp share when launch is $result', (
        tester,
      ) async {
        final launcher = _FakeShareLauncher(
          urlResult: result,
          nativeResult: ShareLaunchResult.opened,
        );
        var confirmed = 0;
        await tester.pumpWidget(
          _wrap(
            BetaShareRow(
              launcher: launcher,
              onShareConfirmed: () async => confirmed += 1,
            ),
          ),
        );

        await tester.tap(find.text('WhatsApp'));
        await tester.pump();

        expect(confirmed, 0);
      });
    }

    testWidgets('records native share success but not native dismissal', (
      tester,
    ) async {
      var confirmed = 0;
      final successLauncher = _FakeShareLauncher(
        urlResult: ShareLaunchResult.failed,
        nativeResult: ShareLaunchResult.opened,
      );
      await tester.pumpWidget(
        _wrap(
          BetaShareRow(
            launcher: successLauncher,
            onShareConfirmed: () async => confirmed += 1,
          ),
        ),
      );
      await tester.tap(find.text('More'));
      await tester.pump();
      expect(confirmed, 1);

      final dismissedLauncher = _FakeShareLauncher(
        urlResult: ShareLaunchResult.failed,
        nativeResult: ShareLaunchResult.dismissed,
      );
      await tester.pumpWidget(
        _wrap(
          BetaShareRow(
            launcher: dismissedLauncher,
            onShareConfirmed: () async => confirmed += 1,
          ),
        ),
      );
      await tester.tap(find.text('More'));
      await tester.pump();
      expect(confirmed, 1);
    });

    testWidgets('copying the link never records a social share', (
      tester,
    ) async {
      final launcher = _FakeShareLauncher(
        urlResult: ShareLaunchResult.opened,
        nativeResult: ShareLaunchResult.opened,
      );
      var confirmed = 0;
      await tester.pumpWidget(
        _wrap(
          BetaShareRow(
            launcher: launcher,
            onShareConfirmed: () async => confirmed += 1,
          ),
        ),
      );

      await tester.tap(find.text('Copy'));
      await tester.pump();

      expect(launcher.copyCalls, 1);
      expect(confirmed, 0);
    });
  });

  group('BetaTestimonialNotifier monotonic sharing', () {
    test(
      'keeps a confirmed pre-photo share locally without calling server',
      () async {
        var patchCalls = 0;
        final notifier = BetaTestimonialNotifier(
          markShared: () async => patchCalls += 1,
        );

        await notifier.recordConfirmedShare(photoAlreadyUploaded: false);

        expect(notifier.state.sharedOnSocial, isTrue);
        expect(notifier.state.shareRecorded, isFalse);
        expect(patchCalls, 0);
      },
    );

    test(
      'patches once after a photo exists and never regresses true to false',
      () async {
        var patchCalls = 0;
        final notifier = BetaTestimonialNotifier(
          markShared: () async => patchCalls += 1,
        );

        await notifier.recordConfirmedShare(photoAlreadyUploaded: true);
        await notifier.recordConfirmedShare(photoAlreadyUploaded: true);
        notifier.clearError();

        expect(notifier.state.sharedOnSocial, isTrue);
        expect(notifier.state.shareRecorded, isTrue);
        expect(patchCalls, 1);
      },
    );

    test(
      'response-loss retry reuses the uploaded testimonial file id',
      () async {
        var uploadCalls = 0;
        final submittedFileIds = <int>[];
        var submitCalls = 0;
        final notifier = BetaTestimonialNotifier(
          uploadPhoto:
              ({photo, photoBytes, photoFileName, onSendProgress}) async {
                uploadCalls += 1;
                onSendProgress?.call(1, 1);
                return 42;
              },
          submitTestimonial:
              ({required fileId, required sharedOnSocial}) async {
                submittedFileIds.add(fileId);
                submitCalls += 1;
                if (submitCalls == 1) {
                  final request = RequestOptions(
                    path: '/beta-mode/testimonial',
                  );
                  throw DioException(
                    requestOptions: request,
                    response: Response(
                      requestOptions: request,
                      statusCode: 503,
                    ),
                  );
                }
              },
        );

        await expectLater(
          notifier.submit(
            photoBytes: Uint8List.fromList([1, 2, 3]),
            photoFileName: 'proof.png',
            sharedOnSocial: false,
          ),
          throwsA(isA<DioException>()),
        );
        await notifier.submit(
          photoBytes: Uint8List.fromList([1, 2, 3]),
          photoFileName: 'proof.png',
          sharedOnSocial: false,
        );

        expect(uploadCalls, 1);
        expect(submittedFileIds, [42, 42]);
        expect(notifier.state.uploadedFileId, 42);
        expect(notifier.state.submitted, isTrue);
      },
    );

    test(
      'upload progress cannot erase a share confirmed during upload',
      () async {
        late BetaTestimonialNotifier notifier;
        bool? submittedShared;
        notifier = BetaTestimonialNotifier(
          uploadPhoto:
              ({photo, photoBytes, photoFileName, onSendProgress}) async {
                onSendProgress?.call(1, 2);
                await notifier.recordConfirmedShare(
                  photoAlreadyUploaded: false,
                );
                onSendProgress?.call(2, 2);
                return 77;
              },
          submitTestimonial:
              ({required fileId, required sharedOnSocial}) async {
                submittedShared = sharedOnSocial;
              },
        );

        await notifier.submit(
          photoBytes: Uint8List.fromList([4, 5, 6]),
          photoFileName: 'shared.png',
          sharedOnSocial: false,
        );

        expect(submittedShared, isTrue);
        expect(notifier.state.sharedOnSocial, isTrue);
        expect(notifier.state.shareRecorded, isTrue);
      },
    );
  });

  group('beta completion screens', () {
    testWidgets(
      'success wall preserves a confirmed share for photo submission',
      (tester) async {
        final launcher = _FakeShareLauncher(
          urlResult: ShareLaunchResult.opened,
          nativeResult: ShareLaunchResult.dismissed,
        );
        final testimonial = BetaTestimonialNotifier();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              betaTestimonialProvider.overrideWith((ref) => testimonial),
            ],
            child: MaterialApp(
              home: BetaSuccessWallScreen(shareLauncher: launcher),
            ),
          ),
        );
        await tester.pump();
        await tester.ensureVisible(find.text('WhatsApp'));
        await tester.tap(find.text('WhatsApp'));
        await tester.pump();

        expect(testimonial.state.sharedOnSocial, isTrue);
        expect(testimonial.state.shareRecorded, isFalse);
      },
    );

    testWidgets(
      'held screen records sharing immediately after retained photo',
      (tester) async {
        final launcher = _FakeShareLauncher(
          urlResult: ShareLaunchResult.opened,
          nativeResult: ShareLaunchResult.dismissed,
        );
        var patchCalls = 0;
        final testimonial = BetaTestimonialNotifier(
          markShared: () async => patchCalls += 1,
        );
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authProvider.overrideWith((ref) => _HeldAuthNotifier()),
              betaTestimonialProvider.overrideWith((ref) => testimonial),
            ],
            child: MaterialApp(home: BetaLockedScreen(shareLauncher: launcher)),
          ),
        );
        await tester.pump();
        await tester.ensureVisible(find.text('WhatsApp'));
        await tester.tap(find.text('WhatsApp'));
        await tester.pump();

        expect(patchCalls, 1);
        expect(testimonial.state.shareRecorded, isTrue);
      },
    );
  });
}
