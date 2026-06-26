import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/screens/beta_success_wall_screen.dart';

void main() {
  testWidgets('shows GRID Community CTA on the beta success wall', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: BetaSuccessWallScreen(),
        ),
      ),
    );

    await tester.pump();

    expect(find.text('Join GRID Community'), findsOneWidget);
    expect(find.textContaining('updates, feedback, and launch perks'), findsOneWidget);
  });
}
