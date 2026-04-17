import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/features/customer/profile/screens/account_details_screen.dart';

Widget _wrap(Widget child) {
  const user = AuthUser(
    id: '1',
    email: 'maria@test.com',
    fullName: 'Maria Santos',
    role: 'customer',
    isProfileComplete: true,
    profileCategory: 'student',
    profileField: 'architecture',
    course: 'BS Architecture',
    organization: 'Mapua University',
    printingPreferences: ['plotting_blueprints'],
  );

  return ProviderScope(
    overrides: [
      profileProvider.overrideWith((ref) => user),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('AccountDetailsScreen', () {
    testWidgets('renders profiling controls and save button', (tester) async {
      await tester.pumpWidget(_wrap(const AccountDetailsScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Account Details'), findsOneWidget);
      expect(find.text('Tell us a bit about yourself'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Professional'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });
  });
}
