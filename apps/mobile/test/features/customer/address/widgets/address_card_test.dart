import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/widgets/address_card.dart';
import 'package:printing_app/shared/models/address.dart';

void main() {
  testWidgets('exposes the saved address details as one accessible card', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final now = DateTime(2026);
    final address = Address(
      id: '1',
      userId: '4',
      label: 'Mark beta route stop',
      fullAddress: 'Mark beta route address, Davao City',
      city: 'Davao City',
      landmark: 'Mark deterministic beta pin',
      latitude: 7.0731,
      longitude: 125.6128,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AddressCard(address: address, onEdit: () {}, onDelete: () {}),
        ),
      ),
    );

    expect(
      find.bySemanticsLabel(
        RegExp(
          r'^Mark beta route stop\. Default\. '
          r'Mark beta route address, Davao City\. '
          r'Landmark: Mark deterministic beta pin',
        ),
      ),
      findsOneWidget,
    );
    semantics.dispose();
  });
}
