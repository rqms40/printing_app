# CLAUDE.md — GRIDGO (printing_app)

GRIDGO is a printing + delivery platform for Davao City: a Flutter mobile app
(customer / rider / admin roles), a React/Refine admin dashboard, a NestJS +
TypeORM + Postgres API, a public landing page, and a Docker dev stack with
MinIO and a deterministic OSRM routing fixture.

**`AGENTS.md` is the single source of truth** for repo rules, per-surface
commands, issue routing, and the beta regression harness. Read it before
making changes. This file only adds Claude-specific orientation and must not
duplicate or contradict it.

## Quick commands

```bash
# Full dev stack (Postgres, MinIO, OSRM, API :3000, mobile web :8088, admin :8189, landing :8090)
GRIDGO_PUBLIC_HOST=127.0.0.1 docker compose -f docker-compose.dev.yml up --build

# Android emulator against the Docker API (SERVER_URL=http://10.0.2.2:3000)
make mobile-android

# Beta workflow contract test (non-mutating; asserts AGENTS.md stays in sync)
cd e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
```

Per-surface checks (lint/build/test for server, admin, mobile, landing) are
listed under "Development Commands" in AGENTS.md — run the owning surface's
checks before reporting done. The stack requires `JWT_SECRET`, `MINIO_*`, and
`GRIDGO_SEED_{CUSTOMER,RIDER,ADMIN}_PASSWORD` in an ignored `server/.env`.

Marketplace pilot seed cast (`server/src/seed.ts` — passwords only in env, never
committed):

| Email | Role | Password env |
|-------|------|----------------|
| `maria@gridgo.ph` | `client` | `GRIDGO_SEED_CUSTOMER_PASSWORD` |
| `supplier@gridgo.ph` | `supplier` | `GRIDGO_SEED_CUSTOMER_PASSWORD` |
| `juan@gridgo.ph` | `rider` | `GRIDGO_SEED_RIDER_PASSWORD` |
| `admin@gridgo.ph` | `ops_admin` | `GRIDGO_SEED_ADMIN_PASSWORD` |
| `superadmin@gridgo.ph` | `super_admin` | `GRIDGO_SEED_ADMIN_PASSWORD` |

Marketplace contract (non-mutating CI skeleton):
`e2e/mobile-web/tests/marketplace-workflow.spec.ts`.

## The beta workflow (the flow this repo revolves around)

The canonical 29-step beta test flow — admin enables beta → customers Mark
and Ven register, auto-enroll, and order → admin assigns rider Juan → OSRM
multi-stop dispatch with queue privacy → proof of delivery → auto survey →
testimonial/share → post-beta lockout — is codified in:

- `e2e/mobile-web/tests/beta-workflow.spec.ts` (contract + step list)
- `docs/superpowers/plans/2026-07-10-beta-workflow-release-1.6.md` (design)
- AGENTS.md "Beta Workflow Regression" (run modes: contract, live preflight,
  destructive, visual — destructive/visual only on isolated stacks)

Implementation map (all rules are server-authoritative; clients only render):

- **Beta mode toggle**: `server/src/beta-mode/` — single-row
  `beta_mode_settings.is_enabled`; disabling releases all
  `beta_survey_complete` account holds.
- **Auto-enrollment + 100 credits**: `server/src/auth/auth.service.ts`
  `ensureBetaEnrollment()` → `beta-mode.service.ts enrollUser()` →
  `credits.service.ts grantBetaEnrollmentCredits()` (idempotent ledger row
  `BETA-ENROLLMENT:{userId}`).
- **Beta number/rank is derived, never stored**: ordered by
  `(beta_enrolled_at, id)` via partial index
  `idx_users_beta_enrollment_rank`.
- **Credits-only beta checkout**: `server/src/orders/orders.service.ts`
  `assertBetaPaymentMethod()` (403 `beta_credits_only`) and the one-order cap
  `assertBetaOrderLimit()` (403 `BETA_ORDER_LIMIT_REACHED`).
- **Dispatch & route optimization**:
  `server/src/riders/dispatch-plan.service.ts` — OSRM duration matrix +
  `solveOpenRoute()` (store origin, ≤5 stops, persisted versioned plans);
  routing failure is a hard 503 `routing_unavailable`, never a haversine
  fallback.
- **Queue privacy**: order enrichment in `orders.service.ts` sets
  `canTrackDelivery` only when `deliveryQueuePosition === 1` AND the stop is
  `on_the_way`/`arrived`; later customers get position/size only — no
  assignment id, geometry, or live map. Mobile renders this in
  `apps/mobile/lib/features/customer/home/widgets/map_tracking_tile.dart` +
  `home/providers/live_delivery_map_provider.dart`.
- **Proof of delivery**: required at `delivered` — photo upload
  (`purpose: proof_of_delivery`) or signature; `server/src/riders/riders.service.ts`.
- **Auto survey → hold**: `server/src/tam-surveys/tam-surveys.service.ts`
  creates a required 14-question survey on delivery; final submission holds
  the account (`accountHoldReason='beta_survey_complete'`, forced logout);
  login while held returns 403 `beta_held` (token still issued for
  `@AllowBetaHeld` testimonial endpoints).
- **Testimonial/share**: `POST /beta-mode/testimonial`,
  `PATCH /beta-mode/me/share`; mobile `beta_success_wall_screen.dart` then
  `/customer/beta/locked`.

Known gaps (documented, not yet built): no `maria@gridgo.ph` beta exception
(see `docs/superpowers/plans/2026-07-15-maria-beta-exception.md`), admin beta
members table doesn't render the rank the API returns, the 100-credit grant
amount isn't admin-configurable, addresses model only `isDefault` + recency,
and `packages/api-types` is a skeleton.

## Orchestration (Claude-led sessions)

When Claude Code runs the session, Claude is the main orchestrator: it owns
requirements, decisions, final review, and integration, and delegates by the
Model Routing table in AGENTS.md. Before delegating, invoke the repo skill
`.claude/skills/agent-delegation`. In short:

- Hard/deep work — backend (NestJS/TypeORM/migrations/dispatch/beta logic),
  security-sensitive changes → `codex exec -m gpt-5.6-sol` at reasoning
  `high`/`xhigh`.
- Moderately hard, cross-surface work → `gpt-5.6-sol` at `medium`.
- Routine/mechanical work → `gpt-5.6-terra`.
- UI/frontend design, visual polish, UX writing → keep with Claude (use the
  frontend-design skill) when Claude is available.
- Second opinions, adversarial review, UX critique → `grok` CLI (Grok 4.5);
  never treat Grok output as source of truth.

Delegated agents work read-only by default, return short structured reports,
and implement only in isolated worktrees; verify their findings locally
before acting on them.

## Guardrails

- `docs/trello/` is a read-only Trello mirror — never archive, delete, or
  hand-edit mirrored cards; preserve `Trello-Card-ID`/`Trello-ShortLink`
  markers in issues.
- Never commit secrets, tokens, or tokenized URLs; seed passwords live only
  in ignored env files.
- Destructive/visual beta e2e runs mutate data — isolated loopback stacks
  only, per AGENTS.md.
- Multi-step feature work follows the plan/spec convention in
  `docs/superpowers/plans/` + `docs/superpowers/specs/`.
- If you edit the "Beta Workflow Regression" section of AGENTS.md, rerun the
  contract test above — it asserts that section's contents.
