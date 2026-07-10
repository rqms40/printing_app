# Mobile Web E2E

Playwright smoke tests for the Flutter mobile web release build.

## Run

```sh
npm install
npm run build:web
npm test
```

`npm test` serves `apps/mobile/build/web` on `127.0.0.1:8091` and runs Chromium checks at desktop and narrow mobile viewports.

## Beta Workflow Regression

The beta workflow contract lives in `tests/beta-workflow.spec.ts`. It records the admin, customer, and rider path from enabling beta mode through customer survey lockout, and it links audited regressions to GitHub issues.

Run the non-mutating contract checks:

```sh
npm test -- tests/beta-workflow.spec.ts
```

Run the CI-style contract checks without starting a local web server:

```sh
MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts
```

Run the opt-in live preflight against the dev compose stack:

```sh
GRIDGO_RUN_BETA_FLOW_E2E=1 \
MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
GRIDGO_ADMIN_URL=http://127.0.0.1:8189 \
GRIDGO_API_URL=http://127.0.0.1:3000/api \
npm test -- tests/beta-workflow.spec.ts
```

The live preflight expects `docker-compose.dev.yml` to already be running. It verifies the API, mobile web, and responsive admin login surfaces without creating beta workflow records.

Run the opt-in destructive API workflow only against an isolated dev stack:

```sh
GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1 \
MOBILE_WEB_E2E_NO_SERVER=1 \
GRIDGO_API_URL=http://127.0.0.1:3000/api \
GRIDGO_ADMIN_EMAIL=<dev-admin-email> \
GRIDGO_ADMIN_PASSWORD=<dev-admin-password> \
GRIDGO_RIDER_EMAIL=<dev-rider-email> \
GRIDGO_RIDER_PASSWORD=<dev-rider-password> \
npm test -- tests/beta-workflow-destructive.spec.ts
```

This scenario creates two new beta customers, files, addresses, orders, delivery assignments, proofs, surveys, and a testimonial. It intentionally remains skipped unless explicitly enabled and credentials are supplied through the environment.
