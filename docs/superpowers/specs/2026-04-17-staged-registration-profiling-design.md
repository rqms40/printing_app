# Staged Registration And Profiling Design

Date: 2026-04-17
Branch: `codex/refresh-and-current-changes`

## Goal

Change the current signup flow so the first screen only collects `email`, `password`, and `confirm password`. The app must not persist a new user record after that first screen. Instead, the app should move to a second profile setup step, collect the required profiling fields, and only then send the final registration request to the backend.

The same profiling fields must remain editable later from `Account Details`.

## Current Problem

The current implementation mixes credential collection and profiling on the first register screen. That causes two issues:

1. The first signup screen is overloaded and no longer matches the desired UX.
2. The backend can persist a user before the required profile fields are complete, which conflicts with the new product rule.

## Product Rule

The backend may only create a new user if all required registration fields are present.

Required at final registration submission:

- `email`
- `password`
- `fullName`
- `profileCategory`
- `profileField`

Optional at final registration submission:

- `phoneNumber`
- `gender`
- `dateOfBirth`
- `course`
- `organization`
- `printingPreferences`

This means the first credential screen is a local-only step. It does not call `/auth/register`.

## Approaches Considered

### Option A: Client-side two-step wizard with one final register request

The mobile app keeps the first-step credentials in local widget/provider state, navigates to profile setup, and calls `/auth/register` only after the second step is valid.

Pros:

- Fully satisfies “only store after required fields exist”
- Simple backend behavior
- No draft users or cleanup jobs
- Best fit for the current NestJS API and Flutter app structure

Cons:

- Requires passing local draft state between auth screens
- The registration submission becomes slightly larger

Recommendation: use this.

### Option B: Create a draft user after email/password, then finalize later

The first step calls the backend and creates an incomplete user row, then the second step upgrades it into a complete account.

Pros:

- Resumeable if the app closes between steps

Cons:

- Violates the new product rule
- Adds draft-user lifecycle complexity
- Requires cleanup and edge-case handling for abandoned signups

Do not use this.

### Option C: Temporary anonymous/local identity before final registration

The client would create a temporary onboarding identity, then exchange it for a real user record on completion.

Pros:

- Keeps the “no user row until complete” rule

Cons:

- Unnecessary complexity for this app
- Adds a second auth concept that the codebase does not currently need

Do not use this.

## Final Design

### 1. UX Flow

#### Screen 1: Register

Purpose: collect credentials only.

Fields:

- Email
- Password
- Confirm Password

Behavior:

- Validate locally using a real `Form`/validation flow
- On success, do not call the backend
- Move to `ProfileSetupScreen` with a local registration draft

#### Screen 2: Profile Setup

Purpose: collect the required identity and profiling data needed for account creation.

Required:

- Full name
- Profile category (`student` or `professional`)
- Profile field

Optional:

- Phone number
- Course / specialization
- School / organization
- Printing preferences
- Date of birth
- Gender

Behavior:

- Preselect printing preferences based on the chosen field
- Allow the user to edit those preferences
- Submit one final `/auth/register` request containing credentials from step 1 and profile data from step 2
- If the request succeeds, log the user in with the returned token and route normally

#### Screen 3: Account Details

Purpose: edit the same profile data after registration.

Behavior:

- Reuse the same profiling UI section used in step 2
- Keep email read-only
- Save through `PUT /users/profile`
- Preserve server-side profile completeness rules

### 2. Mobile Architecture

#### Registration Draft State

Introduce a local registration draft model for the auth flow. It should hold:

- email
- password
- fullName
- phone
- gender
- dateOfBirth
- profileCategory
- profileField
- course
- organization
- printingPreferences

This draft should live only in the auth flow until final registration succeeds.

The first screen writes credentials into the draft. The second screen completes the draft and submits it.

#### Shared Profiling UI

Keep the existing shared profiling section, but move it out of the first registration screen and use it only in:

- `ProfileSetupScreen`
- `AccountDetailsScreen`

This avoids duplicated role-picker logic and keeps field behavior consistent.

#### Form Handling

Follow the Flutter form pattern: use a dedicated `Form` and `FormState.validate()` boundary on both the credential step and the profile step. Replace the current ad-hoc validation on the registration path so step 1 and step 2 each have an explicit submit boundary.

Context7 grounding:

- Flutter form guidance recommends `Form` + `FormState.validate()` as the validation boundary for submission.
- This fits the staged registration flow because step 1 and step 2 are independent validation checkpoints.

### 3. Backend Behavior

#### Registration Endpoint

`POST /auth/register` must now represent final account creation only.

The DTO should require:

- `email`
- `password`
- `fullName`
- `profileCategory`
- `profileField`

The endpoint should reject incomplete payloads with normal DTO validation.

The controller should stay thin and pass the validated payload to the auth service.

#### Users Service

The user creation path should compute `isProfileComplete` server-side from required profile fields, not from client assumptions.

That rule should remain:

- `fullName`
- `profileCategory`
- `profileField`

If those are present, `isProfileComplete = true`.

#### Profile Update Endpoint

`PUT /users/profile` should continue to support later edits from `Account Details`.

It should:

- accept partial updates
- recompute `isProfileComplete` from the merged server-side state
- not require the client to send unchanged fields every time

Context7 grounding:

- NestJS guidance recommends DTO-level validation with a global `ValidationPipe`, keeping the controller thin and rejecting invalid payloads early.
- The current app already uses a global `ValidationPipe`, so this design stays aligned with the existing backend architecture.

### 4. Data Contracts

#### Final Registration Payload

```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "Maria Santos",
  "profileCategory": "student",
  "profileField": "architecture",
  "phoneNumber": "+639171234567",
  "course": "BS Architecture",
  "organization": "Mapua University",
  "printingPreferences": ["plotting_blueprints"],
  "gender": "Female",
  "dateOfBirth": "1995-06-15T00:00:00.000Z"
}
```

#### Profile Update Payload

```json
{
  "fullName": "Maria Santos",
  "profileCategory": "student",
  "profileField": "architecture",
  "course": "BS Architecture",
  "organization": "Mapua University",
  "printingPreferences": ["plotting_blueprints", "high_res_color"]
}
```

## Testing Strategy

### Mobile

Use TDD for the behavior change.

Required tests:

- Register screen only renders credentials on step 1
- Register step 1 continues to step 2 without calling the backend
- Profile setup renders the profiling controls on step 2
- Final registration submits one combined payload
- Account details still renders and edits the same profiling fields
- Existing auth state parsing still works

### Backend

Required tests:

- `/auth/register` rejects payloads missing `fullName`
- `/auth/register` rejects payloads missing `profileCategory`
- `/auth/register` rejects payloads missing `profileField`
- `/auth/register` creates a complete user when required fields are present
- `/users/profile` recomputes `isProfileComplete` from merged state

### Runtime Verification

After implementation:

- start API successfully
- confirm schema is still valid
- register a user through the new staged flow
- verify the created row has profiling data immediately
- verify `Account Details` updates persist and remain visible through `/users/profile` and `/admin/users`

## Non-Goals

- No draft-user persistence
- No resume-later onboarding
- No separate anonymous onboarding identity
- No admin-side filtering redesign beyond what already exists

## Files Expected To Change

Mobile:

- `apps/mobile/lib/features/auth/screens/register_screen.dart`
- `apps/mobile/lib/features/auth/screens/profile_setup_screen.dart`
- `apps/mobile/lib/features/auth/widgets/auth_form.dart`
- `apps/mobile/lib/features/auth/providers/auth_provider.dart`
- `apps/mobile/lib/features/customer/profile/screens/account_details_screen.dart`
- profiling tests for register/profile setup/provider

Backend:

- `server/src/auth/dto/register.dto.ts`
- `server/src/auth/auth.controller.ts`
- `server/src/auth/auth.service.ts`
- `server/src/users/users.service.ts`
- auth/users tests

Cleanup:

- remove the old feature worktree after the design is accepted and implementation is complete on the current branch
