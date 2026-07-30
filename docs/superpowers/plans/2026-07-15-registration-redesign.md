# Registration Redesign (Phase C, issue #85) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the templated 7-step undraw wizard with a distinctive 5-step print-registration flow that reaches an account early, validates properly, and ends on a "press proof" beta reveal.

**Architecture:** A signature `RegistrationMark` progress row (printer's crosshair targets that lock in per step) + a print-ticket step header become the shared chrome. The step enum drops to 5 (`welcome → account → nickname → craft → profile`), Account moves to position 2 with live validation + strength meter, Category+Field and Gender+Age each combine into one screen (Gender/Age skippable). A new `BetaWelcomeScreen` reveals the beta number + 100 credits after `register()`. All in `apps/mobile/lib/features/auth`; server contract unchanged (category/field still required, gender/age already optional in the payload).

**Tech Stack:** Flutter 3.41.6 (fvm), Riverpod, GoRouter, existing `AppColors`/`AppTypography`/`AppButton`, flutter_animate. No new deps; stock undraw SVGs removed.

## Global Constraints

- Branch `feat/registration-redesign` off `agent/beta-coherence-program` in worktree `../printing_app-registration`.
- Palette: mono UI (`AppColors` accent = near-black/near-white) + `brand` yellow reserved for the active registration mark, the primary CTA, and the beta reveal only.
- Email: real regex (`RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$')`); password ≥ 8 everywhere (also fix `auth_form.dart`'s 6).
- Category + Field stay required (server contract); Gender + Age are skippable ("Prefer not to say").
- Beta reveal renders only when the API confirms enrollment (`betaStatusProvider` rank present); never assumed client-side.
- Targets ≥ 48dp; visible focus; `flutter analyze lib/` + touched tests green per task; full `fvm flutter test` before final commit.
- Commands from `apps/mobile`, `export PATH="$HOME/.pub-cache/bin:$PATH"`; restore `apps/mobile/macos` side-effects before committing.

---

### Task 1: RegistrationMark signature widget

**Files:**
- Create: `apps/mobile/lib/features/auth/widgets/registration_mark.dart`
- Test: `apps/mobile/test/features/auth/widgets/registration_mark_test.dart`

**Interfaces:**
- Produces: `RegistrationMarkRow({required int total, required int completed, required int current})` — a row of `total` printer crosshair targets; indices `< completed` render "locked" (solid yellow crosshair), `== current` renders the active outlined mark, `> current` render faint grey. Semantics: `'Step ${current+1} of $total'`.

- [ ] **Step 1: Failing test** — pump `RegistrationMarkRow(total: 5, completed: 1, current: 1)`; expect 5 `CustomPaint` marks and `find.bySemanticsLabel('Step 2 of 5')`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** a `CustomPainter` drawing a circle + crosshair; locked = filled `colors.brand`, current = 2px `colors.brand` ring + thin crosshair, upcoming = `colors.onSurfaceDim` at 0.4. Row wraps in `Semantics(label: 'Step ${current + 1} of $total')`.
- [ ] **Step 4: Test + `fvm flutter analyze lib/features/auth/`** → PASS/clean. **Step 5: Commit** `feat(auth): registration-mark progress signature`.

### Task 2: Print-ticket step header

**Files:**
- Create: `apps/mobile/lib/features/auth/widgets/registration_step_header.dart`
- Test: extend Task 1's test file or a new `registration_step_header_test.dart`

**Interfaces:**
- Produces: `RegistrationStepHeader({required int index, required int total, required String plateLabel, required String title, String? subtitle})` — renders `RegistrationMarkRow` + a mono-caps coordinate `'PLATE ${(index+1).pad2} / ${total.pad2}'` in `AppTypography.overline` + the Poppins display `title` + optional Satoshi `subtitle`. No SVGs.

- [ ] **Step 1: Failing test** — header with `index:1,total:5,plateLabel:'ACCOUNT',title:'Set up your account'` shows `'PLATE 02 / 05'` and the title. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS/clean. **Step 5: Commit** `feat(auth): print-ticket step header`.

### Task 3: Restructure step enum to 5 + reorder

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/register_screen.dart` (`_RegisterStep` enum → `welcome, account, nickname, craft, profile`; `_next`/`_back` transitions; submit fires after `profile`)
- Test: `apps/mobile/test/features/auth/screens/register_screen_test.dart` (create if absent — a smoke test that pumps the screen and walks welcome→account)

**Interfaces:**
- Consumes: `RegistrationDraft` (unchanged — already carries every field), Tasks 1–2 widgets.
- Produces: the 5-step flow; `craft` = category+field, `profile` = gender+age.

- [ ] **Step 1: Failing test** — pump register screen; expect `RegistrationStepHeader` with `'PLATE 01 / 05'` and the welcome consent checkbox present; tapping consent + Continue advances to `'PLATE 02 / 05'` (Account). **Step 2:** FAIL. **Step 3:** rewrite the enum + transitions + the header wiring; keep each step's existing body widget for now (moved, not yet restyled). **Step 4:** test + analyze. **Step 5: Commit** `feat(auth): 5-step registration structure with account moved up`.

### Task 4: Welcome step — real consent

**Files:** Modify `register_screen.dart` (welcome step body)
- [ ] Replace the implicit "Agree & Continue" with a real `Checkbox` (`Key('consent-checkbox')`, ≥48dp tap row) gating the Continue button; Terms link kept. Test: Continue disabled until checked; checking enables it. Commit `feat(auth): explicit registration consent checkbox`.

### Task 5: Account step — validation + strength meter

**Files:**
- Modify: `register_screen.dart` (account step: on-blur per-field validation), `apps/mobile/lib/features/auth/widgets/auth_form.dart` (6→8 password rule)
- Create: `apps/mobile/lib/features/auth/widgets/password_strength_meter.dart`
- Test: `password_strength_meter_test.dart` + account-validation cases in the screen test

**Interfaces:**
- Produces: `PasswordStrength scorePassword(String)` → enum `{weak, fair, strong}` (weak <8; fair ≥8; strong ≥10 with a digit and a letter); `PasswordStrengthMeter(strength)` a 3-segment bar.
- Consumes: `RegExp` email validator (Global Constraints).

- [ ] **Step 1: Failing tests** — `scorePassword('abc')==weak`, `scorePassword('abcdefgh')==fair`, `scorePassword('abcd1234ef')==strong`; email `'a@'` invalid, `'m@x.co'` valid. **Step 2:** FAIL. **Step 3:** implement the scorer, meter, regex email check, on-blur field errors, unify `auth_form.dart` to 8. **Step 4:** tests + analyze. **Step 5: Commit** `feat(auth): account-step validation, email regex, password strength meter`.

### Task 6: Combined Craft step (category + field)

**Files:** Modify `register_screen.dart` (craft step); reuse `profileCategories` / `profileFieldsForCategory` / `defaultPrintingPreferencesForField` from `models/profiling.dart`; restyle `_FieldCard` to the mono+yellow selection treatment (no undraw)
- [ ] Category chips reveal their field options inline; selecting a field keeps the existing preference auto-seed (Tesler). Test: selecting Student then Architecture seeds prefs and enables Continue. Commit `feat(auth): combined craft step with restyled selection cards`.

### Task 7: Combined Profile step (gender + age, skippable)

**Files:** Modify `register_screen.dart`; restyle `gender_identity_selector.dart` + `age_range_selector.dart` to drop undraw SVGs (icon/initial + label), add a "Prefer not to say" for BOTH; a single "Skip for now" advances with both null
- [ ] Test: Skip advances to submit with gender/age null; the register payload omits them. Commit `feat(auth): combined skippable gender and age step`.

### Task 8: Beta welcome reveal (peak-end)

**Files:**
- Create: `apps/mobile/lib/features/auth/screens/beta_welcome_screen.dart`, route `/auth/beta-welcome` in `apps/mobile/lib/config/routes/app_router.dart`
- Modify: `register_screen.dart` submit → on success, if `betaStatusProvider` resolves `globallyEnabled && rank != null`, route to `/auth/beta-welcome`, else the normal `/onboarding`
- Test: `beta_welcome_screen_test.dart`

**Interfaces:**
- Consumes: `betaStatusProvider` (rank), `authProvider` (credits).
- Produces: a full-bleed dark reveal — GRIDGO dot-grid assembles, `'FOUNDING TESTER'` + zero-padded `'#${rank}'` stamp in, `'100 GRIDGO Credits'` revealed, single `'Start printing'` CTA → `/onboarding`.

- [ ] **Step 1: Failing test** — pump with an overridden `betaStatusProvider` (rank 7, credits 100): expect `'#007'`, `'100 GRIDGO Credits'`, and the CTA. **Step 2:** FAIL. **Step 3:** build the screen (respect reduced-motion: no assemble animation when disabled). **Step 4:** test + analyze. **Step 5: Commit** `feat(auth): beta welcome press-proof reveal`.

### Task 9: ProfileSetupScreen reuse + cleanup

**Files:** Modify `apps/mobile/lib/features/auth/screens/profile_setup_screen.dart` to reuse the restyled selectors; delete now-unused undraw asset references; `onboarding_hero.dart` removed if no remaining consumers (grep first)
- [ ] `grep -rn "onboarding_hero\|undraw" apps/mobile/lib` shows no dangling refs. Commit `refactor(auth): reuse restyled selectors, drop undraw assets`.

### Task 10: Verification gate

- [ ] `fvm flutter analyze lib/` clean; `fvm flutter test` all pass; `fvm flutter build web --release --no-tree-shake-icons` succeeds.
- [ ] Rebuild the dev stack; drive registration on mobile web (Playwright) through all 5 steps to the beta reveal; screenshot each step; orchestrator reviews against this plan + #85.
- [ ] Merge to `agent/beta-coherence-program`; re-run contract e2e + the beta visual journey (its registration steps now exercise the new flow); check off #85.
