import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/screens/beta_welcome_screen.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';

void main() {
  testWidgets('reveals the founding tester number and credit grant', (
    tester,
  ) async {
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, _) => const BetaWelcomeScreen()),
        GoRoute(path: '/customer/home', builder: (_, _) => const Scaffold()),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          betaStatusProvider.overrideWith(
            (ref) async => const BetaStatus(
              globallyEnabled: true,
              isBetaUser: true,
              rank: 7,
            ),
          ),
          authProvider.overrideWith(
            (ref) => _StubAuth(
              const AuthState(
                status: AuthStatus.authenticated,
                user: AuthUser(
                  id: '1',
                  email: 'm@x.co',
                  fullName: 'Mark',
                  role: 'customer',
                  credits: '100.00',
                ),
              ),
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('#007'), findsOneWidget);
    expect(find.text('100 GRIDGO Credits'), findsOneWidget);
    expect(find.text('Start printing'), findsOneWidget);
    expect(find.text('FOUNDING TESTER'), findsOneWidget);
  });
}

class _StubAuth extends AuthNotifier {
  _StubAuth(this._initial) : super();
  final AuthState _initial;
  @override
  AuthState build() => _initial;
}
