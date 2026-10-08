# Crackjack

A comprehensive card counting training suite

## What's in it

| Screen                | What it does                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Play Blackjack**    | A full table: betting, side bets, dealer errors to catch, and warnings when a play or bet differs from your strategy. |
| **Flash Drills**      | Flash-card practice of playing decisions, with or without a count.                                                    |
| **Depth Drills**      | Estimate decks (or aces) remaining from a discard tray.                                                               |
| **Count Drills**      | Keep a running or true count as cards are dealt.                                                                      |
| **Full Table Drills** | Count a whole table of hands at once (landscape).                                                                     |
| **Settings**          | What the game and the drills share: the playing strategy, the true count, the theme and sound.                        |

39 counting systems are built in (plus a hole-carding strategy). Everything
works offline.

## Installing on an iPhone or iPad

The app is published at **https://the-burner.github.io/crackjack/**.

1. Open the link in **Safari** (required for Add to Home Screen) and wait a few
   seconds while it caches itself.
2. Share → **Add to Home Screen**.
3. Tap the icon: it runs fully offline from then on.

When a new version is published, the installed app asks whether to reload the
next time it is opened online. Settings, bankroll and statistics are kept on
the device; deleting the app (or clearing Safari's data for the site) resets
them to the defaults in `src/settings/schema.ts`.

## Development

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm install                          # dev dependencies (Vite, TypeScript, ESLint, Vitest, Playwright)
npm run dev                          # dev server with hot reload: http://localhost:5173/
npm run build                        # production build into dist/
npm run preview                      # build and serve dist/: http://127.0.0.1:4173/
npm run serve                        # build and serve dist/ to phones: https://<your-mac>.local:8443/
npx playwright install chromium webkit  # once, for the browser tests
npm test                             # unit and component tests (Vitest)
npm run test:coverage                # the same, with coverage
npm run test:e2e                     # browser tests (starts the dev server and a build)
npm run lint                         # ESLint
npm run typecheck                    # TypeScript
npm run add-strategy -- <code>       # bundle a strategy by its export code (optional --name "...")
npm run add-side-bet -- <code>       # bundle a side-bet game by its export code (optional --name "...")
npm run logo                         # redraw the app icon and wordmark (tools/logo.ts)
```

### In a desktop browser

`npm run dev` serves the source with hot reload and no service worker;
`npm run preview` builds `dist/` and serves it as an installed copy would see
it, offline cache included (after rebuilding, it asks to reload).

- **Use a phone-sized window.** In Chrome open DevTools (`Cmd+Option+I`), turn
  on the device toolbar (`Cmd+Shift+M`) and pick an iPhone. Use its rotate
  button for landscape, which the Full Table Drills need. A mouse drag works as
  a swipe on the table and in the Flash drill.
- **Starting fresh.** **Reset Defaults** on the home screen resets the settings
  only; to wipe everything use DevTools → Application → Storage → **Clear site
  data**.

### On a phone, from your Mac

To try a build on a phone before publishing it, `npm run serve` builds the app
and serves it over HTTPS to your local network (iOS only installs web apps
served over HTTPS):

```bash
npm run serve                        # https://<your-mac>.local:8443/  (also https://localhost:8443/)
npm run serve -- --port 9000         # a different port
```

It uses [`mkcert`](https://github.com/FiloSottile/mkcert) for a certificate
your Mac trusts (`brew install mkcert nss`, then `mkcert -install` once per
Mac); on first run it writes one for your Mac's `.local` hostname into `.certs/`
(git-ignored). The phone has to trust that certificate authority once:

1. Run `mkcert -CAROOT` on the Mac and AirDrop `rootCA.pem` from that folder to
   the phone.
2. On the phone: open the file → **Settings → Profile Downloaded → Install**,
   then **Settings → General → About → Certificate Trust Settings** → turn on
   full trust for the mkcert certificate.
3. With the phone on the same Wi-Fi, open `https://<your-mac>.local:8443/` in
   Safari; it can be added to the Home Screen like the published app.

A copy installed this way is a separate app from the published one, with its
own settings. If you rename the Mac, delete `.certs/` and repeat the setup.

### Tests

The browser tests run in WebKit (Safari's engine) as an iPhone 15 Pro and an
iPad (A16), each upright and sideways; the offline tests run once on the
production build. To run one device only: `npx playwright test --project=iphone`
(or `iphone-landscape`, `ipad`, `ipad-landscape`).

### Publishing

CI (`.github/workflows/ci.yml`) runs lint, the type check, the unit tests and
the build on every push and pull request, and publishes each passing push to
`main` to GitHub Pages (the repository's **Settings → Pages → Source** is
**GitHub Actions**). The browser tests are run locally (`npm run test:e2e`);
they are timing-sensitive and too slow on CI runners. The service worker's file
list is generated by each build, so installed copies pick up every change.

### More

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is organised and
  the conventions it follows.
- `tests/fixtures/` — behavior recorded from the original apps (strategy tables,
  play advice, counts, the drills' answers). The unit tests check the rebuild
  against it. The original apps themselves were removed from the code base; the
  git tag `original-apps-reference` marks the last commit that has them.
- [`CLAUDE.md`](CLAUDE.md) — a short guide for AI coding assistants working in
  this repository.
