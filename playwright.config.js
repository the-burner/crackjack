import { defineConfig, devices } from '@playwright/test';

/** Every test runs on an iPhone 13 profile in both engines the app meets, and on an iPad in WebKit. */
const iPhone = devices['iPhone 13'];
const iPad = devices['iPad Pro 11'];

/**
 * Most tests run against the dev server, whose unbundled modules they can
 * import and patch in the page. Tests tagged @build need the service worker,
 * so they run against the production build.
 */
const DEV = 'http://127.0.0.1:5174';
const BUILD = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.js'],
  fullyParallel: true,
  reporter: 'list',
  use: { ...iPhone, baseURL: DEV },
  projects: [
    { name: 'chromium', grepInvert: /@build/, use: { browserName: 'chromium' } },
    // WebKit is Safari's engine, so it is the closest check on what the iPhone runs.
    { name: 'webkit', grepInvert: /@build/, use: { browserName: 'webkit' } },
    { name: 'ipad', grepInvert: /@build/, use: { ...iPad, browserName: 'webkit' } },
    // Chromium only: Playwright's WebKit build crashes when offline.
    { name: 'build', grep: /@build/, use: { browserName: 'chromium', baseURL: BUILD } },
  ],
  webServer: [
    {
      command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
      url: `${DEV}/index.html`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npx vite preview --strictPort',
      url: `${BUILD}/index.html`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
