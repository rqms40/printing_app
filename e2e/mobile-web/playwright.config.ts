import { defineConfig, devices } from "@playwright/test";
import { chromiumSecureContextArgs } from "./fixtures/browser-security";

const port = Number(process.env.MOBILE_WEB_E2E_PORT ?? 8091);
const baseURL = process.env.MOBILE_WEB_E2E_URL ?? `http://127.0.0.1:${port}`;
const startWebServer = process.env.MOBILE_WEB_E2E_NO_SERVER !== "1";
const betaVisualWorkflow = process.env.GRIDGO_RUN_BETA_FLOW_VISUAL === "1";
const catalogVisualWorkflow = process.env.GRIDGO_RUN_CATALOG_RFQ_VISUAL === "1";
const visualWorkflow = betaVisualWorkflow || catalogVisualWorkflow;

export default defineConfig({
  testDir: "./tests",
  timeout: visualWorkflow ? 30 * 60_000 : 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: visualWorkflow ? 1 : undefined,
  reporter: [["list"]],
  outputDir: visualWorkflow
    ? (process.env.GRIDGO_BETA_PLAYWRIGHT_OUTPUT ??
      process.env.GRIDGO_CATALOG_RFQ_PLAYWRIGHT_OUTPUT ??
      "/tmp/gridgo-visual/playwright")
    : "test-results",
  use: {
    baseURL,
    trace: visualWorkflow ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: startWebServer
    ? {
        command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory ../../apps/mobile/build/web`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "chromium-mobile-viewport",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 393, height: 727 },
      },
    },
    ...(betaVisualWorkflow
      ? [
          {
            name: "beta-visual",
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
              launchOptions: {
                // The full bundled Chromium honors secure-origin test
                // allowlists; chrome-headless-shell does not.
                channel: "chromium",
                args: [
                  "--disable-background-timer-throttling",
                  "--disable-renderer-backgrounding",
                  "--disable-backgrounding-occluded-windows",
                  ...chromiumSecureContextArgs(baseURL),
                ],
              },
            },
          },
        ]
      : []),
    ...(catalogVisualWorkflow
      ? [
          {
            name: "catalog-rfq-visual",
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
              launchOptions: {
                channel: "chromium",
                args: [
                  "--disable-background-timer-throttling",
                  "--disable-renderer-backgrounding",
                  "--disable-backgrounding-occluded-windows",
                  ...chromiumSecureContextArgs(baseURL),
                ],
              },
            },
          },
        ]
      : []),
  ],
});
