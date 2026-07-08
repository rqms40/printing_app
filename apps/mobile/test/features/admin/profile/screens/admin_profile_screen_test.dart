import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/features/admin/profile/screens/admin_profile_screen.dart';
import 'package:printing_app/shared/app_version.dart';

void main() {
  testWidgets('admin profile displays the current release version', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: const AdminProfileScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('GRIDGO Admin'), findsOneWidget);
    expect(find.text(AppVersion.display), findsOneWidget);
    expect(find.text('Version 1.0.0'), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
