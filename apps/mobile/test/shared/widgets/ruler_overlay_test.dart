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

    test('all supported architect scales convert feet to drawing inches', () {
      for (final scale in kArchitectScales) {
        expect(
          scale.drawingInchesForRealFeet(12),
          closeTo(12 * scale.inchesPerFoot, 0.001),
          reason: scale.label,
        );
        expect(
          scale.realFeetForDrawingInches(scale.inchesPerFoot * 8),
          closeTo(8, 0.001),
          reason: scale.label,
        );
        expect(
          pixelsForRealFeet(scale: scale, realFeet: 1, pxPerDrawingInch: 96),
          closeTo(scale.inchesPerFoot * 96, 0.001),
          reason: scale.label,
        );
      }
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

    test('calibrates portrait, landscape, and standard page dimensions', () {
      final portrait = rulerFittedDrawingRect(
        viewportSize: const Size(1000, 800),
        drawingWidthMm: 210,
        drawingHeightMm: 297,
      );
      expect(portrait.width, closeTo(565.657, 0.001));
      expect(portrait.height, closeTo(800, 0.001));
      expect(portrait.left, closeTo(217.172, 0.001));
      expect(portrait.top, closeTo(0, 0.001));

      final landscape = rulerFittedDrawingRect(
        viewportSize: const Size(1000, 800),
        drawingWidthMm: 297,
        drawingHeightMm: 210,
      );
      expect(landscape.width, closeTo(1000, 0.001));
      expect(landscape.height, closeTo(707.071, 0.001));
      expect(landscape.left, closeTo(0, 0.001));
      expect(landscape.top, closeTo(46.465, 0.001));

      final legal = rulerFittedDrawingRect(
        viewportSize: const Size(600, 900),
        drawingWidthMm: 215.9,
        drawingHeightMm: 355.6,
      );
      expect(legal.width, closeTo(546.43, 0.01));
      expect(legal.height, closeTo(900, 0.001));
      expect(legal.left, closeTo(26.78, 0.01));

      final letter = rulerFittedDrawingRect(
        viewportSize: const Size(600, 900),
        drawingWidthMm: 215.9,
        drawingHeightMm: 279.4,
      );
      expect(letter.width, closeTo(600, 0.001));
      expect(letter.height, closeTo(776.47, 0.01));
      expect(letter.top, closeTo(61.76, 0.01));

      final nonStandard = rulerFittedDrawingRect(
        viewportSize: const Size(800, 600),
        drawingWidthMm: 123,
        drawingHeightMm: 456,
      );
      expect(nonStandard.width, closeTo(161.84, 0.01));
      expect(nonStandard.height, closeTo(600, 0.001));
      expect(nonStandard.left, closeTo(319.08, 0.01));
    });

    test('invalid or missing document dimensions avoid bogus calibration', () {
      final rect = rulerFittedDrawingRect(
        viewportSize: const Size(320, 240),
        drawingWidthMm: 0,
        drawingHeightMm: 297,
      );

      expect(rect, Offset.zero & const Size(320, 240));
      expect(
        drawingPixelsPerInchForViewport(
          viewportSize: const Size(320, 240),
          drawingWidthMm: 0,
          drawingHeightMm: 297,
        ),
        0,
      );
    });

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

    test('dragging clamps the ruler center inside small viewports', () {
      final center = rulerCenterForGesture(
        startCenter: const Offset(120, 80),
        startFocalPoint: Offset.zero,
        currentFocalPoint: const Offset(1000, 1000),
        bounds: const Size(240, 160),
        rulerSize: const Size(320, 84),
      );

      expect(center.dx, closeTo(120, 0.001));
      expect(center.dy, closeTo(118, 0.001));
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

  testWidgets('RulerOverlay explains calibration and exposes touch controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 360,
            height: 240,
            child: RulerOverlay(widthMm: 210, heightMm: 297),
          ),
        ),
      ),
    );

    expect(find.text('Document-calibrated'), findsOneWidget);
    expect(find.text('Tap to change'), findsOneWidget);
    expect(find.byTooltip('Reset ruler'), findsOneWidget);
  });

  testWidgets('RulerOverlay opens scale selection through the scale chip', (
    tester,
  ) async {
    var taps = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 600,
            height: 400,
            child: RulerOverlay(
              widthMm: 254,
              heightMm: 127,
              onCycleScale: () => taps++,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Tap to change'));
    expect(taps, 1);
  });

  testWidgets('RulerOverlay can rotate and reset from the visible control', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 600,
            height: 400,
            child: RulerOverlay(widthMm: 254, heightMm: 127),
          ),
        ),
      ),
    );

    expect(find.text('0°'), findsOneWidget);

    final firstFinger = await tester.createGesture(pointer: 1);
    final secondFinger = await tester.createGesture(pointer: 2);
    await firstFinger.down(const Offset(260, 200));
    await secondFinger.down(const Offset(340, 200));
    await tester.pump();
    await firstFinger.moveTo(const Offset(300, 160));
    await secondFinger.moveTo(const Offset(300, 240));
    await tester.pump();
    await firstFinger.up();
    await secondFinger.up();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('0°'), findsNothing);

    await tester.tap(find.byTooltip('Reset ruler'));
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('0°'), findsOneWidget);
  });
}
