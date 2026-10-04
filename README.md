# Crackjack

A comprehensive card counting training suite

## What's in it

| Screen | What it does |
|--------|--------------|
| **Play Blackjack** | A full table: betting, side bets, dealer errors to catch, and warnings when a play or bet differs from your strategy. |
| **Flash Drills** | Flash-card practice of playing decisions, with or without a count. |
| **Depth Drills** | Estimate decks (or aces) remaining from a discard tray. |
| **Count Drills** | Keep a running or true count as cards are dealt. |
| **Full Table Drills** | Count a whole table of hands at once (landscape). |
| **Settings** | One set of rules, playing strategy and true-count settings shared by the game and the drills, plus each drill's own options. |

39 counting systems are built in (plus a hole-carding strategy). Everything
works offline.

## Trying it on a desktop browser

You don't need a phone or any installation to try the app. You need
[Node.js](https://nodejs.org/) 22 or newer.

```bash
npm start                            # or: node tools/server.mjs
npm start -- --port 9000             # a different port
```

Then open <http://127.0.0.1:4173/> in Chrome, Safari or Firefox. The app must
be **served**; opening `index.html` directly as a `file://` page doesn't work,
because the browser won't load modules that way. The server reads files from
disk on every request, so there's no need to restart it after editing.

Tips for desktop testing:

- **Use a phone-sized window.** The app is laid out for phones. In Chrome open
  DevTools (`Cmd+Option+I`), turn on the device toolbar (`Cmd+Shift+M`) and pick
  an iPhone. Use its rotate button for landscape, which the Full Table Drills
  need. A mouse drag works as a swipe on the table and in the Flash drill.
- **Seeing your edits.** The app installs a service worker that caches every
  file for offline use, so after editing a file a plain reload may show the old
  version. In DevTools → Application → Service Workers, tick **Update on
  reload** (or **Bypass for network**). Running `npm run precache` also makes the
  next load pick up the changes.
- **Starting fresh.** Settings, bankroll and statistics are kept in local
  storage. **Reset Defaults** on the home screen resets the
  settings only; to wipe everything use DevTools → Application → Storage →
  **Clear site data**.

## Serving it to a phone

iOS Safari only installs a web app served over HTTPS, so the server has a
phone mode that serves HTTPS to your local network:

```bash
npm run serve                        # https://<your-mac>.local:8443/  (also https://localhost:8443/)
npm run serve -- --port 9000         # a different port
```

It uses [`mkcert`](https://github.com/FiloSottile/mkcert) to make a certificate
your Mac trusts:

```bash
brew install mkcert nss
mkcert -install        # once per Mac
```

On first run it writes a certificate for your Mac's `.local` hostname into
`.certs/` (git-ignored). Only the app's own files are served; the rest of the
repository (tests, `.git`, the certificates) is not.

## Installing on an iPhone (offline home-screen app)

The phone has to trust your Mac's certificate authority once; after that the app
installs and runs with no server at all.

1. On the Mac (same Wi-Fi as the phone) run `npm run serve` and note the
   `https://<your-mac>.local:8443/` URL.
2. Trust the local certificate authority on the iPhone:
   - Run `mkcert -CAROOT` on the Mac and AirDrop `rootCA.pem` from that folder
     to the phone.
   - iPhone: open the file → **Settings → Profile Downloaded → Install**.
   - **Settings → General → About → Certificate Trust Settings** → turn on full
     trust for the mkcert certificate.
3. In **Safari** (required for Add to Home Screen) open the `https://…` URL and
   wait a few seconds while it caches itself.
4. Share → **Add to Home Screen**.
5. Stop the server or turn on airplane mode, then tap the icon: it runs fully
   offline.

The certificate and the installed app are tied to your Mac's `.local` hostname,
so the installed app keeps working even if the Mac's IP address changes. If you
rename the Mac, delete `.certs/` and repeat the setup.

### Keeping settings across reinstalls

Settings live in the browser's local storage under the `cj.` prefix, so they
survive reloads and app updates. Deleting the installed app (or clearing Safari's
data for the site) clears them, and the app starts from the defaults in
`public/src/settings/schema.js` — edit that file if you want different defaults.

## Development

```bash
npm install                          # dev dependencies (Vitest, Playwright)
npm start                            # local server: http://127.0.0.1:4173/
npm run serve                        # phone server: https://<your-mac>.local:8443/
npx playwright install chromium      # once, for the browser tests
npm test                             # unit tests
npm run test:e2e                     # browser tests (starts its own server on port 4173)
npm run precache                     # update the service worker's file list after changing files
npm run add-strategy -- <code>       # bundle a strategy by its export code (optional --name "...")
npm run add-side-bet -- <code>       # bundle a side-bet game by its export code (optional --name "...")
npm run logo                         # redraw the app icon and wordmark (tools/logo.mjs)
```

Run `npm run precache` whenever you add, remove or change a file the app serves;
it refreshes the list and version in `public/sw.js` so installed copies update
themselves. The unit tests fail if you forget.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is organised and
  the conventions it follows.
- `tests/fixtures/` — behavior recorded from the original apps (strategy tables,
  play advice, counts, the drills' answers). The unit tests check the rebuild
  against it. The original apps themselves were removed from the code base; the
  git tag `original-apps-reference` marks the last commit that has them.
- [`CLAUDE.md`](CLAUDE.md) — a short guide for AI coding assistants working in
  this repository.
