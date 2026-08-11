import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';

class SlotPickerSheet {
  static Future<ScheduledSlot?> show(
    BuildContext context, {
    String? initialDate,
  }) {
    final date =
        initialDate ?? DateTime.now().toIso8601String().substring(0, 10);
    return showModalBottomSheet<ScheduledSlot>(
      barrierLabel: 'Dismiss delivery slot picker',
      context: context,
      isScrollControlled: true,
      builder: (_) => _SlotPickerBody(date: date),
    );
  }
}

class _SlotPickerBody extends ConsumerStatefulWidget {
  const _SlotPickerBody({required this.date});
  final String date;

  @override
  ConsumerState<_SlotPickerBody> createState() => _SlotPickerBodyState();
}

class _SlotPickerBodyState extends ConsumerState<_SlotPickerBody> {
  int? _chosenTemplate;
  String? _start;
  String? _end;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = deliverySlotProvider(widget.date);
      final state = ref.read(provider);
      if (state.slots.isNotEmpty || state.isLoading) return;
      ref.read(provider.notifier).refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final slotsState = ref.watch(deliverySlotProvider(widget.date));
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Schedule your delivery',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          if (slotsState.isLoading)
            const Padding(
              padding: EdgeInsets.all(32.0),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (slotsState.error != null)
            Padding(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 48),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load slots:\n${slotsState.error}',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => ref
                        .read(deliverySlotProvider(widget.date).notifier)
                        .refresh(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          else if (slotsState.slots.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32.0),
              child: Center(
                child: Text('No delivery slots available for this date.'),
              ),
            )
          else
            RadioGroup<int>(
              groupValue: _chosenTemplate,
              onChanged: (value) {
                DeliverySlot? selectedSlot;
                for (final slot in slotsState.slots) {
                  if (!slot.isFull && slot.templateId == value) {
                    selectedSlot = slot;
                    break;
                  }
                }
                final slot = selectedSlot;
                if (slot == null) return;
                setState(() {
                  _chosenTemplate = value;
                  _start = slot.startTime;
                  _end = slot.endTime;
                });
              },
              child: Column(
                children: [
                  for (final s in slotsState.slots)
                    RadioListTile<int>(
                      value: s.templateId,
                      enabled: !s.isFull,
                      title: Text(
                        '${s.startTime.substring(0, 5)} – ${s.endTime.substring(0, 5)}',
                      ),
                      subtitle: Text('${s.bookedCount}/${s.capacity} booked'),
                    ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _chosenTemplate == null
                  ? null
                  : () => Navigator.of(context).pop(
                      ScheduledSlot(
                        templateId: _chosenTemplate!,
                        date: widget.date,
                        startTime: _start!,
                        endTime: _end!,
                      ),
                    ),
              child: Text('Confirm ${widget.date}'),
            ),
          ),
        ],
      ),
    );
  }
}
