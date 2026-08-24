import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class MatchedSupplierPreview {
  const MatchedSupplierPreview({
    required this.supplierId,
    required this.businessName,
    required this.preference,
    required this.deliveryFeePesos,
    required this.feeIsEstimate,
    this.address,
    this.distanceMeters,
    this.priorityFee = 50.0,
    this.extraDropFee = 30.0,
  });

  final int supplierId;
  final String businessName;
  final String preference;
  final double deliveryFeePesos;
  final bool feeIsEstimate;
  final String? address;
  final double? distanceMeters;
  final double priorityFee;
  final double extraDropFee;
}

class MatchingPreviewNotifier extends StateNotifier<MatchedSupplierPreview?> {
  MatchingPreviewNotifier() : super(null);

  void clear() => state = null;

  Future<MatchedSupplierPreview?> preview({
    required String category,
    int? destinationId,
    double? latitude,
    double? longitude,
  }) async {
    state = null; // clear stale state
    try {
      final response = await ApiClient.instance.post(
        '/matching/preview',
        data: {
          'category': category,
          if (destinationId != null) 'destinationId': destinationId,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
        },
      );
      print('Matching preview response: ${response.data}');
      final data = Map<String, dynamic>.from(response.data as Map);
      final supplier = Map<String, dynamic>.from(data['supplier'] as Map);
      final preview = MatchedSupplierPreview(
        supplierId: (supplier['supplierId'] as num).toInt(),
        businessName: supplier['businessName']?.toString() ?? 'Print shop',
        preference: data['preference']?.toString() ?? 'quality',
        deliveryFeePesos:
            (data['deliveryFeePesos'] as num?)?.toDouble() ??
            ((data['settings'] as Map?)?['deliveryFeePerKm'] as num?)
                ?.toDouble() ??
            25,
        feeIsEstimate: data['feeIsEstimate'] == true,
        address: supplier['address']?.toString(),
        distanceMeters: (data['distanceMeters'] as num?)?.toDouble(),
        priorityFee:
            ((data['settings'] as Map?)?['priorityFee'] as num?)?.toDouble() ??
            50.0,
        extraDropFee:
            ((data['settings'] as Map?)?['extraDropFee'] as num?)?.toDouble() ??
            30.0,
      );
      state = preview;
      return preview;
    } catch (e, stack) {
      print('Matching preview error: $e\n$stack');
      rethrow;
    }
  }
}

final matchingPreviewProvider =
    StateNotifierProvider<MatchingPreviewNotifier, MatchedSupplierPreview?>(
      (ref) => MatchingPreviewNotifier(),
    );
