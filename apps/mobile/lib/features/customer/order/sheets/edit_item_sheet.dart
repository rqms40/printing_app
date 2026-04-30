import 'package:flutter/material.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';

class EditItemSheet {
  static Future<CartItem?> show(BuildContext context, {required CartItem item}) {
    return showModalBottomSheet<CartItem>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EditItemBody(item: item),
    );
  }
}

class _EditItemBody extends StatefulWidget {
  const _EditItemBody({required this.item});
  final CartItem item;

  @override
  State<_EditItemBody> createState() => _EditItemBodyState();
}

class _EditItemBodyState extends State<_EditItemBody> {
  late TextEditingController _qty;
  late TextEditingController _pages;

  @override
  void initState() {
    super.initState();
    _qty = TextEditingController(text: widget.item.quantity.toString());
    _pages = TextEditingController(text: widget.item.pageCount.toString());
  }

  @override
  void dispose() {
    _qty.dispose();
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Edit · ${widget.item.fileName}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            TextField(
              key: const Key('edit-qty'),
              controller: _qty,
              decoration: const InputDecoration(labelText: 'Quantity'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              key: const Key('edit-pages'),
              controller: _pages,
              decoration: const InputDecoration(labelText: 'Pages'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(widget.item.copyWith(
                quantity: int.tryParse(_qty.text) ?? widget.item.quantity,
                pageCount: int.tryParse(_pages.text) ?? widget.item.pageCount,
              )),
              child: const Text('Save changes'),
            ),
          ],
        ),
      ),
    );
  }
}
