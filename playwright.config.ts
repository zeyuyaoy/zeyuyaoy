import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(tmpdir(), "portfolio-research-playwright"),
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3117",
    trace: "retain-on-failure",
    launchOptions: { timeout: 20_000 },
  },
  reporter: "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node scripts/research-test-server.mjs",
    url: "http://127.0.0.1:3117/",
    timeout: 90_000,
    reuseExistingServer: false,
    env: {
      PORT: "3117",
      TEST_REDIS_URL: process.env.TEST_REDIS_URL || "redis://127.0.0.1:6398/15",
    },
  },
});
