import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/home/providers/daily_grid_provider.dart';
import 'package:printing_app/features/customer/home/widgets/daily_grid_section.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

void main() {
  test('invalidating dailyGridProvider causes it to rebuild', () async {
    final container = ProviderContainer(
      overrides: [
        dailyGridProvider.overrideWith((ref) async => <DailyGridItem>[]),
      ],
    );
    addTearDown(container.dispose);

    // Hold a listener to keep the autoDispose provider alive through invalidation
    container.listen(dailyGridProvider, (previous, next) {});

    // Build the provider
    await container.read(dailyGridProvider.future);
    expect(container.read(dailyGridProvider).value, isA<List<DailyGridItem>>());

    // Simulate _onDailyGridUpdated
    container.invalidate(dailyGridProvider);

    // Provider is now in loading state (kept alive by the listener above)
    final state = container.read(dailyGridProvider);
    expect(state.isLoading, true);
  });

  testWidgets('renders without overflow and treats card photos as decorative', (
    tester,
  ) async {
    WebSocketService.disableDailyGridSocketForTests = true;
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(393, 852);
    addTearDown(() {
      WebSocketService.disableDailyGridSocketForTests = false;
      tester.view.resetDevicePixelRatio();
      tester.view.resetPhysicalSize();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dailyGridProvider.overrideWith(
            (ref) async => const [
              DailyGridItem(
                id: 1,
                title: '3D Print',
                subtitle: 'From P120',
                imageUrl: 'https://example.test/decorative.jpg',
                category: '3d',
                sortOrder: 0,
              ),
            ],
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: DailyGridSection())),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);

    final image = find.byType(CachedNetworkImage);
    expect(image, findsWidgets);
    expect(
      find.ancestor(of: image, matching: find.byType(ExcludeSemantics)),
      findsWidgets,
    );
  });

  testWidgets('card opens the grouped catalog instead of a fresh legacy flow', (
    tester,
  ) async {
    WebSocketService.disableDailyGridSocketForTests = true;
    addTearDown(() {
      WebSocketService.disableDailyGridSocketForTests = false;
    });
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: DailyGridSection()),
        ),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: Text('Grouped catalog')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dailyGridProvider.overrideWith(
            (ref) async => const [
              DailyGridItem(
                id: 1,
                title: 'Paper shortcut',
                category: 'paper',
                sortOrder: 0,
              ),
            ],
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('Paper shortcut').first);
    await tester.pumpAndSettle();

    expect(find.text('Grouped catalog'), findsOneWidget);
  });
}
