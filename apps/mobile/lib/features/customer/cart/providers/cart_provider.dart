import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/services/draft_storage_service.dart';

class CartState {
  const CartState({this.items = const []});

  final List<CartItem> items;

  double get subtotal =>
      items.fold(0, (total, item) => total + item.printSubtotal);

  int get itemCount => items.length;

  bool get isEmpty => items.isEmpty;

  bool get isNotEmpty => items.isNotEmpty;

  Map<String, dynamic> toMap() {
    return {'items': items.map((item) => item.toMap()).toList()};
  }

  factory CartState.fromMap(Map<String, dynamic> map) {
    final rawItems = map['items'];
    if (rawItems is! List) return const CartState();

    return CartState(
      items: rawItems
          .map(
            (item) => CartItem.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
    );
  }
}

class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(const CartState()) {
    _loadCart();
  }

  void addFromOrderFlow(OrderFlowState flow) {
    final item = CartItem.fromOrderFlow(flow);
    state = CartState(items: [...state.items, item]);
    _saveCart();
  }

  void removeItem(String id) {
    state = CartState(
      items: state.items.where((item) => item.id != id).toList(),
    );
    _saveCart();
  }

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

  void clear() {
    state = const CartState();
    DraftStorageService.clearCart();
  }

  void _loadCart() {
    final data = DraftStorageService.loadCart();
    if (data != null) {
      state = CartState.fromMap(data);
    }
  }

  void _saveCart() {
    DraftStorageService.saveCart(state.toMap());
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, CartState>(
  (ref) => CartNotifier(),
);
