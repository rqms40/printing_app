import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/paper_specs_screen.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('paper_specs_screen_');
    Hive.init(tempDir.path);
    await Hive.openBox('draft_orders');
  });

  tearDown(() async {
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  testWidgets('shows print scaling choices in the paper specifications menu', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          productCatalogLoaderProvider.overrideWithValue(
            () async => throw StateError('legacy draft test'),
          ),
        ],
        child: const MaterialApp(home: PaperSpecsScreen()),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('PRINT MODE'), findsOneWidget);
    expect(find.text('Fit to Scale'), findsOneWidget);
    expect(find.text('Actual Size'), findsOneWidget);
  });

  testWidgets('replaces Page Count with special instructions on paper specs', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          productCatalogLoaderProvider.overrideWithValue(
            () async => throw StateError('legacy draft test'),
          ),
        ],
        child: const MaterialApp(home: PaperSpecsScreen()),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Page Count', skipOffstage: false), findsNothing);
    expect(find.text('Special Instructions / Notes'), findsOneWidget);
  });

  testWidgets('abandons an active pipeline tutorial without modifying '
      'providers during unmount', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [
        productCatalogLoaderProvider.overrideWithValue(
          () async => throw StateError('legacy draft test'),
        ),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: PaperSpecsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    final pipeline = container.read(pipelineTutorialProvider.notifier);
    pipeline.start();
    pipeline.advance(); // paperCategoryCard
    pipeline.advance(); // paperSpecsForm
    await tester.pump();

    // Pop the screen mid-tutorial: dispose must not mutate providers
    // synchronously while the tree is locked for unmounting.
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: SizedBox()),
      ),
    );
    expect(tester.takeException(), isNull);

    // The deferred abandon still runs: pipeline cleared, tutorial marked seen.
    await tester.pumpAndSettle();
    expect(container.read(pipelineTutorialProvider).active, isFalse);
    expect(
      container.read(tutorialProvider).contains(TutorialKey.pipeline),
      isTrue,
    );
  });
}
