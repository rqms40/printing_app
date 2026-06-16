# Beta Mode Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin can toggle a global Beta Mode flag, manage which users are beta members, and each enrolled user automatically receives a one-time 100 GRIDGO credit grant; beta users see a floating indicator on the mobile home screen showing their enrollment rank.

**Architecture:** New `beta-mode` NestJS module (fully isolated — no circular deps) backed by a `BetaModeSettings` singleton entity and three new columns on `users`. Admin React app gains a dedicated `/beta-mode` Refine page. Mobile reads `GET /beta-mode/me` via a `FutureProvider` and renders a floating badge in the home screen `Stack`.

**Tech Stack:** NestJS + TypeORM (server) · React + Ant Design + Refine (admin) · Flutter + Riverpod (mobile)

---

## Subsystems

Three independent subsystems delivered in order:

1. **Server** — module, entities, migration, service, controller
2. **Admin UI** — `/beta-mode` Refine page
3. **Mobile** — model, provider, widget, home screen integration

---

## Section 1: Server

### New entity: `server/src/beta-mode/entities/beta-mode-settings.entity.ts`

Singleton table — same pattern as `TamSurveySettings`.

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('beta_mode_settings')
export class BetaModeSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'is_enabled', default: false })
  isEnabled: boolean;
}
```

### Modified: `server/src/users/entities/user.entity.ts`

Three new columns added after existing columns:

```typescript
@Column({ name: 'is_beta_user', default: false })
isBetaUser: boolean;

@Column({ name: 'beta_enrolled_at', type: 'timestamp', nullable: true })
betaEnrolledAt: Date | null;

@Column({ name: 'beta_credits_granted', default: false })
betaCreditsGranted: boolean;
```

### Migration

One TypeORM migration:
- Creates `beta_mode_settings` table with columns `id SERIAL PRIMARY KEY`, `is_enabled BOOLEAN DEFAULT false`
- Adds `is_beta_user BOOLEAN NOT NULL DEFAULT false` to `users`
- Adds `beta_enrolled_at TIMESTAMP NULL` to `users`
- Adds `beta_credits_granted BOOLEAN NOT NULL DEFAULT false` to `users`

### New: `server/src/beta-mode/dto/beta-mode.dto.ts`

```typescript
import { IsBoolean } from 'class-validator';

export class UpdateBetaModeSettingsDto {
  @IsBoolean()
  isEnabled: boolean;
}
```

### New: `server/src/beta-mode/beta-mode.service.ts`

Injects `BetaModeSettings` repo + `UsersService`.

Methods:

**`getSettings(): Promise<BetaModeSettings>`**
- `find()` → if empty, create `{ isEnabled: false }` and return
- Returns `settings[0]`

**`updateSettings(dto: UpdateBetaModeSettingsDto): Promise<BetaModeSettings>`**
- `getSettings()` → set `settings.isEnabled = dto.isEnabled` → save and return

**`getBetaUsers(): Promise<BetaUserDto[]>`**
- Find all users where `isBetaUser = true`, order by `betaEnrolledAt ASC`
- Return array with `rank` (1-indexed position in that ordered list), `id`, `email`, `fullName`, `betaEnrolledAt`, `betaCreditsGranted`

**`enrollUser(userId: number): Promise<void>`**
- Find user by id — throw `NotFoundException` if missing
- If `isBetaUser` already true, return without changes (idempotent)
- Set `isBetaUser = true`, `betaEnrolledAt = new Date()`
- If `!betaCreditsGranted`: add 100 to `user.credits`, set `betaCreditsGranted = true`
- Save user via `usersService.updateProfile(userId, { isBetaUser, betaEnrolledAt, betaCreditsGranted, credits })`

**`unenrollUser(userId: number): Promise<void>`**
- Find user — throw `NotFoundException` if missing
- Set `isBetaUser = false` (credits already granted are NOT revoked)
- Save via `usersService.updateProfile(userId, { isBetaUser: false })`

**`getBetaStatus(userId: number): Promise<BetaStatusDto>`**
- `getSettings()` → `globallyEnabled = settings.isEnabled`
- Find user by id
- If `!user.isBetaUser` → return `{ globallyEnabled, isBetaUser: false, rank: null }`
- Rank = COUNT of users where `isBetaUser = true AND betaEnrolledAt <= user.betaEnrolledAt`
- Return `{ globallyEnabled, isBetaUser: true, rank }`

### New: `server/src/beta-mode/beta-mode.controller.ts`

All admin endpoints require admin JWT. `GET /beta-mode/me` requires any authenticated JWT.

| Method | Path | Guard | Body/Response |
|--------|------|-------|---------------|
| `GET` | `/beta-mode/settings` | admin | `BetaModeSettings` |
| `PATCH` | `/beta-mode/settings` | admin | `UpdateBetaModeSettingsDto` → `BetaModeSettings` |
| `GET` | `/beta-mode/users` | admin | `BetaUserDto[]` |
| `POST` | `/beta-mode/users/:userId/enroll` | admin | `204 No Content` |
| `DELETE` | `/beta-mode/users/:userId/enroll` | admin | `204 No Content` |
| `GET` | `/beta-mode/me` | JWT (any role) | `BetaStatusDto` |

### New: `server/src/beta-mode/beta-mode.module.ts`

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([BetaModeSettings]), UsersModule],
  providers: [BetaModeService],
  controllers: [BetaModeController],
})
export class BetaModeModule {}
```

Add `BetaModeModule` to `AppModule` imports.

### Response DTOs

```typescript
// Returned by GET /beta-mode/users
export class BetaUserDto {
  rank: number;
  id: number;
  email: string;
  fullName: string | null;
  betaEnrolledAt: Date;
  betaCreditsGranted: boolean;
}

// Returned by GET /beta-mode/me
export class BetaStatusDto {
  globallyEnabled: boolean;
  isBetaUser: boolean;
  rank: number | null;
}
```

---

## Section 2: Admin UI

### New file: `admin/src/services/betaModeApi.ts`

Typed API functions (uses `apiClient` from `@/providers/api-client`, same pattern as `admin/src/pages/daily-grid/list.tsx`):

```typescript
getSettings(): Promise<BetaModeSettings>        // GET /beta-mode/settings
updateSettings(dto): Promise<BetaModeSettings>  // PATCH /beta-mode/settings
getBetaUsers(): Promise<BetaUserItem[]>         // GET /beta-mode/users
enrollUser(userId: number): Promise<void>       // POST /beta-mode/users/:id/enroll
unenrollUser(userId: number): Promise<void>     // DELETE /beta-mode/users/:id/enroll
```

### New file: `admin/src/pages/beta-mode/index.tsx`

Page structure (built using `frontend-design` skill — Ant Design components, matching existing admin aesthetic):

**Settings card** (top):
- Card with title "Global Beta Mode" + description "When disabled, beta indicators are hidden from all users even if enrolled"
- `Switch` bound to `settings.isEnabled` — onChange calls `updateSettings` with optimistic update + error rollback

**Beta Users section**:
- Section header: "Beta Users" + count badge (e.g. `12 enrolled`) + `"Enroll User"` primary button top-right
- `Table` columns:
  - `#` — rank number (1-indexed, from server response)
  - Email
  - Name
  - Enrolled Date — formatted `YYYY-MM-DD HH:mm`
  - Credits Granted — green Tag `"Granted"` if true, gray `"—"` if false
  - Actions — `Popconfirm` wrapping `Button` "Remove" (danger, calls `unenrollUser`)
- Table loads on mount, refetches after any enroll/unenroll

**Enroll User modal**:
- Opened by "Enroll User" button
- On modal open, loads all users via `GET /admin/users` (same endpoint as users page — returns full list)
- `Input.Search` field — filters loaded users client-side by email or name as the user types
- Results rendered as `List` with `List.Item` showing avatar initial, email, name — click to select
- Selected user shown in confirmation area with "Enroll + Grant 100 Credits" call-to-action
- Confirm calls `enrollUser(userId)` → closes modal → refetches beta users table

### Modified: `admin/src/App.tsx`

Add import:
```typescript
import { BetaModePage } from '@/pages/beta-mode';
```

Add to `resources` array:
```typescript
{
  name: 'beta-mode',
  list: '/beta-mode',
  meta: { label: 'Beta Mode', icon: <RocketOutlined /> },
},
```

Add to `<Routes>`:
```tsx
<Route path="/beta-mode" element={<BetaModePage />} />
```

---

## Section 3: Mobile

### New model: `apps/mobile/lib/features/customer/beta/models/beta_status.dart`

```dart
class BetaStatus {
  const BetaStatus({
    required this.globallyEnabled,
    required this.isBetaUser,
    this.rank,
  });

  final bool globallyEnabled;
  final bool isBetaUser;
  final int? rank;

  factory BetaStatus.fromJson(Map<String, dynamic> json) => BetaStatus(
        globallyEnabled: json['globallyEnabled'] as bool,
        isBetaUser: json['isBetaUser'] as bool,
        rank: json['rank'] as int?,
      );
}
```

### New provider: `apps/mobile/lib/features/customer/beta/providers/beta_status_provider.dart`

```dart
final betaStatusProvider = FutureProvider.autoDispose<BetaStatus?>((ref) async {
  try {
    final response = await ApiClient.instance.get('/beta-mode/me');
    return BetaStatus.fromJson(response.data as Map<String, dynamic>);
  } catch (_) {
    return null; // indicator silently hides on any error
  }
});
```

### New widget: `apps/mobile/lib/features/customer/beta/widgets/beta_indicator.dart`

- `BetaIndicator` is a `ConsumerWidget`
- Watches `betaStatusProvider`
- Returns `SizedBox.shrink()` when loading, error, null, or `!globallyEnabled || !isBetaUser`
- When visible: floating pill badge with:
  - "BETA" label in brand yellow (`AppColors.brand`)
  - Rank display: `#${rank}` (shown if rank != null)
  - Subtle shimmer/pulse animation using `flutter_animate` `shimmer` effect on 3-second loop
  - Dark background, rounded pill shape using `AppRadius`

### Modified: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`

Import `BetaIndicator` and wrap the home screen's `Scaffold` body in a `Stack`:

```dart
// In build():
body: Stack(
  children: [
    // existing SingleChildScrollView content
    _buildContent(),
    // beta overlay — positions itself top-right within safe area
    const Positioned(
      top: 0,
      right: AppSpacing.md,
      child: SafeArea(child: BetaIndicator()),
    ),
  ],
),
```

`BetaIndicator` handles its own visibility — no conditional logic needed in `HomeScreen`.

**No changes to `websocket_service.dart`** — beta status is plain HTTP REST, not WebSocket.

---

## Data Flow

```
Admin toggles Beta Mode ON (PATCH /beta-mode/settings)
  ↓
BetaModeSettings.isEnabled = true saved to DB

Admin enrolls user (POST /beta-mode/users/:id/enroll)
  ↓
user.isBetaUser = true, betaEnrolledAt = NOW()
  ↓
user.credits += 100, betaCreditsGranted = true (one-time)
  ↓
Mobile: GET /beta-mode/me → { globallyEnabled: true, isBetaUser: true, rank: N }
  ↓
betaStatusProvider rebuilds → BetaIndicator shows "BETA #N"
```

---

## Conflict Avoidance (worktree: feat/beta-mode branched from main)

Files modified in `feat/2026-04-21-file-preview` that beta mode must NOT touch:
- `server/src/daily-grid/daily-grid.service.ts`
- `apps/mobile/lib/shared/services/websocket_service.dart`
- `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart`

Files safe for beta mode to modify (not in `feat/2026-04-21-file-preview`):
- `server/src/users/entities/user.entity.ts`
- `server/src/app.module.ts`
- `apps/mobile/lib/features/customer/home/screens/home_screen.dart`
- `admin/src/App.tsx`

---

## Error Handling

- `enrollUser` with unknown userId → `404 NotFoundException`
- `enrollUser` already enrolled → idempotent no-op (200 OK)
- Mobile `GET /beta-mode/me` failure → `betaStatusProvider` returns null → `BetaIndicator` hidden silently
- Admin toggle failure → optimistic update rolled back, Ant Design error notification shown
- Admin enroll failure → modal stays open, error shown inline

---

## Testing

**Server:**
- Unit: `BetaModeService.enrollUser` — sets columns, grants 100 credits, sets `betaCreditsGranted=true`
- Unit: `BetaModeService.enrollUser` called twice — credits granted only once (`betaCreditsGranted` guard)
- Unit: `BetaModeService.unenrollUser` — sets `isBetaUser=false`, does not change credits
- Unit: `BetaModeService.getBetaStatus` — returns correct rank (COUNT-based)
- Unit: `BetaModeService.getBetaStatus` for non-beta user — returns `isBetaUser: false, rank: null`

**Mobile:**
- Unit: `BetaStatus.fromJson` parses all fields correctly
- Unit: `betaStatusProvider` returns null on API error (no exception thrown)
- Widget: `BetaIndicator` hidden when `globallyEnabled=false`
- Widget: `BetaIndicator` hidden when `isBetaUser=false`
- Widget: `BetaIndicator` shows rank when `globallyEnabled=true && isBetaUser=true`
