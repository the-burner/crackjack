import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist/', 'test-results/', 'playwright-report/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { rules: { eqeqeq: ['error', 'smart'] } },
  // Allowed while the files are moved to TypeScript one at a time.
  { rules: { '@typescript-eslint/ban-ts-comment': ['error', { 'ts-nocheck': false }] } },
  { files: ['src/**'], languageOptions: { globals: globals.browser } },
  { files: ['src/sw.ts'], languageOptions: { globals: globals.serviceworker } },
  { files: ['tools/**', 'tests/**', '*.config.*'], languageOptions: { globals: globals.node } },
  // Playwright runs page.evaluate() callbacks in the browser.
  { files: ['tests/e2e/**'], languageOptions: { globals: globals.browser } },
);
