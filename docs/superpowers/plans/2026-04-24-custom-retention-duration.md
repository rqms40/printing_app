# Custom Retention Duration Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 3-option retention dropdown with preset ChoiceChips plus a free-form number field with a Days/Weeks unit toggle.

**Architecture:** Server DTO swaps `@IsIn([null,1,7,30])` for `@IsOptional()` + `@IsInt()` + `@Min(1)`, accepting any positive integer. Mobile deletes `_PeriodDropdown` and adds `_Unit`, `_PresetChips`, `_CustomDurationInput`, and `_UnitToggle` inside the existing `storage_settings_screen.dart`. No schema migration required.

**Tech Stack:** NestJS + class-validator; Flutter + Riverpod + Material ChoiceChip

---

## File Structure

**Modify:**
- `server/src/users/dto/update-storage-settings.dto.ts` — loosen validation
- `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart` — replace `_PeriodDropdown` with new widgets

**Create:**
- `server/src/users/dto/update-storage-settings.dto.spec.ts` — DTO validation unit tests
- `apps/mobile/test/features/customer/profile/screens/storage_settings_screen_test.dart` — widget tests

---

### Task 1: Server — loosen DTO validation

**Files:**
- Create: `server/src/users/dto/update-storage-settings.dto.spec.ts`
- Modify: `server/src/users/dto/update-storage-settings.dto.ts`

- [ ] **Step 1: Write the failing DTO tests**

Create `server/src/users/dto/update-storage-settings.dto.spec.ts`:

```typescript
import { validate } from 'class-validator';
import { UpdateStorageSettingsDto } from './update-storage-settings.dto';

async function check(value: unknown) {
  const dto = Object.assign(new UpdateStorageSettingsDto(), {
    fileRetentionDays: value,
  });
  return validate(dto);
}

describe('UpdateStorageSettingsDto', () => {
  it('accepts null (disables retention)', async () => {
    expect(await check(null)).toHaveLength(0);
  });

  it('accepts 1', async () => {
    expect(await check(1)).toHaveLength(0);
  });

  it('accepts 7', async () => {
    expect(await check(7)).toHaveLength(0);
  });

  it('accepts 30', async () => {
    expect(await check(30)).toHaveLength(0);
  });

  it('accepts 45 (arbitrary custom value)', async () => {
    expect(await check(45)).toHaveLength(0);
  });

  it('accepts 365', async () => {
    expect(await check(365)).toHaveLength(0);
  });

  it('rejects 0', async () => {
    expect((await check(0)).length).toBeGreaterThan(0);
  });

  it('rejects -1', async () => {
    expect((await check(-1)).length).toBeGreaterThan(0);
  });

  it('rejects 1.5 (non-integer)', async () => {
    expect((await check(1.5)).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd server && npm test -- --testPathPattern=update-storage-settings.dto.spec --no-coverage
```

Expected: `accepts 45` and `accepts 365` fail — "fileRetentionDays must be one of the following values: null, 1, 7, 30".

- [ ] **Step 3: Replace the DTO implementation**

Replace the entire contents of `server/src/users/dto/update-storage-settings.dto.ts`:

```typescript
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorageSettingsDto {
  @ApiPropertyOptional({ nullable: true, example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  fileRetentionDays: number | null;
}
```

- [ ] **Step 4: Run the DTO tests to confirm they pass**

```bash
cd server && npm test -- --testPathPattern=update-storage-settings.dto.spec --no-coverage
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Run the full server test suite**

```bash
cd server && npm test --no-coverage
```

Expected: all tests pass with no regressions.

- [ ] **Step 6: Commit**

```bash
git add server/src/users/dto/update-storage-settings.dto.ts \
        server/src/users/dto/update-storage-settings.dto.spec.ts
git commit -m "feat: accept any positive integer for fileRetentionDays"
```

---

### Task 2: Mobile — preset chips + custom duration input

**Files:**
- Create: `apps/mobile/test/features/customer/profile/screens/storage_settings_screen_test.dart`
- Modify: `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart`

- [ ] **Step 1: Write failing widget tests**

Create `apps/mobile/test/features/customer/profile/screens/storage_settings_screen_test.dart`:

```dart
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
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test \
  test/features/customer/profile/screens/storage_settings_screen_test.dart
```

Expected: FAIL — `ChoiceChip` and custom input widgets not yet in the screen.

- [ ] **Step 3: Delete `_PeriodDropdown` from the screen**

In `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart`, delete the entire `_PeriodDropdown` class (lines 207–257 — the `static const _options` block and its `build` method).

- [ ] **Step 4: Replace the period picker section in `_buildBody`**

In `_buildBody`, find the `if (isEnabled) ...[...]` block (lines 154–175) and replace it:

```dart
if (isEnabled) ...[
  Divider(color: colors.outline, height: 1),
  Padding(
    padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg, vertical: AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Delete after',
          style: AppTypography.body.copyWith(color: colors.onSurface),
        ),
        const SizedBox(height: AppSpacing.sm),
        _PresetChips(
          value: settings.fileRetentionDays!,
          colors: colors,
          onChanged: (days) =>
              ref.read(storageSettingsProvider.notifier).update(days),
        ),
        const SizedBox(height: AppSpacing.sm),
        _CustomDurationInput(
          value: settings.fileRetentionDays!,
          colors: colors,
          onChanged: (days) =>
              ref.read(storageSettingsProvider.notifier).update(days),
        ),
      ],
    ),
  ),
],
```

- [ ] **Step 5: Add the new widget classes at the bottom of the file**

Append the following after the closing `}` of `StorageSettingsScreen`:

```dart
enum _Unit { days, weeks }

// ─── Preset chips ────────────────────────────────────────────────────────────

class _PresetChips extends StatelessWidget {
  const _PresetChips({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final int value;
  final AppColorSet colors;
  final ValueChanged<int> onChanged;

  static const _presets = [(1, '1 day'), (7, '7 days'), (30, '30 days')];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: _presets.map((p) {
        final selected = value == p.$1;
        return ChoiceChip(
          label: Text(p.$2),
          selected: selected,
          selectedColor: colors.accent.withValues(alpha: 0.15),
          labelStyle: AppTypography.caption.copyWith(
            color: selected ? colors.accent : colors.onSurfaceDim,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
          side: BorderSide(color: selected ? colors.accent : colors.outline),
          backgroundColor: Colors.transparent,
          onSelected: (_) => onChanged(p.$1),
        );
      }).toList(),
    );
  }
}

// ─── Custom duration input ────────────────────────────────────────────────────

class _CustomDurationInput extends StatefulWidget {
  const _CustomDurationInput({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final int value;
  final AppColorSet colors;
  final ValueChanged<int> onChanged;

  @override
  State<_CustomDurationInput> createState() => _CustomDurationInputState();
}

class _CustomDurationInputState extends State<_CustomDurationInput> {
  late final TextEditingController _ctrl;
  _Unit _unit = _Unit.days;
  String? _error;

  static const _presets = {1, 7, 30};

  @override
  void initState() {
    super.initState();
    final isPreset = _presets.contains(widget.value);
    _ctrl = TextEditingController(text: isPreset ? '' : '${widget.value}');
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final raw = int.tryParse(_ctrl.text.trim());
    if (raw == null || raw < 1) {
      setState(() => _error = 'Enter a number from 1 to 999');
      return;
    }
    final days = _unit == _Unit.weeks ? raw * 7 : raw;
    if (days > 999) {
      setState(() => _error = 'Maximum is 999 days (142 weeks)');
      return;
    }
    setState(() => _error = null);
    widget.onChanged(days);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            SizedBox(
              width: 80,
              child: TextField(
                controller: _ctrl,
                keyboardType: TextInputType.number,
                maxLength: 3,
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'e.g. 45',
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  border: OutlineInputBorder(
                      borderRadius: AppRadius.borderSm),
                ),
                onSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(width: 8),
            _UnitToggle(
              value: _unit,
              colors: widget.colors,
              onChanged: (u) => setState(() => _unit = u),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: _submit,
              icon: Icon(Icons.check_rounded, color: widget.colors.accent),
              tooltip: 'Save',
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              _error!,
              style: AppTypography.caption
                  .copyWith(color: Colors.red.shade600),
            ),
          ),
      ],
    );
  }
}

// ─── Unit toggle (Days / Weeks) ───────────────────────────────────────────────

class _UnitToggle extends StatelessWidget {
  const _UnitToggle({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final _Unit value;
  final AppColorSet colors;
  final ValueChanged<_Unit> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: colors.outline),
        borderRadius: AppRadius.borderSm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _seg('Days', _Unit.days),
          Container(width: 1, height: 28, color: colors.outline),
          _seg('Weeks', _Unit.weeks),
        ],
      ),
    );
  }

  Widget _seg(String label, _Unit unit) {
    final selected = value == unit;
    return GestureDetector(
      onTap: () => onChanged(unit),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? colors.accent.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: unit == _Unit.days
              ? const BorderRadius.horizontal(
                  left: Radius.circular(AppRadius.sm))
              : const BorderRadius.horizontal(
                  right: Radius.circular(AppRadius.sm)),
        ),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            color: selected ? colors.accent : colors.onSurfaceDim,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 6: Run flutter analyze**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze
```

Expected: exit 0, no errors or warnings.

- [ ] **Step 7: Run the new widget tests**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test \
  test/features/customer/profile/screens/storage_settings_screen_test.dart
```

Expected: all 8 tests PASS.

- [ ] **Step 8: Run the full Flutter test suite**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: all tests pass with no regressions.

- [ ] **Step 9: Rebuild the mobile app**

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
```

Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart \
        apps/mobile/test/features/customer/profile/screens/storage_settings_screen_test.dart
git commit -m "feat: add preset chips and custom duration input for file retention"
```
