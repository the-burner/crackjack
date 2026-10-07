/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig, type PreviewOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { certificateFor, localHostName } from './tools/certs';

/** `--mode phone` serves HTTPS on the network, so a phone can install the app. */
function previewFor(mode: string): PreviewOptions {
  if (mode !== 'phone') return { host: '127.0.0.1', port: 4173 };
  const hostName = localHostName();
  console.log(`On a phone, open https://${hostName}:8443/`);
  return { host: '0.0.0.0', port: 8443, https: certificateFor(hostName) };
}

export default defineConfig(({ mode }) => ({
  // Relative URLs, so the build works under any path and inside Capacitor.
  base: './',
  preview: previewFor(mode),
  // The e2e server serves edits without reloading pages under a running test.
  server: process.env.E2E ? { hmr: false } : undefined,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      // public/manifest.webmanifest is used as it is.
      manifest: false,
      injectManifest: { globPatterns: ['**/*.{html,js,css,png,jpg,svg,mp3,webmanifest}'] },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['tests/unit/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup/dom.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // events.ts holds only types.
      exclude: ['src/data/**', 'src/sw.ts', 'src/game/engine/events.ts'],
      reporter: ['text-summary', 'html'],
      // Just under the current numbers, so a drop fails the run.
      thresholds: {
        'src/core/**': { statements: 99, branches: 99, functions: 99, lines: 99 },
        'src/game/engine/**': { statements: 98, branches: 98, functions: 99, lines: 99 },
        'src/settings/**': { statements: 99, branches: 98, functions: 99, lines: 99 },
      },
    },
  },
}));
