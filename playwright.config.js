import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.js'],
  fullyParallel: true,
  reporter: 'list',
  use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'node tools/server.mjs --port 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
});
