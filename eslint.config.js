import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist/', 'test-results/', 'playwright-report/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { rules: { eqeqeq: ['error', 'smart'] } },
  { files: ['src/**/*.tsx'], ...reactHooks.configs.flat.recommended },
  { files: ['src/**'], languageOptions: { globals: globals.browser } },
  { files: ['src/sw.ts'], languageOptions: { globals: globals.serviceworker } },
  { files: ['tools/**', 'tests/**', '*.config.*'], languageOptions: { globals: globals.node } },
  // Playwright runs page.evaluate() callbacks in the browser.
  { files: ['tests/e2e/**'], languageOptions: { globals: globals.browser } },
);
