import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.js', 'legacy/**/*.spec.js'],
  fullyParallel: true,
  reporter: 'list',
  use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'node tests/support/static-server.js 4173',
    url: 'http://127.0.0.1:4173/package.json',
    reuseExistingServer: true,
  },
});
