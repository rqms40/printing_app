# Onboarding UX Redesign — Cinematic Dark + Yellow Hero

**Date:** 2026-04-21
**Status:** Approved
**Scope:** Full visual redesign of all 7 registration steps in `register_screen.dart` and its extracted widgets

---

## Goal

Transform the existing functional-but-plain multi-step registration flow into an award-winning, attention-capturing onboarding experience. Every screen must feel like an event — not a form. The user should feel excited to complete the flow.

---

## Design Direction: Cinematic Dark + Yellow Hero

The brand is greyscale-dominant (`#000000` / `#FEFEFE`) with brand yellow `#FFDE58` (dark mode) / `#D4A017` (light mode). The redesign uses the **existing dark `AppColorSet`** as the canonical look for onboarding:

- True black `#000000` canvas — content breathes, no outer card wrapper on screens
- Brand yellow `#FFDE58` as the single accent: hero icons, CTA buttons, progress bar, active states, selection glows
- Poppins ExtraBold (already in `AppTypography.display` / `AppTypography.h1`) for large screen headlines
- Satoshi for all supporting copy — no change needed
- Spring-physics step transitions (replace current linear FadeIn+SlideX)

---

## Architecture Changes

### Remove `_StepScaffold` card wrapper
The white card wrapper (`_StepScaffold`) that wraps each step's content is removed. Steps now render directly on the dark canvas. This opens the layout to full-bleed hero zones.

### New `_OnboardingHero` widget
A reusable hero zone rendered at the top of each step:
- Large icon badge: 80dp circle, `colors.surfaceVariant` background, icon 48dp in `colors.brand` (yellow)
- Optional animated pulse ring around the badge (subtle scale loop, 2s duration)
- Headline: `AppTypography.display` (Poppins ExtraBold 32sp), `colors.onBackground` (white in dark)
- Subtitle: `AppTypography.bodyLarge`, `colors.onSurfaceDim` (#808080)

### CTA button colour
All primary `AppButton` calls in the registration flow use a new `AppButtonVariant.brand` variant (yellow fill `colors.brand` = `#FFDE58` in dark, black text `colors.accentOnColor` = `#000000` in dark). The existing `secondary` variant stays for "Back". This requires adding `brand` to the `AppButtonVariant` enum and its corresponding `_backgroundColor` / `_foregroundColor` / `_shape` cases in `app_button.dart`.

### Progress bar
`LinearProgressIndicator` value colour changes to `colors.brand` (yellow). Already uses `colors.brand` — confirm it's `#FFDE58` in dark mode, which it is.

### Step transitions
`AnimatedSwitcher` `transitionBuilder` upgraded from linear fade+slide to a spring-physics curve (`Curves.elasticOut` with shorter duration) combined with a subtle scale (`0.96 → 1.0`) for a "pop in" feel.

---

## Screen-by-Screen Spec

### Screen A — Privacy Notice

**Hero icon:** `Icons.verified_user_rounded` — 48dp yellow on dark badge  
**Headline:** "Your data, your rules."  
**Subtitle:** "We only collect what we need to personalise your experience."  
**Body:** Dark surface card (`colors.surfaceVariant`, `AppRadius.borderXl`) listing 3 bullet rows, each with a small yellow `✦` dot:
- Nickname & profile  
- Contact info  
- Usage preferences  

**CTA:** Yellow "Agree & Continue →" button  
**Link:** "View Terms & Conditions" — `colors.onSurfaceDim`, underlined, centered below button  

---

### Screen B — Nickname

**Hero icon:** `Icons.waving_hand_rounded` — 48dp yellow on dark badge, with an animated 2-second scale-pulse ring  
**Headline:** "What should we call you?"  
**Subtitle:** "This is how we'll greet you throughout the app."  
**Input:** Full-width dark surface card (`colors.surface`, border `colors.outline`):
- Leading icon: `Icons.edit_rounded` in `colors.onSurfaceDim`
- Yellow animated underline on focus (replaces the standard border highlight)
- Autofocus: true  

**CTA:** Yellow "Continue →"  

---

### Screen C — Category Selection

**Hero:** No icon badge — instead, the headline is the hero  
**Headline:** "Hey [nickname], tell us about yourself."  
**Subtitle:** "Pick the lane that fits."  
**Cards:** Two equal-width cards side-by-side in a `Row`:
- Student card: `Icons.school_rounded` 48dp centered, label bold white, description grey caption
- Professional card: `Icons.work_rounded` 48dp centered, label bold white, description grey caption
- **Selected state:** Yellow border (2dp), yellow glow shadow (`colors.brand` at 30% opacity, blur 24), yellow gradient fill (`colors.brand` 15% → transparent top-to-bottom)
- **Unselected state:** `colors.surfaceVariant` fill, `colors.outline` border  

**CTA:** Yellow "Continue →"

---

### Screen D — Niche Selection

**Headline:** Dynamic — "What are you studying?" (student) or "What is your field?" (professional) — already implemented via `profilingPrompt()`  
**Subtitle:** "We'll preselect your print style automatically."  
**Cards:** Vertical stack of 4 option cards. Each card:
- Leading icon (48dp, yellow): Architecture `Icons.architecture`, Engineering `Icons.precision_manufacturing_rounded`, Medical `Icons.medical_services_rounded`, Law `Icons.gavel_rounded`, Architect/Designer `Icons.design_services_rounded`, Engineer/Contractor `Icons.construction_rounded`, Medical Pro `Icons.local_hospital_rounded`, Business `Icons.business_center_rounded`
- Title: bold white
- Auto-selects badge: small pill chip, yellow fill `colors.brand` at 20% opacity, yellow text — e.g. "Auto-selects: Plotting / Blueprints"
- Selected state: same yellow glow/border treatment as Screen C cards  

**CTA:** Yellow "Continue →"

---

### Screen E — Gender Identity

**Headline:** "How do you identify?"  
**Subtitle:** "Choose what feels right for you."  
**Cards:** Two equal-width cards (`GenderIdentitySelector` refactored):
- Male card: `Icons.male_rounded` 52dp centered, label bold white
- Female card: `Icons.female_rounded` 52dp centered, label bold white
- Selected state: full yellow gradient fill (`colors.brand` → `colors.brand` at 80%), black text on selected card (since yellow bg needs dark text), yellow border 2dp
- Unselected: `colors.surfaceVariant` fill  
- "Prefer not to say": centered ghost `TextButton` below the row, `colors.onSurfaceDim` text; when selected, text turns `colors.onBackground` (white) and gets a subtle underline  

**CTA:** Yellow "Continue →"

---

### Screen F — Age Range

**Headline:** "Age is just a number —"  
**Display-size continuation:** "but it shapes your experience." (same text block, display style)  
**Subtitle:** "Swipe to find your range."  
**Scroll widget** (`AgeRangeSelector` refactored):
- Cards are wider (148dp) and taller, with emoji at top:
  - Under 18: 🎒 + "Just getting started"
  - 18–24: 🎓 + "Campus crunch mode"
  - 25–34: 🚀 + "Balancing big ideas"
  - 35–44: 💼 + "Experienced and fast"
  - 45+: 🌟 + "Seasoned and detail-focused"
- Selected card: yellow fill, black text (emoji stays)
- Page dot indicator row below the scroll: filled dot = yellow, unfilled = `colors.outline`
- Left/right nudge arrows (`Icons.chevron_left/right`) in `colors.onSurfaceDim` at ends  

**CTA:** Yellow "Continue →"

---

### Screen G — Account Registration

**No hero badge** — instead, a compact profile summary bar at the top:
- Row of yellow pill chips: category, field, printing preference — pulled from `_draft`
- Example: `[Student]  [Architecture]  [Plotting / Blueprints]`

**Headline:** "Hi, [nickname] 👋"  
**Subheadline:** "Let's create your account." (Satoshi bodyLarge, `colors.onSurfaceDim`)

**Form fields** — each in its own dark surface card (`colors.surface`, border `colors.outline`, `AppRadius.borderLg`):

| Field | Leading Icon | Type |
|-------|-------------|------|
| Full Name | `Icons.person_rounded` | text |
| Email | `Icons.mail_rounded` | email |
| Phone Number | `Icons.phone_rounded` | phone |
| Password | `Icons.lock_rounded` | obscured + show/hide eye toggle |
| Confirm Password | `Icons.lock_rounded` | obscured + show/hide eye toggle |

- Focus state: yellow animated underline inside card (not border change)
- Live validation: green `Icons.check_circle_rounded` appears inline right of input when field passes validation (triggered on `onChanged`, not only on submit)
- Error state: red text caption below the card (existing pattern)

**CTA:** Yellow "Create Account →" full width  
**Loading state:** yellow button with black `CircularProgressIndicator` (size 18)  
**Footer:** "Already have an account? **Sign in**" — Sign in in `colors.brand` (yellow)

---

## Widget Extraction Plan

The current `register_screen.dart` is 888 lines. After this redesign:

| Widget | File |
|--------|------|
| `_OnboardingHero` | extracted to `widgets/onboarding_hero.dart` |
| `GenderIdentitySelector` | updated in place (`widgets/gender_identity_selector.dart`) |
| `AgeRangeSelector` | updated in place (`widgets/age_range_selector.dart`) |
| `_ChoiceCard` | stays in `register_screen.dart` (local use only) |
| `_SummaryChip` | stays in `register_screen.dart` |
| `_FieldCard` | new, stays in `register_screen.dart` |
| `_AccountField` | new `StatefulWidget`: dark surface card + leading icon + `FocusNode` + `colors.brand`-coloured focus underline (NOT `colors.accent`) + live inline validation checkmark |

`register_screen.dart` target: under 700 lines after extraction.

---

## Animation Spec

| Transition | Implementation |
|------------|---------------|
| Step change | `AnimatedSwitcher` with `Curves.easeOutCubic`, 280ms, slide X 0.04 + fade |
| Card selection | `AnimatedContainer` 180ms, `Curves.easeOut` |
| Hero icon pulse | `flutter_animate` `.animate(onPlay: (c) => c.repeat()).scaleXY(begin: 1.0, end: 1.06, duration: 1800.ms, curve: Curves.easeInOut)` |
| Input focus underline | `AnimatedContainer` width 0 → full, 200ms |
| Validation check | `flutter_animate` `.fadeIn(80ms).scale(begin: 0.6, end: 1.0, curve: Curves.elasticOut)` |
| Page entry | `.animate().fadeIn(320ms).slideY(begin: 0.02)` (existing, keep) |

---

## Files to Modify

1. `apps/mobile/lib/features/auth/screens/register_screen.dart` — main redesign
2. `apps/mobile/lib/features/auth/widgets/gender_identity_selector.dart` — yellow selected state
3. `apps/mobile/lib/features/auth/widgets/age_range_selector.dart` — emoji, wider cards, dot indicator
4. `apps/mobile/lib/features/auth/widgets/onboarding_hero.dart` — **new file**
5. `apps/mobile/lib/shared/widgets/app_button.dart` — add `AppButtonVariant.brand` enum value and its colour cases

No changes to: `profiling.dart`, `registration_draft.dart`, `auth_provider.dart`, `profiling_form_section.dart`, `auth_form.dart`.

---

## Out of Scope

- Login screen — not part of this redesign
- Profile setup screen (`profile_setup_screen.dart`) — legacy screen, not touched
- Backend / API — no changes
- Dark/light mode toggle — onboarding always uses dark AppColorSet (same as current)
