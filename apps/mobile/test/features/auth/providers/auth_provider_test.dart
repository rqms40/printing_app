import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/shared/services/notification_service.dart';

import '../../../helpers/test_setup.dart';

class _FakeAuthSessionClient implements AuthSessionClient {
  bool hasToken = true;
  var clearTokenCalls = 0;
  final savedTokens = <String>[];
  final loginResults = <Future<Map<String, dynamic>> Function()>[];
  Future<Map<String, dynamic>> Function()? completionResult;
  Future<Map<String, dynamic>> Function()? profileResult;
  var completionCalls = 0;
  var profileCalls = 0;

  @override
  Future<void> clearToken() async {
    clearTokenCalls += 1;
  }

  @override
  Future<Map<String, dynamic>> getCompletionState() async {
    completionCalls += 1;
    return completionResult!.call();
  }

  @override
  Future<Map<String, dynamic>> getProfile() async {
    profileCalls += 1;
    return profileResult!.call();
  }

  @override
  Future<bool> hasStoredToken() async => hasToken;

  @override
  Future<Map<String, dynamic>> login(String email, String password) {
    return loginResults.removeAt(0).call();
  }

  @override
  Future<void> saveToken(String token) async {
    savedTokens.add(token);
  }
}

class _FakeFcmSessionClient implements FcmSessionClient {
  var registerCalls = 0;
  var revokeCalls = 0;
  var invalidateCalls = 0;
  Object? registerError;
  Object? revokeError;
  Object? invalidateError;
  Completer<void>? registerStarted;
  Completer<void>? registerBlock;
  final operations = <String>[];

  @override
  Future<void> registerCurrentToken() async {
    registerCalls += 1;
    final call = registerCalls;
    operations.add('register-start:$call');
    final started = registerStarted;
    if (started != null && !started.isCompleted) started.complete();
    final block = registerBlock;
    registerBlock = null;
    if (block != null) await block.future;
    if (registerError case final error?) throw error;
    operations.add('register-complete:$call');
  }

  @override
  Future<void> revokeCurrentToken() async {
    revokeCalls += 1;
    operations.add('revoke');
    if (revokeError case final error?) throw error;
  }

  Future<void> invalidateLocalToken() async {
    invalidateCalls += 1;
    operations.add('invalidate');
    if (invalidateError case final error?) throw error;
  }
}

Map<String, dynamic> _customerLoginResponse({
  String token = 'active-token',
  int id = 11,
  String email = 'mark@example.com',
}) => {
  'access_token': token,
  'user': {
    'id': id,
    'email': email,
    'fullName': 'Mark Prado',
    'role': 'customer',
    'isProfileComplete': true,
    'tutorialSeenKeys': <String>[],
    'printingPreferences': <String>[],
  },
};

Map<String, dynamic> _heldCompletionResponse() => {
  'accountStatus': 'beta_held',
  'user': {'fullName': 'Mark Prado', 'email': 'mark@example.com'},
  'betaPhotoUploaded': true,
  'betaSharedOnSocial': false,
  'betaCompletedAt': '2026-07-10T00:00:00.000Z',
};

DioException _dioFailure(int statusCode, Map<String, dynamic> data) {
  final request = RequestOptions(path: '/test');
  return DioException(
    requestOptions: request,
    response: Response(
      requestOptions: request,
      statusCode: statusCode,
      data: data,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.stubAudioPlayers();
    TestSetup.initApiClient();
    WebSocketService.disableNotificationsSocketForTests = true;
    WebSocketService.disableOrdersSocketForTests = true;
  });

  tearDownAll(() {
    WebSocketService.disableNotificationsSocketForTests = false;
    WebSocketService.disableOrdersSocketForTests = false;
  });

  group('AuthNotifier', () {
    late AuthNotifier notifier;

    setUp(() {
      notifier = AuthNotifier();
    });

    test('initial state is unauthenticated', () {
      expect(notifier.state.status, AuthStatus.unauthenticated);
      expect(notifier.state.user, isNull);
      expect(notifier.state.isLoading, false);
      expect(notifier.state.errorMessage, isNull);
    });

    test('devBypass fails closed when development auth is disabled', () {
      expect(
        () => notifier.devBypass('customer'),
        throwsA(isA<UnsupportedError>()),
      );
      expect(notifier.state.status, AuthStatus.unauthenticated);
      expect(notifier.state.user, isNull);
    });

    test('devBypass sets authenticated state for customer', () {
      final devNotifier = AuthNotifier(null, true);
      devNotifier.devBypass('customer');
      expect(devNotifier.state.status, AuthStatus.authenticated);
      expect(devNotifier.state.user, isNotNull);
      expect(devNotifier.state.user!.role, 'customer');
      expect(devNotifier.state.user!.fullName, 'Maria Santos');
      expect(devNotifier.state.user!.email, 'maria@test.com');
      expect(devNotifier.state.user!.id, '1');
      expect(devNotifier.state.user!.isProfileComplete, true);
      expect(devNotifier.state.user!.nickname, 'Mia');
      expect(devNotifier.state.user!.ageRange, '18_24');
      expect(devNotifier.state.user!.profileCategory, 'student');
      expect(devNotifier.state.user!.profileField, 'architecture');
      expect(
        devNotifier.state.user!.printingPreferences,
        contains('plotting_blueprints'),
      );
    });

    test('devBypass sets authenticated state for rider', () {
      final devNotifier = AuthNotifier(null, true);
      devNotifier.devBypass('rider');
      expect(devNotifier.state.status, AuthStatus.authenticated);
      expect(devNotifier.state.user!.role, 'rider');
      expect(devNotifier.state.user!.fullName, 'Juan Reyes');
      expect(devNotifier.state.user!.email, 'juan@test.com');
      expect(devNotifier.state.user!.id, '2');
    });

    test('devBypass sets authenticated state for admin', () {
      final devNotifier = AuthNotifier(null, true);
      devNotifier.devBypass('admin');
      expect(devNotifier.state.status, AuthStatus.authenticated);
      expect(devNotifier.state.user!.role, 'admin');
      expect(devNotifier.state.user!.fullName, 'Admin');
      expect(devNotifier.state.user!.email, 'admin@test.com');
      expect(devNotifier.state.user!.id, '3');
    });

    test('logout resets to unauthenticated', () async {
      final devNotifier = AuthNotifier(null, true);
      devNotifier.devBypass('customer');
      expect(devNotifier.state.status, AuthStatus.authenticated);

      await devNotifier.logout();

      expect(devNotifier.state.status, AuthStatus.unauthenticated);
      expect(devNotifier.state.user, isNull);
      expect(devNotifier.state.isLoading, false);
    });

    test('a new session clears addresses owned by the previous customer', () {
      final oldAddress = Address(
        id: 'old-address',
        userId: 'old-customer',
        label: 'Old home',
        fullAddress: 'Previous customer address',
        city: 'Davao City',
        latitude: 7.06,
        longitude: 125.60,
        isDefault: true,
        createdAt: DateTime(2026),
        updatedAt: DateTime(2026),
      );
      final addressNotifier = AddressNotifier(
        initialState: [oldAddress],
        skipBootstrap: true,
        realFlow: false,
      );
      final container = ProviderContainer(
        overrides: [
          authProvider.overrideWith((ref) => AuthNotifier(ref, true)),
          addressProvider.overrideWith((ref) => addressNotifier),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(addressProvider).single.id, 'old-address');

      container.read(authProvider.notifier).devBypass('customer');
      expect(container.read(addressProvider), isEmpty);
    });

    test('logout clears addresses owned by the current customer', () async {
      final oldAddress = Address(
        id: 'old-address',
        userId: 'old-customer',
        label: 'Old home',
        fullAddress: 'Previous customer address',
        city: 'Davao City',
        latitude: 7.06,
        longitude: 125.60,
        isDefault: true,
        createdAt: DateTime(2026),
        updatedAt: DateTime(2026),
      );
      final container = ProviderContainer(
        overrides: [
          authProvider.overrideWith((ref) => AuthNotifier(ref, true)),
          addressProvider.overrideWith(
            (ref) => AddressNotifier(
              initialState: [oldAddress],
              skipBootstrap: true,
              realFlow: false,
            ),
          ),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(addressProvider).single.id, 'old-address');

      await container.read(authProvider.notifier).logout();

      expect(container.read(addressProvider), isEmpty);
    });

    test('login sets error on connection failure (no server)', () async {
      await notifier.login('test@test.com', 'password');

      // API call fails (no real server), so error state is set
      expect(notifier.state.isLoading, false);
      expect(notifier.state.errorMessage, isNotNull);
      expect(notifier.state.status, AuthStatus.unauthenticated);
    });

    test('register sets error on connection failure (no server)', () async {
      await notifier.register(
        'new@test.com',
        'password',
        fullName: 'New User',
        profileCategory: 'student',
        profileField: 'architecture',
        printingPreferences: const ['plotting_blueprints'],
      );

      expect(notifier.state.isLoading, false);
      expect(notifier.state.errorMessage, isNotNull);
      expect(notifier.state.status, AuthStatus.unauthenticated);
    });

    test('multiple devBypass calls override previous state', () {
      final devNotifier = AuthNotifier(null, true);
      devNotifier.devBypass('customer');
      expect(devNotifier.state.user!.role, 'customer');

      devNotifier.devBypass('rider');
      expect(devNotifier.state.user!.role, 'rider');

      devNotifier.devBypass('admin');
      expect(devNotifier.state.user!.role, 'admin');
    });

    test('devBypass clears stale survey gate state', () async {
      final container = ProviderContainer(
        overrides: [
          authProvider.overrideWith((ref) => AuthNotifier(ref, true)),
          accountStateProvider.overrideWith(
            (ref) => AccountStateNotifier(
              fetchAccountState: () async => {
                'accountStatus': 'survey_required',
                'holds': [
                  {
                    'requirementId': 1,
                    'orderId': 10,
                    'orderRef': 'ORD-10010',
                    'requiredAt': '2026-04-30T00:00:00.000Z',
                  },
                ],
              },
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(accountStateProvider.notifier).refresh();
      expect(
        container.read(accountStateProvider).status,
        AccountGateStatus.surveyRequired,
      );

      container.read(authProvider.notifier).devBypass('customer');

      expect(
        container.read(accountStateProvider).status,
        AccountGateStatus.unknown,
      );
    });

    test(
      'auto-login restores verified beta-held state without clearing token',
      () async {
        final client = _FakeAuthSessionClient();
        client.completionResult = () async => _heldCompletionResponse();
        client.profileResult = () async =>
            _customerLoginResponse()['user'] as Map<String, dynamic>;
        final heldNotifier = AuthNotifier(null, false, client);

        await heldNotifier.tryAutoLogin();

        expect(client.completionCalls, 1);
        expect(client.profileCalls, 0);
        expect(client.clearTokenCalls, 0);
        expect(heldNotifier.state.status, AuthStatus.unauthenticated);
        expect(heldNotifier.state.betaLocked?.fullName, 'Mark Prado');
        expect(heldNotifier.state.betaLocked?.betaPhotoUploaded, isTrue);
      },
    );

    test(
      'auto-login reaches normal customer state after beta-off self-heal',
      () async {
        final client = _FakeAuthSessionClient();
        client.completionResult = () async => {'accountStatus': 'active'};
        client.profileResult = () async =>
            _customerLoginResponse()['user'] as Map<String, dynamic>;
        final restoredNotifier = AuthNotifier(null, false, client);

        await restoredNotifier.tryAutoLogin();

        expect(client.completionCalls, 1);
        expect(client.profileCalls, 1);
        expect(client.clearTokenCalls, 0);
        expect(restoredNotifier.state.status, AuthStatus.authenticated);
        expect(restoredNotifier.state.user?.role, 'customer');
        expect(restoredNotifier.state.betaLocked, isNull);
      },
    );

    test(
      'same credentials transition from beta-held to normal login',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.addAll([
            () async => throw _dioFailure(403, {
              'code': 'beta_held',
              'access_token': 'held-token',
              ..._heldCompletionResponse(),
            }),
            () async => _customerLoginResponse(),
          ]);
        final restoredNotifier = AuthNotifier(null, false, client);

        await restoredNotifier.login('mark@example.com', 'password');
        expect(restoredNotifier.state.betaLocked?.fullName, 'Mark Prado');
        expect(client.savedTokens, ['held-token']);

        await restoredNotifier.login('mark@example.com', 'password');
        expect(restoredNotifier.state.status, AuthStatus.authenticated);
        expect(restoredNotifier.state.betaLocked, isNull);
        expect(client.savedTokens, ['held-token', 'active-token']);
      },
    );

    test(
      'invalid stored token is cleared only after completion and profile fail',
      () async {
        final client = _FakeAuthSessionClient();
        client.completionResult = () async =>
            throw _dioFailure(403, {'message': 'Completion unavailable'});
        client.profileResult = () async =>
            throw _dioFailure(401, {'message': 'Unauthorized'});
        final invalidNotifier = AuthNotifier(null, false, client);

        await invalidNotifier.tryAutoLogin();

        expect(client.completionCalls, 1);
        expect(client.profileCalls, 1);
        expect(client.clearTokenCalls, 1);
        expect(invalidNotifier.state.status, AuthStatus.unauthenticated);
        expect(invalidNotifier.state.betaLocked, isNull);
      },
    );

    test(
      'a delayed profile refresh cannot restore a logged-out user',
      () async {
        final profile = Completer<Map<String, dynamic>>();
        final client = _FakeAuthSessionClient()
          ..loginResults.add(() async => _customerLoginResponse())
          ..profileResult = () => profile.future;
        final sessionNotifier = AuthNotifier(null, false, client);
        addTearDown(sessionNotifier.dispose);
        await sessionNotifier.login('mark@example.com', 'password');

        final refresh = sessionNotifier.refreshProfile();
        await sessionNotifier.logout();
        profile.complete(
          _customerLoginResponse()['user'] as Map<String, dynamic>,
        );
        await refresh;

        expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
        expect(sessionNotifier.state.user, isNull);
      },
    );

    test('a delayed login cannot authenticate after logout', () async {
      final response = Completer<Map<String, dynamic>>();
      final client = _FakeAuthSessionClient()
        ..loginResults.add(() => response.future);
      final sessionNotifier = AuthNotifier(null, false, client);
      addTearDown(sessionNotifier.dispose);

      final login = sessionNotifier.login('mark@example.com', 'password');
      await sessionNotifier.logout();
      response.complete(_customerLoginResponse());
      await login;

      expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
      expect(sessionNotifier.state.user, isNull);
      expect(client.savedTokens, isEmpty);
    });

    test('a delayed auto-login cannot authenticate after logout', () async {
      final completion = Completer<Map<String, dynamic>>();
      final client = _FakeAuthSessionClient();
      client.completionResult = () => completion.future;
      client.profileResult = () async =>
          _customerLoginResponse()['user'] as Map<String, dynamic>;
      final sessionNotifier = AuthNotifier(null, false, client);
      addTearDown(sessionNotifier.dispose);

      final autoLogin = sessionNotifier.tryAutoLogin();
      await Future<void>.delayed(Duration.zero);
      await sessionNotifier.logout();
      completion.complete({'accountStatus': 'active'});
      await autoLogin;

      expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
      expect(sessionNotifier.state.user, isNull);
      expect(client.profileCalls, 0);
    });

    test(
      'logout revokes the authenticated device token before clearing auth',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.add(() async => _customerLoginResponse());
        final fcmClient = _FakeFcmSessionClient();
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);
        await sessionNotifier.login('mark@example.com', 'password');

        await sessionNotifier.logout();

        expect(fcmClient.registerCalls, 1);
        expect(fcmClient.revokeCalls, 1);
        expect(client.clearTokenCalls, 1);
        expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
      },
    );

    test('logout still clears auth when remote FCM revocation fails', () async {
      final client = _FakeAuthSessionClient()
        ..loginResults.add(() async => _customerLoginResponse());
      final fcmClient = _FakeFcmSessionClient()
        ..revokeError = StateError('offline');
      final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
      addTearDown(sessionNotifier.dispose);
      await sessionNotifier.login('mark@example.com', 'password');

      await sessionNotifier.logout();

      expect(fcmClient.revokeCalls, 1);
      expect(fcmClient.invalidateCalls, 1);
      expect(client.clearTokenCalls, 1);
      expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
    });

    test(
      'failed token transfer invalidates previous-account push delivery',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.add(() async => _customerLoginResponse());
        final fcmClient = _FakeFcmSessionClient()
          ..registerError = StateError('offline');
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);

        await sessionNotifier.login('ven@example.com', 'password');

        expect(sessionNotifier.state.status, AuthStatus.authenticated);
        expect(fcmClient.registerCalls, 1);
        expect(fcmClient.invalidateCalls, 1);
      },
    );

    test(
      'login fails closed when transfer and invalidation both fail',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.add(() async => _customerLoginResponse());
        final fcmClient = _FakeFcmSessionClient()
          ..registerError = StateError('registration offline')
          ..invalidateError = StateError('deletion offline');
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);

        await sessionNotifier.login('ven@example.com', 'password');

        expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
        expect(sessionNotifier.state.errorMessage, isNotNull);
        expect(client.clearTokenCalls, 1);
      },
    );

    test('real login in a dev-auth build still revokes on logout', () async {
      final client = _FakeAuthSessionClient()
        ..loginResults.add(() async => _customerLoginResponse());
      final fcmClient = _FakeFcmSessionClient();
      final sessionNotifier = AuthNotifier(null, true, client, fcmClient);
      addTearDown(sessionNotifier.dispose);
      await sessionNotifier.login('mark@example.com', 'password');

      await sessionNotifier.logout();

      expect(fcmClient.revokeCalls, 1);
      expect(client.clearTokenCalls, 1);
    });

    test('logout revokes a token from a beta-held session', () async {
      final client = _FakeAuthSessionClient()
        ..completionResult = () async => _heldCompletionResponse();
      final fcmClient = _FakeFcmSessionClient();
      final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
      addTearDown(sessionNotifier.dispose);
      await sessionNotifier.tryAutoLogin();
      expect(sessionNotifier.state.betaLocked, isNotNull);

      await sessionNotifier.logout();

      expect(fcmClient.revokeCalls, 1);
      expect(client.clearTokenCalls, 1);
    });

    test(
      'invalid auto-login revokes device delivery before clearing auth',
      () async {
        final client = _FakeAuthSessionClient()
          ..completionResult = () async {
            throw _dioFailure(403, {'message': 'Completion unavailable'});
          }
          ..profileResult = () async {
            throw _dioFailure(401, {'message': 'Unauthorized'});
          };
        final fcmClient = _FakeFcmSessionClient();
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);

        await sessionNotifier.tryAutoLogin();

        expect(fcmClient.revokeCalls, 1);
        expect(client.clearTokenCalls, 1);
        expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
      },
    );

    test(
      'delayed registration is compensated before logout completes',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.add(() async => _customerLoginResponse());
        final registerStarted = Completer<void>();
        final registerBlock = Completer<void>();
        final fcmClient = _FakeFcmSessionClient()
          ..registerStarted = registerStarted
          ..registerBlock = registerBlock;
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);

        final login = sessionNotifier.login('mark@example.com', 'password');
        await registerStarted.future;
        final logout = sessionNotifier.logout();
        registerBlock.complete();
        await Future.wait([login, logout]);

        expect(sessionNotifier.state.status, AuthStatus.unauthenticated);
        expect(fcmClient.operations.last, 'revoke');
        expect(client.clearTokenCalls, 1);
      },
    );

    test(
      'older registration cannot overwrite a newer account session',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.addAll([
            () async => _customerLoginResponse(),
            () async => _customerLoginResponse(
              token: 'ven-token',
              id: 12,
              email: 'ven@example.com',
            ),
          ]);
        final firstRegisterStarted = Completer<void>();
        final firstRegisterBlock = Completer<void>();
        final fcmClient = _FakeFcmSessionClient()
          ..registerStarted = firstRegisterStarted
          ..registerBlock = firstRegisterBlock;
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);

        final markLogin = sessionNotifier.login('mark@example.com', 'password');
        await firstRegisterStarted.future;
        final venLogin = sessionNotifier.login('ven@example.com', 'password');
        firstRegisterBlock.complete();
        await Future.wait([markLogin, venLogin]);

        expect(sessionNotifier.state.user?.email, 'ven@example.com');
        expect(fcmClient.operations, [
          'register-start:1',
          'register-complete:1',
          'revoke',
          'register-start:2',
          'register-complete:2',
        ]);
      },
    );

    test(
      'a refreshed FCM token is registered for the current session',
      () async {
        final client = _FakeAuthSessionClient()
          ..loginResults.add(() async => _customerLoginResponse());
        final fcmClient = _FakeFcmSessionClient();
        final sessionNotifier = AuthNotifier(null, false, client, fcmClient);
        addTearDown(sessionNotifier.dispose);
        await sessionNotifier.login('mark@example.com', 'password');

        NotificationService.emitTokenRefreshForTest('rotated-token');
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        expect(fcmClient.registerCalls, 2);
        expect(fcmClient.operations.last, 'register-complete:2');
      },
    );
  });

  group('AuthState', () {
    test('unauthenticated factory creates correct state', () {
      final state = AuthState.unauthenticated();
      expect(state.status, AuthStatus.unauthenticated);
      expect(state.user, isNull);
      expect(state.isLoading, false);
      expect(state.errorMessage, isNull);
    });

    test('copyWith preserves unchanged fields', () {
      const user = AuthUser(
        id: '1',
        email: 'test@test.com',
        fullName: 'Test',
        role: 'customer',
      );
      const state = AuthState(status: AuthStatus.authenticated, user: user);
      final copied = state.copyWith(isLoading: true);
      expect(copied.status, AuthStatus.authenticated);
      expect(copied.user, user);
      expect(copied.isLoading, true);
    });

    test('copyWith clears errorMessage when not passed', () {
      const state = AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: 'some error',
      );
      // copyWith uses nullable errorMessage — passing nothing clears it
      final copied = state.copyWith(isLoading: true);
      expect(copied.errorMessage, isNull);
    });
  });

  test('extracts the scoped token returned for a beta-held login', () {
    expect(
      betaHeldAccessTokenFromResponse({
        'code': 'beta_held',
        'access_token': 'held-token',
      }),
      'held-token',
    );
    expect(betaHeldAccessTokenFromResponse({'code': 'beta_held'}), isNull);
  });

  group('AuthUser', () {
    test('copyWith creates new instance with overridden fields', () {
      const user = AuthUser(
        id: '1',
        email: 'test@test.com',
        fullName: 'Test User',
        role: 'customer',
        profileCategory: 'student',
        profileField: 'architecture',
        printingPreferences: ['plotting_blueprints'],
      );
      final updated = user.copyWith(
        fullName: 'New Name',
        nickname: 'Kai',
        phone: '1234567890',
        ageRange: '25_34',
        printingPreferences: const ['technical_specs'],
      );
      expect(updated.fullName, 'New Name');
      expect(updated.nickname, 'Kai');
      expect(updated.phone, '1234567890');
      expect(updated.ageRange, '25_34');
      expect(updated.printingPreferences, const ['technical_specs']);
      expect(updated.email, 'test@test.com'); // preserved
      expect(updated.id, '1'); // preserved
    });
  });
}
