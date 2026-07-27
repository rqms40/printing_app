import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/customer/home/providers/home_feed_provider.dart';
import 'package:printing_app/features/customer/home/widgets/home_feed_tile.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

Widget _harness(HomeFeedData data, {double width = 200, double height = 260}) {
  return ProviderScope(
    overrides: [
      homeFeedProvider.overrideWith((ref) async => data),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: width,
            height: height,
            child: HomeFeedTile(colors: AppColors.dark),
          ),
        ),
      ),
    ),
  );
}

/// The tile shares a bento row, so its box varies with the device. These are
/// the extremes it has to survive: a small phone's narrow column and a short
/// row, up through a large phone.
const _tileSizes = <Size>[
  Size(140, 120),
  Size(150, 96),
  Size(200, 260),
  Size(260, 320),
];

void main() {
  setUpAll(() {
    WebSocketService.disableHomeFeedSocketForTests = true;
  });

  tearDownAll(() {
    WebSocketService.disableHomeFeedSocketForTests = false;
  });

  testWidgets('renders promo card with CTA when resolved to promo', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        HomeFeedData.fromJson({
          'mode': 'promo',
          'resolvedMode': 'promo',
          'promoCards': [
            {
              'title': 'A3 posters at ₱75',
              'body': 'This week only.',
              'ctaLabel': 'Start printing',
              'ctaTarget': '/customer/order/category',
            },
          ],
          'feedItems': [],
        }),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('A3 posters at ₱75'), findsOneWidget);
    expect(find.text('Start printing'), findsOneWidget);
    expect(find.text('FROM GRIDGO'), findsOneWidget);
    expect(find.text('News & offers.'), findsOneWidget);
  });

  testWidgets('renders multiple promo cards as a swipeable carousel', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        HomeFeedData.fromJson({
          'mode': 'promo',
          'resolvedMode': 'promo',
          'promoCards': [
            {'title': 'First campaign', 'body': 'One'},
            {'title': 'Second campaign', 'body': 'Two'},
          ],
          'feedItems': [],
        }),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byType(PageView), findsOneWidget);
    expect(find.text('First campaign'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(-200, 0));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Second campaign'), findsOneWidget);

    // Auto-advance keeps looping — dispose the tile so its periodic timer
    // is cancelled before the test ends.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('renders invite state when community feed is empty', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        HomeFeedData.fromJson({
          'mode': 'community',
          'resolvedMode': 'community',
          'promo': null,
          'feedItems': [],
        }),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No community feedback yet.'), findsOneWidget);
    expect(find.text('Reviews appear here after deliveries.'), findsNothing);
    expect(find.text('Community feedback.'), findsOneWidget);
  });

  testWidgets('renders community carousel when feed has items', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        HomeFeedData.fromJson({
          'mode': 'auto',
          'resolvedMode': 'community',
          'promo': null,
          'feedItems': [
            {
              'id': 1,
              'user_name': 'Mark',
              'rating': 5,
              'feedback': 'Great quality!',
              'created_at': '2026-07-16T10:00:00.000Z',
            },
          ],
        }),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Mark'), findsOneWidget);
    expect(find.text('"Great quality!"'), findsOneWidget);
  });

  testWidgets('renders quiet error state with retry', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeFeedProvider.overrideWith(
            (ref) => Future<HomeFeedData>.error(Exception('boom')),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 200,
                height: 260,
                child: HomeFeedTile(colors: AppColors.dark),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Couldn't load the feed."), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  group('lays out without overflowing at any tile size', () {
    final states = <String, HomeFeedData>{
      'empty': HomeFeedData.fromJson({
        'mode': 'community',
        'resolvedMode': 'community',
        'promo': null,
        'feedItems': [],
      }),
      'community': HomeFeedData.fromJson({
        'mode': 'auto',
        'resolvedMode': 'community',
        'promo': null,
        'feedItems': [
          {
            'id': 1,
            'user_name': 'Mark Villanueva',
            'rating': 5,
            'feedback':
                'Plans came back crisp and the rider found the site first try.',
            'created_at': '2026-07-27T10:00:00.000Z',
          },
        ],
      }),
    };

    for (final entry in states.entries) {
      for (final size in _tileSizes) {
        testWidgets(
          '${entry.key} at ${size.width.toInt()}x${size.height.toInt()}',
          (tester) async {
            await tester.pumpWidget(
              _harness(entry.value, width: size.width, height: size.height),
            );
            await tester.pumpAndSettle();

            // A RenderFlex overflow surfaces as a painting exception.
            expect(tester.takeException(), isNull);

            await tester.pumpWidget(const SizedBox());
          },
        );
      }
    }
  });
}
