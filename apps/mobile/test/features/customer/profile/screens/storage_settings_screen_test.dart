import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';
import 'package:printing_app/features/customer/profile/providers/storage_settings_provider.dart';
import 'package:printing_app/features/customer/profile/screens/storage_settings_screen.dart';

import '../../../../helpers/test_setup.dart';

// Overrides fetch/update so tests never hit the network.
// lastUpdatedDays starts at -1 as a sentinel meaning "update never called".
class _FakeStorageNotifier extends StorageSettingsNotifier {
  final StorageSettings initial;
  int? lastUpdatedDays = -1;

  _FakeStorageNotifier(this.initial);

  @override
  Future<void> fetch() async {
    state = AsyncValue.data(initial);
  }

  @override
  Future<void> update(int? fileRetentionDays) async {
    lastUpdatedDays = fileRetentionDays;
    state = AsyncValue.data(StorageSettings(fileRetentionDays: fileRetentionDays));
  }
}

Widget _wrap(_FakeStorageNotifier notifier) {
  return ProviderScope(
    overrides: [
      storageSettingsProvider.overrideWith((_) => notifier),
    ],
    child: const MaterialApp(
      home: Scaffold(body: StorageSettingsScreen()),
    ),
  );
}

void main() {
  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.stubAudioPlayers();
    TestSetup.initApiClient();
  });

  group('StorageSettingsScreen — preset chips', () {
    testWidgets('highlights the 7-day chip when current value is 7', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 7),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      final chip7 = tester.widget<ChoiceChip>(
        find.ancestor(
          of: find.text('7 days'),
          matching: find.byType(ChoiceChip),
        ),
      );
      expect(chip7.selected, isTrue);
    });

    testWidgets('no chip selected when current value is 45 (custom)', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 45),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      final chips = tester.widgetList<ChoiceChip>(find.byType(ChoiceChip));
      expect(chips.every((c) => !c.selected), isTrue);
    });

    testWidgets('tapping 1-day chip calls update(1)', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 7),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      await tester.tap(find.text('1 day'));
      await tester.pump();

      expect(notifier.lastUpdatedDays, 1);
    });
  });

  group('StorageSettingsScreen — custom input', () {
    testWidgets('text field shows current value when it is not a preset', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 45),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      final tf = tester.widget<TextField>(find.byType(TextField));
      expect(tf.controller?.text, '45');
    });

    testWidgets('entering a days value and tapping confirm saves correctly', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 7),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      await tester.enterText(find.byType(TextField), '45');
      await tester.tap(find.byTooltip('Save'));
      await tester.pump();

      expect(notifier.lastUpdatedDays, 45);
    });

    testWidgets('switching to Weeks and entering 2 saves 14 days', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 7),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      await tester.tap(find.text('Weeks'));
      await tester.pump();
      await tester.enterText(find.byType(TextField), '2');
      await tester.tap(find.byTooltip('Save'));
      await tester.pump();

      expect(notifier.lastUpdatedDays, 14); // 2 × 7
    });

    testWidgets('entering 0 shows error and does not call update', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 7),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      await tester.enterText(find.byType(TextField), '0');
      await tester.tap(find.byTooltip('Save'));
      await tester.pump();

      expect(find.text('Enter a number from 1 to 999'), findsOneWidget);
      expect(notifier.lastUpdatedDays, -1); // sentinel — update never called
    });

    testWidgets('143 weeks shows error because 143×7=1001 exceeds 999', (tester) async {
      final notifier = _FakeStorageNotifier(
        const StorageSettings(fileRetentionDays: 7),
      );
      await tester.pumpWidget(_wrap(notifier));
      await tester.pump();

      await tester.tap(find.text('Weeks'));
      await tester.pump();
      await tester.enterText(find.byType(TextField), '143');
      await tester.tap(find.byTooltip('Save'));
      await tester.pump();

      expect(find.text('Maximum is 999 days (142 weeks)'), findsOneWidget);
      expect(notifier.lastUpdatedDays, -1);
    });
  });
}
