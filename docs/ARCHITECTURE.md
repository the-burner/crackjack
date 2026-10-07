# Architecture

Crackjack is a static, offline-first web app in strict TypeScript, built with
Vite: `index.html` loads `src/main.ts`, and `npm run build` bundles it, with the
files in `public/`, into `dist/`. Menu and settings screens are React
components; the canvas screens (the drills and the table) are imperative.
Everything else (tests, tools, docs) is for development only.

## Layout

```
index.html       the page; loads src/main.ts
public/          copied into the build as-is
  manifest.webmanifest  install manifest (name, icons, colours)
  assets/        images and sounds (cards, table, trays, shoe, sounds, icons)
src/
  main.ts        entry point: creates the app, registers screens, opens Home
  sw.ts          service worker source: offline precache, built to dist/sw.js
  app/           createApp() / createServices() and the screen router
  core/          pure logic shared by everything, no DOM
    cards.ts       card ids, ranks, suits, hand totals
    counting.ts    running count, true count, side counts, decks remaining
    random.ts      seeded and default random sources, shuffling
    strategy/      strategy-file parsing, table building, play and insurance
                   advice, and the cell formatting the table viewer draws
  settings/      the settings schema and store, the strategy catalog, and the
                 pure rules behind the settings screens (rule interactions,
                 bet ramp, side-bet game decoding)
  services/      namespaced localStorage, sound effects (Web Audio),
                 strategy-error tallies, the screen wake lock
  ui/            DOM helpers, imperative components, dialogs, the standard
                 screen layout, card sprites, the stylesheets, and the colour
                 themes (theme.ts; Classic in :root, Catppuccin in themes.css)
  react/         reactScreen(), useApp()/useSettings(), the controls as React
                 components, and settings-bound controls
  screens/       (React) Home and Help, the settings screens (settings/) and
                 the strategy, true count and betting screens (strategy/)
  drills/        the four drills; shared/ holds what they have in common
    <drill>/       logic.ts (pure), options.tsx (React) and screen.ts (canvas)
  game/
    engine/        the round as a pure state machine: hands, shoe, rules,
                   settlement, side bets, and the GameEvent union (events.ts)
    session.ts     the engine plus the count, bankroll, statistics and
                   strategy checking, persisted across visits
    play-check.ts  is this play or bet what the strategy calls for?
    dealer-errors.ts  the deliberate dealer mistakes and Foul claims
    dealer-error-round.ts  a round's dealer error, from pick to claim
    bet-validation.ts  table limits, affordability, side-bet multiples
    table/         drawing and animating the table, the betting overlay,
                   gestures, controls and labels
    screens/       the table (canvas), the bet picker and statistics (React)
  data/          bundled data: strategy files, side-bet games, help text
tests/
  unit/          Vitest tests for src/ (react/ ones run in jsdom)
  e2e/           Playwright tests of the running app
  fixtures/      reference data recorded from the original apps (gzipped JSON)
  support/       the fixture loader
tools/           certs.ts (HTTPS certificates for serving to a phone),
                 bundle-import.ts, which bundles strategies and side-bet games
                 from their export codes, and logo.ts
docs/            this document
```

## How the pieces fit

`createApp()` builds the shared services — `app.settings`, `app.storage`,
`app.strategies`, `app.sound`, `app.errorTallies` — and a router. Every screen
receives `app`, reads and writes settings through it, and opens other screens
by name with `app.open(name, params)`.

The drills and the game both get their strategy from
`app.strategies.current(app.settings, decks)`, so the Playing Strategy and True
Count screens drive both.

The game is split three ways. The **engine** knows the rules and nothing else:
`startRound()`, `act()`, `takeInsurance()` and friends advance it and return the
events that happened (a card dealt, a hand settled, ...). The **session** wraps
the engine with what lasts between rounds. The **table screen** animates the
engine's events at the user's speed settings and refuses input until the
animation is done.

## Conventions

- **Logic and UI are separate.** Anything that can be expressed without the DOM
  is a pure module (`core/`, `settings/`, `game/engine/`, `game/*.ts`,
  `drills/*/logic.ts`) and is unit tested. Screens only render state and turn
  input into calls.
- **Screens** are factories `(app, params) => ({ el, onShow?, onHide?, destroy?, onBack? })`
  registered by name (`app.open(name, params)`, `app.back()`). React screens are
  built with `reactScreen(Component, { className })`: the first render happens
  before the factory returns, `useOnShow`/`useOnHide`/`useOnBack` receive the
  router's lifecycle, and `useSettings()` re-renders on any settings change.
  Imperative screens use `standardScreen()` and `ui/components.ts`; both
  component sets render the same markup, so the stylesheets serve both.
- **Settings** are declared once in `settings/schema.ts` (dotted keys, typed,
  with defaults); `app.settings.get/set` are typed per key. They are saved as
  `{ version, values }`, and `migrate()` in `settings/store.ts` reads older
  shapes. State that is not a preference (bankroll, statistics) is stored
  through `app.storage` under its own key. All keys are prefixed `cj.`.
- **Randomness** is injected: functions take a `random` function returning
  [0, 1), so tests can pass `seededRandom(seed)`.
- **Card ids** are 1..52 (`suit * 13 + rank`, rank 1..13, suits spades, clubs,
  hearts, diamonds — the row order of `public/assets/cards/cards.png`).
- **Canvas drawing** scales the backing store by `devicePixelRatio`
  (`setupCanvas()` in `ui/card-sprites.ts`).
- **Help** text for a screen lives in `data/help.ts` under the screen's name.
- **Types**: strict TypeScript with no `any` or suppressions; erasable syntax
  only (no enums), so Node runs the tools and Vitest the tests directly.
- Code style: Prettier, named exports, small modules, a doc comment on exported
  functions whose shape is not obvious.

## Tests

- `npm test` runs the unit tests. Several of them replay data recorded from the
  original apps (`tests/fixtures/`): every strategy table for every rule set and
  index limit, about a million play-advice decisions, dealt shoes with their
  running and true counts, the strategy table viewer's cells, the drills' hand
  lists, answer grids and tray photos. They pin the rebuild's behavior to the
  original's.
- `npm run test:e2e` drives the running app in a mobile browser: every screen,
  playing rounds at the table, and running each drill. It runs on the Vite dev
  server, so tests can import and patch the app's modules in the page; the
  tests tagged `@build` (offline use) run on the production build instead.
- CI (`.github/workflows/ci.yml`) runs lint, the type check, and both suites.

## Offline

`src/sw.ts` is built by vite-plugin-pwa (`injectManifest`), which writes the
list of built files into it, so every build precaches exactly what it ships.
A new build installs in the background and waits; `main.ts` then asks whether
to reload, and on Reload the new worker takes over. Offline navigations to any
other URL are redirected to `index.html`, so relative asset paths resolve.

The build uses relative URLs (`base: './'`), so `dist/` works under any path and
can be wrapped by Capacitor later (which would skip the service worker).
