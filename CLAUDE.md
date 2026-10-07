# CLAUDE.md

Crackjack: one offline blackjack practice web app (four drills + a full
game) rebuilt from two earlier apps. Strict **TypeScript**, built with **Vite**
into `dist/`; menu and settings screens are **React** components, the canvas play
screens (drills, table) are imperative. The service worker comes from
vite-plugin-pwa. Nothing outside `index.html`, `src/` and `public/` reaches the
browser.

## Commands

```bash
npm run dev              # Vite dev server with hot reload (no service worker): http://localhost:5173/
npm run preview          # build, then serve dist/: http://127.0.0.1:4173/
npm run serve            # build, then serve dist/ over HTTPS for phones (needs mkcert): https://<mac>.local:8443/
                         # add `-- --port N` to any of them for another port
npm run build            # production build into dist/ (bundles, hashed files, sw.js with the precache list)
npm test                 # Vitest unit tests (fast; run after any logic change)
npm run test:e2e         # Playwright browser tests (iPhone 13 profile; Chromium and WebKit) on the dev server (port 5174); @build-tagged ones on the build (port 4173)
npm run lint             # ESLint
npm run typecheck        # tsc for the app, service worker, tools and tests
npm run format           # Prettier (CI runs format:check)
npm run add-strategy -- <code> [--name "..."]   # download a strategy by its export code and bundle it
npm run add-side-bet -- <code> [--name "..."]   # same for a side-bet game
npm run logo             # redraw the CJ icon (SVG + PNGs) and the in-app wordmark from tools/logo.ts
```

Run a single test: `npx vitest run tests/unit/game/engine.test.ts` or
`npx playwright test tests/e2e/drills.spec.js -g "name"` (add `--project=chromium|webkit|ipad`).

## Layout

- `index.html` — the page; Vite's entry. Code in `src/` (entry `src/main.ts`; service worker source `src/sw.ts`).
- `public/` — copied into the build as-is: `manifest.webmanifest`, and images and sounds in `public/assets/` (referenced by relative paths such as `assets/cards/cards.png`).
- `src/core/` — pure logic shared by everything: cards, counting, random, strategy (parsing, tables, advisor).
- `src/settings/` — `schema.ts` (every setting, type and default), store, strategy catalog, and pure rule logic behind the settings screens.
- `src/game/engine/` — the round as a pure state machine emitting `GameEvent`s (`events.ts`); `session.ts` wraps it with count/bankroll/stats; pure helpers in `game/*.ts` (bet validation, dealer-error round); `table/` + `screens/` are the UI.
- `src/drills/<flash|depth|count|full>/` — `logic.ts` (pure) + `options.tsx` (React) + `screen.ts` (canvas); shared machinery in `drills/shared/`.
- `src/screens/` — React: home, help, settings screens (`settings/`), strategy/TC/betting screens (`strategy/`).
- `src/react/` — `reactScreen()` (a component as a router screen), `useApp()`/`useSettings()`, React versions of the controls, settings-bound controls.
- `src/ui/` — DOM helpers (`h()`), imperative components, dialogs, `standardScreen()`, card sprites, CSS.
- `src/services/` — storage, sound (Web Audio), error tallies, screen wake lock.
- `src/data/` — bundled strategy files, side-bet game definitions, help text (keyed by screen name).
- `docs/ARCHITECTURE.md` — fuller description.

## Conventions

- Keep logic DOM-free and unit tested; screens only render and wire input. New logic goes in a pure module, not a screen.
- Strict TypeScript everywhere: no `any`, `@ts-ignore` or `@ts-nocheck`; `import type` for types; no enums/namespaces (`erasableSyntaxOnly` — use `as const` objects and unions); imports keep their `.ts`/`.tsx` extension.
- Screens are factories `(app, params) => ({ el, onShow?, onHide?, destroy?, onBack? })`, registered by name in the area's `index.ts`, opened with `app.open(name, params)`. New non-canvas screens are React: `export const fooScreen = reactScreen(Foo, { className })`, with `useOnShow/useOnHide/useOnBack` for the lifecycle and `useSettings()` to read settings (it re-renders on change).
- Imperative screens must clean up in `onHide`/`destroy`: timers, listeners, observers, the wake lock. A timer that outlives its screen is the most common bug here.
- Settings: add to `src/settings/schema.ts` (dotted keys, typed, with default) and use `app.settings.get/set` (typed per key). Saved as `{ version, values }`; a change of shape needs a migration in `settings/store.ts`. Non-preference state (bankroll, stats) goes through `app.storage` (keys prefixed `cj.`). Changing a default changes what fresh installs get.
- Randomness is injected (`random` param); tests use `seededRandom(seed)` from `src/core/random.ts`.
- Card ids are 1..52 (`suit * 13 + rank`; suits spades, clubs, hearts, diamonds).
- Canvas drawing must go through `setupCanvas()` (devicePixelRatio aware).
- Reuse the controls: `react/components.tsx` in React screens, `ui/components.ts` in imperative ones (same markup: button, select, checkList, valueButton, slider, field). Put related controls in a `settings-group` (an inset list with hairline rows), with an optional `section` heading; navigation rows are `button(..., { className: 'list-row', icon: 'arrow-r' })`. Use `toast()` (`ui/toast.ts`) for acknowledgements and `alert()` only for messages that need reading.
- Type and shape come from tokens in `app.css` (`--font`, `--radius`, `--radius-s`, `--control-h`); use weights 400/500/600, not `bold`. Icons are stroke SVG masks in `ui/styles/icons.css` (generated by hand; they take the text colour).
- Never hard-code a colour. Use a CSS custom property: Classic values (the original look) go in `:root` (`app.css`, `strategy.css`, `game.css`), and Latte/Mocha map it to the Catppuccin palette in `ui/styles/themes.css`. Canvas code reads them with `cssVar(name, classicFallback)` from `ui/theme.ts`. Mocha is the default theme (`display.theme`).
- Money is shown with `money()`/`dollars()` from `core/money.ts`.
- Style: Prettier (2-space indent, single quotes, semicolons, width 120), named exports, small modules.

## Gotchas

- `tests/fixtures/*.json.gz` is behavior recorded from the original apps; it **cannot be regenerated** (the originals were removed — recoverable from git tag `original-apps-reference`). If a fixture test fails, the code changed behavior: either fix the code or, if the change is intentional, adjust the test deliberately.
- The service worker's precache list is generated at build time; files in `dist/` matching `vite.config.ts`'s `globPatterns` are precached. Installed copies offer a Reload when a new build is deployed.
- E2E tests import and patch source modules in the page (`import('/src/...ts')`), which only the dev server serves; tests that need the service worker are tagged `@build` and run on the production build. Tests that seed `Math.random` must seed only calls from `/src/` (React draws random ids). Tests hear sounds by replacing `app.sound.output`. Locally Playwright reuses any server already on ports 5174/4173; stop a stale one first.
- The app makes no network requests; users cannot import strategies or side-bet games. New ones are bundled with `tools/bundle-import.ts` (the npm scripts above), which edits `src/data/` and `src/settings/strategies.ts`.
- Don't reintroduce code-generator-style names (`frm*`, numeric option arrays, globals) — the codebase intentionally has none.
