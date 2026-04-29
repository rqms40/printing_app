import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/widgets/file_upload_card.dart';

void main() {
  testWidgets('FileUploadCard shows preview action when a file can preview', (
    tester,
  ) async {
    var previewTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FileUploadCard(
            onTap: () {},
            onPreview: () => previewTapped = true,
            fileName: 'proposal.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
          ),
        ),
      ),
    );

    expect(find.text('Preview'), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);

    await tester.tap(find.text('Preview'));

    expect(previewTapped, isTrue);
  });
}
