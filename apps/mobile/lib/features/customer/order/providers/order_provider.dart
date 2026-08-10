import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/services/draft_storage_service.dart';
import 'package:printing_app/utils/pricing_engine.dart';

Map<String, dynamic> _readStringKeyedMap(dynamic value) {
  if (value is! Map) return const {};
  return Map<String, dynamic>.from(value);
}

Map<String, String> _readStringMap(dynamic value) {
  if (value is! Map) return const {};
  return value.map(
    (key, entry) => MapEntry(key.toString(), entry?.toString() ?? ''),
  );
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

String? _normalizeOptionalText(String? value) {
  final text = value?.trim();
  return text == null || text.isEmpty ? null : text;
}

/// Holds the full state for the 6-step order creation flow.
class OrderFlowState {
  const OrderFlowState({
    this.currentStep = 0,
    this.category,
    this.categoryName,
    this.groupSlug,
    this.productSlug,
    this.productName,
    this.requiredDate,
    this.quoteRequired = false,
    this.catalogServerBacked = false,
    this.specs = const {},
    this.specDisplayValues = const {},
    this.paperSpecs,
    this.threeDSpecs,
    this.fileName,
    this.filePath,
    this.fileSize,
    this.fileMetadataId,
    this.quantity = 1,
    this.pageCount = 1,
    this.deliveryOption = 'pickup',
    this.deliveryAddress,
    this.paymentMethod,
    this.totalPrice = 0,
    this.deliveryFee = 0,
    this.printMode = 'fitToPage',
    this.specialInstructions,
  });

  /// Current step index (0-5).
  final int currentStep;

  /// Either `'paper'` or `'3d'`.
  final String? category;
  final String? categoryName;
  final String? groupSlug;
  final String? productSlug;
  final String? productName;
  final DateTime? requiredDate;
  final bool quoteRequired;
  final bool catalogServerBacked;

  /// Dynamic catalog spec values keyed by `product_spec_definitions.key`.
  final Map<String, dynamic> specs;

  /// Human-readable selected spec labels keyed by spec key.
  final Map<String, String> specDisplayValues;

  final PaperSpecs? paperSpecs;
  final ThreeDSpecs? threeDSpecs;

  final String? fileName;
  final String? filePath;
  final int? fileSize;
  final int? fileMetadataId;

  final int quantity;

  /// Only relevant for paper printing.
  final int pageCount;

  /// `'pickup'` or `'delivery'`.
  final String deliveryOption;
  final Address? deliveryAddress;

  final PaymentMethod? paymentMethod;

  final double totalPrice;
  final double deliveryFee;

  /// `'fitToPage'` or `'actualSize'`.
  final String printMode;

  /// Customer-facing instructions for this specific print job.
  final String? specialInstructions;

  OrderFlowState copyWith({
    int? currentStep,
    String? category,
    String? categoryName,
    String? groupSlug,
    String? productSlug,
    String? productName,
    DateTime? requiredDate,
    bool? quoteRequired,
    bool? catalogServerBacked,
    Map<String, dynamic>? specs,
    Map<String, String>? specDisplayValues,
    PaperSpecs? paperSpecs,
    ThreeDSpecs? threeDSpecs,
    String? fileName,
    String? filePath,
    int? fileSize,
    int? fileMetadataId,
    int? quantity,
    int? pageCount,
    String? deliveryOption,
    Address? deliveryAddress,
    PaymentMethod? paymentMethod,
    double? totalPrice,
    double? deliveryFee,
    String? printMode,
    String? specialInstructions,
    // Allow explicit null clearing
    bool clearPaperSpecs = false,
    bool clearThreeDSpecs = false,
    bool clearSpecs = false,
    bool clearFile = false,
    bool clearAddress = false,
    bool clearPaymentMethod = false,
    bool clearSpecialInstructions = false,
  }) {
    return OrderFlowState(
      currentStep: currentStep ?? this.currentStep,
      category: category ?? this.category,
      categoryName: categoryName ?? this.categoryName,
      groupSlug: groupSlug ?? this.groupSlug,
      productSlug: productSlug ?? this.productSlug,
      productName: productName ?? this.productName,
      requiredDate: requiredDate ?? this.requiredDate,
      quoteRequired: quoteRequired ?? this.quoteRequired,
      catalogServerBacked: catalogServerBacked ?? this.catalogServerBacked,
      specs: clearSpecs ? const {} : (specs ?? this.specs),
      specDisplayValues: clearSpecs
          ? const {}
          : (specDisplayValues ?? this.specDisplayValues),
      paperSpecs: clearPaperSpecs ? null : (paperSpecs ?? this.paperSpecs),
      threeDSpecs: clearThreeDSpecs ? null : (threeDSpecs ?? this.threeDSpecs),
      fileName: clearFile ? null : (fileName ?? this.fileName),
      filePath: clearFile ? null : (filePath ?? this.filePath),
      fileSize: clearFile ? null : (fileSize ?? this.fileSize),
      fileMetadataId: clearFile
          ? null
          : (fileMetadataId ?? this.fileMetadataId),
      quantity: quantity ?? this.quantity,
      pageCount: pageCount ?? this.pageCount,
      deliveryOption: deliveryOption ?? this.deliveryOption,
      deliveryAddress: clearAddress
          ? null
          : (deliveryAddress ?? this.deliveryAddress),
      paymentMethod: clearPaymentMethod
          ? null
          : (paymentMethod ?? this.paymentMethod),
      totalPrice: totalPrice ?? this.totalPrice,
      deliveryFee: deliveryFee ?? this.deliveryFee,
      printMode: printMode ?? this.printMode,
      specialInstructions: clearSpecialInstructions
          ? null
          : (specialInstructions ?? this.specialInstructions),
    );
  }

  /// Serialises this state to a plain map for Hive persistence.
  Map<String, dynamic> toMap() {
    return {
      'currentStep': currentStep,
      'category': category,
      'categoryName': categoryName,
      'groupSlug': groupSlug,
      'productSlug': productSlug,
      'productName': productName,
      'requiredDate': requiredDate?.toIso8601String(),
      'quoteRequired': quoteRequired,
      'catalogServerBacked': catalogServerBacked,
      'specs': specs,
      'specDisplayValues': specDisplayValues,
      'paperSpecs': paperSpecs != null
          ? {
              'paperSize': paperSpecs!.paperSize.name,
              'colorMode': paperSpecs!.colorMode.name,
              'mediaType': paperSpecs!.mediaType.name,
              'printSides': paperSpecs!.printSides.name,
              'binding': paperSpecs!.binding.name,
            }
          : null,
      'threeDSpecs': threeDSpecs != null
          ? {
              'fileFormat': threeDSpecs!.fileFormat.name,
              'material': threeDSpecs!.material.name,
              'color': threeDSpecs!.color,
              'infillPercentage': threeDSpecs!.infillPercentage,
              'layerHeight': threeDSpecs!.layerHeight,
              'supports': threeDSpecs!.supports,
              'notes': threeDSpecs!.notes,
            }
          : null,
      'fileName': fileName,
      'filePath': filePath,
      'fileSize': fileSize,
      'fileMetadataId': fileMetadataId,
      'quantity': quantity,
      'pageCount': pageCount,
      'deliveryOption': deliveryOption,
      'deliveryAddress': deliveryAddress != null
          ? {
              'id': deliveryAddress!.id,
              'userId': deliveryAddress!.userId,
              'label': deliveryAddress!.label,
              'fullAddress': deliveryAddress!.fullAddress,
              'barangay': deliveryAddress!.barangay,
              'city': deliveryAddress!.city,
              'province': deliveryAddress!.province,
              'zipCode': deliveryAddress!.zipCode,
              'landmark': deliveryAddress!.landmark,
              'latitude': deliveryAddress!.latitude,
              'longitude': deliveryAddress!.longitude,
              'isDefault': deliveryAddress!.isDefault,
              'createdAt': deliveryAddress!.createdAt.toIso8601String(),
              'updatedAt': deliveryAddress!.updatedAt.toIso8601String(),
            }
          : null,
      'paymentMethod': paymentMethod?.name,
      'totalPrice': totalPrice,
      'deliveryFee': deliveryFee,
      'printMode': printMode,
      'specialInstructions': specialInstructions,
    };
  }

  /// Restores an [OrderFlowState] from a persisted map.
  static OrderFlowState fromMap(Map<String, dynamic> map) {
    PaperSpecs? paperSpecs;
    final psMap = map['paperSpecs'];
    if (psMap != null) {
      final ps = Map<String, dynamic>.from(psMap as Map);
      paperSpecs = PaperSpecs(
        paperSize:
            _parseEnum(PaperSize.values, ps['paperSize'] as String?) ??
            PaperSize.a4,
        colorMode:
            _parseEnum(ColorMode.values, ps['colorMode'] as String?) ??
            ColorMode.blackAndWhite,
        mediaType:
            _parseEnum(MediaType.values, ps['mediaType'] as String?) ??
            MediaType.glossy,
        printSides:
            _parseEnum(PrintSides.values, ps['printSides'] as String?) ??
            PrintSides.frontOnly,
        binding:
            _parseEnum(Binding.values, ps['binding'] as String?) ??
            Binding.none,
      );
    }

    ThreeDSpecs? threeDSpecs;
    final tdMap = map['threeDSpecs'];
    if (tdMap != null) {
      final td = Map<String, dynamic>.from(tdMap as Map);
      threeDSpecs = ThreeDSpecs(
        fileFormat:
            _parseEnum(FileFormat3D.values, td['fileFormat'] as String?) ??
            FileFormat3D.stl,
        material:
            _parseEnum(Material3D.values, td['material'] as String?) ??
            Material3D.pla,
        color: td['color']?.toString() ?? '',
        infillPercentage: _readInt(td['infillPercentage'], 20),
        layerHeight: _readDouble(td['layerHeight'], 0.2),
        supports: td['supports'] as bool? ?? false,
        notes: td['notes']?.toString(),
      );
    }

    Address? deliveryAddress;
    final addrMap = map['deliveryAddress'];
    if (addrMap != null) {
      final a = Map<String, dynamic>.from(addrMap as Map);
      deliveryAddress = Address(
        id: a['id'] as String,
        userId: a['userId'] as String,
        label: a['label'] as String,
        fullAddress: a['fullAddress'] as String,
        barangay: a['barangay'] as String?,
        city: a['city'] as String,
        province: a['province'] as String?,
        zipCode: a['zipCode'] as String?,
        landmark: a['landmark'] as String?,
        latitude: (a['latitude'] as num).toDouble(),
        longitude: (a['longitude'] as num).toDouble(),
        isDefault: a['isDefault'] as bool,
        createdAt: DateTime.parse(a['createdAt'] as String),
        updatedAt: DateTime.parse(a['updatedAt'] as String),
      );
    }

    return OrderFlowState(
      currentStep: map['currentStep'] as int? ?? 0,
      category: map['category'] as String?,
      categoryName: map['categoryName'] as String?,
      groupSlug: map['groupSlug'] as String?,
      productSlug: map['productSlug'] as String?,
      productName: map['productName'] as String?,
      requiredDate: DateTime.tryParse(map['requiredDate']?.toString() ?? ''),
      quoteRequired: map['quoteRequired'] as bool? ?? false,
      catalogServerBacked: map['catalogServerBacked'] as bool? ?? false,
      specs: _readStringKeyedMap(map['specs']),
      specDisplayValues: _readStringMap(map['specDisplayValues']),
      paperSpecs: paperSpecs,
      threeDSpecs: threeDSpecs,
      fileName: map['fileName'] as String?,
      filePath: map['filePath'] as String?,
      fileSize: map['fileSize'] as int?,
      fileMetadataId: map['fileMetadataId'] as int?,
      quantity: map['quantity'] as int? ?? 1,
      pageCount: map['pageCount'] as int? ?? 1,
      deliveryOption: map['deliveryOption'] as String? ?? 'pickup',
      deliveryAddress: deliveryAddress,
      paymentMethod: _parseEnum(
        PaymentMethod.values,
        map['paymentMethod'] as String?,
      ),
      totalPrice: (map['totalPrice'] as num?)?.toDouble() ?? 0,
      deliveryFee: (map['deliveryFee'] as num?)?.toDouble() ?? 0,
      printMode: map['printMode'] as String? ?? 'fitToPage',
      specialInstructions: _normalizeOptionalText(
        map['specialInstructions']?.toString(),
      ),
    );
  }
}

/// Manages order flow progression and state mutations.
class OrderFlowNotifier extends StateNotifier<OrderFlowState> {
  OrderFlowNotifier({bool persistDraft = true})
    : _persistDraft = persistDraft,
      super(const OrderFlowState()) {
    if (_persistDraft) _loadDraft();
  }

  final bool _persistDraft;

  void _loadDraft() {
    final data = DraftStorageService.loadDraft();
    if (data != null) {
      state = OrderFlowState.fromMap(data);
    }
  }

  void _saveDraft() {
    if (!_persistDraft) return;
    DraftStorageService.saveDraft(state.toMap());
  }

  void setCategory(String category, {String? categoryName}) {
    state = state.copyWith(
      category: category,
      categoryName: categoryName ?? _defaultCategoryName(category),
      clearSpecs: true,
      clearPaperSpecs: true,
      clearThreeDSpecs: true,
      clearFile: true,
      clearSpecialInstructions: true,
      printMode: 'fitToPage',
    );
    _saveDraft();
  }

  void setCatalogProduct({
    required String groupSlug,
    required String productSlug,
    required String productName,
    required DateTime requiredDate,
    required bool quoteRequired,
    required bool catalogServerBacked,
    required int quantity,
    required Map<String, dynamic> specs,
    required Map<String, String> displayValues,
    String? notes,
  }) {
    state = state.copyWith(
      category: productSlug,
      categoryName: productName,
      groupSlug: groupSlug,
      productSlug: productSlug,
      productName: productName,
      requiredDate: requiredDate,
      quoteRequired: quoteRequired,
      catalogServerBacked: catalogServerBacked,
      quantity: quantity,
      specs: Map<String, dynamic>.unmodifiable(specs),
      specDisplayValues: Map<String, String>.unmodifiable(displayValues),
      specialInstructions: _normalizeOptionalText(notes),
      clearPaperSpecs: true,
      clearThreeDSpecs: true,
    );
    _saveDraft();
  }

  void setPaperSpecs(PaperSpecs specs) {
    state = state.copyWith(paperSpecs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  void setThreeDSpecs(ThreeDSpecs specs) {
    state = state.copyWith(threeDSpecs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  void setCatalogSpecs({
    required Map<String, dynamic> specs,
    required Map<String, String> displayValues,
    double? totalPrice,
  }) {
    state = state.copyWith(
      specs: Map<String, dynamic>.unmodifiable(specs),
      specDisplayValues: Map<String, String>.unmodifiable(displayValues),
      totalPrice: totalPrice,
    );
    _saveDraft();
  }

  void setPaperSpecsFromMap(Map<String, dynamic> map) {
    if (map.isEmpty) return;
    final specs = PaperSpecs(
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
          _parseEnum(Binding.values, map['binding']?.toString()) ??
          Binding.none,
    );
    state = state.copyWith(paperSpecs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  void setThreeDSpecsFromMap(Map<String, dynamic> map) {
    if (map.isEmpty) return;
    final specs = ThreeDSpecs(
      fileFormat:
          _parseEnum(FileFormat3D.values, map['fileFormat']?.toString()) ??
          FileFormat3D.stl,
      material:
          _parseEnum(Material3D.values, map['material']?.toString()) ??
          Material3D.pla,
      color: map['color']?.toString() ?? '',
      infillPercentage: _readInt(map['infillPercentage'], 20),
      layerHeight: _readDouble(map['layerHeight'], 0.2),
      supports: map['supports'] as bool? ?? false,
      notes: map['notes']?.toString(),
    );
    state = state.copyWith(threeDSpecs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  void setFile({
    required String fileName,
    required String filePath,
    required int fileSize,
    int? fileMetadataId,
  }) {
    state = state.copyWith(
      fileName: fileName,
      filePath: filePath,
      fileSize: fileSize,
      fileMetadataId: fileMetadataId,
    );
    _saveDraft();
  }

  void setFileMetadataId(int? id) {
    state = state.copyWith(fileMetadataId: id);
    _saveDraft();
  }

  void setSpecialInstructions(String? value) {
    final text = _normalizeOptionalText(value);
    state = state.copyWith(
      specialInstructions: text,
      clearSpecialInstructions: text == null,
    );
    _saveDraft();
  }

  void setQuantity(int quantity) {
    state = state.copyWith(quantity: quantity);
    _recalculatePrice();
    _saveDraft();
  }

  void setPageCount(int pageCount) {
    final Map<String, dynamic>? specs;
    if (state.specs.isEmpty) {
      specs = null;
    } else {
      specs = Map<String, dynamic>.from(state.specs);
      specs['page_count'] = pageCount;
    }
    state = state.copyWith(pageCount: pageCount, specs: specs);
    _recalculatePrice();
    _saveDraft();
  }

  void setDeliveryOption(String option) {
    final fee = option == 'delivery' ? 50.0 : 0.0;
    state = state.copyWith(
      deliveryOption: option,
      deliveryFee: fee,
      clearAddress: option == 'pickup',
    );
    _recalculatePrice();
    _saveDraft();
  }

  void setAddress(Address address) {
    state = state.copyWith(deliveryAddress: address);
    _saveDraft();
  }

  void setPaymentMethod(PaymentMethod method) {
    state = state.copyWith(paymentMethod: method);
    _saveDraft();
  }

  void setPrintMode(String mode) {
    final Map<String, dynamic>? specs;
    if (state.specs.isEmpty) {
      specs = null;
    } else {
      specs = Map<String, dynamic>.from(state.specs);
      specs['print_mode'] = mode;
    }
    state = state.copyWith(printMode: mode, specs: specs);
    _saveDraft();
  }

  void nextStep() {
    if (state.currentStep < 5) {
      state = state.copyWith(currentStep: state.currentStep + 1);
      _saveDraft();
    }
  }

  void previousStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
      _saveDraft();
    }
  }

  void goToStep(int step) {
    if (step >= 0 && step <= 5) {
      state = state.copyWith(currentStep: step);
      _saveDraft();
    }
  }

  void reset() {
    state = const OrderFlowState();
    if (_persistDraft) DraftStorageService.clearDraft();
  }

  void _recalculatePrice() {
    double price = 0;

    if (state.category == 'paper' && state.paperSpecs != null) {
      price = PricingEngine.calculatePaperPrice(
        size: state.paperSpecs!.paperSize,
        colorMode: state.paperSpecs!.colorMode,
        mediaType: state.paperSpecs!.mediaType,
        printSides: state.paperSpecs!.printSides,
        binding: state.paperSpecs!.binding,
        quantity: state.quantity,
        pageCount: state.pageCount,
      );
    } else if (state.category == '3d' && state.threeDSpecs != null) {
      price = PricingEngine.calculate3DPrice(
        material: state.threeDSpecs!.material,
        infillPercentage: state.threeDSpecs!.infillPercentage,
        quantity: state.quantity,
      );
    }

    state = state.copyWith(totalPrice: price);
  }
}

T? _parseEnum<T extends Enum>(List<T> values, String? name) {
  if (name == null) return null;
  try {
    return values.byName(name);
  } catch (_) {
    return null;
  }
}

String _defaultCategoryName(String category) {
  if (category == '3d') return '3D Printing';
  if (category == 'paper') return 'Paper Printing';
  return category;
}

/// Global provider for the order creation flow.
final orderFlowProvider =
    StateNotifierProvider<OrderFlowNotifier, OrderFlowState>(
      (ref) => OrderFlowNotifier(),
    );
