import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.MOBILE_WEB_E2E_PORT ?? 8091);
const baseURL = process.env.MOBILE_WEB_E2E_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory ../../apps/mobile/build/web`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "chromium-mobile-viewport",
      use: { ...devices["Desktop Chrome"], viewport: { width: 393, height: 727 } },
    },
  ],
});
