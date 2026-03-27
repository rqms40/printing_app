import 'enums.dart';

class ThreeDSpecs {
  const ThreeDSpecs({
    required this.fileFormat,
    required this.material,
    required this.color,
    required this.infillPercentage,
    required this.layerHeight,
    required this.supports,
    this.notes,
  });

  final FileFormat3D fileFormat;
  final Material3D material;
  final String color;
  final int infillPercentage;
  final double layerHeight;
  final bool supports;
  final String? notes;

  ThreeDSpecs copyWith({
    FileFormat3D? fileFormat,
    Material3D? material,
    String? color,
    int? infillPercentage,
    double? layerHeight,
    bool? supports,
    String? notes,
  }) {
    return ThreeDSpecs(
      fileFormat: fileFormat ?? this.fileFormat,
      material: material ?? this.material,
      color: color ?? this.color,
      infillPercentage: infillPercentage ?? this.infillPercentage,
      layerHeight: layerHeight ?? this.layerHeight,
      supports: supports ?? this.supports,
      notes: notes ?? this.notes,
    );
  }

  @override
  String toString() =>
      'ThreeDSpecs(${fileFormat.displayName}, ${material.displayName}, $color)';
}
