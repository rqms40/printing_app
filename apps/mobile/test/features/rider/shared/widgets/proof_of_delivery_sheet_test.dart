import 'dart:ui';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/features/rider/shared/widgets/proof_of_delivery_sheet.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

void main() {
  test('builds web-compatible photo proof from XFile bytes', () async {
    final bytes = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xD9]);
    final picked = XFile.fromData(
      bytes,
      name: 'proof.jpg',
      mimeType: 'image/jpeg',
    );

    final multipart = await buildProofPhotoMultipart(picked);
    final uploaded = await multipart.finalize().fold<List<int>>(
      <int>[],
      (all, chunk) => all..addAll(chunk),
    );

    expect(multipart.filename, 'delivery-proof.jpg');
    expect(uploaded, bytes);
  });

  testWidgets('signature canvas has a distinct accessible name', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ProofOfDeliverySheet(orderRef: 'ORD-10001')),
      ),
    );

    final signaturePad = find.bySemanticsLabel(RegExp(r'^Signature pad'));
    expect(signaturePad, findsOneWidget);
    final semantics = tester.getSemantics(signaturePad);
    expect(semantics.flagsCollection.isFocused, isNot(Tristate.none));
    expect(semantics.childrenCount, greaterThan(0));
    final signaturePaint = find.descendant(
      of: signaturePad,
      matching: find.byType(CustomPaint),
    );
    expect(signaturePaint, findsOneWidget);
    final beforeDraw = tester.widget<CustomPaint>(signaturePaint);

    final rect = tester.getRect(signaturePad);
    final signature = await tester.startGesture(
      Offset(rect.left + 24, rect.top + 32),
    );
    await signature.moveTo(Offset(rect.center.dx, rect.center.dy));
    await signature.moveTo(Offset(rect.right - 24, rect.bottom - 32));
    await signature.up();
    await tester.pump();

    final afterDraw = tester.widget<CustomPaint>(signaturePaint);
    expect(
      afterDraw.painter!.shouldRepaint(beforeDraw.painter!),
      isTrue,
      reason: 'each signature update must repaint the drawn stroke',
    );

    final submit = tester.widget<AppButton>(
      find.widgetWithText(AppButton, 'Submit proof'),
    );
    expect(submit.isDisabled, isFalse);
    expect(submit.onTap, isNotNull);
  });
}
