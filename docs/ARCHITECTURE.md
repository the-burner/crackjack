# Architecture

Blackjack Verité is a static, offline-first web app written as plain ES
modules. There is no build step: `index.html` loads `src/main.js`, and every
file under `src/` is served as-is.

## Layout

```
index.html, manifest.webmanifest, sw.js   app shell, install manifest, offline cache
assets/        images and sounds (cards, table, trays, shoe, sounds, icons)
src/
  main.js      entry point
  app/         app services (createApp) and the screen router
  core/        pure logic, no DOM: cards, randomness, counting, strategy
    strategy/  strategy files, table building, play/insurance advisor
  settings/    settings schema, settings store, strategy catalog
  services/    storage (namespaced localStorage) and sound
  ui/          DOM helpers, components, dialogs, standard screen layout, CSS
  screens/     home, help, settings screens; screens/index.js registers routes
  drills/      the four drills (flash, depth, count, full)
  game/        the blackjack game (engine + table screen)
  data/        bundled data: strategy files, help text
tests/
  unit/        Vitest tests for src/
  e2e/         Playwright tests of the running app
  fixtures/    recorded reference data (gzipped JSON)
docs/          this document and the change log of behavior decisions
```

## Conventions

- **Logic and UI are separate.** Anything that can be expressed without the DOM
  lives in `core/` (or an area's `logic/` folder) and is unit tested. Screens
  only render state and translate user input into calls on that logic.
- **Screens** are factories `(app, params) => ({ el, onShow?, onHide?, destroy?, onBack? })`
  registered by name with the router (`app.open(name, params)`, `app.back()`).
  Use `standardScreen()` for the title bar + body layout and the components in
  `ui/components.js` (button, select, checkList, valueButton, slider, field).
- **Settings** are declared once in `settings/schema.js` (dotted keys, typed,
  with defaults) and read/written through `app.settings`. Persistent state that
  is not a preference (bankroll, stats, imported strategies) goes through
  `app.storage` under its own key.
- **Randomness** is injected: functions take a `random` function returning
  [0, 1), so tests can pass `seededRandom(seed)`.
- **Card ids** are 1..52 (`suit * 13 + rank`, rank 1..13, suits spades, clubs,
  hearts, diamonds — the row order of `assets/cards/cards.png`).
- **Canvas drawing** scales the backing store by `devicePixelRatio`.
- Code style: 2-space indent, single quotes, semicolons, named exports, small
  modules, JSDoc on exported functions where the shape is not obvious.
