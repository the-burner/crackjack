# CLAUDE.md

Blackjack Verité: one offline blackjack practice web app (four drills + a full
game) rebuilt from two QFIT apps. Plain HTML/CSS/ES modules, **no build step** —
the files in `src/` are what the browser runs.

## Commands

```bash
npm test                 # Vitest unit tests (fast; run after any logic change)
npm run test:e2e         # Playwright browser tests (iPhone 13 profile, port 4173)
npm run precache         # regenerate sw.js file list — REQUIRED after adding/removing/changing any served file
npm run precache:check   # fails if sw.js is stale (also enforced by tests/unit/precache.test.js)
./serve.sh [PORT]        # HTTPS server for phones (needs mkcert); default 8443
node tests/support/static-server.js 4173   # plain HTTP server for local dev
```

Run a single test: `npx vitest run tests/unit/game/engine.test.js` or
`npx playwright test tests/e2e/drills.spec.js -g "name"`.

## Layout

- `src/core/` — pure logic shared by everything: cards, counting, random, strategy (parsing, tables, advisor).
- `src/settings/` — `schema.js` (every setting, type and default), store, strategy catalog, and pure rule logic behind the settings screens.
- `src/game/engine/` — the round as a pure state machine; `session.js` wraps it with count/bankroll/stats; `table/` + `screens/` are the UI.
- `src/drills/<flash|depth|count|full>/` — `logic.js` (pure) + `options.js` + `screen.js`; shared machinery in `drills/shared/`.
- `src/screens/` — home, help, settings screens (`settings/`), strategy/TC/betting/casino screens (`strategy/`).
- `src/ui/` — DOM helpers, components, dialogs, `standardScreen()`, card sprites, CSS.
- `src/data/` — bundled strategy files, side-bet game definitions, help text (keyed by screen name).
- `docs/ARCHITECTURE.md` — fuller description. `docs/CHANGES-FROM-ORIGINAL.md` — every intentional difference from the original apps.

## Conventions

- Keep logic DOM-free and unit tested; screens only render and wire input. New logic goes in a pure module, not a screen.
- Screens are factories `(app, params) => ({ el, onShow?, onHide?, destroy?, onBack? })`, registered by name in the area's `index.js`, opened with `app.open(name, params)`.
- Settings: add to `src/settings/schema.js` (dotted keys, typed, with default) and use `app.settings.get/set`. Non-preference state (bankroll, stats, imports) goes through `app.storage` (keys prefixed `bjv.`). Changing a default changes what fresh installs get.
- Randomness is injected (`random` param); tests use `seededRandom(seed)` from `src/core/random.js`.
- Card ids are 1..52 (`suit * 13 + rank`; suits spades, clubs, hearts, diamonds).
- Canvas drawing must go through `setupCanvas()` (devicePixelRatio aware).
- Reuse `ui/components.js` (button, select, checkList, valueButton, slider, field) and keep the original visual style (peach page, red title chip, blue Back/Help).
- Style: 2-space indent, single quotes, semicolons, named exports, small modules.

## Gotchas

- `tests/fixtures/*.json.gz` is behavior recorded from the original apps; it **cannot be regenerated** (the originals were removed — recoverable from git tag `original-apps-reference`). If a fixture test fails, the code changed behavior: either fix the code or, if the change is intentional, document it in `docs/CHANGES-FROM-ORIGINAL.md` and adjust the test deliberately.
- Any behavior change versus the original apps must be recorded in `docs/CHANGES-FROM-ORIGINAL.md`.
- Forgetting `npm run precache` means installed (offline) copies won't update, and the unit suite fails.
- Strategy import, side-bet import and the casino database call qfit.com through same-origin `/apps/*` paths; only `serve.sh` proxies them.
- Don't reintroduce code-generator-style names (`frm*`, numeric option arrays, globals) — the codebase intentionally has none.
