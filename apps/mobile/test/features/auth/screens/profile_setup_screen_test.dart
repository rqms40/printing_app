import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/screens/profile_setup_screen.dart';

Widget _wrapWithAuth(Widget child, {required AuthState state}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) {
        final notifier = AuthNotifier();
        notifier.state = state;
        return notifier;
      }),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('ProfileSetupScreen', () {
    testWidgets('renders profiling controls alongside identity fields', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrapWithAuth(
          const ProfileSetupScreen(
            draft: RegistrationDraft(
              email: 'new@test.com',
              password: 'password123',
            ),
          ),
          state: const AuthState(
            status: AuthStatus.profileIncomplete,
            user: AuthUser(
              id: '1',
              email: 'new@test.com',
              fullName: '',
              role: 'customer',
            ),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Complete Your Profile'), findsOneWidget);
      expect(find.text('Full Name'), findsOneWidget);
      expect(find.text('Tell us a bit about yourself'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Professional'), findsOneWidget);
    });

    testWidgets(
      'shows loading and error state from auth provider after final registration failure',
      (tester) async {
        await tester.pumpWidget(
          _wrapWithAuth(
            const ProfileSetupScreen(
              draft: RegistrationDraft(
                email: 'new@test.com',
                password: 'password123',
              ),
            ),
            state: const AuthState(
              status: AuthStatus.profileIncomplete,
              isLoading: true,
              errorMessage: 'Registration failed',
              user: AuthUser(
                id: '1',
                email: 'new@test.com',
                fullName: '',
                role: 'customer',
              ),
            ),
          ),
        );
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(milliseconds: 500));

        expect(find.text('Registration failed'), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
      },
    );

    testWidgets(
      'shows a recovery guard when opened unauthenticated without a draft',
      (tester) async {
        await tester.pumpWidget(
          _wrapWithAuth(
            const ProfileSetupScreen(),
            state: AuthState.unauthenticated(),
          ),
        );
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(milliseconds: 500));

        expect(find.textContaining('restart'), findsWidgets);
        expect(find.text('Full Name'), findsNothing);
        expect(find.text('Student'), findsNothing);
        expect(find.text('Professional'), findsNothing);
      },
    );
  });
}
