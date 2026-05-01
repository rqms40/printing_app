import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';

class SlotPickerSheet {
  static Future<ScheduledSlot?> show(
    BuildContext context, {
    String? initialDate,
  }) {
    final date = initialDate ?? DateTime.now().toIso8601String().substring(0, 10);
    return showModalBottomSheet<ScheduledSlot>(
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
  Widget build(BuildContext context) {
    final slotsState = ref.watch(deliverySlotProvider(widget.date));
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Schedule your delivery',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          for (final s in slotsState.slots)
            RadioListTile<int>(
              value: s.templateId,
              groupValue: _chosenTemplate,
              onChanged: s.isFull
                  ? null
                  : (v) => setState(() {
                        _chosenTemplate = v;
                        _start = s.startTime;
                        _end = s.endTime;
                      }),
              title: Text(
                  '${s.startTime.substring(0, 5)} – ${s.endTime.substring(0, 5)}'),
              subtitle: Text('${s.bookedCount}/${s.capacity} booked'),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _chosenTemplate == null
                  ? null
                  : () => Navigator.of(context).pop(ScheduledSlot(
                        templateId: _chosenTemplate!,
                        date: widget.date,
                        startTime: _start!,
                        endTime: _end!,
                      )),
              child: Text('Confirm ${widget.date}'),
            ),
          ),
        ],
      ),
    );
  }
}
