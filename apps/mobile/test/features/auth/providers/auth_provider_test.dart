import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';

import '../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
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

    test('devBypass sets authenticated state for customer', () {
      notifier.devBypass('customer');
      expect(notifier.state.status, AuthStatus.authenticated);
      expect(notifier.state.user, isNotNull);
      expect(notifier.state.user!.role, 'customer');
      expect(notifier.state.user!.fullName, 'Maria Santos');
      expect(notifier.state.user!.email, 'maria@test.com');
      expect(notifier.state.user!.id, '1');
      expect(notifier.state.user!.isProfileComplete, true);
      expect(notifier.state.user!.profileCategory, 'student');
      expect(notifier.state.user!.profileField, 'architecture');
      expect(
        notifier.state.user!.printingPreferences,
        contains('plotting_blueprints'),
      );
    });

    test('devBypass sets authenticated state for driver', () {
      notifier.devBypass('driver');
      expect(notifier.state.status, AuthStatus.authenticated);
      expect(notifier.state.user!.role, 'driver');
      expect(notifier.state.user!.fullName, 'Juan Reyes');
      expect(notifier.state.user!.email, 'juan@test.com');
      expect(notifier.state.user!.id, '2');
    });

    test('devBypass sets authenticated state for admin', () {
      notifier.devBypass('admin');
      expect(notifier.state.status, AuthStatus.authenticated);
      expect(notifier.state.user!.role, 'admin');
      expect(notifier.state.user!.fullName, 'Admin');
      expect(notifier.state.user!.email, 'admin@test.com');
      expect(notifier.state.user!.id, '3');
    });

    test('logout resets to unauthenticated', () async {
      notifier.devBypass('customer');
      expect(notifier.state.status, AuthStatus.authenticated);

      await notifier.logout();

      expect(notifier.state.status, AuthStatus.unauthenticated);
      expect(notifier.state.user, isNull);
      expect(notifier.state.isLoading, false);
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
        profileCategory: 'student',
        profileField: 'architecture',
        printingPreferences: const ['plotting_blueprints'],
      );

      expect(notifier.state.isLoading, false);
      expect(notifier.state.errorMessage, isNotNull);
      expect(notifier.state.status, AuthStatus.unauthenticated);
    });

    test('multiple devBypass calls override previous state', () {
      notifier.devBypass('customer');
      expect(notifier.state.user!.role, 'customer');

      notifier.devBypass('driver');
      expect(notifier.state.user!.role, 'driver');

      notifier.devBypass('admin');
      expect(notifier.state.user!.role, 'admin');
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
      const state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
      );
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
        phone: '1234567890',
        printingPreferences: const ['technical_specs'],
      );
      expect(updated.fullName, 'New Name');
      expect(updated.phone, '1234567890');
      expect(updated.printingPreferences, const ['technical_specs']);
      expect(updated.email, 'test@test.com'); // preserved
      expect(updated.id, '1'); // preserved
    });
  });
}
