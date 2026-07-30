import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/home/providers/tam_surveys_feed_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Admin-selected mode for the home "The Feed" bento tile.
enum HomeFeedMode { auto, community, promo }

/// Server-resolved rendering decision — the client never re-derives this.
enum HomeFeedResolvedMode { community, promo, empty }

class HomeFeedPromo {
  const HomeFeedPromo({
    required this.title,
    this.body,
    this.ctaLabel,
    this.ctaTarget,
    this.imageUrl,
  });

  final String title;
  final String? body;
  final String? ctaLabel;
  final String? ctaTarget;
  final String? imageUrl;

  bool get hasCta =>
      ctaLabel != null &&
      ctaLabel!.trim().isNotEmpty &&
      ctaTarget != null &&
      ctaTarget!.trim().isNotEmpty;

  bool get hasTapTarget =>
      ctaTarget != null && ctaTarget!.trim().isNotEmpty;

  static HomeFeedPromo? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final title = (json['title'] as String?)?.trim() ?? '';
    if (title.isEmpty) return null;
    String? optional(String key) {
      final value = (json[key] as String?)?.trim();
      return value == null || value.isEmpty ? null : value;
    }

    return HomeFeedPromo(
      title: title,
      body: optional('body'),
      ctaLabel: optional('ctaLabel'),
      ctaTarget: optional('ctaTarget'),
      imageUrl: optional('imageUrl'),
    );
  }
}

class HomeFeedData {
  const HomeFeedData({
    required this.mode,
    required this.resolvedMode,
    required this.promoCards,
    required this.feedItems,
  });

  final HomeFeedMode mode;
  final HomeFeedResolvedMode resolvedMode;
  final List<HomeFeedPromo> promoCards;
  final List<FeedItem> feedItems;

  factory HomeFeedData.fromJson(Map<String, dynamic> json) {
    final promoCards = (json['promoCards'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(HomeFeedPromo.fromJson)
        .whereType<HomeFeedPromo>()
        .toList();
    final feedItems = (json['feedItems'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(FeedItem.fromJson)
        .toList();

    // Unknown enum strings fall back to safe values so an older app build
    // renders sensibly against a newer server.
    final mode = switch (json['mode'] as String?) {
      'community' => HomeFeedMode.community,
      'promo' => HomeFeedMode.promo,
      _ => HomeFeedMode.auto,
    };
    var resolvedMode = switch (json['resolvedMode'] as String?) {
      'promo' => HomeFeedResolvedMode.promo,
      'empty' => HomeFeedResolvedMode.empty,
      'community' => HomeFeedResolvedMode.community,
      _ => feedItems.isNotEmpty
          ? HomeFeedResolvedMode.community
          : HomeFeedResolvedMode.empty,
    };
    // Never render promo without cards, whatever the server said.
    if (resolvedMode == HomeFeedResolvedMode.promo && promoCards.isEmpty) {
      resolvedMode = feedItems.isNotEmpty
          ? HomeFeedResolvedMode.community
          : HomeFeedResolvedMode.empty;
    }

    return HomeFeedData(
      mode: mode,
      resolvedMode: resolvedMode,
      promoCards: promoCards,
      feedItems: feedItems,
    );
  }
}

final homeFeedProvider = FutureProvider.autoDispose<HomeFeedData>((ref) async {
  final response = await ApiClient.instance.get('/home-feed');
  return HomeFeedData.fromJson(response.data as Map<String, dynamic>);
});
