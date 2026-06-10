import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/screens/register_screen.dart';

class _TestAuthNotifier extends AuthNotifier {
  int registerCalls = 0;
  Map<String, dynamic>? lastRegisterPayload;

  @override
  Future<void> register(
    String email,
    String password, {
    required String fullName,
    required String profileCategory,
    required String profileField,
    String? nickname,
    String? phone,
    String? gender,
    String? ageRange,
    DateTime? dob,
    String? course,
    String? organization,
    List<String> printingPreferences = const [],
  }) async {
    registerCalls += 1;
    lastRegisterPayload = {
      'email': email,
      'password': password,
      'fullName': fullName,
      'nickname': nickname,
      'phone': phone,
      'gender': gender,
      'ageRange': ageRange,
      'profileCategory': profileCategory,
      'profileField': profileField,
      'course': course,
      'organization': organization,
      'printingPreferences': printingPreferences,
    };
  }
}

Widget _wrap(Widget child, {_TestAuthNotifier? notifier}) {
  return ProviderScope(
    overrides: [
      if (notifier != null) authProvider.overrideWith((ref) => notifier),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('RegisterScreen', () {
    testWidgets('starts on the privacy step instead of the account form', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const RegisterScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.textContaining('your rules'), findsOneWidget);
      expect(find.text('Agree & Continue'), findsOneWidget);
      expect(find.text('View Terms & Conditions'), findsOneWidget);
      expect(find.text('Email'), findsNothing);
      expect(find.text('Password'), findsNothing);
      expect(find.text('Confirm Password'), findsNothing);
      expect(find.text('Full Name'), findsNothing);
    });

    testWidgets('blocks progression until the nickname step is filled', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const RegisterScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Agree & Continue'));
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.textContaining('we call you'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Nickname is required'), findsOneWidget);
      expect(find.text('Tell us a bit about yourself'), findsNothing);
    });

    testWidgets(
      'submits registration only after completing the onboarding flow',
      (tester) async {
        final notifier = _TestAuthNotifier();

        await tester.pumpWidget(
          _wrap(const RegisterScreen(), notifier: notifier),
        );
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(milliseconds: 500));

        await tester.tap(find.text('Agree & Continue'));
        await tester.pump(const Duration(milliseconds: 300));
        await tester.pump(const Duration(milliseconds: 300));

        await tester.enterText(find.byType(TextField).first, 'Kai');
        await tester.tap(find.text('Continue'));
        await tester.pump(const Duration(milliseconds: 300));
        await tester.pump(const Duration(milliseconds: 600));

        // postFrameCallback auto-selects 'student' (page 0) on init
        await tester.tap(find.text('Continue'));
        await tester.pump(const Duration(milliseconds: 600));

        await tester.tap(find.text('Architecture'));
        await tester.tap(find.text('Continue'));
        await tester.pump(const Duration(milliseconds: 600));

        await tester.ensureVisible(find.text('Prefer not to say'));
        await tester.tap(find.text('Prefer not to say'));
        await tester.tap(find.text('Continue'));
        await tester.pump(const Duration(milliseconds: 600));

        // postFrameCallback auto-selects 'under_18' (page 0) on init
        await tester.tap(find.text('Continue'));
        await tester.pump(const Duration(milliseconds: 600));

        expect(find.textContaining('Hi, Kai'), findsOneWidget);
        expect(find.text('Full Name'), findsOneWidget);
        expect(notifier.registerCalls, 0);

        await tester.enterText(find.byType(TextField).at(0), 'Kai Reyes');
        await tester.enterText(find.byType(TextField).at(1), 'kai@test.com');
        await tester.enterText(find.byType(TextField).at(2), '+639171234567');
        await tester.enterText(find.byType(TextField).at(3), 'password123');
        await tester.enterText(find.byType(TextField).at(4), 'password123');

        await tester.tap(find.text('Create Account'));
        await tester.pump(const Duration(milliseconds: 600));

        expect(notifier.registerCalls, 1);
        expect(notifier.lastRegisterPayload, isNotNull);
        expect(notifier.lastRegisterPayload!['nickname'], 'Kai');
        expect(notifier.lastRegisterPayload!['ageRange'], 'under_18');
        expect(notifier.lastRegisterPayload!['profileCategory'], 'student');
        expect(notifier.lastRegisterPayload!['profileField'], 'architecture');
        expect(notifier.lastRegisterPayload!['printingPreferences'], const [
          'plotting_blueprints',
        ]);
        expect(notifier.lastRegisterPayload!['phone'], '+639171234567');
      },
    );
  });

  group('RegisterScreen routes', () {
    testWidgets('opens the terms screen from the privacy step', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (_, _) => const RegisterScreen()),
          GoRoute(
            path: '/customer/profile/terms',
            builder: (_, _) => const Scaffold(body: Text('Terms Destination')),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            theme: ThemeData(brightness: Brightness.light),
            routerConfig: router,
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.ensureVisible(find.text('View Terms & Conditions'));
      await tester.tap(find.text('View Terms & Conditions'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      expect(find.text('Terms Destination'), findsOneWidget);
    });
  });
}
