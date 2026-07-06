# Mobile Web E2E

Playwright smoke tests for the Flutter mobile web release build.

## Run

```sh
npm install
npm run build:web
npm test
```

`npm test` serves `apps/mobile/build/web` on `127.0.0.1:8091` and runs Chromium checks at desktop and narrow mobile viewports.
