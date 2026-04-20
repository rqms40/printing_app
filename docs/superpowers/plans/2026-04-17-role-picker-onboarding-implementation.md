# Role Picker Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sequential mobile onboarding flow for registration, persist `nickname` and `ageRange`, and keep account details aligned with the new data.

**Architecture:** Keep account creation on the final onboarding step by expanding the registration draft into a full onboarding draft. Add the two missing persisted fields to the backend/mobile contract, then replace the old register/profile-setup surfaces with a single premium wizard plus a lighter account-details editor.

**Tech Stack:** Flutter, Riverpod, GoRouter, NestJS, TypeORM, Jest, Flutter test

---

## File Structure

### Backend

- Modify: `server/src/users/entities/user.entity.ts`
  - add nullable `nickname` and `ageRange`
- Modify: `server/src/auth/dto/register.dto.ts`
  - accept the new fields
- Modify: `server/src/users/dto/update-profile.dto.ts`
  - accept the new fields
- Modify: `server/src/auth/auth.service.ts`
  - pass through new fields during registration
- Modify: `server/src/auth/auth.controller.ts`
  - map the DTO fields into service input
- Modify: `server/src/users/users.service.ts`
  - normalize and persist new profile fields
- Modify: `server/src/auth/auth.service.spec.ts`
- Modify: `server/src/users/users.service.spec.ts`
- Modify: `server/src/auth/dto/register.dto.spec.ts`

### Mobile

- Modify: `apps/mobile/lib/features/auth/models/registration_draft.dart`
  - replace the tiny auth-only draft with a full onboarding draft
- Modify: `apps/mobile/lib/features/auth/models/profiling.dart`
  - add `ageRange` options/helpers and onboarding-facing labels
- Modify: `apps/mobile/lib/features/auth/providers/auth_provider.dart`
  - add `nickname` and `ageRange` to the user model, parser, register call, and complete-profile call
- Replace: `apps/mobile/lib/features/auth/screens/register_screen.dart`
  - make this the multi-step onboarding wizard
- Modify: `apps/mobile/lib/features/auth/screens/profile_setup_screen.dart`
  - reduce to a compatibility/editor flow or route it safely for incomplete legacy cases
- Modify: `apps/mobile/lib/features/customer/profile/screens/account_details_screen.dart`
  - expose nickname and age range editing with improved choice controls
- Modify: `apps/mobile/lib/shared/models/user.dart`
  - if needed for profile surfaces that read shared user state
- Add/Modify tests under:
  - `apps/mobile/test/features/auth/...`
  - `apps/mobile/test/features/customer/profile/...`

## Tasks

### Task 1: Add Backend Field Support

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/auth/dto/register.dto.ts`
- Modify: `server/src/users/dto/update-profile.dto.ts`
- Modify: `server/src/auth/auth.service.ts`
- Modify: `server/src/auth/auth.controller.ts`
- Modify: `server/src/users/users.service.ts`
- Test: `server/src/auth/dto/register.dto.spec.ts`
- Test: `server/src/auth/auth.service.spec.ts`
- Test: `server/src/users/users.service.spec.ts`

- [ ] Write failing Jest tests for DTO validation and service persistence of `nickname` and `ageRange`
- [ ] Run the focused server tests to verify they fail for the new fields
- [ ] Implement the minimal backend changes to persist and parse the fields
- [ ] Re-run the focused server tests and confirm they pass

### Task 2: Expand the Mobile Draft and Auth Contract

**Files:**
- Modify: `apps/mobile/lib/features/auth/models/registration_draft.dart`
- Modify: `apps/mobile/lib/features/auth/models/profiling.dart`
- Modify: `apps/mobile/lib/features/auth/providers/auth_provider.dart`
- Modify: `apps/mobile/lib/shared/models/user.dart`
- Test: `apps/mobile/test/features/auth/...`

- [ ] Write failing Dart tests for onboarding draft/state helpers, default printing-preference seeding, and auth payload serialization
- [ ] Run the focused Flutter tests to verify the expected failures
- [ ] Implement the minimal draft/model/provider changes
- [ ] Re-run the focused Flutter tests and confirm they pass

### Task 3: Build the Sequential Register Wizard

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/register_screen.dart`
- Optionally create focused widgets under `apps/mobile/lib/features/auth/widgets/`
- Test: `apps/mobile/test/features/auth/screens/register_screen_test.dart`

- [ ] Write failing widget tests that prove:
  - the wizard starts on privacy
  - next/back navigation works
  - required steps block continuation
  - the final submit calls registration only once all steps are complete
- [ ] Run the widget test and verify it fails
- [ ] Implement the wizard UI with strong card-based layouts, step progress, and local draft state
- [ ] Re-run the widget test and confirm it passes

### Task 4: Align Profile/Account Details

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/profile_setup_screen.dart`
- Modify: `apps/mobile/lib/features/customer/profile/screens/account_details_screen.dart`
- Test: `apps/mobile/test/features/customer/profile/screens/account_details_screen_test.dart`

- [ ] Write failing tests for displaying and updating nickname/age range in account details
- [ ] Run the focused widget test and verify failure
- [ ] Implement the account-details updates and safe legacy handling for profile-setup
- [ ] Re-run the focused widget test and confirm it passes

### Task 5: Full Verification

**Files:**
- No new product files expected

- [ ] Run focused server tests for the touched auth/users files
- [ ] Run focused Flutter tests for onboarding/profile
- [ ] Run `fvm flutter analyze lib`
- [ ] Run `fvm flutter test`
- [ ] Run `fvm flutter build web --release`
- [ ] Fix any failures before claiming completion
