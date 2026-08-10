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

const _rider = AuthUser(
  id: '12',
  email: 'juan@example.com',
  fullName: 'Juan Reyes',
  role: 'rider',
  isProfileComplete: true,
);

const _admin = AuthUser(
  id: '13',
  email: 'admin@example.com',
  fullName: 'GRID Admin',
  role: 'admin',
  isProfileComplete: true,
);

const _supplier = AuthUser(
  id: '14',
  email: 'supplier@example.com',
  fullName: 'Supplier Co',
  role: 'supplier',
  isProfileComplete: true,
);

const _activeCustomer = AuthState(
  status: AuthStatus.authenticated,
  user: _customer,
);

const _activeRider = AuthState(status: AuthStatus.authenticated, user: _rider);

const _activeAdmin = AuthState(status: AuthStatus.authenticated, user: _admin);

const _activeSupplier = AuthState(
  status: AuthStatus.authenticated,
  user: _supplier,
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
    test('restores a validated platform target after splash auto-login', () {
      const target = '/customer/orders/42?source=platform';
      final splash = '/splash?redirect=${Uri.encodeComponent(target)}';

      expect(_redirect(splash, AuthState.unauthenticated()), isNull);
      expect(_redirect(splash, _activeCustomer), target);
      expect(_redirect(splash, _heldCustomer), '/customer/beta/locked');
    });

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

  group('authenticated role route ownership', () {
    test('customer cannot directly open rider or admin routes', () {
      expect(_redirect('/rider/home', _activeCustomer), '/customer/home');
      expect(_redirect('/admin/dashboard', _activeCustomer), '/customer/home');
      expect(_redirect('/supplier/jobs', _activeCustomer), '/customer/home');
    });

    test('rider cannot directly open customer or admin routes', () {
      expect(_redirect('/customer/orders/42', _activeRider), '/rider/home');
      expect(_redirect('/admin/dashboard', _activeRider), '/rider/home');
      expect(_redirect('/supplier/jobs', _activeRider), '/rider/home');
    });

    test('admin cannot directly open customer or rider routes', () {
      expect(_redirect('/customer/home', _activeAdmin), '/admin/dashboard');
      expect(_redirect('/rider/deliveries', _activeAdmin), '/admin/dashboard');
      expect(_redirect('/supplier/jobs', _activeAdmin), '/admin/dashboard');
    });

    test('supplier lands on jobs home and stays on supplier surface', () {
      expect(
        _redirect('/auth/login', _activeSupplier),
        '/supplier/jobs',
      );
      expect(_redirect('/supplier/jobs', _activeSupplier), isNull);
      expect(_redirect('/supplier/profile', _activeSupplier), isNull);
      expect(_redirect('/supplier/jobs/9', _activeSupplier), isNull);
      expect(_redirect('/customer/home', _activeSupplier), '/supplier/jobs');
      expect(_redirect('/rider/home', _activeSupplier), '/supplier/jobs');
      expect(_redirect('/admin/dashboard', _activeSupplier), '/supplier/jobs');
    });

    test('each authenticated role keeps routes in its own surface', () {
      expect(_redirect('/customer/orders', _activeCustomer), isNull);
      expect(_redirect('/rider/deliveries', _activeRider), isNull);
      expect(_redirect('/admin/queue', _activeAdmin), isNull);
      expect(_redirect('/supplier/payouts', _activeSupplier), isNull);
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
