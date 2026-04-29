import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';

class OrderCheckoutState {
  const OrderCheckoutState({
    this.groups = const [],
    this.slotTemplateId,
    this.slotDate,
    this.priority = false,
  });

  final List<DestinationGroup> groups;
  final int? slotTemplateId;
  final String? slotDate;
  final bool priority;

  OrderCheckoutState copyWith({
    List<DestinationGroup>? groups,
    int? slotTemplateId,
    String? slotDate,
    bool? priority,
  }) =>
      OrderCheckoutState(
        groups: groups ?? this.groups,
        slotTemplateId: slotTemplateId ?? this.slotTemplateId,
        slotDate: slotDate ?? this.slotDate,
        priority: priority ?? this.priority,
      );
}

class OrderCheckoutNotifier extends StateNotifier<OrderCheckoutState> {
  OrderCheckoutNotifier() : super(const OrderCheckoutState());
  final _uuid = const Uuid();

  void addGroup(String label) {
    state = OrderCheckoutState(
      groups: [
        ...state.groups,
        DestinationGroup(id: _uuid.v4(), label: label, itemIds: const []),
      ],
      slotTemplateId: state.slotTemplateId,
      slotDate: state.slotDate,
      priority: state.priority,
    );
  }

  void removeGroup(String id) {
    state = OrderCheckoutState(
      groups: state.groups.where((g) => g.id != id).toList(),
      slotTemplateId: state.slotTemplateId,
      slotDate: state.slotDate,
      priority: state.priority,
    );
  }

  void assignAddress(String groupId, int addressId) {
    state = state.copyWith(
      groups: state.groups
          .map((g) => g.id == groupId ? g.copyWith(addressId: addressId) : g)
          .toList(),
    );
  }

  void moveItemToGroup(String itemId, String targetGroupId) {
    state = state.copyWith(
      groups: state.groups.map((g) {
        if (g.id == targetGroupId) {
          if (g.itemIds.contains(itemId)) return g;
          return g.copyWith(itemIds: [...g.itemIds, itemId]);
        }
        return g.copyWith(itemIds: g.itemIds.where((id) => id != itemId).toList());
      }).toList(),
    );
  }

  void selectSlot({required int templateId, required String date}) {
    state = state.copyWith(slotTemplateId: templateId, slotDate: date);
  }

  void togglePriority() {
    state = state.copyWith(priority: !state.priority);
  }

  void reset() {
    state = const OrderCheckoutState();
  }
}

final orderCheckoutProvider =
    StateNotifierProvider<OrderCheckoutNotifier, OrderCheckoutState>(
  (_) => OrderCheckoutNotifier(),
);
