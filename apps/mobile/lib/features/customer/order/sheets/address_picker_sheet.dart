import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/shared/models/address.dart';

class AddressPickerSheet {
  static Future<Address?> show(BuildContext context) {
    return showModalBottomSheet<Address>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddressPickerBody(),
    );
  }
}

class _AddressPickerBody extends ConsumerWidget {
  const _AddressPickerBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressProvider);
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Choose a delivery address',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          for (final a in addresses)
            ListTile(
              leading: const Icon(Icons.place),
              title: Text(a.label),
              subtitle: Text(a.fullAddress),
              onTap: () => Navigator.of(context).pop(a),
            ),
        ],
      ),
    );
  }
}
