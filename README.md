# Blackjack Verité

One offline blackjack practice app: four card-counting drills and a full game
with betting, sharing a single set of settings.

It is a rebuild of two QFIT web apps — [Blackjack Verité
Drills](http://www.qfit.com/apps/bjvd) and [Blackjack Verité
Games](http://www.qfit.com/apps/gcbj) — merged into one app written as plain
HTML, CSS and JavaScript modules. There is no build step: the files you edit are
the files the browser runs.

> **Ownership:** the original apps and their assets are `Copyright 2025 QFIT`.
> This repository is a personal rebuild for offline use; all rights to the
> original code, data and artwork remain with QFIT.

## What's in it

| Screen | What it does |
|--------|--------------|
| **Play Blackjack** | A full table: betting, side bets, dealer errors to catch, and warnings when a play or bet differs from your strategy. |
| **Flash Drills** | Flash-card practice of playing decisions, with or without a count. |
| **Depth Drills** | Estimate decks (or aces) remaining from a discard tray. |
| **Count Drills** | Keep a running or true count as cards are dealt. |
| **Full Table Drills** | Count a whole table of hands at once (landscape). |
| **Settings** | One set of rules, playing strategy and true-count settings shared by the game and the drills, plus each drill's own options. |

Over 40 counting systems are built in, and you can import your own strategy and
side-bet definitions by code. The casino database (CBJN) lets you load a real
casino's rules.

## Running it locally

The app is static files, but it must be **served** (not opened as `file://`),
because it loads modules and data files over HTTP.

```bash
./serve.sh          # https://<your-mac>.local:8443/
./serve.sh 9000     # a different port
```

`serve.sh` serves the app over HTTPS, which iOS Safari requires before it will
install a web app. It uses [`mkcert`](https://github.com/FiloSottile/mkcert) to
make a certificate your Mac trusts:

```bash
brew install mkcert nss
mkcert -install        # once per Mac
```

On first run it writes a certificate for your Mac's `.local` hostname into
`.certs/` (git-ignored). It also forwards the strategy-import and
casino-database requests to qfit.com, which only work while you are online.

Any static server works for quick local use; for example
`node tests/support/static-server.js 4173` then open
<http://127.0.0.1:4173/>. Service workers and installation need HTTPS or
`localhost`.

## Installing on an iPhone (offline home-screen app)

The phone has to trust your Mac's certificate authority once; after that the app
installs and runs with no server at all.

1. On the Mac (same Wi-Fi as the phone) run `./serve.sh` and note the
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

Settings live in the browser's local storage under the `bjv.` prefix, so they
survive reloads and app updates. Deleting the installed app (or clearing Safari's
data for the site) clears them, and the app starts from the defaults in
`src/settings/schema.js` — edit that file if you want different defaults.

## Development

```bash
npm install            # dev dependencies (Vitest, Playwright)
npm test               # unit tests
npm run test:e2e       # browser tests
npm run precache       # update the service worker's file list after changing files
```

Run `npm run precache` whenever you add, remove or change a file the app serves;
it refreshes the list and version in `sw.js` so installed copies update
themselves.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is organised and
  the conventions it follows.
- [`docs/CHANGES-FROM-ORIGINAL.md`](docs/CHANGES-FROM-ORIGINAL.md) — every place the
  rebuild behaves differently from the original apps, and why.
- `tests/fixtures/` — behavior recorded from the original apps (strategy tables,
  play advice, counts, the drills' answers). The unit tests check the rebuild
  against it.
