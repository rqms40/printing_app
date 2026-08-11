import 'dart:typed_data';
import 'dart:ui' show SemanticsAction;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_items_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';

void main() {
  testWidgets('renders one row per item with name and quantity', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'a',
            category: 'paper',
            fileName: 'thesis.pdf',
            filePath: '/tmp/a.pdf',
            fileSize: 1,
            fileMetadataId: 1,
            quantity: 3,
            pageCount: 10,
            printSubtotal: 150,
            createdAt: DateTime.now(),
          ),
        );

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: CheckoutItemsCard()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    expect(find.text('thesis.pdf'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('Add Items'), findsOneWidget);
    expect(find.text('View'), findsOneWidget);
  });

  testWidgets('names the quantity stepper controls for assistive technology', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'accessible-stepper',
            category: 'paper',
            fileName: 'flyer.pdf',
            filePath: '/tmp/flyer.pdf',
            fileSize: 1,
            fileMetadataId: 1,
            quantity: 3,
            pageCount: 1,
            printSubtotal: 150,
            createdAt: DateTime.now(),
          ),
        );
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: CheckoutItemsCard()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    expect(find.bySemanticsLabel('Decrease quantity'), findsOneWidget);
    expect(find.bySemanticsLabel('Increase quantity'), findsOneWidget);
    expect(
      tester
          .getSemantics(find.bySemanticsLabel('Decrease quantity'))
          .getSemanticsData()
          .hasAction(SemanticsAction.tap),
      isTrue,
    );
    expect(
      tester
          .getSemantics(find.bySemanticsLabel('Increase quantity'))
          .getSemanticsData()
          .hasAction(SemanticsAction.tap),
      isTrue,
    );
    semantics.dispose();
  });

  testWidgets('View action opens preview with selected item metadata', (
    tester,
  ) async {
    ApiClient.instance.init(baseUrl: 'http://mock-test/api');
    final previousAdapter = ApiClient.instance.dio.httpClientAdapter;
    ApiClient.instance.dio.httpClientAdapter = _PresignedUrlAdapter();
    addTearDown(() {
      ApiClient.instance.dio.httpClientAdapter = previousAdapter;
    });

    final container = ProviderContainer();
    addTearDown(container.dispose);

    final item = CartItem(
      id: 'a',
      category: 'paper',
      fileName: 'THESIS.PDF',
      filePath: '/tmp/a.pdf',
      fileSize: 2048,
      fileMetadataId: 7,
      quantity: 1,
      pageCount: 10,
      printSubtotal: 150,
      createdAt: DateTime.now(),
    );
    container.read(checkoutProvider.notifier).addItem(item);

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: CheckoutItemsCard()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    await tester.tap(find.text('View'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));

    final preview = tester.widget<FilePreviewSheet>(
      find.byType(FilePreviewSheet),
    );
    expect(preview.fileId, 7);
    expect(preview.fileName, 'THESIS.PDF');
    expect(preview.mimeType, 'application/pdf');
    expect(preview.fileSize, 2048);
  });

  testWidgets('View action does not open preview without uploaded metadata', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'a',
            category: 'paper',
            fileName: 'draft.pdf',
            filePath: '/tmp/a.pdf',
            fileSize: 1,
            fileMetadataId: 0,
            quantity: 1,
            pageCount: 10,
            printSubtotal: 150,
            createdAt: DateTime.now(),
          ),
        );

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: CheckoutItemsCard()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    await tester.tap(find.text('View'));
    await tester.pump();

    expect(find.byType(FilePreviewSheet), findsNothing);
  });

  testWidgets('renders changed paper specs beyond the first two values', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'a',
            category: 'paper',
            fileName: 'poster.pdf',
            filePath: '/tmp/poster.pdf',
            fileSize: 1,
            fileMetadataId: 1,
            specs: const {
              'paper_size': 'a3',
              'color_mode': 'black_and_white',
              'media_type': 'glossy',
              'print_sides': 'back_to_back',
              'binding': 'staple',
              'page_count': 12,
            },
            specDisplayValues: const {
              'paper_size': 'A3',
              'color_mode': 'Black & White',
              'media_type': 'Glossy',
              'print_sides': 'Back to Back',
              'binding': 'Staple',
              'page_count': '12 pages',
            },
            paperSpecs: const PaperSpecs(
              paperSize: PaperSize.a3,
              colorMode: ColorMode.blackAndWhite,
              mediaType: MediaType.glossy,
              printSides: PrintSides.backToBack,
              binding: Binding.staple,
            ),
            quantity: 1,
            pageCount: 12,
            printSubtotal: 150,
            createdAt: DateTime.now(),
          ),
        );

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: CheckoutItemsCard()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    expect(
      find.text(
        'A3 · Black & White · Glossy · Back to Back · Staple · 12 pages',
      ),
      findsOneWidget,
    );
  });

  testWidgets('renders changed 3D specs beyond the first two values', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'a',
            category: '3d',
            fileName: 'model.obj',
            filePath: '/tmp/model.obj',
            fileSize: 1,
            fileMetadataId: 1,
            specs: const {
              'file_format': 'obj',
              'material': 'abs',
              'color': 'blue',
              'infill_percentage': 50,
              'layer_height': 0.3,
              'supports': false,
            },
            specDisplayValues: const {
              'file_format': 'OBJ',
              'material': 'ABS',
              'color': 'Blue',
              'infill_percentage': '50%',
              'layer_height': '0.3mm',
              'supports': 'No',
            },
            threeDSpecs: const ThreeDSpecs(
              fileFormat: FileFormat3D.obj,
              material: Material3D.abs,
              color: 'Blue',
              infillPercentage: 50,
              layerHeight: 0.3,
              supports: false,
            ),
            quantity: 1,
            pageCount: 1,
            printSubtotal: 150,
            createdAt: DateTime.now(),
          ),
        );

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: CheckoutItemsCard()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    expect(find.text('OBJ · ABS · Blue · 50% · 0.3mm · No'), findsOneWidget);
  });
}

class _PresignedUrlAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      '{"url":null}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
