import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_photo_upload_card.dart';

void main() {
  testWidgets('presents the selected photo as a branded social image', (
    tester,
  ) async {
    var saveCalls = 0;
    final shareImageKey = GlobalKey();
    final photoBytes = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 320,
              child: BetaPhotoUploadCard(
                photoBytes: photoBytes,
                shareImageKey: shareImageKey,
                onPick: () {},
                onReplace: () {},
                onSave: () => saveCalls += 1,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('BETA TESTER'), findsOneWidget);
    expect(find.text('PRINTED WITH GRIDGO'), findsOneWidget);
    expect(find.byKey(const ValueKey('beta-photo-save')), findsOneWidget);
    final shareImageSize = tester.getSize(find.byKey(shareImageKey));
    expect(shareImageSize.width / shareImageSize.height, closeTo(4 / 5, 0.001));

    await tester.tap(find.byKey(const ValueKey('beta-photo-save')));
    expect(saveCalls, 1);
  });
}
