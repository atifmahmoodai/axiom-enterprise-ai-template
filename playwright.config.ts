import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login/",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
