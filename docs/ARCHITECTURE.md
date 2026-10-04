# Architecture

Crackjack is a static, offline-first web app written as plain ES
modules. There is no build step: everything the browser loads is in `public/`,
served as-is — `public/index.html` loads `public/src/main.js`. Everything outside
`public/` (tests, tools, docs) is for development only.

## Layout

```
public/          the app: the only folder the server serves
  index.html     the page; loads src/main.js
  manifest.webmanifest  install manifest (name, icons, colours)
  sw.js          service worker: offline cache (must sit at the site root)
  assets/        images and sounds (cards, table, trays, shoe, sounds, icons)
  src/
    main.js        entry point: creates the app, registers screens, opens Home
    app/           createApp() / createServices() and the screen router
    core/          pure logic shared by everything, no DOM
      cards.js       card ids, ranks, suits, hand totals
      counting.js    running count, true count, side counts, decks remaining
      random.js      seeded and default random sources, shuffling
      strategy/      strategy-file parsing, table building, play and insurance
                     advice, and the cell formatting the table viewer draws
    settings/      the settings schema and store, the strategy catalog, and the
                   pure rules behind the settings screens (rule interactions,
                   bet ramp, side-bet game decoding)
    services/      namespaced localStorage, sound effects, strategy-error tallies
    ui/            DOM helpers, components, dialogs, the standard screen layout,
                   card sprites, the stylesheets, and the colour themes
                   (theme.js; Classic in :root, Catppuccin in themes.css)
    screens/       Home and Help, the settings screens (settings/) and the
                   strategy, true count and betting screens (strategy/)
    drills/        the four drills; shared/ holds what they have in common
      <drill>/       logic.js (pure), options.js and screen.js
    game/
      engine/        the round as a pure state machine: hands, shoe, rules,
                     settlement, side bets
      session.js     the engine plus the count, bankroll, statistics and
                     strategy checking, persisted across visits
      play-check.js  is this play or bet what the strategy calls for?
      dealer-errors.js  the deliberate dealer mistakes and Foul claims
      table/         drawing and animating the table, the betting overlay,
                     gestures
      screens/       the table, the bet picker and the statistics screen
    data/          bundled data: strategy files, side-bet games, help text
tests/
  unit/          Vitest tests for public/src/
  e2e/           Playwright tests of the running app
  fixtures/      reference data recorded from the original apps (gzipped JSON)
  support/       the fixture loader
tools/           the app's web server (server.mjs), the service worker's
                 precache list generator, and bundle-import.mjs, which bundles
                 strategies and side-bet games from their export codes
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
  is a pure module (`core/`, `settings/`, `game/engine/`, `drills/*/logic.js`)
  and is unit tested. Screens only render state and turn input into calls.
- **Screens** are factories `(app, params) => ({ el, onShow?, onHide?, destroy?, onBack? })`
  registered by name (`app.open(name, params)`, `app.back()`). Use
  `standardScreen()` for the title bar and body, and the controls in
  `ui/components.js` (button, select, checkList, valueButton, slider, field).
- **Settings** are declared once in `settings/schema.js` (dotted keys, typed,
  with defaults) and read and written through `app.settings`. State that is not
  a preference (bankroll, statistics) is stored through
  `app.storage` under its own key. All keys are prefixed `cj.`.
- **Randomness** is injected: functions take a `random` function returning
  [0, 1), so tests can pass `seededRandom(seed)`.
- **Card ids** are 1..52 (`suit * 13 + rank`, rank 1..13, suits spades, clubs,
  hearts, diamonds — the row order of `public/assets/cards/cards.png`).
- **Canvas drawing** scales the backing store by `devicePixelRatio`
  (`setupCanvas()` in `ui/card-sprites.js`).
- **Help** text for a screen lives in `data/help.js` under the screen's name.
- Code style: 2-space indent, single quotes, semicolons, named exports, small
  modules, JSDoc on exported functions whose shape is not obvious.

## Tests

- `npm test` runs the unit tests. Several of them replay data recorded from the
  original apps (`tests/fixtures/`): every strategy table for every rule set and
  index limit, about a million play-advice decisions, dealt shoes with their
  running and true counts, the strategy table viewer's cells, the drills' hand
  lists, answer grids and tray photos. They pin the rebuild's behavior to the
  original's.
- `npm run test:e2e` drives the running app in a mobile browser: every screen,
  playing rounds at the table, and running each drill.

## Offline

`public/sw.js` precaches every file in `public/`. Its file list and version are
generated: run `npm run precache` after adding, removing or changing a file.
`npm run precache:check` fails if the list is out of date.
