import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_stale_route_banner.dart';

void main() {
  testWidgets('stale route banner shows the refresh guidance', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: RiderStaleRouteBanner())),
    );
    expect(
      find.text('Route data may be outdated — pull to refresh'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
  });
}
