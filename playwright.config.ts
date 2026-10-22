import { defineConfig, devices } from "@playwright/test";
import fs from "fs";

const existingHeadless =
  "C:/Users/jatur/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe";
const existingChrome =
  "C:/Users/jatur/AppData/Local/ms-playwright/chromium-1243/chrome-win/chrome.exe";

const executablePath = fs.existsSync(existingHeadless)
  ? existingHeadless
  : fs.existsSync(existingChrome)
  ? existingChrome
  : undefined;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3300",
    trace: "on-first-retry",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: "chromium",
      // viewport after the device preset, otherwise Desktop Chrome silently resets it to 1280x720
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3300/api/auth/me",
        reuseExistingServer: true,
        timeout: 60000,
      },
});
