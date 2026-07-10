import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/routes/app_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/models/beta_locked_info.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';

const _customer = AuthUser(
  id: '11',
  email: 'mark@example.com',
  fullName: 'Mark Prado',
  role: 'customer',
  isProfileComplete: true,
);

const _activeCustomer = AuthState(
  status: AuthStatus.authenticated,
  user: _customer,
);

const _justSubmittedCustomer = AuthState(
  status: AuthStatus.authenticated,
  user: _customer,
  betaCompletionJustSubmitted: true,
);

const _heldCustomer = AuthState(
  betaLocked: BetaLockedInfo(
    fullName: 'Mark Prado',
    email: 'mark@example.com',
    betaPhotoUploaded: false,
    betaSharedOnSocial: false,
  ),
);

String? _redirect(
  String location,
  AuthState auth, {
  AccountState account = const AccountState.unknown(),
  bool seenOnboarding = true,
}) => resolveAppRedirect(
  uri: Uri.parse(location),
  authState: auth,
  accountState: account,
  seenOnboarding: seenOnboarding,
);

void main() {
  group('beta completion route guards', () {
    test('unauthenticated success-wall deep link fails closed', () {
      expect(
        _redirect('/customer/beta/success-wall', AuthState.unauthenticated()),
        '/auth/login',
      );
    });

    test('ordinary authenticated customer cannot open success wall', () {
      expect(
        _redirect('/customer/beta/success-wall', _activeCustomer),
        '/customer/home',
      );
    });

    test('authenticated just-submitted customer can open success wall', () {
      expect(
        _redirect('/customer/beta/success-wall', _justSubmittedCustomer),
        isNull,
      );
    });

    test('locked route requires server-verified held state', () {
      expect(
        _redirect('/customer/beta/locked', AuthState.unauthenticated()),
        '/auth/login',
      );
      expect(
        _redirect('/customer/beta/locked', _activeCustomer),
        '/customer/home',
      );
      expect(_redirect('/customer/beta/locked', _heldCustomer), isNull);
    });

    test('verified held customer is contained to locked route', () {
      expect(
        _redirect('/customer/home', _heldCustomer),
        '/customer/beta/locked',
      );
      expect(_redirect('/auth/login', _heldCustomer), '/customer/beta/locked');
    });
  });

  group('legitimate deep-link preservation', () {
    test('preserves a protected customer URI through login', () {
      const target = '/customer/orders/42?source=notification';
      final login = _redirect(target, AuthState.unauthenticated());

      expect(login, '/auth/login?redirect=${Uri.encodeComponent(target)}');
      expect(_redirect(login!, _activeCustomer), target);
    });

    test('rejects absolute and role-mismatched post-login redirects', () {
      expect(
        _redirect(
          '/auth/login?redirect=${Uri.encodeComponent('https://evil.test')}',
          _activeCustomer,
        ),
        '/customer/home',
      );
      expect(
        _redirect(
          '/auth/login?redirect=${Uri.encodeComponent('/admin/dashboard')}',
          _activeCustomer,
        ),
        '/customer/home',
      );
    });

    test('never preserves guarded beta completion routes as redirects', () {
      final target = Uri.encodeComponent('/customer/beta/success-wall');
      expect(
        _redirect('/auth/login?redirect=$target', _activeCustomer),
        '/customer/home',
      );
    });
  });

  test('required survey still outranks ordinary customer deep links', () {
    const account = AccountState(
      status: AccountGateStatus.surveyRequired,
      holds: [],
    );
    expect(
      _redirect('/customer/orders/42', _activeCustomer, account: account),
      '/customer/survey/required',
    );
  });
}
