import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/tracking/widgets/rider_info_card.dart';
import 'package:printing_app/shared/models/order.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.light),
    home: Scaffold(body: child),
  );
}

void main() {
  testWidgets('shows a pending state instead of fake rider data', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const RiderInfoCard()));

    expect(find.text('Rider pending'), findsOneWidget);
    expect(find.textContaining('assigned'), findsOneWidget);
    expect(find.text('Juan Reyes'), findsNothing);
    expect(find.text('Call Rider'), findsNothing);
    expect(find.text('Message Rider'), findsNothing);
  });

  testWidgets('renders assigned rider details with phone actions', (
    tester,
  ) async {
    var tappedChat = false;
    await tester.pumpWidget(
      _wrap(
        RiderInfoCard(
          rider: const AssignedRiderContact(
            userId: '70',
            riderProfileId: '7',
            displayName: 'Maya Santos',
            phoneNumber: '+639171234567',
            vehicleType: 'motorcycle',
            plateNumber: 'ABC 1234',
            deliveryAssignmentId: '99',
            deliveryStatus: 'on_the_way',
          ),
          onChat: () => tappedChat = true,
        ),
      ),
    );

    expect(find.text('Maya Santos'), findsOneWidget);
    expect(find.text('Motorcycle · ABC 1234'), findsOneWidget);
    expect(find.text('+639171234567'), findsOneWidget);
    expect(find.text('On the way'), findsOneWidget);
    expect(find.text('Message Rider'), findsOneWidget);
    expect(find.text('Call Rider'), findsOneWidget);

    await tester.tap(find.text('Message Rider'));
    expect(tappedChat, isTrue);
  });

  testWidgets(
    'renders assigned rider without enabling call when phone missing',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          const RiderInfoCard(
            rider: AssignedRiderContact(
              userId: '70',
              riderProfileId: '7',
              displayName: 'Maya Santos',
              vehicleType: 'motorcycle',
              plateNumber: 'ABC 1234',
              deliveryAssignmentId: '99',
              deliveryStatus: 'accepted',
            ),
          ),
        ),
      );

      expect(find.text('Maya Santos'), findsOneWidget);
      expect(find.text('Phone unavailable'), findsOneWidget);
      expect(find.text('Call Rider'), findsNothing);
    },
  );
}
