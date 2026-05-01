# Custom File Retention Duration Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded 3-option retention dropdown with preset chips + a free-form custom input (number + Days/Weeks unit selector).

**Architecture:** Server DTO validation loosened to accept any positive integer; mobile UI rebuilt in-place within `StorageSettingsScreen` — no new routes or providers needed.

**Tech Stack:** NestJS (class-validator), Flutter (Riverpod, Material widgets)

---

## Server Changes

**File:** `server/src/users/dto/update-storage-settings.dto.ts`

Replace `@IsIn([null, 1, 7, 30])` with:
- `@IsOptional()` — allows `null` to disable retention
- `@IsInt()` — must be a whole number
- `@Min(1)` — minimum 1 day

No entity changes. No migration. `fileRetentionDays` column is already an integer and accepts any value; only the DTO was restricting it.

---

## Mobile UI Changes

**File:** `apps/mobile/lib/features/customer/profile/screens/storage_settings_screen.dart`

### Replace `_PeriodDropdown` with two new widgets

**`_PresetChips`**
- Three `ChoiceChip`s: `1 day`, `7 days`, `30 days`
- The chip matching the current `settings.fileRetentionDays` is selected (highlighted)
- If current value matches none of the presets, no chip is selected
- Tapping a chip calls `notifier.update(days)` immediately

**`_CustomDurationInput`**
- Always visible below the chip row when retention is enabled
- A `TextFormField` with `keyboardType: TextInputType.number`, max 3 characters
- Initialized with the current value if it doesn't match a preset; empty otherwise
- A segmented toggle (`Days` / `Weeks`) to the right of the input
- On submit (focus lost or checkmark tapped):
  - Validate: value must be an integer between 1 and 999
  - Convert: if unit is Weeks, multiply by 7; if result > 999 show inline error and do not save
  - Call `notifier.update(days)`
  - Show inline error text if invalid; do not call API
- A small confirm icon button (✓) triggers the same save action on tap

### Layout inside the card (when toggle is on)

```
┌─────────────────────────────────────────────┐
│ Auto-delete files after order completion [✓] │
├─────────────────────────────────────────────┤
│ Delete after                                 │
│  [1 day]  [7 days]  [30 days]               │
│  [  45  ] [ Days ▾ ] [✓]                    │
└─────────────────────────────────────────────┘
```

---

## Validation Rules

| Rule | Detail |
|------|--------|
| Min | 1 day |
| Max | 999 days (≈ 2.7 years) |
| Weeks max | 142 weeks (142 × 7 = 994 ≤ 999); 143 weeks errors |
| Empty/zero | Inline error, no API call |
| Non-integer | Rejected by numeric keyboard; server also rejects |

---

## Data Flow

1. User taps preset chip → `notifier.update(days)` → PATCH `/users/me/storage-settings` → state updated
2. User types custom value + taps ✓ → validate → convert weeks to days → `notifier.update(days)` → PATCH → state updated
3. Server DTO validates `fileRetentionDays` is a positive integer; returns 400 on invalid input
4. On save error, existing `ref.listen` in `StorageSettingsScreen` shows a SnackBar

---

## Testing

- **Server:** Update `update-storage-settings.dto` unit test — verify `@IsIn` removed, `@Min(1)` enforced, `null` accepted, arbitrary integers accepted (e.g. 45, 365)
- **Mobile:** Widget test for `_PresetChips` — correct chip highlighted for 1/7/30, none highlighted for 45
- **Mobile:** Widget test for `_CustomDurationInput` — weeks conversion (2 weeks → 14), validation errors for 0 and empty, max cap at 999
