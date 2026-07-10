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

This scenario creates two new beta customers, files, addresses, orders, delivery assignments, proofs, surveys, and testimonials. It intentionally remains skipped unless explicitly enabled and credentials are supplied through the environment.

## Screenshot-backed beta release workflow

`tests/beta-workflow-visual.spec.ts` is the opt-in release audit. It uses one
Chromium process with four independent contexts: admin at 1440x900 and Mark,
Ven, and Juan at 393x852. Juan alone receives geolocation permission. The
journey enables Flutter semantics before semantic locators are used, performs
real UI mutations, checks every mutation response, and filters Juan's route to
the two orders created by that run.

Run it only after recreating the isolated compose stack:

```sh
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

The Browser plugin is not installed in this environment, so this approved
workflow uses repository Playwright Chromium. It does not complete an external
social-network post: it requires the share popup callback and then aborts the
external resource. Screenshots, SHA-256 hashes, sanitized console/network logs,
videos, and the JSON manifest default to
`/tmp/gridgo-beta-visual/<run-id>`, outside committed source. Override that
location with `GRIDGO_BETA_EVIDENCE_DIR`. Do not point it into the repository or
publish it without reviewing the sanitization output.

Playwright traces are deliberately disabled for the authenticated visual
project. Retained traces include request headers and can expose bearer tokens;
there is no proven trace-archive redaction pass in this harness. Sanitized
method/URL/status network logs and token-free videos are retained instead.

Axe WCAG 2A/2AA checks run on selected login, checkout, queue, proof, survey,
and held screens and fail on serious or critical findings. Axe can inspect the
enabled Flutter semantics DOM, but not CanvasKit pixels; every manifest entry
for an Axe screen records that limitation. Screenshot assertions separately
cover nonblank content, title/URL identity, overlays, console errors, viewport
overflow, PNG dimensions, and step-specific durable state.
