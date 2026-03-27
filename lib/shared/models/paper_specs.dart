import 'enums.dart';

class PaperSpecs {
  const PaperSpecs({
    required this.paperSize,
    required this.colorMode,
    required this.mediaType,
    required this.printSides,
    required this.binding,
  });

  final PaperSize paperSize;
  final ColorMode colorMode;
  final MediaType mediaType;
  final PrintSides printSides;
  final Binding binding;

  PaperSpecs copyWith({
    PaperSize? paperSize,
    ColorMode? colorMode,
    MediaType? mediaType,
    PrintSides? printSides,
    Binding? binding,
  }) {
    return PaperSpecs(
      paperSize: paperSize ?? this.paperSize,
      colorMode: colorMode ?? this.colorMode,
      mediaType: mediaType ?? this.mediaType,
      printSides: printSides ?? this.printSides,
      binding: binding ?? this.binding,
    );
  }

  @override
  String toString() =>
      'PaperSpecs(${paperSize.displayName}, ${colorMode.displayName}, ${mediaType.displayName})';
}
