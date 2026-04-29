import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/cart/screens/cart_screen.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/screens/summary_screen.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';

void main() {
  late Directory tempDir;
  late ProviderContainer container;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('cart_screen_hive_test_');
    Hive.init(tempDir.path);
    await Hive.openBox('draft_orders');
    await Hive.box('draft_orders').clear();

    container = ProviderContainer(
      overrides: [
        cartProvider.overrideWith((_) => _MemoryCartNotifier()),
        orderFlowProvider.overrideWith((_) => _MemoryOrderFlowNotifier()),
      ],
    );
  });

  tearDown(() async {
    container.dispose();
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  testWidgets('CartScreen shows empty queue actions when cart is empty', (
    tester,
  ) async {
    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    expect(find.text('The Queue'), findsOneWidget);
    expect(find.text('Your queue is empty'), findsOneWidget);
    expect(find.text('Start Printing'), findsOneWidget);
    expect(find.text('Back to Home'), findsOneWidget);
    expect(find.text('Continue to Delivery'), findsNothing);
  });

  testWidgets('CartScreen shows queued item file names and total', (
    tester,
  ) async {
    container
        .read(cartProvider.notifier)
        .addFromOrderFlow(_completePaperFlow(totalPrice: 175));

    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    expect(find.text('proposal.pdf'), findsOneWidget);
    expect(find.text('The Queue'), findsOneWidget);
    expect(find.text('Print subtotal'), findsOneWidget);
    expect(find.text('Total before delivery'), findsOneWidget);
    expect(find.text('₱175.00'), findsWidgets);
    expect(find.text('Continue to Delivery'), findsOneWidget);
    expect(find.text('Add another print job'), findsOneWidget);
    expect(find.text('Back to Home'), findsOneWidget);
    expect(find.byType(FileTypeIcon), findsOneWidget);
  });

  testWidgets('CartScreen plus button increases quantity and total', (
    tester,
  ) async {
    container
        .read(cartProvider.notifier)
        .addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));

    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    await tester.tap(find.byKey(const Key('cart-item-increment')).first);
    await tester.pump();

    expect(find.text('3'), findsOneWidget);
    expect(find.text('₱270.00'), findsWidgets);
    expect(container.read(cartProvider).items.single.quantity, 3);
  });

  testWidgets('CartScreen minus button decreases quantity but not below one', (
    tester,
  ) async {
    container
        .read(cartProvider.notifier)
        .addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));

    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    await tester.tap(find.byKey(const Key('cart-item-decrement')).first);
    await tester.pump();
    await tester.tap(find.byKey(const Key('cart-item-decrement')).first);
    await tester.pump();

    expect(find.text('1'), findsOneWidget);
    expect(find.text('₱90.00'), findsWidgets);
    expect(container.read(cartProvider).items.single.quantity, 1);
    expect(container.read(cartProvider).items, hasLength(1));
  });

  testWidgets(
    'CartScreen quantity controls have accessible labels and targets',
    (tester) async {
      container
          .read(cartProvider.notifier)
          .addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));

      await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

      final decrement = find.byKey(const Key('cart-item-decrement')).first;
      final increment = find.byKey(const Key('cart-item-increment')).first;

      expect(
        find.byTooltip('Decrease quantity for proposal.pdf'),
        findsOneWidget,
      );
      expect(
        find.byTooltip('Increase quantity for proposal.pdf'),
        findsOneWidget,
      );
      expect(find.byTooltip('Decrease quantity'), findsNothing);
      expect(find.byTooltip('Increase quantity'), findsNothing);
      expect(tester.getSize(decrement), const Size(48, 48));
      expect(tester.getSize(increment), const Size(48, 48));
    },
  );

  testWidgets(
    'CartScreen totals do not overflow on narrow large-text screens',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      container
          .read(cartProvider.notifier)
          .addFromOrderFlow(_completePaperFlow(totalPrice: 180));

      await tester.pumpWidget(
        _wrapWithMaterial(
          container,
          const MediaQuery(
            data: MediaQueryData(
              size: Size(320, 480),
              textScaler: TextScaler.linear(2.4),
            ),
            child: CartScreen(),
          ),
        ),
      );

      await tester.scrollUntilVisible(find.text('Print subtotal'), 300);

      expect(tester.takeException(), isNull);
      expect(find.text('Print subtotal'), findsOneWidget);
      expect(find.text('Total before delivery'), findsOneWidget);
    },
  );

  testWidgets('CartScreen swipe remove deletes item and undo restores it', (
    tester,
  ) async {
    container
        .read(cartProvider.notifier)
        .addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));

    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    final itemId = container.read(cartProvider).items.single.id;

    await tester.drag(find.byKey(ValueKey(itemId)), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(find.text('proposal.pdf'), findsNothing);
    expect(find.text('Removed proposal.pdf'), findsOneWidget);
    expect(container.read(cartProvider).isEmpty, isTrue);

    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();

    expect(find.text('proposal.pdf'), findsOneWidget);
    expect(container.read(cartProvider).items.single.quantity, 2);
  });

  testWidgets('CartScreen undo restores first removed item at original index', (
    tester,
  ) async {
    container.read(cartProvider.notifier)
      ..addFromOrderFlow(_completePaperFlow(fileName: 'proposal.pdf'))
      ..addFromOrderFlow(_completePaperFlow(fileName: 'appendix.pdf'));

    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    final removedId = container.read(cartProvider).items.first.id;

    await tester.drag(find.byKey(ValueKey(removedId)), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(container.read(cartProvider).items.map((item) => item.fileName), [
      'appendix.pdf',
    ]);

    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();

    expect(container.read(cartProvider).items.map((item) => item.fileName), [
      'proposal.pdf',
      'appendix.pdf',
    ]);
  });

  testWidgets(
    'CartScreen clears stale remove snackbars before showing a new one',
    (tester) async {
      container.read(cartProvider.notifier)
        ..addFromOrderFlow(_completePaperFlow(fileName: 'proposal.pdf'))
        ..addFromOrderFlow(_completePaperFlow(fileName: 'appendix.pdf'));

      await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

      final firstId = container.read(cartProvider).items.first.id;
      await tester.drag(find.byKey(ValueKey(firstId)), const Offset(-600, 0));
      await tester.pumpAndSettle();

      final remainingId = container.read(cartProvider).items.single.id;
      await tester.drag(
        find.byKey(ValueKey(remainingId)),
        const Offset(-600, 0),
      );
      await tester.pumpAndSettle();

      expect(find.text('Removed proposal.pdf'), findsNothing);
      expect(find.text('Removed appendix.pdf'), findsOneWidget);
    },
  );

  testWidgets('CartScreen empty state is scroll safe', (tester) async {
    await tester.pumpWidget(
      _wrapWithMaterial(
        container,
        const MediaQuery(
          data: MediaQueryData(
            size: Size(320, 360),
            textScaler: TextScaler.linear(2),
          ),
          child: CartScreen(),
        ),
      ),
    );

    expect(find.byType(SingleChildScrollView), findsOneWidget);
    expect(find.text('Your queue is empty'), findsOneWidget);
  });

  testWidgets('SummaryScreen has Add to Cart action', (tester) async {
    _seedOrderFlow(container);

    await tester.pumpWidget(_wrapWithRouter(container));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Add to Cart'), findsOneWidget);
    expect(find.text('Continue to Delivery'), findsOneWidget);
  });

  testWidgets(
    'SummaryScreen Add to Cart adds item, resets flow, and opens cart',
    (tester) async {
      _seedOrderFlow(container);

      await tester.pumpWidget(_wrapWithRouter(container));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Add to Cart'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      expect(container.read(cartProvider).items, hasLength(1));
      expect(container.read(orderFlowProvider).category, isNull);
      expect(find.text('The Queue'), findsOneWidget);
      expect(find.text('proposal.pdf'), findsOneWidget);
    },
  );
}

Widget _wrapWithMaterial(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

Widget _wrapWithRouter(ProviderContainer container) {
  final router = GoRouter(
    initialLocation: SummaryScreen.routeName,
    routes: [
      GoRoute(
        path: SummaryScreen.routeName,
        builder: (_, _) => const SummaryScreen(),
      ),
      GoRoute(path: '/customer/cart', builder: (_, _) => const CartScreen()),
    ],
  );

  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp.router(
      theme: ThemeData(brightness: Brightness.light),
      routerConfig: router,
    ),
  );
}

void _seedOrderFlow(ProviderContainer container) {
  final notifier =
      container.read(orderFlowProvider.notifier) as _MemoryOrderFlowNotifier;
  notifier.seed(_completePaperFlow(totalPrice: 175));
}

OrderFlowState _completePaperFlow({
  String fileName = 'proposal.pdf',
  int quantity = 2,
  double totalPrice = 125,
}) {
  return OrderFlowState(
    category: 'paper',
    paperSpecs: const PaperSpecs(
      paperSize: PaperSize.a4,
      colorMode: ColorMode.fullColor,
      mediaType: MediaType.matte,
      printSides: PrintSides.backToBack,
      binding: Binding.spiral,
    ),
    fileName: fileName,
    filePath: '/tmp/$fileName',
    fileSize: 2048,
    fileMetadataId: 42,
    quantity: quantity,
    pageCount: 10,
    totalPrice: totalPrice,
  );
}

class _MemoryCartNotifier extends CartNotifier {
  _MemoryCartNotifier() : super();

  @override
  void addFromOrderFlow(OrderFlowState flow) {
    state = CartState(items: [...state.items, CartItem.fromOrderFlow(flow)]);
  }

  @override
  void removeItem(String id) {
    state = CartState(
      items: state.items.where((item) => item.id != id).toList(),
    );
  }

  @override
  void incrementQuantity(String id) {
    state = CartState(
      items: state.items
          .map(
            (item) => item.id == id
                ? item.copyWith(quantity: item.quantity + 1)
                : item,
          )
          .toList(),
    );
  }

  @override
  void decrementQuantity(String id) {
    state = CartState(
      items: state.items
          .map(
            (item) => item.id == id && item.quantity > 1
                ? item.copyWith(quantity: item.quantity - 1)
                : item,
          )
          .toList(),
    );
  }

  @override
  void restoreItem(CartItem item, int index) {
    final items = [...state.items];
    final safeIndex = index.clamp(0, items.length).toInt();
    items.insert(safeIndex, item);
    state = CartState(items: items);
  }

  @override
  void clear() {
    state = const CartState();
  }
}

class _MemoryOrderFlowNotifier extends OrderFlowNotifier {
  _MemoryOrderFlowNotifier() : super();

  void seed(OrderFlowState flow) {
    state = flow;
  }

  @override
  void reset() {
    state = const OrderFlowState();
  }
}
