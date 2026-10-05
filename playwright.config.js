import { defineConfig, devices } from '@playwright/test';

/** Every test runs on an iPhone 13 profile, in both engines the app meets. */
const iPhone = devices['iPhone 13'];

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.js'],
  fullyParallel: true,
  reporter: 'list',
  use: { ...iPhone, baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // WebKit is Safari's engine, so it is the closest check on what the iPhone runs.
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node tools/server.mjs --port 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
});
