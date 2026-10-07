import { defineConfig, type PreviewOptions } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { certificateFor, localHostName } from './tools/certs.mjs';

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
  plugins: [
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
}));
