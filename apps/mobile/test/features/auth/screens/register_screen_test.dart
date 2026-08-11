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
    String? profileField,
    String? nickname,
    String? phone,
    String? gender,
    String? ageRange,
    DateTime? dob,
    String? course,
    String? organization,
    List<String> printingPreferences = const [],
    List<String> serviceFocusRanks = const [],
  }) async {
    registerCalls += 1;
    lastRegisterPayload = {
      'email': email,
      'fullName': fullName,
      'nickname': nickname,
      'gender': gender,
      'ageRange': ageRange,
      'profileCategory': profileCategory,
      'profileField': profileField,
      'serviceFocusRanks': serviceFocusRanks,
    };
  }
}

GoRouter _router() => GoRouter(
  routes: [
    GoRoute(path: '/', builder: (_, _) => const RegisterScreen()),
    GoRoute(path: '/auth/beta-welcome', builder: (_, _) => const Scaffold()),
    GoRoute(path: '/onboarding', builder: (_, _) => const Scaffold()),
    GoRoute(
      path: '/customer/profile/terms',
      builder: (_, _) => const Scaffold(body: Text('Terms screen')),
    ),
  ],
);

Widget _wrap({_TestAuthNotifier? notifier}) {
  return ProviderScope(
    overrides: [
      if (notifier != null) authProvider.overrideWith((ref) => notifier),
    ],
    child: MaterialApp.router(
      theme: ThemeData(brightness: Brightness.light),
      routerConfig: _router(),
    ),
  );
}

void main() {
  testWidgets('starts on the welcome plate with a consent gate', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.textContaining('PLATE 01 / 05'), findsOneWidget);
    expect(find.byKey(const Key('consent-checkbox')), findsOneWidget);
    expect(find.bySemanticsLabel('Step 1 of 5'), findsOneWidget);

    // Continue without consent shows an error and does not advance.
    await tester.tap(find.widgetWithText(InkWell, 'Continue').first);
    await tester.pump();
    expect(find.text('Please accept the terms to continue'), findsOneWidget);
    expect(find.textContaining('PLATE 02 / 05'), findsNothing);
  });

  testWidgets('consent advances to the account plate (moved up to step 2)', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byKey(const Key('consent-checkbox')));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.textContaining('PLATE 02 / 05'), findsOneWidget);
    expect(find.text('Set up your\naccount.'), findsOneWidget);
  });

  testWidgets('account step blocks on an invalid email', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.byKey(const Key('consent-checkbox')));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 400));

    await tester.enterText(find.byType(TextField).at(0), 'Mark Reyes');
    await tester.enterText(find.byType(TextField).at(1), 'not-an-email');
    await tester.enterText(find.byType(TextField).at(2), '+639171234567');
    await tester.enterText(find.byType(TextField).at(3), 'abcd1234');
    await tester.enterText(find.byType(TextField).at(4), 'abcd1234');
    await tester.tap(find.text('Continue'));
    await tester.pump();

    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(find.textContaining('PLATE 03 / 05'), findsNothing);
  });
}
