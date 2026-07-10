import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.MOBILE_WEB_E2E_PORT ?? 8091);
const baseURL = process.env.MOBILE_WEB_E2E_URL ?? `http://127.0.0.1:${port}`;
const startWebServer = process.env.MOBILE_WEB_E2E_NO_SERVER !== "1";
const visualWorkflow = process.env.GRIDGO_RUN_BETA_FLOW_VISUAL === "1";

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
      "/tmp/gridgo-beta-visual/playwright")
    : "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
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
    ...(visualWorkflow
      ? [
          {
            name: "beta-visual",
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
            },
          },
        ]
      : []),
  ],
});
