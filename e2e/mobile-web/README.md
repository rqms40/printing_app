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

The beta workflow contract lives in `tests/beta-workflow.spec.ts`. It records the admin, customer, and rider path from enabling beta mode through customer survey lockout, and it links the currently known audited gaps to GitHub issues.

Run the non-mutating contract checks:

```sh
npm test -- tests/beta-workflow.spec.ts
```

Run the opt-in live preflight against the dev compose stack:

```sh
GRIDGO_RUN_BETA_FLOW_E2E=1 \
MOBILE_WEB_E2E_URL=http://127.0.0.1:8088 \
GRIDGO_API_URL=http://127.0.0.1:3000/api \
npm test -- tests/beta-workflow.spec.ts
```

The live preflight expects `docker-compose.dev.yml` to already be running. It verifies the API and mobile web surfaces before a destructive beta QA run; the full customer/admin/rider flow remains tracked by the contract steps and the linked issues.
