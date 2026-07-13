import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Wraps a widget in a minimal MaterialApp for testing.
Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.light),
    home: Scaffold(body: Center(child: child)),
  );
}

void main() {
  group('AppButton', () {
    /// Finds the first Material widget that is a descendant of AppButton.
    Material findButtonMaterial(WidgetTester tester) {
      final materials = tester.widgetList<Material>(
        find.descendant(
          of: find.byType(AppButton),
          matching: find.byType(Material),
        ),
      );
      return materials.first;
    }

    testWidgets('primary button renders with accent background color', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          AppButton(
            label: 'Submit',
            onTap: () {},
            variant: AppButtonVariant.primary,
          ),
        ),
      );

      final material = findButtonMaterial(tester);
      expect(material.color, equals(AppColors.light.accent));
    });

    testWidgets('secondary button renders with border', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppButton(
            label: 'Cancel',
            onTap: () {},
            variant: AppButtonVariant.secondary,
          ),
        ),
      );

      final material = findButtonMaterial(tester);

      // Secondary has transparent background.
      expect(material.color, equals(Colors.transparent));

      // Shape should be RoundedRectangleBorder with a non-zero side.
      final shape = material.shape as RoundedRectangleBorder;
      expect(shape.side.width, equals(1.0));
      expect(shape.side.color, equals(AppColors.light.accent));
    });

    testWidgets('ghost button has transparent background', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppButton(
            label: 'More',
            onTap: () {},
            variant: AppButtonVariant.ghost,
          ),
        ),
      );

      final material = findButtonMaterial(tester);

      expect(material.color, equals(Colors.transparent));

      // Ghost shape should have no border side.
      final shape = material.shape as RoundedRectangleBorder;
      expect(shape.side, equals(BorderSide.none));
    });

    testWidgets('loading state shows CircularProgressIndicator', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Save', onTap: () {}, isLoading: true)),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      // Label text should NOT be visible when loading.
      expect(find.text('Save'), findsNothing);
    });

    testWidgets('disabled button has reduced opacity', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Go', onTap: () {}, isDisabled: true)),
      );

      final opacity = tester.widget<AnimatedOpacity>(
        find.byType(AnimatedOpacity),
      );

      expect(opacity.opacity, equals(AppColors.disabledOpacity));
    });

    testWidgets('onTap fires when not disabled', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        _wrap(AppButton(label: 'Tap Me', onTap: () => tapped = true)),
      );

      await tester.tap(find.text('Tap Me'));
      expect(tapped, isTrue);
    });

    testWidgets('press animation does not create a duplicate semantic action', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Start delivery', onTap: () {})),
      );

      final pressDetector = tester.widget<GestureDetector>(
        find.byWidgetPredicate(
          (widget) =>
              widget is GestureDetector &&
              widget.onTapDown != null &&
              widget.onTap == null,
        ),
      );
      expect(pressDetector.excludeFromSemantics, isTrue);
    });

    testWidgets('treats its icon as decorative', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Accept', icon: Icons.check, onTap: () {})),
      );

      expect(
        find.descendant(
          of: find.byType(AppButton),
          matching: find.byType(ExcludeSemantics),
        ),
        findsWidgets,
      );
    });

    testWidgets('onTap does NOT fire when disabled', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        _wrap(
          AppButton(
            label: 'No Tap',
            onTap: () => tapped = true,
            isDisabled: true,
          ),
        ),
      );

      await tester.tap(find.text('No Tap'));
      expect(tapped, isFalse);
    });

    testWidgets(
      'brand button renders with brand background color in dark mode',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(brightness: Brightness.dark),
            home: Scaffold(
              body: Center(
                child: AppButton(
                  label: 'Get Started',
                  onTap: () {},
                  variant: AppButtonVariant.brand,
                ),
              ),
            ),
          ),
        );

        final material = tester
            .widgetList<Material>(
              find.descendant(
                of: find.byType(AppButton),
                matching: find.byType(Material),
              ),
            )
            .first;
        expect(material.color, equals(AppColors.dark.brand));
      },
    );
  });
}
