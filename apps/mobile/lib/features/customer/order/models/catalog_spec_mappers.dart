import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';

PaperSpecs paperSpecsFromCatalogValues(Map<String, dynamic> values) {
  return PaperSpecs(
    paperSize:
        _parseEnum(
          PaperSize.values,
          _serverValueToEnumName(values['paper_size']),
        ) ??
        PaperSize.a4,
    colorMode:
        _parseEnum(
          ColorMode.values,
          _serverValueToEnumName(values['color_mode']),
        ) ??
        ColorMode.blackAndWhite,
    mediaType:
        _parseEnum(
          MediaType.values,
          _serverValueToEnumName(values['media_type']),
        ) ??
        MediaType.matte,
    printSides:
        _parseEnum(
          PrintSides.values,
          _serverValueToEnumName(values['print_sides']),
        ) ??
        PrintSides.frontOnly,
    binding:
        _parseEnum(Binding.values, _serverValueToEnumName(values['binding'])) ??
        Binding.none,
  );
}

ThreeDSpecs threeDSpecsFromCatalogValues(Map<String, dynamic> values) {
  return ThreeDSpecs(
    fileFormat:
        _parseEnum(
          FileFormat3D.values,
          _serverValueToEnumName(values['file_format']),
        ) ??
        FileFormat3D.stl,
    material:
        _parseEnum(
          Material3D.values,
          _serverValueToEnumName(values['material']),
        ) ??
        Material3D.pla,
    color: values['color']?.toString() ?? 'white',
    infillPercentage: _readInt(values['infill_percentage'], 20),
    layerHeight: _readDouble(values['layer_height'], 0.2),
    supports: _readBool(values['supports'], false),
    notes: values['notes']?.toString().trim().isEmpty ?? true
        ? null
        : values['notes']?.toString().trim(),
  );
}

String? _serverValueToEnumName(dynamic value) {
  if (value == null) return null;
  final text = value.toString();
  if (text == '3mf') return 'threeMf';
  return text.replaceAllMapped(
    RegExp(r'_([a-z0-9])'),
    (match) => match.group(1)!.toUpperCase(),
  );
}

T? _parseEnum<T extends Enum>(List<T> values, String? name) {
  if (name == null) return null;
  try {
    return values.byName(name);
  } catch (_) {
    return null;
  }
}

int _readInt(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

bool _readBool(dynamic value, bool fallback) {
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}
