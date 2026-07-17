import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/providers/home_feed_provider.dart';

void main() {
  group('HomeFeedData.fromJson', () {
    test('parses promo mode with promo cards', () {
      final data = HomeFeedData.fromJson({
        'mode': 'promo',
        'resolvedMode': 'promo',
        'promoCards': [
          {
            'title': 'A3 posters at ₱75',
            'body': 'This week only — same-day batch delivery.',
            'ctaLabel': 'Start printing',
            'ctaTarget': '/customer/order/category',
            'imageUrl': 'https://cdn.example.com/promo.png',
          },
          {
            'title': 'Image-led drop',
            'imageUrl': 'https://cdn.example.com/drop.png',
          },
        ],
        'feedItems': [],
      });

      expect(data.mode, HomeFeedMode.promo);
      expect(data.resolvedMode, HomeFeedResolvedMode.promo);
      expect(data.promoCards, hasLength(2));
      expect(data.promoCards.first.title, 'A3 posters at ₱75');
      expect(data.promoCards.first.hasCta, isTrue);
      expect(data.promoCards.last.body, isNull);
      expect(data.promoCards.last.imageUrl, isNotNull);
      expect(data.feedItems, isEmpty);
    });

    test('community resolution carries feed items through', () {
      final data = HomeFeedData.fromJson({
        'mode': 'auto',
        'resolvedMode': 'community',
        'promoCards': [],
        'feedItems': [
          {
            'id': 7,
            'user_name': 'Mark',
            'rating': 5,
            'feedback': 'Great quality!',
            'created_at': '2026-07-16T10:00:00.000Z',
          },
        ],
      });

      expect(data.mode, HomeFeedMode.auto);
      expect(data.resolvedMode, HomeFeedResolvedMode.community);
      expect(data.feedItems, hasLength(1));
      expect(data.feedItems.first.userName, 'Mark');
    });

    test('promo resolution without cards falls back safely', () {
      final data = HomeFeedData.fromJson({
        'mode': 'promo',
        'resolvedMode': 'promo',
        'promoCards': [],
        'feedItems': [],
      });

      expect(data.resolvedMode, HomeFeedResolvedMode.empty);
    });

    test('cards with blank titles are dropped', () {
      final data = HomeFeedData.fromJson({
        'mode': 'promo',
        'resolvedMode': 'promo',
        'promoCards': [
          {'title': '   ', 'body': 'Body'},
          {'title': 'Kept', 'body': 'Body'},
        ],
        'feedItems': [],
      });

      expect(data.promoCards, hasLength(1));
      expect(data.promoCards.single.title, 'Kept');
    });

    test('unknown enum strings fall back without throwing', () {
      final data = HomeFeedData.fromJson({
        'mode': 'seasonal',
        'resolvedMode': 'carousel-3d',
        'promoCards': [],
        'feedItems': [],
      });

      expect(data.mode, HomeFeedMode.auto);
      expect(data.resolvedMode, HomeFeedResolvedMode.empty);
    });

    test('cta requires both label and target', () {
      final promo = HomeFeedPromo.fromJson({
        'title': 'Title',
        'ctaLabel': 'Go',
      });
      expect(promo, isNotNull);
      expect(promo!.hasCta, isFalse);
      expect(promo.hasTapTarget, isFalse);
    });
  });
}
