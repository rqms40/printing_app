import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_theme.dart';
import 'package:printing_app/features/customer/order/widgets/model_3d_preview.dart';

void main() {
  testWidgets('shows a non-blocking fallback when preview is unavailable', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: Model3dPreview(
            fileUrl: 'https://files.local/model.ply',
            filename: 'model.ply',
          ),
        ),
      ),
    );

    expect(find.text('model.ply'), findsOneWidget);
    expect(
      find.text('3D preview not available for this format'),
      findsOneWidget,
    );
    expect(
      find.text('You can still continue if file checks pass.'),
      findsOneWidget,
    );
  });
}
