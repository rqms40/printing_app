# Queue Cart UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the customer queue/cart feel like one batch order with multiple print jobs, swipe removal with undo, working quantity controls, and a Home resume entry point.

**Architecture:** Keep the batch checkout model from Milestone 1. Add unit-price semantics and cart mutation methods to the cart model/provider, then make the UI consume those methods through small private widgets. Home reads `cartProvider` directly and shows a contextual resume card only when the cart has items.

**Tech Stack:** Flutter, Riverpod `StateNotifierProvider`, GoRouter, Hive-backed `DraftStorageService`, built-in Flutter `Dismissible`, `flutter_test`.

---

## File Structure

- Modify `apps/mobile/lib/features/customer/cart/models/cart_item.dart`: add `unitPrice`, make `printSubtotal` derived, and migrate old persisted map data.
- Modify `apps/mobile/lib/features/customer/cart/providers/cart_provider.dart`: add `incrementQuantity`, `decrementQuantity`, and `restoreItem`.
- Modify `apps/mobile/lib/features/customer/cart/screens/cart_screen.dart`: implement the final queue UI, `Dismissible` swipe removal, snackbar undo, and quantity stepper.
- Modify `apps/mobile/lib/features/customer/home/screens/home_screen.dart`: import cart provider, show `_ResumeQueueCard` above the draft banner when the queue has items.
- Modify `apps/mobile/test/features/customer/cart/providers/cart_provider_test.dart`: add TDD coverage for unit price, quantity mutations, decrement guard, and restore.
- Modify `apps/mobile/test/features/customer/cart/screens/cart_screen_test.dart`: add TDD coverage for quantity buttons and swipe undo; update remove test from tap to swipe.
- Modify `apps/mobile/test/features/customer/home/screens/home_screen_test.dart`: add TDD coverage for Home resume card hidden/visible and route navigation.
- Verify `apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart`: existing batch payload tests must still pass with updated quantity semantics.

## Task 1: Cart Model and Provider Behavior

**Files:**
- Modify: `apps/mobile/lib/features/customer/cart/models/cart_item.dart`
- Modify: `apps/mobile/lib/features/customer/cart/providers/cart_provider.dart`
- Test: `apps/mobile/test/features/customer/cart/providers/cart_provider_test.dart`

- [ ] **Step 1: Write failing tests for unit price and quantity mutations**

Add these tests to `cart_provider_test.dart` after `adding a complete paper order flow creates a cart item`:

```dart
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
      ..addFromOrderFlow(_completePaperFlow(fileName: 'first.pdf', totalPrice: 100))
      ..addFromOrderFlow(_completePaperFlow(fileName: 'second.pdf', totalPrice: 200));
    final removed = container.read(cartProvider).items.first;

    notifier.removeItem(removed.id);
    notifier.restoreItem(removed, 0);

    final items = container.read(cartProvider).items;
    expect(items.map((item) => item.fileName), ['first.pdf', 'second.pdf']);
    expect(container.read(cartProvider).subtotal, 300);
  });

  test('old persisted cart maps derive unit price from subtotal and quantity', () {
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
  });
```

- [ ] **Step 2: Run provider tests to verify RED**

Run:

```bash
flutter test test/features/customer/cart/providers/cart_provider_test.dart
```

Expected: FAIL because `CartItem.unitPrice`, `CartNotifier.incrementQuantity`, `CartNotifier.decrementQuantity`, and `CartNotifier.restoreItem` do not exist yet.

- [ ] **Step 3: Implement `CartItem.unitPrice` and derived subtotal**

In `cart_item.dart`, change the constructor fields so `unitPrice` is stored and `printSubtotal` is derived:

```dart
  CartItem({
    required this.id,
    required this.category,
    required this.fileName,
    this.filePath,
    this.fileSize,
    required this.fileMetadataId,
    this.paperSpecs,
    this.threeDSpecs,
    required this.quantity,
    required this.pageCount,
    required this.unitPrice,
    required this.createdAt,
  });
```

Add fields/getters:

```dart
  final int quantity;
  final int pageCount;
  final double unitPrice;
  double get printSubtotal => unitPrice * quantity;
  final DateTime createdAt;
```

Update `fromOrderFlow`:

```dart
      quantity: flow.quantity,
      pageCount: flow.pageCount,
      unitPrice: flow.totalPrice / flow.quantity,
      createdAt: DateTime.now(),
```

Update `fromMap`:

```dart
    final rawQuantity = (map['quantity'] as num?)?.toInt() ?? 1;
    final quantity = rawQuantity < 1 ? 1 : rawQuantity;
    final legacySubtotal = (map['printSubtotal'] as num?)?.toDouble() ?? 0;
    final unitPrice =
        (map['unitPrice'] as num?)?.toDouble() ??
        (quantity == 0 ? legacySubtotal : legacySubtotal / quantity);
```

Then pass:

```dart
      quantity: quantity,
      pageCount: (map['pageCount'] as num?)?.toInt() ?? 1,
      unitPrice: unitPrice,
```

Update `toMap` to persist both current subtotal and unit price:

```dart
      'quantity': quantity,
      'pageCount': pageCount,
      'unitPrice': unitPrice,
      'printSubtotal': printSubtotal,
      'createdAt': createdAt.toIso8601String(),
```

Update `_validateOrderFlow` to keep the existing `quantity <= 0` guard before calculating unit price.

- [ ] **Step 4: Add cart item copy helper and provider mutations**

Add this method to `CartItem`:

```dart
  CartItem copyWith({
    int? quantity,
    double? unitPrice,
  }) {
    return CartItem(
      id: id,
      category: category,
      fileName: fileName,
      filePath: filePath,
      fileSize: fileSize,
      fileMetadataId: fileMetadataId,
      paperSpecs: paperSpecs,
      threeDSpecs: threeDSpecs,
      quantity: quantity ?? this.quantity,
      pageCount: pageCount,
      unitPrice: unitPrice ?? this.unitPrice,
      createdAt: createdAt,
    );
  }
```

Add these methods to `CartNotifier`:

```dart
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
    _saveCart();
  }

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
    _saveCart();
  }

  void restoreItem(CartItem item, int index) {
    final items = [...state.items];
    final safeIndex = index.clamp(0, items.length).toInt();
    items.insert(safeIndex, item);
    state = CartState(items: items);
    _saveCart();
  }
```

- [ ] **Step 5: Run provider tests to verify GREEN**

Run:

```bash
flutter test test/features/customer/cart/providers/cart_provider_test.dart
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add apps/mobile/lib/features/customer/cart/models/cart_item.dart apps/mobile/lib/features/customer/cart/providers/cart_provider.dart apps/mobile/test/features/customer/cart/providers/cart_provider_test.dart
git commit -m "feat: add cart quantity mutations"
```

## Task 2: Queue Screen Swipe Removal and Quantity UI

**Files:**
- Modify: `apps/mobile/lib/features/customer/cart/screens/cart_screen.dart`
- Modify: `apps/mobile/test/features/customer/cart/screens/cart_screen_test.dart`

- [ ] **Step 1: Write failing widget tests for quantity controls**

In `cart_screen_test.dart`, add these tests after `CartScreen shows queued item file names and total`:

```dart
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
```

- [ ] **Step 2: Replace the existing tap remove test with swipe + undo RED test**

Replace `CartScreen remove button removes item` with:

```dart
  testWidgets('CartScreen swipe remove deletes item and undo restores it', (
    tester,
  ) async {
    container
        .read(cartProvider.notifier)
        .addFromOrderFlow(_completePaperFlow(quantity: 2, totalPrice: 180));

    await tester.pumpWidget(_wrapWithMaterial(container, const CartScreen()));

    await tester.drag(find.byKey(const Key('cart-item-proposal.pdf')), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(find.text('proposal.pdf'), findsNothing);
    expect(find.text('Removed proposal.pdf'), findsOneWidget);
    expect(container.read(cartProvider).isEmpty, isTrue);

    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();

    expect(find.text('proposal.pdf'), findsOneWidget);
    expect(container.read(cartProvider).items.single.quantity, 2);
  });
```

- [ ] **Step 3: Run cart screen tests to verify RED**

Run:

```bash
flutter test test/features/customer/cart/screens/cart_screen_test.dart
```

Expected: FAIL because the quantity controls are not wired to provider methods and rows are not `Dismissible` with the expected key/snackbar.

- [ ] **Step 4: Implement final queue screen UI**

In `cart_screen.dart`, apply these behavior changes:

- Change app bar title from `Summary` to `The Queue`.
- Replace `_QuantityPill` with `_QuantityStepper`.
- Wrap each `_QueueItemTile` in `Dismissible`.
- Remove the permanent trailing red delete strip.
- Add an inline `+ Add another print job` button above totals.
- Keep primary bottom CTA as `Continue to Delivery`.

Use this structure inside `_QueuedJobs` item mapping:

```dart
              ...cart.items.indexed.map(
                (entry) {
                  final index = entry.$1;
                  final item = entry.$2;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: Dismissible(
                      key: Key('cart-item-${item.fileName}'),
                      direction: DismissDirection.endToStart,
                      background: const SizedBox.shrink(),
                      secondaryBackground: _RemoveBackground(colors: colors),
                      onDismissed: (_) {
                        ref.read(cartProvider.notifier).removeItem(item.id);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Removed ${item.fileName}'),
                            action: SnackBarAction(
                              label: 'Undo',
                              onPressed: () => ref
                                  .read(cartProvider.notifier)
                                  .restoreItem(item, index),
                            ),
                          ),
                        );
                      },
                      child: _QueueItemTile(
                        item: item,
                        colors: colors,
                        onIncrement: () => ref
                            .read(cartProvider.notifier)
                            .incrementQuantity(item.id),
                        onDecrement: () => ref
                            .read(cartProvider.notifier)
                            .decrementQuantity(item.id),
                      ),
                    ),
                  );
                },
              ),
```

Create `_RemoveBackground`:

```dart
class _RemoveBackground extends StatelessWidget {
  const _RemoveBackground({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.error,
        borderRadius: AppRadius.borderMd,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const HugeIcon(
            icon: HugeIcons.strokeRoundedDelete02,
            size: 22,
            color: Colors.white,
          ),
          const SizedBox(height: 4),
          Text(
            'Remove',
            style: AppTypography.caption.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}
```

Create `_QuantityStepper`:

```dart
class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.colors,
    required this.onIncrement,
    required this.onDecrement,
  });

  final int quantity;
  final AppColorSet colors;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final canDecrement = quantity > 1;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.outline.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            key: const Key('cart-item-decrement'),
            visualDensity: VisualDensity.compact,
            onPressed: canDecrement ? onDecrement : null,
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedMinusSign,
              size: 16,
              color: canDecrement ? colors.onBackground : colors.onSurfaceDim,
            ),
          ),
          Text(
            '$quantity',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          IconButton(
            key: const Key('cart-item-increment'),
            visualDensity: VisualDensity.compact,
            onPressed: onIncrement,
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedPlusSign,
              size: 16,
              color: colors.onBackground,
            ),
          ),
        ],
      ),
    );
  }
}
```

Update `_MemoryCartNotifier` in the widget test with overrides for `incrementQuantity`, `decrementQuantity`, and `restoreItem` that mirror the production methods.

- [ ] **Step 5: Run cart screen tests to verify GREEN**

Run:

```bash
flutter test test/features/customer/cart/screens/cart_screen_test.dart
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add apps/mobile/lib/features/customer/cart/screens/cart_screen.dart apps/mobile/test/features/customer/cart/screens/cart_screen_test.dart
git commit -m "feat: improve queue cart interactions"
```

## Task 3: Home Resume Queue Card

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`
- Modify: `apps/mobile/test/features/customer/home/screens/home_screen_test.dart`

- [ ] **Step 1: Write failing Home tests**

In `home_screen_test.dart`, add imports:

```dart
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/cart/screens/cart_screen.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
```

Change `_wrap` to accept cart overrides and optional router:

```dart
Widget _wrap(
  Widget child, {
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((_) {
        final notifier = AuthNotifier();
        notifier.devBypass('customer');
        return notifier;
      }),
      ...overrides,
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}
```

Add a router wrapper for navigation:

```dart
Widget _wrapRouter(List<Override> overrides) {
  final router = GoRouter(
    initialLocation: '/customer/home',
    routes: [
      GoRoute(path: '/customer/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/customer/cart', builder: (_, _) => const CartScreen()),
    ],
  );

  return ProviderScope(
    overrides: [
      authProvider.overrideWith((_) {
        final notifier = AuthNotifier();
        notifier.devBypass('customer');
        return notifier;
      }),
      ...overrides,
    ],
    child: MaterialApp.router(
      theme: ThemeData(brightness: Brightness.light),
      routerConfig: router,
    ),
  );
}
```

Add tests:

```dart
    testWidgets('hides resume queue card when cart is empty', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const HomeScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Resume your queue'), findsNothing);
    });

    testWidgets('shows resume queue card when cart has items', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrap(
          const HomeScreen(),
          overrides: [
            cartProvider.overrideWith(
              (_) => _SeededCartNotifier(
                CartState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
              ),
            ),
          ],
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Resume your queue'), findsOneWidget);
      expect(find.text('1 print job'), findsOneWidget);
      expect(find.text('₱180.00 subtotal'), findsOneWidget);
      expect(find.text('View queue'), findsOneWidget);
    });

    testWidgets('tapping resume queue card opens cart screen', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrapRouter([
          cartProvider.overrideWith(
            (_) => _SeededCartNotifier(
              CartState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
            ),
          ),
        ]),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Resume your queue'));
      await tester.pumpAndSettle();

      expect(find.text('The Queue'), findsWidgets);
      expect(find.text('proposal.pdf'), findsOneWidget);
    });
```

Add test helpers at the bottom:

```dart
class _SeededCartNotifier extends CartNotifier {
  _SeededCartNotifier(CartState initial) : super() {
    state = initial;
  }
}

CartItem _cartItem({required int quantity, required double unitPrice}) {
  return CartItem(
    id: 'cart-home-test',
    category: 'paper',
    fileName: 'proposal.pdf',
    fileMetadataId: 42,
    paperSpecs: const PaperSpecs(
      paperSize: PaperSize.a4,
      colorMode: ColorMode.fullColor,
      mediaType: MediaType.matte,
      printSides: PrintSides.backToBack,
      binding: Binding.spiral,
    ),
    quantity: quantity,
    pageCount: 10,
    unitPrice: unitPrice,
    createdAt: DateTime(2026, 4, 25),
  );
}
```

- [ ] **Step 2: Run Home tests to verify RED**

Run:

```bash
flutter test test/features/customer/home/screens/home_screen_test.dart
```

Expected: FAIL because Home does not import/read `cartProvider` and does not render the resume queue card.

- [ ] **Step 3: Implement Home resume queue card**

In `home_screen.dart`, add imports:

```dart
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/utils/formatters.dart';
```

In `build`, read the cart:

```dart
    final cart = ref.watch(cartProvider);
```

Insert this block immediately before the existing draft banner block:

```dart
                if (cart.isNotEmpty) ...[
                  _ResumeQueueCard(colors: colors, cart: cart)
                      .animate()
                      .fadeIn(duration: 300.ms, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.02,
                        duration: 300.ms,
                        curve: Curves.easeOut,
                      ),
                  const SizedBox(height: AppSpacing.md),
                ],
```

Add `_ResumeQueueCard` near the other private widgets:

```dart
class _ResumeQueueCard extends StatelessWidget {
  const _ResumeQueueCard({required this.colors, required this.cart});

  final AppColorSet colors;
  final CartState cart;

  @override
  Widget build(BuildContext context) {
    final jobLabel = cart.itemCount == 1 ? '1 print job' : '${cart.itemCount} print jobs';

    return InkWell(
      borderRadius: AppRadius.borderLg,
      onTap: () => context.push('/customer/cart'),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: colors.brand.withValues(alpha: 0.12),
          borderRadius: AppRadius.borderLg,
          border: Border.all(color: colors.brand.withValues(alpha: 0.55)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: colors.brand,
                borderRadius: AppRadius.borderMd,
              ),
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedShoppingCart01,
                size: 24,
                color: colors.accentOnColor,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Resume your queue',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    jobLabel,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${formatCurrency(cart.subtotal)} subtotal',
                    style: AppTypography.caption.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                ],
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'View queue',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colors.onBackground,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  Icons.arrow_forward_rounded,
                  size: 16,
                  color: colors.onBackground,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run Home tests to verify GREEN**

Run:

```bash
flutter test test/features/customer/home/screens/home_screen_test.dart
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add apps/mobile/lib/features/customer/home/screens/home_screen.dart apps/mobile/test/features/customer/home/screens/home_screen_test.dart
git commit -m "feat: add home resume queue card"
```

## Task 4: Regression Verification and Integration Cleanup

**Files:**
- Verify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Verify: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`
- Verify: `apps/mobile/test/features/customer/orders/providers/orders_provider_test.dart`
- Modify only if regression tests identify a real issue.

- [ ] **Step 1: Run focused cart and order regression tests**

Run:

```bash
flutter test test/features/customer/cart/providers/cart_provider_test.dart test/features/customer/cart/screens/cart_screen_test.dart test/features/customer/home/screens/home_screen_test.dart test/features/customer/orders/providers/orders_provider_test.dart
```

Expected: PASS.

- [ ] **Step 2: If batch payload quantity semantics fail, fix only the payload mapping**

If the orders provider test fails because the batch payload no longer receives current quantities, inspect `_cartItemPayload` in `orders_provider.dart`. It must continue using:

```dart
Map<String, dynamic> _cartItemPayload(CartItem item) {
  return {
    'category': item.category,
    'fileMetadataId': item.fileMetadataId,
    'quantity': item.quantity,
    'pageCount': item.pageCount,
    'totalPrice': item.printSubtotal,
    'paperSize': item.paperSpecs?.paperSize.name,
    'colorMode': item.paperSpecs?.colorMode.name,
    'mediaType': item.paperSpecs?.mediaType.name,
    'printSides': item.paperSpecs?.printSides.name,
    'binding': item.paperSpecs?.binding.name,
    'fileFormat': item.threeDSpecs?.fileFormat.name,
    'material': item.threeDSpecs?.material.name,
    'color': item.threeDSpecs?.color,
    'infillPercentage': item.threeDSpecs?.infillPercentage,
    'layerHeight': item.threeDSpecs?.layerHeight,
    'supports': item.threeDSpecs?.supports,
    'notes': item.threeDSpecs?.notes,
  };
}
```

Do not send `unitPrice` to the server in Milestone 1. The server contract remains item `totalPrice` plus `quantity`.

- [ ] **Step 3: Run analyzer**

Run:

```bash
flutter analyze
```

Expected: `No issues found!`

- [ ] **Step 4: Run full mobile test suite**

Run:

```bash
flutter test
```

Expected: all tests pass.

- [ ] **Step 5: Run web release build**

Run:

```bash
flutter build web --release --no-tree-shake-icons
```

Expected: build succeeds and writes `build/web`. Existing Wasm dry-run warnings from `flutter_secure_storage_web` or `socket_io_common` are acceptable if the command exits `0`.

- [ ] **Step 6: Check formatting and whitespace**

Run:

```bash
dart format lib/features/customer/cart/models/cart_item.dart lib/features/customer/cart/providers/cart_provider.dart lib/features/customer/cart/screens/cart_screen.dart lib/features/customer/home/screens/home_screen.dart test/features/customer/cart/providers/cart_provider_test.dart test/features/customer/cart/screens/cart_screen_test.dart test/features/customer/home/screens/home_screen_test.dart
git diff --check
```

Expected: `dart format` completes and `git diff --check` exits `0`.

- [ ] **Step 7: Commit final verification fixes if any**

If Task 4 required code changes, run:

```bash
git add apps/mobile/lib apps/mobile/test
git commit -m "test: verify queue cart ux regressions"
```

If Task 4 required no code changes, do not create an empty commit.

## Final Review Requirements

- Dispatch a spec-compliance reviewer against `docs/superpowers/specs/2026-04-25-queue-cart-ux-design.md`.
- Dispatch a code-quality reviewer after spec compliance passes.
- The final response must mention exact verification commands and whether each passed.
- The final response must call out any remaining web Wasm dry-run warnings separately from release-build success.
