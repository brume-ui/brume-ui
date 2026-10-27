import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  expect: {
    // Strict on purpose: a site-wide font swap must fail. Loosen per screenshot only where flaky, with a reason.
    toHaveScreenshot: { animations: 'disabled', scale: 'css', threshold: 0.2, maxDiffPixels: 50 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Builds against the packages' dist output, so run `pnpm build` at the root first.
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
