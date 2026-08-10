import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';

class DynamicSpecField extends StatelessWidget {
  const DynamicSpecField({
    super.key,
    required this.definition,
    required this.value,
    required this.onChanged,
  });

  final ProductSpecDefinition definition;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    final label = '${definition.label}${definition.isRequired ? ' *' : ''}';
    final field = switch (definition.inputType) {
      'select' => DropdownButtonFormField<String>(
        initialValue: value?.toString().isEmpty ?? true
            ? null
            : value.toString(),
        decoration: InputDecoration(labelText: label),
        validator: (selected) =>
            definition.isRequired && (selected == null || selected.isEmpty)
            ? '${definition.label} is required'
            : null,
        items: definition.options
            .map(
              (option) => DropdownMenuItem(
                value: option.value,
                child: Text(option.label),
              ),
            )
            .toList(),
        onChanged: onChanged,
      ),
      'boolean' => Semantics(
        label: label,
        child: SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(label),
          value: value == true,
          onChanged: onChanged,
        ),
      ),
      _ => TextFormField(
        initialValue: value?.toString() ?? '',
        decoration: InputDecoration(
          labelText: label,
          hintText: definition.placeholder,
          suffixText: definition.unitLabel,
        ),
        keyboardType:
            definition.inputType == 'number' || definition.valueType == 'number'
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.text,
        inputFormatters:
            definition.inputType == 'number' || definition.valueType == 'number'
            ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))]
            : null,
        validator: (raw) => _validate(raw),
        onChanged: (raw) {
          if (definition.inputType == 'number' ||
              definition.valueType == 'number') {
            onChanged(num.tryParse(raw));
          } else {
            onChanged(raw);
          }
        },
      ),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          field,
          if (definition.helpText?.trim().isNotEmpty ?? false) ...[
            const SizedBox(height: 6),
            Text(
              definition.helpText!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }

  String? _validate(String? raw) {
    final text = raw?.trim() ?? '';
    if (definition.isRequired && text.isEmpty) {
      return '${definition.label} is required';
    }
    if (text.isEmpty) return null;
    if (definition.inputType == 'number' || definition.valueType == 'number') {
      final number = num.tryParse(text);
      if (number == null) return 'Enter a valid number';
      if (definition.minValue != null && number < definition.minValue!) {
        return 'Minimum is ${_formatBound(definition.minValue!)}';
      }
      if (definition.maxValue != null && number > definition.maxValue!) {
        return 'Maximum is ${_formatBound(definition.maxValue!)}';
      }
    }
    return null;
  }
}

String _formatBound(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toString();
