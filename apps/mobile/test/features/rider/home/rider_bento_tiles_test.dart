import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_bento_tiles.dart';

void main() {
  testWidgets('earnings tile shows a peso-formatted today value',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SizedBox(height: 200, child: RiderEarningsTile(todayAmount: 250))),
      ),
    );
    expect(find.textContaining('250'), findsOneWidget);
    expect(find.text('Earnings'), findsOneWidget);
  });
}
