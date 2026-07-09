# GRID Agent Operating Guide

## Scope

This file applies to the whole `printing_app` repository. Keep nested overrides small and only add them when a subtree needs different commands or rules.

## Primary Operating Model

- Codex/GPT is the default planner, implementer, reviewer, and final integrator for this repo.
- GitHub Issues are the main tracker. Trello is mirrored only; do not manually archive or delete Trello cards.
- Before implementation, compare the issue against the current codebase. Imported Trello issues may be fixed, partial, duplicated, stale, unclear, or assigned to the wrong surface.
- Preserve Trello markers in issue bodies: `Trello-Card-ID` and `Trello-ShortLink`.
- Use normal engineering language in branches, commits, comments, issues, PRs, and docs.
- Keep branches and commits small. Reference GitHub issue numbers when useful.
- Preserve user changes. Do not revert unrelated work.
- Never put secrets, tokens, passwords, credential files, or tokenized URLs in code, issues, comments, or docs.

## Repo Surfaces

- Mobile app: `apps/mobile`
  - Flutter app with customer, rider, and admin role surfaces.
  - Important areas include `features/customer`, `features/rider`, `features/admin`, `features/auth`, `features/tutorial`, and `shared`.
- Admin frontend: `admin`
  - React/Vite/Refine/Ant Design operational dashboard.
  - Important areas include orders, riders, users, products, delivery slots, notifications, credits, daily grid, beta mode, chat, TAM surveys, and admin settings.
- Backend/server/API: `server`
  - NestJS API with TypeORM modules.
  - Important modules include auth, users, admin, orders, riders, delivery slots, payments, credits, files, storage, notifications, chat, products, printer profile, daily grid, beta mode, TAM surveys, support tickets, addresses, firebase, and health.
- Landing page / website: `apps/Landing-page`
  - React/Vite public website with components, assets, and utility code.
- Deployment/config/CI/docs/assets:
  - Root dev stack: `docker-compose.dev.yml`.
  - Dockerfiles: `docker/`.
  - GitHub Actions: `.github/workflows/`.
  - Trello attachment mirror: `docs/trello/grid-it-team-pm/<card-short-link>/`.
  - Shared API package docs: `packages/api-types/`.

## Issue Labeling And Routing

Use labels to make agent orchestration obvious:

- `surface:mobile`, `surface:admin`, `surface:backend`, `surface:landing`, `surface:docs`
- `role:customer`, `role:rider`, `role:admin`
- `module:*` for backend/admin/mobile feature modules when useful, such as `module:orders`, `module:payments`, `module:riders`, `module:files`, `module:notifications`, `module:products`, `module:chat`, `module:delivery-slots`, `module:daily-grid`, `module:beta-mode`, `module:tam-surveys`
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

- Keep the main Codex/GPT thread responsible for requirements, decisions, issue updates, final review, and integration.
- Use parallel Codex subagents for read-heavy work: repo exploration, issue triage, attachment inspection, test-log analysis, security review, and independent code review.
- Use parallel implementation only when scopes are independent and file ownership is clear. Prefer separate branches or worktrees for implementation agents.
- A delegated agent should return a short report with inspected files, findings, confidence, and recommended next action.
- Verify delegated findings locally before changing code, closing issues, or reporting results.
- Do not let multiple agents edit the same files at the same time without an explicit coordination point.

## Grok 4.5 Delegation

Grok 4.5 is available through the local `grok` CLI and the local `delegate-to-grok` Codex skill. Use it as an optional second model, not as the source of truth.

Best uses for Grok:

- independent second opinion on plans or issue triage
- adversarial review of a proposed implementation
- product/UX critique and copy alternatives
- broad checklist generation
- comparing competing implementation approaches
- Grok subagent exploration when the user explicitly asks for Grok agents

Default read-only delegation:

```bash
python3 ~/.codex/skills/delegate-to-grok/scripts/grok_delegate.py \
  --cwd /home/jd/projects/printing_app \
  "Read-only review. Do not edit files. Review issue #XX and list risks, missing tests, and recommended next steps."
```

Allow Grok subagents only when useful for breadth:

```bash
python3 ~/.codex/skills/delegate-to-grok/scripts/grok_delegate.py \
  --cwd /home/jd/projects/printing_app \
  --subagents \
  --max-turns 4 \
  "Read-only multi-agent review. Split by mobile, admin, and backend. Return a concise merged report."
```

Use Grok for implementation only when the user explicitly asks for it. Isolate it in a worktree and review the diff before accepting anything:

```bash
grok --cwd /home/jd/projects/printing_app \
  --worktree=grok-issue-XX \
  --model grok-4.5 \
  --max-turns 8 \
  "Implement issue #XX in the smallest safe scope. Do not push. Run relevant tests and summarize the diff."
```

If Grok output conflicts with local code, tests, or GitHub issue evidence, trust the verified local evidence.

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

Integrated dev stack:

```bash
GRIDGO_PUBLIC_HOST=127.0.0.1 docker compose -f docker-compose.dev.yml up --build
```

The dev stack starts Postgres, MinIO, seed, API, mobile web, admin, and landing. Keep local secrets in ignored env files or a secret manager, not in committed files.

## Surface-Specific Guidance

Mobile:

- Respect the customer/rider/admin role split.
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
