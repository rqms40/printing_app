import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';

class RfqReviewCard extends ConsumerWidget {
  const RfqReviewCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    return CheckoutSectionCard(
      title: 'Quote request',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Price and turnaround pending review',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            'GRIDGO Operations and an eligible supplier will confirm feasibility, final price, and turnaround before payment.',
          ),
          for (final item in state.items) ...[
            const SizedBox(height: 12),
            Text(
              item.categoryName ?? item.productSlug ?? item.category,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            Text(
              'Required by ${_date(item.requiredDate)} · Quantity ${item.quantity}',
            ),
            for (final entry in item.specDisplayValues.entries)
              if (entry.value.trim().isNotEmpty)
                Text('${_label(entry.key)}: ${entry.value.trim()}'),
          ],
          if (state.hasMixedPricingModes) ...[
            const SizedBox(height: 12),
            const Text(
              'Quoted requests and priced orders must be submitted separately.',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700),
            ),
          ],
        ],
      ),
    );
  }
}

String _date(DateTime? date) => date == null
    ? 'date required'
    : '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

String _label(String key) => key
    .split('_')
    .map(
      (word) =>
          word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}',
    )
    .join(' ');
