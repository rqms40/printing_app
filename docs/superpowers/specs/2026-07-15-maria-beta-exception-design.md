# Maria Beta Exception — Design

**Date:** 2026-07-15
**Status:** Approved for implementation (not yet implemented)

## Problem

`maria@gridgo.ph` is the seeded demo customer (`server/src/seed.ts`, "Maria
Santos") and is not beta-enrolled. The product owner wants her treated as the
honorary first user: she keeps beta access while beta mode is on — she can log
in, order, and use the app — but she must not occupy a slot in the beta
numbering, and she must never be locked out by the post-survey
`beta_survey_complete` hold. Today no such exception exists anywhere in the
codebase: rank is derived purely from `(beta_enrolled_at, id)` ordering over
`is_beta_user = true` rows, and every enrolled beta customer is subject to the
survey hold unless `is_beta_survey_exempt` is set.

## Decision

Add a generic, admin-visible per-user flag rather than hardcoding an email in
business logic:

- New column `users.is_beta_unranked` (boolean, default `false`), exposed on
  the `User` entity as `isBetaUnranked`.
- A user with `isBetaUser = true` and `isBetaUnranked = true` has full beta
  access (beta indicator, credits-only checkout rules, beta order limit still
  apply) but:
  - is **excluded from rank derivation** — both from other users' rank
    computation and from their own (`rank: null`);
  - is **skipped by the beta enrollment credit grant only if the admin says
    so** — default behavior keeps the standard one-time 100-credit grant,
    since the grant is idempotent and harmless;
  - is expected to also carry `is_beta_survey_exempt = true` so the
    post-delivery survey never holds the account (reuse the existing lever —
    do not duplicate hold-exemption logic).
- `server/src/seed.ts` enrolls maria with `isBetaUser = true`,
  `isBetaUnranked = true`, `isBetaSurveyExempt = true`, and a
  `betaEnrolledAt` timestamp earlier than any real tester ("first user").

Hardcoding `maria@gridgo.ph` stays confined to the seed script, which is
already the single place that knows seeded identities.

## Rank derivation changes (server/src/beta-mode/beta-mode.service.ts)

- `getBetaUsers()` (rank = index + 1 over the ordered list): filter
  `is_beta_unranked = false` for the ranked list; return unranked members
  with `rank: null` so admin surfaces can still show them.
- `getBetaStatus(userId)` (rank via count of earlier-enrolled beta users):
  - if the caller is unranked → `rank: null`, `isBetaUser: true`;
  - the count query adds `AND is_beta_unranked = false` so unranked users
    never shift anyone else's number.
- `searchBetaMembers()`: include an `isBetaUnranked` field so the admin beta
  members table can render an "Unranked / Exempt" badge instead of a number.
- Partial index `idx_users_beta_enrollment_rank` keeps working; optionally
  narrow it with `AND is_beta_unranked = false` in the new migration (not
  required for correctness, only for exactness).

## Invariants that must not change

- Mark registers first, Ven second → Mark rank 1, Ven rank 2, regardless of
  maria's earlier `betaEnrolledAt`.
- `updateSettings(false)` still releases every `beta_survey_complete` hold;
  maria never enters that state.
- Enrollment credit grant stays idempotent (`BETA-ENROLLMENT:{userId}`
  ledger reference).
- `assertBetaPaymentMethod` / `assertBetaOrderLimit` still apply to maria
  (she is a real beta user, just unnumbered). If the owner wants her exempt
  from the one-order cap, that is the existing admin "Reset order limit"
  action — not part of this change.

## Alternatives rejected

- **Hardcoded email allowlist in `beta-mode.service.ts`** — couples business
  logic to seed data, untestable in isolation, invisible to admins.
- **Stored beta number column** — larger migration and backfill for a
  numbering scheme that is intentionally derived; out of scope.
- **Reusing `is_beta_survey_exempt` alone** — survey exemption does not
  remove the user from rank computation, which is the core ask.

## Affected surfaces

- `server/`: migration, `user.entity.ts`, `beta-mode.service.ts` (+ specs),
  `seed.ts`.
- `admin/`: beta members table badge (`admin/src/pages/beta-mode/index.tsx`,
  `admin/src/services/betaModeApi.ts` types). While touching this table, add
  the currently missing **rank column** (the API already returns `rank`).
- `apps/mobile/`: no change required — `BetaStatus.rank` is already nullable
  in practice when not enrolled; verify the beta indicator badge renders a
  rankless state (`beta_indicator.dart`) instead of `#000`.
- `e2e/mobile-web/`: destructive spec addition asserting the seeded maria
  path (login during beta, unranked, Mark/Ven numbering unaffected).
