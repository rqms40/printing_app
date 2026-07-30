import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/customer/home/providers/home_feed_provider.dart';
import 'package:printing_app/features/customer/home/widgets/home_feed_tile.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

Widget _harness(HomeFeedData data) {
  return ProviderScope(
    overrides: [
      homeFeedProvider.overrideWith((ref) async => data),
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
  );
}

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
    expect(find.text('Reviews appear here after deliveries.'), findsOneWidget);
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
}
