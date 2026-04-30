import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';

class PaymentMethodSheet {
  static Future<PaymentMethod?> show(
    BuildContext context, {
    PaymentMethod? current,
  }) {
    return showModalBottomSheet<PaymentMethod>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PaymentSheetBody(initial: current),
    );
  }
}

class _PaymentSheetBody extends ConsumerStatefulWidget {
  const _PaymentSheetBody({required this.initial});
  final PaymentMethod? initial;

  @override
  ConsumerState<_PaymentSheetBody> createState() => _PaymentSheetBodyState();
}

class _PaymentSheetBodyState extends ConsumerState<_PaymentSheetBody> {
  PaymentMethod? _chosen;
  bool _setDefault = false;

  @override
  void initState() {
    super.initState();
    _chosen = widget.initial;
  }

  String _label(PaymentMethod m) {
    switch (m) {
      case PaymentMethod.gcash:
        return 'GCash';
      case PaymentMethod.maya:
        return 'Maya';
      case PaymentMethod.cod:
        return 'Cash on Delivery';
      case PaymentMethod.gridCredits:
        return 'GRID Credits';
    }
  }

  String _wireValue(PaymentMethod m) {
    switch (m) {
      case PaymentMethod.gridCredits:
        return 'credits';
      default:
        return m.name;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Choose payment method',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          for (final m in PaymentMethod.values)
            RadioListTile<PaymentMethod>(
              value: m,
              groupValue: _chosen,
              onChanged: (v) => setState(() => _chosen = v),
              title: Text(_label(m)),
            ),
          CheckboxListTile(
            value: _setDefault,
            onChanged: (v) => setState(() => _setDefault = v ?? false),
            title: const Text('Set as default for future orders'),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _chosen == null
                  ? null
                  : () async {
                      if (_setDefault) {
                        try {
                          await ApiClient.instance.dio.patch(
                            '/users/me/default-payment-method',
                            data: {'method': _wireValue(_chosen!)},
                          );
                        } catch (_) {
                          // non-fatal — selection still applied for this order
                        }
                      }
                      if (!context.mounted) return;
                      Navigator.of(context).pop(_chosen);
                    },
              child: const Text('Use this'),
            ),
          ),
        ],
      ),
    );
  }
}
