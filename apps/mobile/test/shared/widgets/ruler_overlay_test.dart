import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/widgets/ruler_overlay.dart';

void main() {
  group('architect scale calibration', () {
    test('uses architect-only triangular scale labels', () {
      final labels = kArchitectScales.map((scale) => scale.label).toList();

      expect(
        labels,
        containsAll(<String>[
          '3/32" = 1\'-0"',
          '3/16" = 1\'-0"',
          '1/8" = 1\'-0"',
          '1/4" = 1\'-0"',
          '1/2" = 1\'-0"',
          '3/8" = 1\'-0"',
          '3/4" = 1\'-0"',
          '1" = 1\'-0"',
          '1 1/2" = 1\'-0"',
          '3" = 1\'-0"',
          'Full size (1/16")',
        ]),
      );
      expect(labels.any((label) => label.startsWith('1:')), isFalse);
    });

    test('maps 1/4 inch architect scale to real feet accurately', () {
      final quarterScale = kArchitectScales.singleWhere(
        (scale) => scale.label == '1/4" = 1\'-0"',
      );

      expect(
        pixelsForRealFeet(
          scale: quarterScale,
          realFeet: 4,
          pxPerDrawingInch: 100,
        ),
        closeTo(100, 0.001),
      );
      expect(quarterScale.realFeetForDrawingInches(1), closeTo(4, 0.001));
    });

    test('full-size triangular face uses sixteenth-inch increments', () {
      final fullSizeScale = kArchitectScales.singleWhere(
        (scale) => scale.isFullSize,
      );

      expect(fullSizeScale.label, 'Full size (1/16")');
      expect(
        pixelsForDrawingInches(drawingInches: 1 / 16, pxPerDrawingInch: 160),
        closeTo(10, 0.001),
      );
    });

    test(
      'calibrates against the fitted document rect, not raw viewport width',
      () {
        final rect = rulerFittedDrawingRect(
          viewportSize: const Size(1000, 800),
          drawingWidthMm: 254,
          drawingHeightMm: 127,
        );

        expect(rect.left, closeTo(0, 0.001));
        expect(rect.top, closeTo(150, 0.001));
        expect(rect.width, closeTo(1000, 0.001));
        expect(rect.height, closeTo(500, 0.001));
        expect(
          drawingPixelsPerInchForViewport(
            viewportSize: const Size(1000, 800),
            drawingWidthMm: 254,
            drawingHeightMm: 127,
          ),
          closeTo(100, 0.001),
        );
      },
    );

    test('gesture center uses absolute focal point movement', () {
      final center = rulerCenterForGesture(
        startCenter: const Offset(200, 300),
        startFocalPoint: const Offset(10, 20),
        currentFocalPoint: const Offset(70, 5),
        bounds: const Size(500, 500),
        rulerSize: const Size(100, 84),
      );

      expect(center.dx, closeTo(260, 0.001));
      expect(center.dy, closeTo(285, 0.001));
    });
  });

  testWidgets('RulerOverlay renders the selected architect scale label', (
    tester,
  ) async {
    final quarterScale = kArchitectScales.singleWhere(
      (scale) => scale.label == '1/4" = 1\'-0"',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 600,
            height: 400,
            child: RulerOverlay(
              widthMm: 254,
              heightMm: 127,
              scale: quarterScale,
            ),
          ),
        ),
      ),
    );

    expect(find.text('1/4" = 1\'-0"'), findsOneWidget);
    expect(find.text('1:100'), findsNothing);
  });
}
