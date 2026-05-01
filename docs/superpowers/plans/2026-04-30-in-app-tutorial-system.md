# In-App Tutorial System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GCash-style in-app tutorial system that shows first-time customers contextual coach marks and feature overlay cards, tracks seen state server-side + local cache, and gates the existing onboarding slides to first login only.

**Architecture:** A new `lib/features/tutorial/` module owns the `TutorialKey` enum, `TutorialRepository` (SharedPreferences + API sync), and `TutorialNotifier` (StateNotifier). Each tutorialized screen checks `tutorialSeenProvider(TutorialKey.X)` in `postFrameCallback` and shows a `FeatureOverlayCard` then a `CoachMarkSequence` if unseen. Server stores `tutorial_seen_keys text[]` on the `users` table; client always sends the full current set on each update.

**Tech Stack:** Flutter + Riverpod (StateNotifier), `tutorial_coach_mark: ^1.2.11`, SharedPreferences, NestJS/TypeORM (server), PostgreSQL migration.

---

## File Map

**New files — server:**
- `server/migrations/1777507200000-add-tutorial-seen-keys.ts`
- `server/src/users/dto/update-tutorial-keys.dto.ts`

**Modified files — server:**
- `server/src/users/entities/user.entity.ts` — add `tutorialSeenKeys` column
- `server/src/users/users.service.ts` — add `updateTutorialSeenKeys()`
- `server/src/users/users.controller.ts` — add `PATCH /users/me/tutorials`

**New files — Flutter:**
- `apps/mobile/lib/features/tutorial/models/tutorial_key.dart`
- `apps/mobile/lib/features/tutorial/repository/tutorial_repository.dart`
- `apps/mobile/lib/features/tutorial/providers/tutorial_provider.dart`
- `apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart`
- `apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart`
- `apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart`
- `apps/mobile/test/features/tutorial/tutorial_repository_test.dart`
- `apps/mobile/test/features/tutorial/feature_overlay_card_test.dart`
- `apps/mobile/test/features/tutorial/tutorial_bubble_test.dart`

**Modified files — Flutter:**
- `apps/mobile/pubspec.yaml` — add `tutorial_coach_mark`
- `apps/mobile/lib/features/auth/providers/auth_provider.dart` — add `tutorialSeenKeys` to `AuthUser`, update `_parseUser`, sync on login/autoLogin/register
- `apps/mobile/lib/config/routes/app_router.dart` — first-login gate for `/onboarding`
- `apps/mobile/lib/features/onboarding/screens/onboarding_screen.dart` — markSeen on exit
- `apps/mobile/lib/features/customer/home/screens/home_screen.dart` — home tutorial (wraps `_CreditsWidget` with KeyedSubtree)
- `apps/mobile/lib/features/customer/chat/widgets/floating_chat_button.dart` — accept optional GlobalKey
- `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart` — checkout tutorial
- `apps/mobile/lib/features/customer/order/widgets/checkout_segmented.dart` — expose GlobalKey for multi-drop tab
- `apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart` — expose GlobalKey
- `apps/mobile/lib/features/customer/tracking/screens/delivery_tracking_screen.dart` — tracking tutorial
- `apps/mobile/lib/features/customer/tracking/widgets/delivery_map.dart` — accept optional GlobalKey
- `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` — Reset Tutorials row

---

## Task 1: Server — migration

**Files:**
- Create: `server/migrations/1777507200000-add-tutorial-seen-keys.ts`

- [ ] **Write the migration file**

```typescript
// server/migrations/1777507200000-add-tutorial-seen-keys.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorialSeenKeys1777507200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS tutorial_seen_keys text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS tutorial_seen_keys
    `);
  }
}
```

- [ ] **Apply the migration**

```bash
cd server
npx typeorm migration:run -d src/data-source.ts
```

If `data-source.ts` doesn't exist, the app uses `synchronize: true` in non-production — restart the server instead:

```bash
docker compose restart server
```

Expected: no error, column exists on `users` table.

- [ ] **Verify column exists**

```bash
docker exec server-postgres-1 psql -U postgres -d grid_print -c "\d users" | grep tutorial
```

Expected: `tutorial_seen_keys | text[] | not null | default '{}'`

- [ ] **Commit**

```bash
git add server/migrations/1777507200000-add-tutorial-seen-keys.ts
git commit -m "feat(server): add tutorial_seen_keys column to users"
```

---

## Task 2: Server — entity + service + DTO

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/users/users.service.ts`
- Create: `server/src/users/dto/update-tutorial-keys.dto.ts`

- [ ] **Add column to User entity** — open `server/src/users/entities/user.entity.ts`, add after the `defaultPaymentMethod` column:

```typescript
  @Column({
    name: 'tutorial_seen_keys',
    type: 'text',
    array: true,
    default: [],
  })
  tutorialSeenKeys: string[];
```

- [ ] **Create the DTO** — create `server/src/users/dto/update-tutorial-keys.dto.ts`:

```typescript
import { IsArray, IsString } from 'class-validator';

export class UpdateTutorialKeysDto {
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}
```

- [ ] **Add service method** — open `server/src/users/users.service.ts`, add this method after `setDefaultPaymentMethod`:

```typescript
  async updateTutorialSeenKeys(userId: number, keys: string[]): Promise<void> {
    await this.usersRepo.update(userId, { tutorialSeenKeys: keys });
  }
```

- [ ] **Restart server and verify no TypeORM errors**

```bash
docker compose restart server && docker compose logs server --tail=20
```

Expected: server starts without column mismatch errors.

- [ ] **Commit**

```bash
git add server/src/users/entities/user.entity.ts \
        server/src/users/users.service.ts \
        server/src/users/dto/update-tutorial-keys.dto.ts
git commit -m "feat(server): tutorial_seen_keys entity column + service method + DTO"
```

---

## Task 3: Server — controller endpoint

**Files:**
- Modify: `server/src/users/users.controller.ts`

- [ ] **Add import and endpoint** — open `server/src/users/users.controller.ts`:

Add to imports at top:
```typescript
import { UpdateTutorialKeysDto } from './dto/update-tutorial-keys.dto';
```

Add method after `setDefaultPaymentMethod`:
```typescript
  @Patch('me/tutorials')
  async updateTutorialSeenKeys(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateTutorialKeysDto,
  ) {
    await this.usersService.updateTutorialSeenKeys(req.user.sub, dto.keys);
    return { ok: true };
  }
```

- [ ] **Verify endpoint responds** — make sure server is running, then:

```bash
curl -s -X PATCH http://localhost:3000/users/me/tutorials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat /tmp/test_token.txt 2>/dev/null || echo 'no-token')" \
  -d '{"keys":["onboarding"]}' | head -20
```

Expected with valid token: `{"ok":true}`. Expected without token: 401 Unauthorized. Both are correct responses.

- [ ] **Verify `GET /users/profile` returns `tutorialSeenKeys`**

The entity column is already returned since `getProfile` spreads the whole user (minus passwordHash). Confirm:

```bash
# After setting a key above, GET profile should include tutorialSeenKeys: ["onboarding"]
```

- [ ] **Commit**

```bash
git add server/src/users/users.controller.ts
git commit -m "feat(server): PATCH /users/me/tutorials endpoint"
```

---

## Task 4: Flutter — add `tutorial_coach_mark` package

**Files:**
- Modify: `apps/mobile/pubspec.yaml`

- [ ] **Add dependency**

Open `apps/mobile/pubspec.yaml`. Under the `# UI & Animation` section, add:
```yaml
  tutorial_coach_mark: ^1.2.11
```

- [ ] **Install**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter pub get
```

Expected: resolves without conflicts. If version conflict, use `any` and let pub choose.

- [ ] **Commit**

```bash
git add apps/mobile/pubspec.yaml apps/mobile/pubspec.lock
git commit -m "feat(mobile): add tutorial_coach_mark dependency"
```

---

## Task 5: Flutter — TutorialKey + TutorialRepository

**Files:**
- Create: `apps/mobile/lib/features/tutorial/models/tutorial_key.dart`
- Create: `apps/mobile/lib/features/tutorial/repository/tutorial_repository.dart`
- Create: `apps/mobile/test/features/tutorial/tutorial_repository_test.dart`

- [ ] **Write failing tests first** — create `apps/mobile/test/features/tutorial/tutorial_repository_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';

@GenerateMocks([])
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('TutorialRepository', () {
    test('loadLocal returns empty set when no prefs key', () async {
      final repo = TutorialRepository();
      final result = await repo.loadLocal();
      expect(result, isEmpty);
    });

    test('syncFromServer writes server keys to prefs', () async {
      final repo = TutorialRepository();
      await repo.syncFromServer(['onboarding', 'home']);
      final result = await repo.loadLocal();
      expect(result, containsAll([TutorialKey.onboarding, TutorialKey.home]));
    });

    test('markSeen adds key to existing set', () async {
      final repo = TutorialRepository();
      await repo.syncFromServer(['onboarding']);
      await repo.markSeen(TutorialKey.home, currentKeys: {TutorialKey.onboarding});
      final result = await repo.loadLocal();
      expect(result, containsAll([TutorialKey.onboarding, TutorialKey.home]));
    });

    test('resetAll clears all keys from prefs', () async {
      final repo = TutorialRepository();
      await repo.syncFromServer(['onboarding', 'home', 'checkout']);
      await repo.resetAll();
      final result = await repo.loadLocal();
      expect(result, isEmpty);
    });

    test('loadLocal ignores unknown key strings', () async {
      SharedPreferences.setMockInitialValues({
        'tutorial_seen_keys': '["onboarding","unknown_future_key"]',
      });
      final repo = TutorialRepository();
      final result = await repo.loadLocal();
      expect(result, contains(TutorialKey.onboarding));
      expect(result.length, 1); // unknown key silently dropped
    });
  });
}
```

- [ ] **Run tests — verify they fail**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_repository_test.dart
```

Expected: compilation error (files don't exist yet).

- [ ] **Create TutorialKey enum** — create `apps/mobile/lib/features/tutorial/models/tutorial_key.dart`:

```dart
enum TutorialKey {
  onboarding,
  home,
  checkout,
  tracking;

  static TutorialKey? fromString(String value) {
    for (final key in TutorialKey.values) {
      if (key.name == value) return key;
    }
    return null;
  }
}
```

- [ ] **Create TutorialRepository** — create `apps/mobile/lib/features/tutorial/repository/tutorial_repository.dart`:

```dart
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/shared/services/api_client.dart';

class TutorialRepository {
  static const _prefsKey = 'tutorial_seen_keys';

  Future<Set<TutorialKey>> loadLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return {};
    final list = (jsonDecode(raw) as List).cast<String>();
    return list
        .map(TutorialKey.fromString)
        .whereType<TutorialKey>()
        .toSet();
  }

  Future<void> syncFromServer(List<String> serverKeys) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(serverKeys));
  }

  // currentKeys = the full set already in provider state (to build complete list for server)
  Future<void> markSeen(TutorialKey key, {required Set<TutorialKey> currentKeys}) async {
    final updated = {...currentKeys, key};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(updated.map((k) => k.name).toList()));
    // Fire-and-forget — failure is acceptable (will resync on next login)
    _patchServer(updated.map((k) => k.name).toList());
  }

  Future<void> resetAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
    _patchServer([]);
  }

  void _patchServer(List<String> keys) {
    ApiClient.instance
        .patch('/users/me/tutorials', data: {'keys': keys})
        .catchError((_) {}); // fire-and-forget
  }
}
```

- [ ] **Run tests — verify they pass**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_repository_test.dart
```

Expected: all 5 tests pass.

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/tutorial/ \
        apps/mobile/test/features/tutorial/tutorial_repository_test.dart
git commit -m "feat(mobile): TutorialKey enum + TutorialRepository with tests"
```

---

## Task 6: Flutter — TutorialNotifier + tutorialProvider

**Files:**
- Create: `apps/mobile/lib/features/tutorial/providers/tutorial_provider.dart`

- [ ] **Create the provider file** — create `apps/mobile/lib/features/tutorial/providers/tutorial_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';

class TutorialNotifier extends StateNotifier<Set<TutorialKey>> {
  TutorialNotifier(this._repo) : super({});

  final TutorialRepository _repo;

  // Called after login/autoLogin — loads server-synced prefs into state
  Future<void> loadFromPrefs() async {
    final keys = await _repo.loadLocal();
    state = keys;
  }

  Future<void> markSeen(TutorialKey key) async {
    // Optimistic update
    state = {...state, key};
    await _repo.markSeen(key, currentKeys: state);
  }

  Future<void> resetAll() async {
    state = {};
    await _repo.resetAll();
  }
}

final _tutorialRepositoryProvider = Provider<TutorialRepository>(
  (_) => TutorialRepository(),
);

final tutorialProvider = StateNotifierProvider<TutorialNotifier, Set<TutorialKey>>(
  (ref) => TutorialNotifier(ref.read(_tutorialRepositoryProvider)),
);

// Per-screen: true = already seen (don't show), false = first time (show tutorial).
// State is populated by loadFromPrefs() during login/autoLogin before any
// customer screen is reached, so empty state == new user (show tutorials).
final tutorialSeenProvider = Provider.family<bool, TutorialKey>((ref, key) {
  return ref.watch(tutorialProvider).contains(key);
});
```

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/tutorial/providers/tutorial_provider.dart
git commit -m "feat(mobile): TutorialNotifier + tutorialProvider + tutorialSeenProvider"
```

---

## Task 7: Flutter — AuthUser + auth sync integration

**Files:**
- Modify: `apps/mobile/lib/features/auth/providers/auth_provider.dart`

- [ ] **Add `tutorialSeenKeys` to `AuthUser`** — in `auth_provider.dart`, find the `AuthUser` class constructor and add the field:

```dart
// Add to AuthUser constructor params:
this.tutorialSeenKeys = const [],

// Add to AuthUser fields:
final List<String> tutorialSeenKeys;
```

Add to `copyWith`:
```dart
List<String>? tutorialSeenKeys,
// ...
tutorialSeenKeys: tutorialSeenKeys ?? this.tutorialSeenKeys,
```

- [ ] **Update `_parseUser`** — in `_parseUser`, add before the closing `)`:

```dart
tutorialSeenKeys: _parseStringList(json['tutorialSeenKeys']),
```

- [ ] **Sync tutorial state after login** — in `AuthNotifier.login()`, after `state = AuthState(...)` is set and before the `catch` block:

```dart
// Sync server keys into local prefs, then load into provider state
await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
```

Add the same two lines to `tryAutoLogin()` and `register()` after their respective `state = AuthState(...)` assignments.

Add the import at top of file:
```dart
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';
```

- [ ] **Clear tutorial state on logout** — in `logout()`, after `_ref?.read(accountStateProvider.notifier).clear();` add:

```dart
_ref?.read(tutorialProvider.notifier).resetStateOnly();
```

Add `resetStateOnly()` to `TutorialNotifier` in `tutorial_provider.dart`:
```dart
// Clears in-memory state only — no API call. Used on logout.
void resetStateOnly() => state = {};
```

- [ ] **Build and check for errors**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -20
```

Expected: builds clean.

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/auth/providers/auth_provider.dart \
        apps/mobile/lib/features/tutorial/providers/tutorial_provider.dart
git commit -m "feat(mobile): sync tutorial seen-keys from server on login/autoLogin/register"
```

---

## Task 8: Flutter — FeatureOverlayCard widget

**Files:**
- Create: `apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart`
- Create: `apps/mobile/test/features/tutorial/feature_overlay_card_test.dart`

- [ ] **Write failing tests** — create `apps/mobile/test/features/tutorial/feature_overlay_card_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';
import 'package:hugeicons/hugeicons.dart';

void main() {
  group('FeatureOverlayCard', () {
    testWidgets('renders title, body, and icon tiles', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'Welcome to GRID',
            body: 'Your prints, delivered.',
            iconTiles: const [
              FeatureIconTile(icon: HugeIcons.strokeRoundedPrinter01, label: 'Order'),
              FeatureIconTile(icon: HugeIcons.strokeRoundedMapsLocation01, label: 'Track'),
              FeatureIconTile(icon: HugeIcons.strokeRoundedMessage01, label: 'Chat'),
            ],
            ctaLabel: 'Show me around',
            onCta: () {},
            onSkip: () {},
          ),
        ),
      ));
      expect(find.text('Welcome to GRID'), findsOneWidget);
      expect(find.text('Your prints, delivered.'), findsOneWidget);
      expect(find.text('Order'), findsOneWidget);
      expect(find.text('Track'), findsOneWidget);
      expect(find.text('Chat'), findsOneWidget);
      expect(find.text('Show me around'), findsOneWidget);
    });

    testWidgets('calls onCta when CTA button tapped', (tester) async {
      bool ctaTapped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'T', body: 'B',
            iconTiles: const [],
            ctaLabel: 'Got it',
            onCta: () => ctaTapped = true,
            onSkip: () {},
          ),
        ),
      ));
      await tester.tap(find.text('Got it'));
      expect(ctaTapped, isTrue);
    });

    testWidgets('calls onSkip when skip tapped', (tester) async {
      bool skipTapped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'T', body: 'B',
            iconTiles: const [],
            ctaLabel: 'Got it',
            onCta: () {},
            onSkip: () => skipTapped = true,
          ),
        ),
      ));
      await tester.tap(find.text('Skip for now'));
      expect(skipTapped, isTrue);
    });
  });
}
```

- [ ] **Run tests — verify they fail**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/feature_overlay_card_test.dart
```

Expected: compilation error.

- [ ] **Create the widget** — create `apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class FeatureIconTile {
  const FeatureIconTile({required this.icon, required this.label});
  final IconData icon;
  final String label;
}

class FeatureOverlayCard extends StatelessWidget {
  const FeatureOverlayCard({
    super.key,
    required this.title,
    required this.body,
    required this.iconTiles,
    required this.ctaLabel,
    required this.onCta,
    required this.onSkip,
    this.tipLine,
  });

  final String title;
  final String body;
  final List<FeatureIconTile> iconTiles;
  final String ctaLabel;
  final VoidCallback onCta;
  final VoidCallback onSkip;
  final String? tipLine;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl, AppSpacing.md, AppSpacing.xl, AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: colors.outline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Header row
          Row(
            children: [
              Expanded(
                child: Text(title,
                  style: AppTypography.h2.copyWith(color: colors.onBackground)),
              ),
            ],
          ),

          if (body.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(body,
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim)),
          ],

          if (iconTiles.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: iconTiles.map((tile) => Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        color: colors.brand.withValues(alpha: 0.10),
                        borderRadius: AppRadius.borderMd,
                      ),
                      child: Center(
                        child: HugeIcon(
                          icon: tile.icon,
                          color: colors.brand,
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(tile.label,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )).toList(),
            ),
          ],

          if (tipLine != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: 10),
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.10),
                borderRadius: AppRadius.borderMd,
              ),
              child: Text(tipLine!,
                style: AppTypography.caption.copyWith(
                  color: colors.onBackground, fontSize: 12)),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          // CTA button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: onCta,
              style: ElevatedButton.styleFrom(
                backgroundColor: colors.brand,
                foregroundColor: colors.background,
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.borderMd,
                ),
                elevation: 0,
              ),
              child: Text(ctaLabel, style: AppTypography.button),
            ),
          ),

          const SizedBox(height: AppSpacing.sm),

          // Skip
          Center(
            child: TextButton(
              onPressed: onSkip,
              child: Text('Skip for now',
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim)),
            ),
          ),
        ],
      ),
    ).animate().slideY(begin: 0.08, duration: 350.ms, curve: Curves.easeOut)
     .fadeIn(duration: 350.ms);
  }
}
```

- [ ] **Run tests — verify they pass**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/feature_overlay_card_test.dart
```

Expected: all 3 tests pass.

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart \
        apps/mobile/test/features/tutorial/feature_overlay_card_test.dart
git commit -m "feat(mobile): FeatureOverlayCard widget with tests"
```

---

## Task 9: Flutter — TutorialBubble + CoachMarkSequence

**Files:**
- Create: `apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart`
- Create: `apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart`
- Create: `apps/mobile/test/features/tutorial/tutorial_bubble_test.dart`

- [ ] **Write failing tests** — create `apps/mobile/test/features/tutorial/tutorial_bubble_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/widgets/tutorial_bubble.dart';

void main() {
  group('TutorialBubble', () {
    testWidgets('shows Next on non-final step', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'GRID Credits',
            body: 'Pay without GCash.',
            step: 1,
            totalSteps: 2,
            onNext: () {},
            onSkip: () {},
          ),
        ),
      ));
      expect(find.text('Next →'), findsOneWidget);
      expect(find.text('Done ✓'), findsNothing);
      expect(find.text('1 of 2'), findsOneWidget);
    });

    testWidgets('shows Done on final step', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedMessage01,
            title: 'GridBot',
            body: 'Ask anything.',
            step: 2,
            totalSteps: 2,
            onNext: () {},
            onSkip: () {},
          ),
        ),
      ));
      expect(find.text('Done ✓'), findsOneWidget);
      expect(find.text('Next →'), findsNothing);
    });

    testWidgets('fires onNext when Next tapped', (tester) async {
      bool nextFired = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'T', body: 'B',
            step: 1, totalSteps: 3,
            onNext: () => nextFired = true,
            onSkip: () {},
          ),
        ),
      ));
      await tester.tap(find.text('Next →'));
      expect(nextFired, isTrue);
    });
  });
}
```

- [ ] **Run tests — verify they fail**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_bubble_test.dart
```

Expected: compilation error.

- [ ] **Create TutorialBubble** — create `apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class TutorialBubble extends StatelessWidget {
  const TutorialBubble({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.step,
    required this.totalSteps,
    required this.onNext,
    required this.onSkip,
  });

  final IconData icon;
  final String title;
  final String body;
  final int step;
  final int totalSteps;
  final VoidCallback onNext;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final isFinal = step == totalSteps;
    final width = MediaQuery.of(context).size.width * 0.85;

    return Container(
      width: width,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon + title row
          Row(
            children: [
              HugeIcon(icon: icon, color: colors.brand, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(title,
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  )),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Body text
          Text(body,
            style: AppTypography.body.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 13,
              height: 1.4,
            )),
          const SizedBox(height: AppSpacing.md),

          // Footer row: step counter + skip + next/done
          Row(
            children: [
              Text('$step of $totalSteps',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim)),
              const Spacer(),
              TextButton(
                onPressed: onSkip,
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text('Skip',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim)),
              ),
              const SizedBox(width: AppSpacing.sm),
              TextButton(
                onPressed: onNext,
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  isFinal ? 'Done ✓' : 'Next →',
                  style: AppTypography.caption.copyWith(
                    color: colors.brand,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Create CoachMarkSequence helper** — create `apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:printing_app/features/tutorial/widgets/tutorial_bubble.dart';

class TutorialStep {
  const TutorialStep({
    required this.targetKey,
    required this.icon,
    required this.title,
    required this.body,
    this.shape = ShapeLightFocus.RRect,
  });

  final GlobalKey targetKey;
  final IconData icon;
  final String title;
  final String body;
  final ShapeLightFocus shape;
}

void showCoachMark(
  BuildContext context,
  List<TutorialStep> steps,
  VoidCallback onFinish,
) {
  final targets = steps.asMap().entries.map((entry) {
    final i = entry.key;
    final step = entry.value;

    return TargetFocus(
      identify: step.title,
      keyTarget: step.targetKey,
      shape: step.shape,
      radius: 8,
      paddingFocus: 8,
      enableOverlayTab: false,
      contents: [
        TargetContent(
          align: ContentAlign.bottom,
          builder: (context, controller) => TutorialBubble(
            icon: step.icon,
            title: step.title,
            body: step.body,
            step: i + 1,
            totalSteps: steps.length,
            onNext: controller.next,
            onSkip: controller.skip,
          ),
        ),
      ],
    );
  }).toList();

  TutorialCoachMark(
    targets: targets,
    colorShadow: Colors.black,
    opacityShadow: 0.75,
    onFinish: onFinish,
    onSkip: () {
      onFinish();
      return true;
    },
  ).show(context: context);
}
```

- [ ] **Run tests — verify they pass**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_bubble_test.dart
```

Expected: all 3 tests pass.

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart \
        apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart \
        apps/mobile/test/features/tutorial/tutorial_bubble_test.dart
git commit -m "feat(mobile): TutorialBubble + CoachMarkSequence with tests"
```

---

## Task 10: Flutter — OnboardingScreen first-login gate

**Files:**
- Modify: `apps/mobile/lib/config/routes/app_router.dart`
- Modify: `apps/mobile/lib/features/onboarding/screens/onboarding_screen.dart`

- [ ] **Update router redirect** — in `app_router.dart`, find the block:

```dart
// Authenticated users on auth pages go through onboarding first
if (isAuth && isOnAuth) {
  return '/onboarding';
}
```

Replace with:

```dart
// Authenticated users on auth pages: only show onboarding on first login
if (isAuth && isOnAuth) {
  final seenOnboarding = ref.read(tutorialSeenProvider(TutorialKey.onboarding));
  if (seenOnboarding) {
    final role = ref.read(authProvider).user?.role ?? 'customer';
    return switch (role) {
      'driver' => '/driver/deliveries',
      'admin' => '/admin/dashboard',
      _ => '/customer/home',
    };
  }
  return '/onboarding';
}
```

Add imports at top of `app_router.dart`:
```dart
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
```

- [ ] **Mark onboarding seen on exit** — in `onboarding_screen.dart`, find `_goToHome()`:

```dart
void _goToHome() {
  final role = ref.read(authProvider).user?.role ?? 'customer';
```

Add before the switch statement:
```dart
void _goToHome() {
  // Mark first-time onboarding as seen so it doesn't show on next login
  ref.read(tutorialProvider.notifier).markSeen(TutorialKey.onboarding);
  final role = ref.read(authProvider).user?.role ?? 'customer';
```

Add import at top of `onboarding_screen.dart`:
```dart
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
```

- [ ] **Build and verify no errors**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

Expected: builds clean.

- [ ] **Commit**

```bash
git add apps/mobile/lib/config/routes/app_router.dart \
        apps/mobile/lib/features/onboarding/screens/onboarding_screen.dart
git commit -m "feat(mobile): gate OnboardingScreen to first login only via TutorialKey.onboarding"
```

---

## Task 11: Flutter — Home screen tutorial

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`
- Modify: `apps/mobile/lib/features/customer/chat/widgets/floating_chat_button.dart`

- [ ] **Add GlobalKey prop to FloatingChatButton** — in `floating_chat_button.dart`, add `tutorialKey` param:

```dart
class FloatingChatButton extends StatelessWidget {
  const FloatingChatButton({
    super.key,
    this.unreadCount = 0,
    this.orderId,
    this.tutorialKey,  // ADD THIS
  });
  final int unreadCount;
  final int? orderId;
  final GlobalKey? tutorialKey;  // ADD THIS
```

In `build()`, wrap the outermost returned widget with a `KeyedSubtree` if `tutorialKey` is provided — or simpler, just assign the key to the Material widget:

```dart
  @override
  Widget build(BuildContext context) {
    // ...
    final button = Material(
      key: tutorialKey,  // ADD key param here
      color: colors.accent,
```

- [ ] **Integrate home tutorial** — in `home_screen.dart`:

Add at the top of `_HomeScreenState`:
```dart
  final _creditsTutorialKey = GlobalKey();
  final _chatFabTutorialKey = GlobalKey();
```

Add imports:
```dart
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
```

In `initState()`, after the existing `addPostFrameCallback` block, add a second one:
```dart
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _maybeShowHomeTutorial();
    });
```

Add the method:
```dart
  void _maybeShowHomeTutorial() {
    if (!mounted) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.home));
    if (seen) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FeatureOverlayCard(
        title: 'Welcome to GRID',
        body: 'Your prints, delivered.',
        iconTiles: const [
          FeatureIconTile(
            icon: HugeIcons.strokeRoundedPrinter01,
            label: 'Order',
          ),
          FeatureIconTile(
            icon: HugeIcons.strokeRoundedMapsLocation01,
            label: 'Track',
          ),
          FeatureIconTile(
            icon: HugeIcons.strokeRoundedMessage01,
            label: 'Chat',
          ),
        ],
        ctaLabel: 'Show me around',
        onCta: () {
          Navigator.of(context).pop();
          _startHomeCoachMarks();
        },
        onSkip: () {
          Navigator.of(context).pop();
          ref.read(tutorialProvider.notifier).markSeen(TutorialKey.home);
        },
      ),
    );
  }

  void _startHomeCoachMarks() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _creditsTutorialKey,
          icon: HugeIcons.strokeRoundedCoins01,
          title: 'GRID Credits',
          body: 'Top up your balance and pay at checkout — no GCash OTP or app-switching needed.',
        ),
        TutorialStep(
          targetKey: _chatFabTutorialKey,
          icon: HugeIcons.strokeRoundedMessage01,
          title: 'Meet GridBot',
          body: 'Ask anything — order specs, pricing, delivery status. Available 24/7.',
          shape: ShapeLightFocus.Circle,
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.home),
    );
  }
```

In the `build()` method, find `_CreditsWidget(colors: colors, credits: credits)` and wrap it:
```dart
KeyedSubtree(
  key: _creditsTutorialKey,
  child: _CreditsWidget(colors: colors, credits: credits),
),
```

Find `FloatingChatButton(` usage in the Stack and add the key:
```dart
FloatingChatButton(
  unreadCount: ref.watch(chatProvider).totalUnread,
  tutorialKey: _chatFabTutorialKey,
),
```

- [ ] **Build and verify**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/customer/home/screens/home_screen.dart \
        apps/mobile/lib/features/customer/chat/widgets/floating_chat_button.dart
git commit -m "feat(mobile): home screen tutorial — welcome overlay + Credits + GridBot coach marks"
```

---

## Task 12: Flutter — Checkout screen tutorial

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_delivery_card.dart`
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_payment_card.dart`

- [ ] **Add GlobalKey props to checkout widgets**

In `checkout_delivery_card.dart`, find the top-level `CheckoutDeliveryCard` widget and add a `segmentedKey` param:
```dart
class CheckoutDeliveryCard extends ConsumerWidget {
  const CheckoutDeliveryCard({super.key, this.segmentedKey});
  final GlobalKey? segmentedKey;
```

Pass it down to `CheckoutSegmented`:
```dart
CheckoutSegmented(tutorialKey: segmentedKey),
```

In `checkout_segmented.dart` (the segmented selector widget), add `tutorialKey` prop and wrap the container:
```dart
class CheckoutSegmented extends ConsumerWidget {
  const CheckoutSegmented({super.key, this.tutorialKey});
  final GlobalKey? tutorialKey;
```

Wrap the outermost container in build with `KeyedSubtree(key: tutorialKey, child: ...)`.

In `checkout_payment_card.dart`, add `tutorialKey` param and apply it to the outermost `InkWell` or container widget:
```dart
class CheckoutPaymentCard extends ConsumerWidget {
  const CheckoutPaymentCard({super.key, this.tutorialKey});
  final GlobalKey? tutorialKey;
```

Wrap the outermost widget: `KeyedSubtree(key: tutorialKey, child: ...)`.

- [ ] **Convert CheckoutScreen to StatefulWidget and add tutorial** — `checkout_screen.dart` currently uses `ConsumerWidget`. Convert to `ConsumerStatefulWidget`:

```dart
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _multiDropKey = GlobalKey();
  final _paymentKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowCheckoutTutorial());
  }

  void _maybeShowCheckoutTutorial() {
    if (!mounted) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.checkout));
    if (seen) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FeatureOverlayCard(
        title: 'Before you checkout',
        body: '',
        iconTiles: const [
          FeatureIconTile(
            icon: HugeIcons.strokeRoundedFile02,
            label: 'Items',
          ),
          FeatureIconTile(
            icon: HugeIcons.strokeRoundedMapsLocation01,
            label: 'Delivery',
          ),
          FeatureIconTile(
            icon: HugeIcons.strokeRoundedCreditCard,
            label: 'Payment',
          ),
        ],
        ctaLabel: 'Got it',
        tipLine: '💡 Use Multi-drop to send prints to different addresses in one order.',
        onCta: () {
          Navigator.of(context).pop();
          _startCheckoutCoachMarks();
        },
        onSkip: () {
          Navigator.of(context).pop();
          ref.read(tutorialProvider.notifier).markSeen(TutorialKey.checkout);
        },
      ),
    );
  }

  void _startCheckoutCoachMarks() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _multiDropKey,
          icon: HugeIcons.strokeRoundedRoute01,
          title: 'Multi-drop Delivery',
          body: 'Assign each file to a different address. One rider handles all the stops.',
        ),
        TutorialStep(
          targetKey: _paymentKey,
          icon: HugeIcons.strokeRoundedCoins01,
          title: 'Pay with GRID Credits',
          body: 'No OTP, no app-switching. Top up anytime in Profile → Wallet.',
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.checkout),
    );
  }

  @override
  Widget build(BuildContext context) {
    // ... existing build body unchanged, except:
    // Pass keys to child widgets:
    // CheckoutDeliveryCard(segmentedKey: _multiDropKey)
    // CheckoutPaymentCard(tutorialKey: _paymentKey)
  }
}
```

Add missing imports at top:
```dart
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
```

- [ ] **Build and verify**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/customer/order/
git commit -m "feat(mobile): checkout tutorial — before-checkout overlay + multi-drop + credits coach marks"
```

---

## Task 13: Flutter — Tracking screen tutorial

**Files:**
- Modify: `apps/mobile/lib/features/customer/tracking/screens/delivery_tracking_screen.dart`
- Modify: `apps/mobile/lib/features/customer/tracking/widgets/delivery_map.dart`

- [ ] **Add GlobalKey prop to DeliveryMap** — in `delivery_map.dart`, add `tutorialKey` param:

```dart
class DeliveryMap extends StatelessWidget {
  const DeliveryMap({super.key, this.tutorialKey});
  final GlobalKey? tutorialKey;
```

Apply to the outermost `ClipRRect`:
```dart
ClipRRect(
  key: tutorialKey,
  // ... existing params
```

- [ ] **Convert DeliveryTrackingScreen to StatefulWidget and add tutorial** — in `delivery_tracking_screen.dart`:

```dart
class DeliveryTrackingScreen extends ConsumerStatefulWidget {
  const DeliveryTrackingScreen({super.key});

  @override
  ConsumerState<DeliveryTrackingScreen> createState() =>
      _DeliveryTrackingScreenState();
}

class _DeliveryTrackingScreenState extends ConsumerState<DeliveryTrackingScreen> {
  final _mapKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowTrackingTutorial());
  }

  void _maybeShowTrackingTutorial() {
    if (!mounted) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.tracking));
    if (seen) return;

    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _mapKey,
          icon: HugeIcons.strokeRoundedMapsLocation01,
          title: 'Live Driver Tracking',
          body: "Your rider's GPS updates in real time. The ETA badge top-right refreshes live.",
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.tracking),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Track Delivery',
          style: AppTypography.h3.copyWith(color: colors.onBackground)),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: DeliveryMap(tutorialKey: _mapKey),  // pass key
            ),
          ).animate()
            .fadeIn(duration: 400.ms, curve: Curves.easeOut)
            .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
            child: DriverInfoCard(),
          ).animate()
            .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
            .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
        ],
      ),
    );
  }
}
```

Add imports:
```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
```

- [ ] **Build and verify**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/customer/tracking/
git commit -m "feat(mobile): tracking screen tutorial — live map coach mark"
```

---

## Task 14: Flutter — Profile reset tutorials

**Files:**
- Modify: `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`

- [ ] **Add Reset Tutorials menu row** — in `profile_screen.dart`, find the PREFERENCES section. After the "Default Print Mode" row (and its divider), add:

```dart
const Divider(height: 1, color: Colors.transparent),  // existing divider
_MenuRow(
  icon: HugeIcons.strokeRoundedRepeat,
  label: 'Reset Tutorials',
  onTap: () => _confirmResetTutorials(context, ref),
),
```

Add the method to the widget's state or as a standalone function:
```dart
void _confirmResetTutorials(BuildContext context, WidgetRef ref) {
  showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Reset Tutorials'),
      content: const Text(
        'Feature guides will reappear next time you visit each screen.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            ref.read(tutorialProvider.notifier).resetAll();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tutorials reset — they'll show again on your next visit.')),
            );
          },
          child: Text(
            'Reset',
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppColors.dark.brand
                  : AppColors.light.brand,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );
}
```

Add imports:
```dart
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
```

- [ ] **Build and verify**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

- [ ] **Commit**

```bash
git add apps/mobile/lib/features/customer/profile/screens/profile_screen.dart
git commit -m "feat(mobile): Reset Tutorials option in Profile → Preferences"
```

---

## Task 15: Run all tests + final build

- [ ] **Run all tutorial tests**

```bash
cd apps/mobile
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/ -v
```

Expected: all tests pass (tutorial_repository_test, feature_overlay_card_test, tutorial_bubble_test).

- [ ] **Run full test suite**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test --no-tree-shake-icons
```

Expected: no regressions in existing tests.

- [ ] **Final release build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
```

Expected: clean build, no warnings.

- [ ] **Commit**

```bash
git add .
git commit -m "feat(mobile): in-app tutorial system — coach marks, overlays, first-login gate, profile reset"
```
