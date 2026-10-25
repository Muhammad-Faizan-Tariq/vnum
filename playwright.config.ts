import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./e2e/env";

export default defineConfig({
  testDir: "./e2e",
  // One shared seeded database: specs run serially so mutations never race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E.baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build by default (closest to real behaviour); E2E_DEV=1 uses the dev server.
    command: process.env.E2E_DEV
      ? `npx next dev -p ${E2E.port}`
      : `npx next build && npx next start -p ${E2E.port}`,
    url: E2E.baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: E2E.databaseUrl,
      PAYMENT_WEBHOOK_SECRET: E2E.webhookSecret,
      DEMO_MODE: "true",
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
