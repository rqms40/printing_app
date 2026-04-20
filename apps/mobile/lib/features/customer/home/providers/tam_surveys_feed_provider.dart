import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class FeedItem {
  final int id;
  final String userName;
  final double rating;
  final String? feedback;
  final DateTime createdAt;

  FeedItem({
    required this.id,
    required this.userName,
    required this.rating,
    this.feedback,
    required this.createdAt,
  });

  factory FeedItem.fromJson(Map<String, dynamic> json) {
    String? finalFeedback;
    final fb = json['feedback'] as String?;
    if (fb != null && fb.trim().isNotEmpty) {
      if (fb.trim().startsWith('{')) {
        try {
          final map = jsonDecode(fb) as Map<String, dynamic>;
          final feature = map['feature'] as String?;
          final delivery = map['delivery'] as String?;
          final parts = <String>[];
          if (feature != null && feature.trim().isNotEmpty) parts.add(feature.trim());
          if (delivery != null && delivery.trim().isNotEmpty) parts.add(delivery.trim());
          finalFeedback = parts.join(' ');
        } catch (_) {
          finalFeedback = fb;
        }
      } else {
        finalFeedback = fb;
      }
    }

    return FeedItem(
      id: json['id'] as int,
      userName: json['user_name'] as String? ?? 'Customer',
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      feedback: finalFeedback,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

final feedSurveysProvider = FutureProvider.autoDispose<List<FeedItem>>((ref) async {
  final response = await ApiClient.instance.get('/tam-surveys/feed');
  final data = response.data as List;
  return data.map((e) => FeedItem.fromJson(e as Map<String, dynamic>)).toList();
});
