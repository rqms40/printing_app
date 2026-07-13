import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_indicator.dart';

void main() {
  testWidgets(
    'defaults the beta badge to top chrome away from bottom actions',
    (tester) async {
      tester.view.physicalSize = const Size(393, 852);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            betaStatusProvider.overrideWith(
              (_) async => const BetaStatus(
                globallyEnabled: true,
                isBetaUser: true,
                rank: 1,
              ),
            ),
          ],
          child: const MaterialApp(
            home: BetaIndicatorOverlay(
              child: Scaffold(
                body: Column(
                  children: [
                    Text('Page heading'),
                    Spacer(),
                    SizedBox(height: 56, child: Text('Primary action')),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final beta = find.text('BETA');
      expect(beta, findsOneWidget);
      expect(tester.getRect(beta).top, lessThan(30));
      expect(
        tester
            .getRect(beta)
            .overlaps(tester.getRect(find.text('Page heading'))),
        isFalse,
      );
      expect(
        tester
            .getRect(beta)
            .overlaps(tester.getRect(find.text('Primary action'))),
        isFalse,
      );
    },
  );
}
