import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

import '../../../helpers/test_setup.dart';

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
