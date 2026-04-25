import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';

void main() {
  late Directory tempDir;
  late ProviderContainer container;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('cart_hive_test_');
    Hive.init(tempDir.path);
    await Hive.openBox('draft_orders');
    await Hive.box('draft_orders').clear();

    container = ProviderContainer();
  });

  tearDown(() async {
    container.dispose();
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  test('empty cart has zero totals and reports empty', () {
    final state = container.read(cartProvider);

    expect(state.items, isEmpty);
    expect(state.subtotal, 0);
    expect(state.itemCount, 0);
    expect(state.isEmpty, isTrue);
  });

  test('adding a complete paper order flow creates a cart item', () {
    final flow = _completePaperFlow(totalPrice: 175, deliveryFee: 50);

    container.read(cartProvider.notifier).addFromOrderFlow(flow);

    final state = container.read(cartProvider);
    expect(state.items, hasLength(1));
    expect(state.subtotal, 175);
    expect(state.itemCount, 1);

    final item = state.items.single;
    expect(item.category, 'paper');
    expect(item.fileName, 'proposal.pdf');
    expect(item.fileMetadataId, 42);
    expect(item.quantity, 2);
    expect(item.pageCount, 10);
    expect(item.paperSpecs, isNotNull);
    expect(item.threeDSpecs, isNull);
    expect(item.printSubtotal, 175);
  });

  test('adding a cart item stores unit price and derives subtotal', () {
    container
        .read(cartProvider.notifier)
        .addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));

    final item = container.read(cartProvider).items.single;

    expect(item.quantity, 2);
    expect(item.unitPrice, 90);
    expect(item.printSubtotal, 180);
    expect(container.read(cartProvider).subtotal, 180);
  });

  test('incrementing quantity updates item subtotal and cart subtotal', () {
    final notifier = container.read(cartProvider.notifier);
    notifier.addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));
    final itemId = container.read(cartProvider).items.single.id;

    notifier.incrementQuantity(itemId);

    final state = container.read(cartProvider);
    expect(state.items.single.quantity, 3);
    expect(state.items.single.unitPrice, 90);
    expect(state.items.single.printSubtotal, 270);
    expect(state.subtotal, 270);
  });

  test('decrementing quantity updates item subtotal and stops at one', () {
    final notifier = container.read(cartProvider.notifier);
    notifier.addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));
    final itemId = container.read(cartProvider).items.single.id;

    notifier.decrementQuantity(itemId);
    notifier.decrementQuantity(itemId);

    final state = container.read(cartProvider);
    expect(state.items.single.quantity, 1);
    expect(state.items.single.printSubtotal, 90);
    expect(state.subtotal, 90);
    expect(state.items, hasLength(1));
  });

  test('restoring a removed item inserts it at the original index', () {
    final notifier = container.read(cartProvider.notifier);
    notifier
      ..addFromOrderFlow(
        _completePaperFlow(fileName: 'first.pdf', totalPrice: 100),
      )
      ..addFromOrderFlow(
        _completePaperFlow(fileName: 'second.pdf', totalPrice: 200),
      );
    final removed = container.read(cartProvider).items.first;

    notifier.removeItem(removed.id);
    notifier.restoreItem(removed, 0);

    final items = container.read(cartProvider).items;
    expect(items.map((item) => item.fileName), ['first.pdf', 'second.pdf']);
    expect(container.read(cartProvider).subtotal, 300);
  });

  test(
    'old persisted cart maps derive unit price from subtotal and quantity',
    () {
      final restored = CartItem.fromMap({
        'id': 'legacy-item',
        'category': 'paper',
        'fileName': 'legacy.pdf',
        'fileMetadataId': 99,
        'quantity': 4,
        'pageCount': 10,
        'printSubtotal': 360,
        'createdAt': DateTime(2026, 4, 25).toIso8601String(),
        'paperSpecs': {
          'paperSize': PaperSize.a4.name,
          'colorMode': ColorMode.fullColor.name,
          'mediaType': MediaType.matte.name,
          'printSides': PrintSides.frontOnly.name,
          'binding': Binding.none.name,
        },
      });

      expect(restored.quantity, 4);
      expect(restored.unitPrice, 90);
      expect(restored.printSubtotal, 360);
    },
  );

  test('old persisted cart maps normalize quantity below one', () {
    final restored = CartItem.fromMap({
      'id': 'malformed-legacy-item',
      'category': 'paper',
      'fileName': 'legacy.pdf',
      'fileMetadataId': 99,
      'quantity': 0,
      'pageCount': 10,
      'printSubtotal': 360,
      'createdAt': DateTime(2026, 4, 25).toIso8601String(),
      'paperSpecs': {
        'paperSize': PaperSize.a4.name,
        'colorMode': ColorMode.fullColor.name,
        'mediaType': MediaType.matte.name,
        'printSides': PrintSides.frontOnly.name,
        'binding': Binding.none.name,
      },
    });

    expect(restored.quantity, 1);
    expect(restored.unitPrice, 360);
    expect(restored.printSubtotal, 360);
  });

  test('rejects incomplete order flow states', () {
    final notifier = container.read(cartProvider.notifier);

    expect(
      () => notifier.addFromOrderFlow(const OrderFlowState()),
      throwsA(isA<ArgumentError>()),
    );
    expect(container.read(cartProvider).isEmpty, isTrue);

    expect(
      () => notifier.addFromOrderFlow(_completePaperFlow(fileName: null)),
      throwsA(isA<ArgumentError>()),
    );
    expect(container.read(cartProvider).isEmpty, isTrue);

    expect(
      () => notifier.addFromOrderFlow(_completePaperFlow(totalPrice: 0)),
      throwsA(isA<ArgumentError>()),
    );
    expect(container.read(cartProvider).isEmpty, isTrue);
  });

  test('removing items and clearing cart update totals', () {
    final notifier = container.read(cartProvider.notifier);
    notifier
      ..addFromOrderFlow(_completePaperFlow(totalPrice: 120))
      ..addFromOrderFlow(_completeThreeDFlow(totalPrice: 300));

    final firstId = container.read(cartProvider).items.first.id;

    notifier.removeItem(firstId);

    expect(container.read(cartProvider).items, hasLength(1));
    expect(container.read(cartProvider).subtotal, 300);
    expect(container.read(cartProvider).itemCount, 1);

    notifier.clear();

    expect(container.read(cartProvider).items, isEmpty);
    expect(container.read(cartProvider).subtotal, 0);
    expect(container.read(cartProvider).itemCount, 0);
    expect(container.read(cartProvider).isEmpty, isTrue);
  });

  test('CartItem toMap/fromMap round-trips paper items', () {
    final original = CartItem.fromOrderFlow(_completePaperFlow());

    final restored = CartItem.fromMap(original.toMap());

    expect(restored.id, original.id);
    expect(restored.category, 'paper');
    expect(restored.fileName, 'proposal.pdf');
    expect(restored.filePath, '/tmp/proposal.pdf');
    expect(restored.fileSize, 2048);
    expect(restored.fileMetadataId, 42);
    expect(restored.quantity, 2);
    expect(restored.pageCount, 10);
    expect(restored.printSubtotal, 125);
    expect(restored.paperSpecs?.paperSize, PaperSize.a4);
    expect(restored.paperSpecs?.colorMode, ColorMode.fullColor);
    expect(restored.paperSpecs?.mediaType, MediaType.matte);
    expect(restored.paperSpecs?.printSides, PrintSides.backToBack);
    expect(restored.paperSpecs?.binding, Binding.spiral);
    expect(restored.threeDSpecs, isNull);
    expect(restored.createdAt, original.createdAt);
  });

  test('CartItem toMap/fromMap round-trips 3D items', () {
    final original = CartItem.fromOrderFlow(_completeThreeDFlow());

    final restored = CartItem.fromMap(original.toMap());

    expect(restored.id, original.id);
    expect(restored.category, '3d');
    expect(restored.fileName, 'gear.stl');
    expect(restored.filePath, '/tmp/gear.stl');
    expect(restored.fileSize, 4096);
    expect(restored.fileMetadataId, 84);
    expect(restored.quantity, 3);
    expect(restored.pageCount, 1);
    expect(restored.printSubtotal, 240);
    expect(restored.paperSpecs, isNull);
    expect(restored.threeDSpecs?.fileFormat, FileFormat3D.stl);
    expect(restored.threeDSpecs?.material, Material3D.pla);
    expect(restored.threeDSpecs?.color, 'White');
    expect(restored.threeDSpecs?.infillPercentage, 35);
    expect(restored.threeDSpecs?.layerHeight, 0.16);
    expect(restored.threeDSpecs?.supports, isTrue);
    expect(restored.threeDSpecs?.notes, 'Hollow center');
    expect(restored.createdAt, original.createdAt);
  });
}

OrderFlowState _completePaperFlow({
  String? category = 'paper',
  String? fileName = 'proposal.pdf',
  String? filePath = '/tmp/proposal.pdf',
  int? fileSize = 2048,
  int? fileMetadataId = 42,
  int quantity = 2,
  int pageCount = 10,
  double totalPrice = 125,
  double deliveryFee = 0,
  PaperSpecs? paperSpecs,
}) {
  return OrderFlowState(
    category: category,
    paperSpecs:
        paperSpecs ??
        const PaperSpecs(
          paperSize: PaperSize.a4,
          colorMode: ColorMode.fullColor,
          mediaType: MediaType.matte,
          printSides: PrintSides.backToBack,
          binding: Binding.spiral,
        ),
    fileName: fileName,
    filePath: filePath,
    fileSize: fileSize,
    fileMetadataId: fileMetadataId,
    quantity: quantity,
    pageCount: pageCount,
    totalPrice: totalPrice,
    deliveryFee: deliveryFee,
  );
}

OrderFlowState _completeThreeDFlow({
  String? category = '3d',
  String? fileName = 'gear.stl',
  String? filePath = '/tmp/gear.stl',
  int? fileSize = 4096,
  int? fileMetadataId = 84,
  int quantity = 3,
  double totalPrice = 240,
  double deliveryFee = 0,
  ThreeDSpecs? threeDSpecs,
}) {
  return OrderFlowState(
    category: category,
    threeDSpecs:
        threeDSpecs ??
        const ThreeDSpecs(
          fileFormat: FileFormat3D.stl,
          material: Material3D.pla,
          color: 'White',
          infillPercentage: 35,
          layerHeight: 0.16,
          supports: true,
          notes: 'Hollow center',
        ),
    fileName: fileName,
    filePath: filePath,
    fileSize: fileSize,
    fileMetadataId: fileMetadataId,
    quantity: quantity,
    totalPrice: totalPrice,
    deliveryFee: deliveryFee,
  );
}
