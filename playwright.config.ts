import { defineConfig, devices } from '@playwright/test';

/**
 * The devices the app is built for, each upright and on its side, in WebKit
 * (Safari's engine, which every browser on iPhone and iPad uses).
 */
const iPhone = devices['iPhone 15 Pro'];
const iPhoneLandscape = devices['iPhone 15 Pro landscape'];
/** iPad (A16), the 11th generation. */
const iPad = devices['iPad (gen 11)'];
const iPadLandscape = devices['iPad (gen 11) landscape'];

/**
 * Most tests run against the dev server, whose unbundled modules they can
 * import and patch in the page. Tests tagged @build need the service worker,
 * so they run against the production build.
 */
const DEV = 'http://127.0.0.1:5174';
const BUILD = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts'],
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: DEV },
  projects: [
    { name: 'iphone', grepInvert: /@build/, use: { ...iPhone, browserName: 'webkit' } },
    { name: 'iphone-landscape', grepInvert: /@build/, use: { ...iPhoneLandscape, browserName: 'webkit' } },
    { name: 'ipad', grepInvert: /@build/, use: { ...iPad, browserName: 'webkit' } },
    { name: 'ipad-landscape', grepInvert: /@build/, use: { ...iPadLandscape, browserName: 'webkit' } },
    // Chromium: Playwright's WebKit build crashes when offline. The service worker is engine-independent.
    { name: 'build', grep: /@build/, use: { ...iPhone, browserName: 'chromium', baseURL: BUILD } },
  ],
  webServer: [
    {
      command: 'E2E=1 npx vite --host 127.0.0.1 --port 5174 --strictPort',
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
