import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';

class CartItem {
  CartItem({
    required this.id,
    required this.category,
    required this.fileName,
    this.filePath,
    this.fileSize,
    required this.fileMetadataId,
    this.paperSpecs,
    this.threeDSpecs,
    required this.quantity,
    required this.pageCount,
    required this.unitPrice,
    required this.createdAt,
  });

  final String id;
  final String category;
  final String fileName;
  final String? filePath;
  final int? fileSize;
  final int fileMetadataId;
  final PaperSpecs? paperSpecs;
  final ThreeDSpecs? threeDSpecs;
  final int quantity;
  final int pageCount;
  final double unitPrice;
  final DateTime createdAt;

  double get printSubtotal => unitPrice * quantity;

  factory CartItem.fromOrderFlow(OrderFlowState flow) {
    _validateOrderFlow(flow);

    return CartItem(
      id: _newCartItemId(flow),
      category: flow.category!,
      fileName: flow.fileName!.trim(),
      filePath: flow.filePath,
      fileSize: flow.fileSize,
      fileMetadataId: flow.fileMetadataId!,
      paperSpecs: flow.category == 'paper' ? flow.paperSpecs : null,
      threeDSpecs: flow.category == '3d' ? flow.threeDSpecs : null,
      quantity: flow.quantity,
      pageCount: flow.pageCount,
      unitPrice: flow.totalPrice / flow.quantity,
      createdAt: DateTime.now(),
    );
  }

  factory CartItem.fromMap(Map<String, dynamic> map) {
    final quantity = _normalizeQuantity((map['quantity'] as num?)?.toInt());
    final legacySubtotal = (map['printSubtotal'] as num?)?.toDouble() ?? 0;

    return CartItem(
      id: map['id']?.toString() ?? _newFallbackId(),
      category: map['category']?.toString() ?? '',
      fileName: map['fileName']?.toString() ?? '',
      filePath: map['filePath']?.toString(),
      fileSize: (map['fileSize'] as num?)?.toInt(),
      fileMetadataId: (map['fileMetadataId'] as num?)?.toInt() ?? 0,
      paperSpecs: _paperSpecsFromMap(map['paperSpecs']),
      threeDSpecs: _threeDSpecsFromMap(map['threeDSpecs']),
      quantity: quantity,
      pageCount: (map['pageCount'] as num?)?.toInt() ?? 1,
      unitPrice:
          (map['unitPrice'] as num?)?.toDouble() ?? legacySubtotal / quantity,
      createdAt:
          DateTime.tryParse(map['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'category': category,
      'fileName': fileName,
      'filePath': filePath,
      'fileSize': fileSize,
      'fileMetadataId': fileMetadataId,
      'paperSpecs': paperSpecs == null
          ? null
          : {
              'paperSize': paperSpecs!.paperSize.name,
              'colorMode': paperSpecs!.colorMode.name,
              'mediaType': paperSpecs!.mediaType.name,
              'printSides': paperSpecs!.printSides.name,
              'binding': paperSpecs!.binding.name,
            },
      'threeDSpecs': threeDSpecs == null
          ? null
          : {
              'fileFormat': threeDSpecs!.fileFormat.name,
              'material': threeDSpecs!.material.name,
              'color': threeDSpecs!.color,
              'infillPercentage': threeDSpecs!.infillPercentage,
              'layerHeight': threeDSpecs!.layerHeight,
              'supports': threeDSpecs!.supports,
              'notes': threeDSpecs!.notes,
            },
      'quantity': quantity,
      'pageCount': pageCount,
      'unitPrice': unitPrice,
      'printSubtotal': printSubtotal,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  CartItem copyWith({int? quantity, double? unitPrice}) {
    return CartItem(
      id: id,
      category: category,
      fileName: fileName,
      filePath: filePath,
      fileSize: fileSize,
      fileMetadataId: fileMetadataId,
      paperSpecs: paperSpecs,
      threeDSpecs: threeDSpecs,
      quantity: quantity ?? this.quantity,
      pageCount: pageCount,
      unitPrice: unitPrice ?? this.unitPrice,
      createdAt: createdAt,
    );
  }
}

void _validateOrderFlow(OrderFlowState flow) {
  final category = flow.category;
  if (category != 'paper' && category != '3d') {
    throw ArgumentError('Cart item requires a paper or 3D category.');
  }

  if (category == 'paper' && flow.paperSpecs == null) {
    throw ArgumentError('Paper cart items require paper specs.');
  }

  if (category == '3d' && flow.threeDSpecs == null) {
    throw ArgumentError('3D cart items require 3D specs.');
  }

  if (flow.fileName == null || flow.fileName!.trim().isEmpty) {
    throw ArgumentError('Cart items require a file name.');
  }

  if (flow.fileMetadataId == null) {
    throw ArgumentError('Cart items require uploaded file metadata.');
  }

  if (flow.quantity <= 0) {
    throw ArgumentError('Cart item quantity must be positive.');
  }

  if (flow.totalPrice <= 0) {
    throw ArgumentError('Cart item subtotal must be positive.');
  }
}

String _newCartItemId(OrderFlowState flow) {
  final timestamp = DateTime.now().microsecondsSinceEpoch;
  return 'cart-$timestamp-${flow.fileMetadataId}';
}

String _newFallbackId() => 'cart-${DateTime.now().microsecondsSinceEpoch}';

int _normalizeQuantity(int? quantity) {
  if (quantity == null || quantity < 1) return 1;
  return quantity;
}

PaperSpecs? _paperSpecsFromMap(dynamic data) {
  if (data == null) return null;
  final map = Map<String, dynamic>.from(data as Map);
  return PaperSpecs(
    paperSize:
        _parseEnum(PaperSize.values, map['paperSize']?.toString()) ??
        PaperSize.a4,
    colorMode:
        _parseEnum(ColorMode.values, map['colorMode']?.toString()) ??
        ColorMode.blackAndWhite,
    mediaType:
        _parseEnum(MediaType.values, map['mediaType']?.toString()) ??
        MediaType.glossy,
    printSides:
        _parseEnum(PrintSides.values, map['printSides']?.toString()) ??
        PrintSides.frontOnly,
    binding:
        _parseEnum(Binding.values, map['binding']?.toString()) ?? Binding.none,
  );
}

ThreeDSpecs? _threeDSpecsFromMap(dynamic data) {
  if (data == null) return null;
  final map = Map<String, dynamic>.from(data as Map);
  return ThreeDSpecs(
    fileFormat:
        _parseEnum(FileFormat3D.values, map['fileFormat']?.toString()) ??
        FileFormat3D.stl,
    material:
        _parseEnum(Material3D.values, map['material']?.toString()) ??
        Material3D.pla,
    color: map['color']?.toString() ?? '',
    infillPercentage: (map['infillPercentage'] as num?)?.toInt() ?? 20,
    layerHeight: (map['layerHeight'] as num?)?.toDouble() ?? 0.2,
    supports: map['supports'] as bool? ?? false,
    notes: map['notes']?.toString(),
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
