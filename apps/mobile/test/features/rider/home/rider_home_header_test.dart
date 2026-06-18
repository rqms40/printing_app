import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';

void main() {
  testWidgets('renders greeting with the rider first name', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: RiderHomeHeader(firstName: 'Juan')),
        ),
      ),
    );
    await tester.pump();
    expect(find.textContaining('Juan'), findsOneWidget);
    expect(find.text('Online'), findsNothing);
    expect(find.text('Offline'), findsNothing);
  });
}
