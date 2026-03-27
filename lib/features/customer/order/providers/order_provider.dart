import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/utils/pricing_engine.dart';

/// Holds the full state for the 6-step order creation flow.
class OrderFlowState {
  const OrderFlowState({
    this.currentStep = 0,
    this.category,
    this.paperSpecs,
    this.threeDSpecs,
    this.fileName,
    this.filePath,
    this.fileSize,
    this.quantity = 1,
    this.pageCount = 1,
    this.deliveryOption = 'pickup',
    this.deliveryAddress,
    this.paymentMethod,
    this.totalPrice = 0,
    this.deliveryFee = 0,
  });

  /// Current step index (0-5).
  final int currentStep;

  /// Either `'paper'` or `'3d'`.
  final String? category;

  final PaperSpecs? paperSpecs;
  final ThreeDSpecs? threeDSpecs;

  final String? fileName;
  final String? filePath;
  final int? fileSize;

  final int quantity;

  /// Only relevant for paper printing.
  final int pageCount;

  /// `'pickup'` or `'delivery'`.
  final String deliveryOption;
  final Address? deliveryAddress;

  final PaymentMethod? paymentMethod;

  final double totalPrice;
  final double deliveryFee;

  OrderFlowState copyWith({
    int? currentStep,
    String? category,
    PaperSpecs? paperSpecs,
    ThreeDSpecs? threeDSpecs,
    String? fileName,
    String? filePath,
    int? fileSize,
    int? quantity,
    int? pageCount,
    String? deliveryOption,
    Address? deliveryAddress,
    PaymentMethod? paymentMethod,
    double? totalPrice,
    double? deliveryFee,
    // Allow explicit null clearing
    bool clearPaperSpecs = false,
    bool clearThreeDSpecs = false,
    bool clearFile = false,
    bool clearAddress = false,
    bool clearPaymentMethod = false,
  }) {
    return OrderFlowState(
      currentStep: currentStep ?? this.currentStep,
      category: category ?? this.category,
      paperSpecs: clearPaperSpecs ? null : (paperSpecs ?? this.paperSpecs),
      threeDSpecs: clearThreeDSpecs ? null : (threeDSpecs ?? this.threeDSpecs),
      fileName: clearFile ? null : (fileName ?? this.fileName),
      filePath: clearFile ? null : (filePath ?? this.filePath),
      fileSize: clearFile ? null : (fileSize ?? this.fileSize),
      quantity: quantity ?? this.quantity,
      pageCount: pageCount ?? this.pageCount,
      deliveryOption: deliveryOption ?? this.deliveryOption,
      deliveryAddress:
          clearAddress ? null : (deliveryAddress ?? this.deliveryAddress),
      paymentMethod:
          clearPaymentMethod ? null : (paymentMethod ?? this.paymentMethod),
      totalPrice: totalPrice ?? this.totalPrice,
      deliveryFee: deliveryFee ?? this.deliveryFee,
    );
  }
}

/// Manages order flow progression and state mutations.
class OrderFlowNotifier extends StateNotifier<OrderFlowState> {
  OrderFlowNotifier() : super(const OrderFlowState());

  void setCategory(String category) {
    state = state.copyWith(
      category: category,
      clearPaperSpecs: true,
      clearThreeDSpecs: true,
      clearFile: true,
    );
  }

  void setPaperSpecs(PaperSpecs specs) {
    state = state.copyWith(paperSpecs: specs);
    _recalculatePrice();
  }

  void setThreeDSpecs(ThreeDSpecs specs) {
    state = state.copyWith(threeDSpecs: specs);
    _recalculatePrice();
  }

  void setFile({
    required String fileName,
    required String filePath,
    required int fileSize,
  }) {
    state = state.copyWith(
      fileName: fileName,
      filePath: filePath,
      fileSize: fileSize,
    );
  }

  void setQuantity(int quantity) {
    state = state.copyWith(quantity: quantity);
    _recalculatePrice();
  }

  void setPageCount(int pageCount) {
    state = state.copyWith(pageCount: pageCount);
    _recalculatePrice();
  }

  void setDeliveryOption(String option) {
    final fee = option == 'delivery' ? 50.0 : 0.0;
    state = state.copyWith(
      deliveryOption: option,
      deliveryFee: fee,
      clearAddress: option == 'pickup',
    );
    _recalculatePrice();
  }

  void setAddress(Address address) {
    state = state.copyWith(deliveryAddress: address);
  }

  void setPaymentMethod(PaymentMethod method) {
    state = state.copyWith(paymentMethod: method);
  }

  void nextStep() {
    if (state.currentStep < 5) {
      state = state.copyWith(currentStep: state.currentStep + 1);
    }
  }

  void previousStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
    }
  }

  void goToStep(int step) {
    if (step >= 0 && step <= 5) {
      state = state.copyWith(currentStep: step);
    }
  }

  void reset() {
    state = const OrderFlowState();
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

/// Global provider for the order creation flow.
final orderFlowProvider =
    StateNotifierProvider<OrderFlowNotifier, OrderFlowState>(
  (ref) => OrderFlowNotifier(),
);
