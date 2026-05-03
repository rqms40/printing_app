import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/screens/paper_specs_screen.dart';

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
          productCatalogProvider.overrideWith(
            (ref) async => ProductCatalog.fallback(),
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
          productCatalogProvider.overrideWith(
            (ref) async => ProductCatalog.fallback(),
          ),
        ],
        child: const MaterialApp(home: PaperSpecsScreen()),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Page Count', skipOffstage: false), findsNothing);
    expect(find.text('Special Instructions / Notes'), findsOneWidget);
  });
}
