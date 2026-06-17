import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_online_pill.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';

void main() {
  testWidgets('tapping the pill toggles availability', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: const Scaffold(body: RiderOnlinePill()),
        ),
      ),
    );
    await tester.pump();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(RiderOnlinePill)),
    );
    final before = container.read(riderProfileProvider).isAvailable;

    await tester.tap(find.byType(RiderOnlinePill));
    await tester.pump();

    expect(container.read(riderProfileProvider).isAvailable, !before);
  });
}
