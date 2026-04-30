import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';

enum DeliveryMode { delivery, pickup, multidrop }

class ScheduledSlot {
  const ScheduledSlot({
    required this.templateId,
    required this.date,
    required this.startTime,
    required this.endTime,
  });
  final int templateId;
  final String date;
  final String startTime;
  final String endTime;
}

class CheckoutState {
  const CheckoutState({
    this.items = const [],
    this.mode = DeliveryMode.delivery,
    this.singleAddress,
    this.drops = const [],
    this.speedTier = DeliverySpeedTier.standard,
    this.scheduledSlot,
    this.paymentMethod,
    this.leaveAtDoor = false,
    this.riderNote = '',
    this.unitAssignments = const {},
  });

  final List<CartItem> items;
  final DeliveryMode mode;
  final Address? singleAddress;
  final List<DestinationGroup> drops;
  final DeliverySpeedTier speedTier;
  final ScheduledSlot? scheduledSlot;
  final PaymentMethod? paymentMethod;
  final bool leaveAtDoor;
  final String riderNote;

  /// Per-item, per-copy assignment to a [DestinationGroup.id].
  /// Length of each list must equal the matching item's quantity.
  /// `null` entries mean the copy is unassigned (rare — only when a drop was
  /// removed and there is no remaining drop to fall back to).
  final Map<String, List<String?>> unitAssignments;

  int get itemCount => items.length;
  double get subtotal => items.fold(0.0, (s, i) => s + i.printSubtotal);

  CheckoutState copyWith({
    List<CartItem>? items,
    DeliveryMode? mode,
    Address? singleAddress,
    List<DestinationGroup>? drops,
    DeliverySpeedTier? speedTier,
    ScheduledSlot? scheduledSlot,
    PaymentMethod? paymentMethod,
    bool? leaveAtDoor,
    String? riderNote,
    Map<String, List<String?>>? unitAssignments,
  }) => CheckoutState(
    items: items ?? this.items,
    mode: mode ?? this.mode,
    singleAddress: singleAddress ?? this.singleAddress,
    drops: drops ?? this.drops,
    speedTier: speedTier ?? this.speedTier,
    scheduledSlot: scheduledSlot ?? this.scheduledSlot,
    paymentMethod: paymentMethod ?? this.paymentMethod,
    leaveAtDoor: leaveAtDoor ?? this.leaveAtDoor,
    riderNote: riderNote ?? this.riderNote,
    unitAssignments: unitAssignments ?? this.unitAssignments,
  );
}
