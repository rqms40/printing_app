import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_address.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';

export 'package:printing_app/features/customer/order/models/checkout_address.dart';

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
    this.temporaryAddress,
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
  final TemporaryCheckoutAddress? temporaryAddress;
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
  bool get hasPendingQuoteItems => items.any((item) => item.quoteRequired);
  bool get hasLegacyPricedItems => items.any((item) => !item.quoteRequired);
  bool get hasMixedPricingModes => hasPendingQuoteItems && hasLegacyPricedItems;
  double? get subtotal => hasPendingQuoteItems
      ? null
      : items.fold<double>(0, (sum, item) => sum + (item.printSubtotal ?? 0));

  CheckoutState copyWith({
    List<CartItem>? items,
    DeliveryMode? mode,
    Address? singleAddress,
    TemporaryCheckoutAddress? temporaryAddress,
    List<DestinationGroup>? drops,
    DeliverySpeedTier? speedTier,
    ScheduledSlot? scheduledSlot,
    PaymentMethod? paymentMethod,
    bool? leaveAtDoor,
    String? riderNote,
    Map<String, List<String?>>? unitAssignments,
    bool clearSingleAddress = false,
    bool clearTemporaryAddress = false,
    bool clearPaymentMethod = false,
    bool clearScheduledSlot = false,
  }) => CheckoutState(
    items: items ?? this.items,
    mode: mode ?? this.mode,
    singleAddress: clearSingleAddress
        ? null
        : singleAddress ?? this.singleAddress,
    temporaryAddress: clearTemporaryAddress
        ? null
        : temporaryAddress ?? this.temporaryAddress,
    drops: drops ?? this.drops,
    speedTier: speedTier ?? this.speedTier,
    scheduledSlot: clearScheduledSlot
        ? null
        : scheduledSlot ?? this.scheduledSlot,
    paymentMethod: clearPaymentMethod
        ? null
        : paymentMethod ?? this.paymentMethod,
    leaveAtDoor: leaveAtDoor ?? this.leaveAtDoor,
    riderNote: riderNote ?? this.riderNote,
    unitAssignments: unitAssignments ?? this.unitAssignments,
  );
}
