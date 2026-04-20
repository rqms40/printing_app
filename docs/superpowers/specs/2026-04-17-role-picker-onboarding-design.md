# Role Picker Onboarding Design

**Goal:** Replace the current split `register -> profile setup` experience with a premium sequential onboarding flow that only creates the user account on the final step, while preserving the existing profiling model and adding support for `nickname` and `ageRange`.

## Scope

This design covers:
- the mobile registration/onboarding flow
- the profile/account-details surface needed to keep the new fields editable later
- the backend/mobile contract additions required to store the new data

This design does not cover:
- admin analytics for nickname/age segments
- redesigning login
- changing order or checkout flows

## Product Decisions

### Registration boundary

Account creation happens only on the last screen. Steps before that build a local onboarding draft and never hit `/auth/register`.

### New persisted fields

The backend and mobile app will persist:
- `nickname`
- `ageRange`

These fields will be optional at the database level for backward compatibility, but required by the onboarding flow before the final account-creation step.

### Existing profile fields

The flow keeps and persists:
- `profileCategory`
- `profileField`
- `gender`
- `printingPreferences`

`fullName`, `email`, `phoneNumber`, and `password` remain the required account-creation fields on the final step.

### Date of birth

This onboarding flow uses `ageRange` instead of date-of-birth selection. Existing `dateOfBirth` support stays in the backend and parsing layer for compatibility, but the new onboarding and account-details UX will foreground `ageRange`.

## UX Flow

The onboarding sequence is:

1. Privacy notice
2. Nickname
3. High-level category
4. Niche selection
5. Gender identity
6. Age range
7. Account registration

The flow uses a single wizard-style screen with animated step transitions, visible progress, and explicit `Back` / `Continue` affordances.

### Screen A: Privacy Notice

Purpose:
- set expectation on what data is collected
- link to terms and conditions
- establish consent before the rest of the wizard

Content:
- minimal copy
- `View Terms & Conditions`
- primary `Agree & Continue`

### Screen B: Nickname

Purpose:
- personalize the remaining steps
- give the flow warmth without asking for legal identity first

Rules:
- required to continue
- stored as `nickname`
- reused in headings such as `Hi, Kai`

### Screen C: High-Level Category

Two visual cards:
- `Student`
- `Professional`

Selection is required to continue.

### Screen D: Niche Selection

Conditional on category:

If `Student`:
- Architecture -> preselect `plotting_blueprints`
- Engineering -> preselect `technical_specs`
- Medical / Nursing -> preselect `high_res_color`
- Law / Arts / Other -> preselect `document_printing`

If `Professional`:
- Architect / Designer -> preselect `plotting_blueprints`
- Engineer / Contractor -> preselect `technical_specs`
- Medical Professional -> preselect `high_res_color`
- Business / Corporate -> preselect `marketing_materials`

Selection is required to continue.

### Screen E: Gender Identity

The UX should avoid a generic chip row. The preferred layout is:
- two large visual tiles for `Male` and `Female`
- a low-pressure centered action for `Prefer not to say`

The stored values should remain string-compatible with existing backend/mobile parsing.

### Screen F: Age Range

Age is collected as:
- `under_18`
- `18_24`
- `25_34`
- `35_44`
- `45_plus`

The UX should use a horizontal selector or carousel-style wheel instead of a static list.

### Screen G: Account Registration

Fields:
- `Full Name` required
- `Email` required
- `Number` required
- `Password` required
- `Confirm Password` required

This screen also shows a compact summary of earlier selections:
- nickname
- category / field
- seeded print preferences

Submitting this step performs the actual registration request.

## UX Quality Bar

The flow should feel more like onboarding than form entry:
- each step has a single clear decision
- large hit targets
- obvious progress
- minimal copy
- warm but restrained visual language
- no crowded all-in-one profile form

The implementation should prefer a bold card-based layout over default list tiles and dropdowns.

## Data Model Changes

### Backend

Add to `User`:
- `nickname: string | null`
- `ageRange: string | null`

Expose both fields through:
- registration DTO
- update-profile DTO
- user serialization/parsing paths used by mobile

### Mobile auth/profile model

Add to `AuthUser` and parsed user payloads:
- `nickname`
- `ageRange`

Add to the registration draft/onboarding draft:
- consent accepted
- nickname
- category
- field
- gender
- ageRange
- seeded print preferences
- final registration fields

## Account Details

The user should be able to edit the new onboarding fields later in account details:
- nickname
- profile category
- profile field
- gender
- age range
- print preferences
- full name
- phone

Email remains read-only.

The account-details UI does not need to duplicate the entire onboarding wizard, but it should visually align with the new choices and avoid falling back to dropdown-heavy controls.

## Validation Rules

### Required to finish onboarding
- privacy accepted
- nickname
- profile category
- profile field
- gender choice or `prefer_not_to_say`
- age range
- full name
- email
- phone number
- password
- confirm password

### Backend compatibility

The backend remains tolerant of missing `nickname` and `ageRange` for old users and legacy flows, but the new mobile onboarding will always send them.

## Testing

Minimum verification:
- onboarding draft/state transitions
- preference auto-seeding from niche selection
- final registration request includes the new fields
- account-details screen reflects and updates the new fields
- mobile analysis and tests pass
- `flutter build web --release` succeeds

## Risks and Mitigations

### Risk: flow becomes too complex

Mitigation:
- keep one decision per screen
- do not ask for free-text course/organization in onboarding
- reserve deeper editing for account details

### Risk: backend/mobile drift

Mitigation:
- add explicit DTO/model parsing tests around `nickname` and `ageRange`

### Risk: existing users regress

Mitigation:
- keep new persisted fields nullable in storage and parsing
- avoid changing `isProfileComplete` rules in this iteration
