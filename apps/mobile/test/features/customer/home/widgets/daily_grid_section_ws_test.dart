import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/providers/daily_grid_provider.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';

void main() {
  test('invalidating dailyGridProvider causes it to rebuild', () async {
    final container = ProviderContainer(
      overrides: [
        dailyGridProvider.overrideWith(
          (ref) async => <DailyGridItem>[],
        ),
      ],
    );
    addTearDown(container.dispose);

    // Hold a listener to keep the autoDispose provider alive through invalidation
    container.listen(dailyGridProvider, (_, __) {});

    // Build the provider
    await container.read(dailyGridProvider.future);
    expect(
      container.read(dailyGridProvider).value,
      isA<List<DailyGridItem>>(),
    );

    // Simulate _onDailyGridUpdated
    container.invalidate(dailyGridProvider);

    // Provider is now in loading state (kept alive by the listener above)
    final state = container.read(dailyGridProvider);
    expect(state.isLoading, true);
  });
}
