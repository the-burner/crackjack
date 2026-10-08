# Architecture

Crackjack is a static, offline-first web app in strict TypeScript, built with
Vite: `index.html` loads `src/main.tsx`, and `npm run build` bundles it, with the
files in `public/`, into `dist/`. The UI is React 19 with React Router (hash
routes), Zustand stores, and Tailwind CSS v4 with the app's own component
library (the original app's look); the canvas
drawing (cards, trays, the table) is plain TypeScript that React drives through
refs. Everything else (tests, tools, docs) is for development only.

## Layout

```
index.html       the page; loads src/main.tsx
public/          copied into the build as-is
  manifest.webmanifest  install manifest (name, icons, colours)
  assets/        images and sounds (cards, table, trays, shoe, sounds, icons)
src/
  main.tsx       entry point: creates the services, renders the router
  sw.ts          service worker source: offline precache, built to dist/sw.js
  index.css      Tailwind, the type scale, animations, base styles
  app/           routes.tsx (every screen's route), paths.ts (screen URLs by
                 name), navigation (useGoBack), the help screen's store, and
                 createServices()
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
  components/    ui/ (the component library), the screen layout, settings-bound
                 controls, promise dialogs, and area components
  lib/           framework-free helpers: card sprites and setupCanvas(),
                 theme (cssVar), install hint, double tap, the wordmark
  styles/        tokens.css (colours, Classic values) and themes.css
                 (Catppuccin Latte and Mocha)
  react/         useApp()/useSetting()/useSettings(), useOnShow/useOnHide
  screens/       (React) Home and Help, the settings screens (settings/) and
                 the strategy, true count and betting screens (strategy/)
  drills/        the four drills; shared/ holds what they have in common
    <drill>/       logic.ts (pure), controller.ts (a run's timing and
                   drawing), screen.tsx and options.tsx (React)
  game/
    engine/        the round as a pure state machine: hands, shoe, rules,
                   settlement, side bets, and the GameEvent union (events.ts)
    session.ts     the engine plus the count, bankroll, statistics and
                   strategy checking, persisted across visits
    play-check.ts  is this play or bet what the strategy calls for?
    dealer-errors.ts  the deliberate dealer mistakes and Foul claims
    dealer-error-round.ts  a round's dealer error, from pick to claim
    bet-validation.ts  table limits, affordability, side-bet multiples
    table/         the table controller, drawing and animating the table,
                   the betting overlay, gestures, controls and labels
    screens/       the table, the bet picker and statistics
  data/          bundled data: strategy files, side-bet games, help text
tests/
  unit/          Vitest tests for src/ (.tsx ones run in jsdom)
  e2e/           Playwright tests of the running app
  fixtures/      reference data recorded from the original apps (gzipped JSON)
  support/       the fixture loader and renderScreen() for component tests
tools/           certs.ts (HTTPS certificates for serving to a phone),
                 bundle-import.ts, which bundles strategies and side-bet games
                 from their export codes, and logo.ts
docs/            this document
```

## How the pieces fit

`createServices()` builds the shared services — `app.settings`, `app.storage`,
`app.strategies`, `app.sound`, `app.errorTallies`, `app.bankroll`,
`app.gameStats` — provided to every component through `AppContext`
(`useApp()`). Screens are routes in `app/routes.tsx`; they navigate with
`useNavigate()` and the URLs in `PATHS`, and go back with `useGoBack()`.

The drills and the game both get their strategy from
`app.strategies.current(app.settings, decks)`, so the Playing Strategy and True
Count screens drive both.

The game is split three ways. The **engine** knows the rules and nothing else:
`startRound()`, `act()`, `takeInsurance()` and friends advance it and return the
events that happened (a card dealt, a hand settled, ...). The **session** wraps
the engine with what lasts between rounds. The **table screen** animates the
engine's events at the user's speed settings and refuses input until the
animation is done. Its state lives in a table controller that the React screen
reads with `useSyncExternalStore`; Stats, the last error and the bet pickers are
child routes shown over it, so the round underneath stays as it is.

## Conventions

- **Logic and UI are separate.** Anything that can be expressed without the DOM
  is a pure module (`core/`, `settings/`, `game/engine/`, `game/*.ts`,
  `drills/*/logic.ts`) and is unit tested. Screens only render state and turn
  input into calls.
- **Screens** are React components with a route, wrapped in `ScreenLayout`
  (title bar with Back and Help, scrolling body). `useOnShow`/`useOnHide` fire
  when a child route or the help screen covers or uncovers a screen. Canvas
  screens keep their run in a controller that survives StrictMode's double
  mount: nothing stateful in render, and effects' cleanups call off what they
  started.
- **UI**: the components in `components/ui/` (one file per control, its look
  in Tailwind classes over the theme tokens; controls restyle themselves inside
  a settings group or row via `in-data-[slot=…]:` variants), the original's
  icons (`Icon`), `toast()`, and `alert()`/`confirm()`/`prompt()` from
  `components/dialogs.tsx`. Colours are never hard-coded: Classic values in
  `styles/tokens.css`, Latte and Mocha in `themes.css`, all meeting WCAG AA.
- **Settings** are declared once in `settings/schema.ts` (dotted keys, typed,
  with defaults); `app.settings.get/set` are typed per key and `useSetting(key)`
  re-renders on that key. They are a persisted Zustand store, and `migrate()`
  in `settings/store.ts` reads older shapes. State that is not a preference
  (bankroll, statistics, tallies) is its own persisted store. All keys are
  prefixed `cj.`.
- **Randomness** is injected: functions take a `random` function returning
  [0, 1), so tests can pass `seededRandom(seed)`.
- **Card ids** are 1..52 (`suit * 13 + rank`, rank 1..13, suits spades, clubs,
  hearts, diamonds — the row order of `public/assets/cards/cards.png`).
- **Canvas drawing** scales the backing store by `devicePixelRatio`
  (`setupCanvas()` in `lib/card-sprites.ts`).
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
- Component tests render screens with Testing Library (`renderScreen()` in
  `tests/support/render.tsx`, inside a memory router) and assert on roles.
- `npm run test:e2e` drives the running app in WebKit as an iPhone 15 Pro and an
  iPad (A16), upright and sideways: every screen, playing rounds at the table,
  and running each drill. It runs on the Vite dev server, so tests can import
  and patch the app's modules in the page; the tests tagged `@build` (offline
  use) run on the production build instead.
- CI (`.github/workflows/ci.yml`) runs lint, the type check, the unit tests and
  the build, then deploys `main` to GitHub Pages. The browser tests are run
  locally; they are timing-sensitive and too slow on CI runners.

## Offline

`src/sw.ts` is built by vite-plugin-pwa (`injectManifest`), which writes the
list of built files into it, so every build precaches exactly what it ships.
A new build installs in the background and waits; `main.tsx` then asks whether
to reload, and on Reload the new worker takes over. Offline navigations to any
other URL are redirected to `index.html`, so relative asset paths resolve.

The build uses relative URLs (`base: './'`), so `dist/` works under any path and
can be wrapped by Capacitor later (which would skip the service worker).
