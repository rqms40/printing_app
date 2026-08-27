# GRID Agent Operating Guide

## Scope

This file applies to the whole `printing_app` repository. Keep nested overrides small and only add them when a subtree needs different commands or rules.

## Primary Operating Model

- This file is the single source of truth for repo rules, per-surface commands, issue routing, and the beta regression harness. Any agent session in this repo follows it.
- The session agent owns requirements, decisions, issue updates, final review, and integration. Parallel subagents are optional for read-heavy work; verify their findings against local code before acting.
- GitHub Issues are the main tracker. Trello is mirrored only; do not manually archive or delete Trello cards.
- Before implementation, compare the issue against the current codebase. Imported Trello issues may be fixed, partial, duplicated, stale, unclear, or assigned to the wrong surface.
- Preserve Trello markers in issue bodies: `Trello-Card-ID` and `Trello-ShortLink`.
- Use normal engineering language in branches, commits, comments, issues, PRs, and docs.
- Keep branches and commits small. Reference GitHub issue numbers when useful.
- Preserve user changes. Do not revert unrelated work.
- Never put secrets, tokens, passwords, credential files, or tokenized URLs in code, issues, comments, or docs.

## Repo Surfaces

- Mobile app: `apps/mobile`
  - Flutter app with client, rider, supplier, and leftover admin role surfaces.
  - Important areas include `features/customer`, `features/rider`, `features/supplier`, `features/admin`, `features/auth`, `features/tutorial`, and `shared`.
- Admin frontend: `admin`
  - React/Vite/Refine/Ant Design dashboard for ops_admin, super_admin, and the supplier portal.
  - Important areas include orders, QA, matching, riders, suppliers, users, products, delivery slots, notifications, credits, daily grid, beta mode, chat, TAM surveys, payouts, issues, geo-zones, and admin settings.
- Backend/server/API: `server`
  - NestJS API with TypeORM modules.
  - Important modules include auth, users, admin, super, orders, riders, suppliers, matching, quality, issues, payouts, geo-zones, audit, delivery slots, payments, credits, files, storage, notifications, chat, products, printer profile, daily grid, home-feed, beta mode, TAM surveys, support tickets, addresses, mockup, firebase, and health.
- Landing page / website: `apps/Landing-page`
  - React/Vite public website with components, assets, and utility code.
- Deployment/config/CI/docs/assets:
  - Root dev stack: `docker-compose.dev.yml`.
  - Public-IP + domain overlays on this host: `docker-compose.public.yml`, `docker-compose.domain.yml`.
  - Dockerfiles: `docker/`.
  - GitHub Actions: `.github/workflows/`.
  - Trello attachment mirror: `docs/trello/grid-it-team-pm/<card-short-link>/`.
  - Shared API package docs: `packages/api-types/`.

## Issue Labeling And Routing

Use labels to make agent orchestration obvious:

- `surface:mobile`, `surface:admin`, `surface:backend`, `surface:landing`, `surface:docs`
- `role:customer`, `role:rider`, `role:admin`, `role:supplier`
- `module:*` for backend/admin/mobile feature modules when useful, such as `module:orders`, `module:payments`, `module:riders`, `module:files`, `module:notifications`, `module:products`, `module:chat`, `module:delivery-slots`, `module:daily-grid`, `module:beta-mode`, `module:tam-surveys`, `module:matching`, `module:quality`
- `status:*` for tracker reality, such as `status:still-needed`, `status:partial`, `status:already-fixed`, `status:duplicate`, `status:outdated`, `status:unclear`
- `agent:*` for orchestration hints, such as `agent:needs-repo-check`, `agent:needs-mobile-check`, `agent:needs-backend-check`, `agent:needs-admin-check`, `agent:needs-qa`, `agent:good-first-implementation`
- `priority:*` for sequencing.

Close an issue only when the current code clearly satisfies it. When closing, add concise evidence. If partial, update the issue with the remaining checklist. If vague, rewrite the body into actionable implementation steps while preserving Trello source markers.

## Work Loop

1. Orient on the issue, labels, linked Trello card, and attachments.
2. Read the relevant surface code before planning.
3. Decide whether the issue is still needed, fixed, partial, duplicate, outdated, unclear, or mislabeled.
4. If implementation is needed, define the smallest branch scope that can be reviewed independently.
5. Implement in the owning surface first, then update adjacent surfaces only when the contract requires it.
6. Self-review the diff for behavior, types, error states, tests, and unintended surface changes.
7. Run the smallest relevant checks first, then broader checks before marking the work ready.
8. If review or tests fail, fix and repeat the review loop before reporting completion.

## Agent Orchestration

- Keep the main session thread responsible for requirements, decisions, issue updates, final review, and integration.
- Use parallel subagents for read-heavy work: repo exploration, issue triage, attachment inspection, test-log analysis, security review, and independent code review.
- Use parallel implementation only when scopes are independent and file ownership is clear. Prefer separate branches or worktrees for implementation agents.
- A delegated agent should return a short report with inspected files, findings, confidence, and recommended next action.
- Verify delegated findings locally before changing code, closing issues, or reporting results.
- Do not let multiple agents edit the same files at the same time without an explicit coordination point.

## Development Commands

Install dependencies per surface:

```bash
cd server && npm ci
cd admin && npm ci
cd apps/Landing-page && npm ci
cd apps/mobile && fvm flutter pub get
```

Backend checks:

```bash
cd server && npm run lint:check
cd server && npm run build
cd server && npm test
cd server && npm run test:e2e -- --runInBand
```

Admin checks:

```bash
cd admin && npx tsc --noEmit
cd admin && npm test
cd admin && npm run build
```

Mobile checks:

```bash
cd apps/mobile && fvm flutter analyze lib/
cd apps/mobile && fvm flutter test
cd apps/mobile && fvm flutter build web --release --no-tree-shake-icons
```

Landing checks:

```bash
cd apps/Landing-page && npm run lint
cd apps/Landing-page && npm run test:community-cta
cd apps/Landing-page && npm run test:video
cd apps/Landing-page && npm run test:support-copy
cd apps/Landing-page && npm run build
```

Integrated dev stack (loopback):

```bash
GRIDGO_PUBLIC_HOST=127.0.0.1 docker compose -f docker-compose.dev.yml up --build
```

This host's public HTTPS stack bakes the `gridgo-legacy*.talasora.com` origins via `docker-compose.domain.yml`. `GRIDGO_PUBLIC_HOST` is only the origin IP the edge proxy binds for Cloudflare — not a client-facing URL. Keep seed passwords in ignored `server/.env` (`GRIDGO_SEED_CUSTOMER_PASSWORD`, `GRIDGO_SEED_RIDER_PASSWORD`, `GRIDGO_SEED_ADMIN_PASSWORD`):

```bash
GRIDGO_PUBLIC_HOST=<origin-ip> GRIDGO_LAN_HOST=<lan-ip> GRIDGO_BIND_ADDR=127.0.0.1 \
  docker compose --env-file server/.env \
  -f docker-compose.dev.yml \
  -f docker-compose.public.yml \
  -f docker-compose.domain.yml \
  up --build -d
```

The stack starts Postgres, MinIO, OSRM, seed, API, mobile web, admin, landing, and the public-edge proxy. Keep local secrets in ignored env files or a secret manager, not in committed files.

## Beta Workflow Regression

The canonical beta test flow is stored in `e2e/mobile-web/tests/beta-workflow.spec.ts`. Use it as the shared checklist for customer/admin/rider beta workflow work, especially issues #72-#79.

Run the non-mutating flow contract:

```bash
cd e2e/mobile-web && npm test -- tests/beta-workflow.spec.ts
```

Run the same contract without starting a local web server, as CI does:

```bash
cd e2e/mobile-web && MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
```

Run the opt-in live preflight against the dev compose stack:

```bash
cd e2e/mobile-web && \
  GRIDGO_RUN_BETA_FLOW_E2E=1 \
  MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
  GRIDGO_API_URL=http://127.0.0.1:3000/api \
npm test -- tests/beta-workflow.spec.ts
```

Run the opt-in destructive API workflow only against an isolated dev stack:

The isolated stack must be loopback-bound and started with
`GRIDGO_TRUST_PROXY_HOPS=1`; the Playwright harness assigns Admin, Mark, Ven,
and Juan separate RFC 5737 client addresses while preserving production's
per-IP authentication throttle.

```bash
cd e2e/mobile-web && \
  GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1 \
  MOBILE_WEB_E2E_NO_SERVER=1 \
  GRIDGO_API_URL=http://127.0.0.1:3000/api \
  GRIDGO_ADMIN_EMAIL=<dev-admin-email> \
  GRIDGO_ADMIN_PASSWORD=<dev-admin-password> \
  GRIDGO_RIDER_EMAIL=<dev-rider-email> \
  GRIDGO_RIDER_PASSWORD=<dev-rider-password> \
npm test -- tests/beta-workflow-destructive.spec.ts
```

Run the sequential four-context screenshot-backed release audit only after the
controller recreates the isolated dev stack:

```bash
cd e2e/mobile-web && \
  GRIDGO_RUN_BETA_FLOW_VISUAL=1 \
  MOBILE_WEB_E2E_NO_SERVER=1 \
  MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
  GRIDGO_ADMIN_URL=http://127.0.0.1:8189 \
  GRIDGO_API_URL=http://127.0.0.1:3000/api \
  GRIDGO_ADMIN_EMAIL=<dev-admin-email> \
  GRIDGO_ADMIN_PASSWORD=<dev-admin-password> \
  GRIDGO_RIDER_EMAIL=<dev-rider-email> \
  GRIDGO_RIDER_PASSWORD=<dev-rider-password> \
npm run test:beta:visual
```

The live preflight assumes `docker-compose.dev.yml` is already running. The destructive workflow creates two customers, uploads, addresses, orders, delivery assignments, proofs, surveys, and testimonials. The visual workflow writes numbered screenshots, sanitized logs, hashes, a manifest, and videos outside committed source. Authenticated Playwright traces are deliberately disabled because retained request headers can expose bearer tokens. Do not run destructive customer/rider/admin beta scenarios on shared data unless the issue or user explicitly asks for a live workflow run. Keep Mark, Ven, and Juan as separate role paths and preserve the queue/privacy expectations documented in the tests.

## Surface-Specific Guidance

Mobile:

- Respect the client/rider/supplier/admin role split.
- Keep shared models, providers, services, and widgets in `lib/shared` only when they are genuinely cross-role.
- For API changes, update mobile DTO/model parsing and backend contracts together.
- Prefer existing Riverpod, GoRouter, theme, and feature folder patterns.

Admin:

- Keep operational workflows dense and predictable.
- Prefer existing Refine, Ant Design, hooks, providers, and service patterns.
- Run typecheck/build for changes that affect routes, data providers, charts, forms, or API contracts.

Backend:

- Keep module boundaries clear. Put DTOs, entities, controllers, services, and specs with the owning module.
- Validate inputs with DTOs and class-validator patterns already used in the server.
- Update migrations when persistence shape changes.
- Add or update unit/e2e tests for business rules, auth, file handling, payments, delivery/rider flows, and websocket behavior.

Landing:

- Keep the public site focused on real GRID surfaces, assets, and calls to action.
- Follow existing React/Vite component patterns.
- Run the landing-specific content checks when editing CTA, video, or support sections.

Docs/config/CI:

- Keep docs actionable and tied to the current repo.
- Keep CI commands aligned with package scripts and GitHub Actions.
- Do not add credential inventory issues or master credential files.

## Before Reporting Done

- Confirm `git status --short --branch`.
- List files changed and tests run.
- State any checks that could not be run.
- For GitHub issue work, update labels/comments so the tracker matches the code.
