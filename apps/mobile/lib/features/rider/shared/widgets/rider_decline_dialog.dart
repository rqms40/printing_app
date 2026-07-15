import 'package:flutter/material.dart';

const riderDeclineReasons = [
  'Customer unreachable',
  'Vehicle problem',
  'Too far / out of area',
  'Other',
];

/// Confirmation dialog for declining an assignment. Returns the chosen
/// reason, or null when the rider cancels — declining is irreversible, so
/// it must never be a single accidental tap.
Future<String?> showRiderDeclineDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (ctx) => SimpleDialog(
      title: const Text('Decline this delivery?'),
      children: [
        for (final reason in riderDeclineReasons)
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, reason),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(reason),
            ),
          ),
        const Divider(height: 8),
        SimpleDialogOption(
          onPressed: () => Navigator.pop(ctx),
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 6),
            child: Text('Cancel'),
          ),
        ),
      ],
    ),
  );
}
