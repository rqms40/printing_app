import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/features/customer/profile/screens/profile_screen.dart';

Widget _wrapProfile() {
  const user = AuthUser(
    id: '1',
    email: 'maria@test.com',
    fullName: 'Maria Santos',
    role: 'customer',
    isProfileComplete: true,
    credits: '120.00',
  );

  return ProviderScope(
    overrides: [
      profileProvider.overrideWith((ref) => user),
      surveyVisibilityProvider.overrideWith((ref) async => false),
    ],
    child: const MaterialApp(home: Scaffold(body: ProfileScreen())),
  );
}

void main() {
  testWidgets('does not show print mode controls in profile preferences', (
    tester,
  ) async {
    await tester.pumpWidget(_wrapProfile());
    await tester.pumpAndSettle();

    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Dark Mode'), findsOneWidget);
    expect(find.text('Default Print Mode'), findsNothing);
    expect(find.text('Fit to paper'), findsNothing);
    expect(find.text('Actual size'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
