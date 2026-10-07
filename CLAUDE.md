# CLAUDE.md

Crackjack: one offline blackjack practice web app (four drills + a full
game) rebuilt from two earlier apps. A conventional Vite + React app: strict
**TypeScript**, **React 19**, **React Router** (hash routes), **Zustand** stores,
**Tailwind CSS v4** and the app's own component library (the original app's
look, rebuilt in Tailwind), with a service worker from
vite-plugin-pwa. The canvas drawing (cards, trays, the table) is plain
TypeScript driven from React through refs. Nothing outside `index.html`, `src/`
and `public/` reaches the browser.

## Commands

```bash
npm run dev              # Vite dev server with hot reload (no service worker): http://localhost:5173/
npm run preview          # build, then serve dist/: http://127.0.0.1:4173/
npm run serve            # build, then serve dist/ over HTTPS for phones (needs mkcert): https://<mac>.local:8443/
                         # add `-- --port N` to any of them for another port
npm run build            # production build into dist/ (bundles, hashed files, sw.js with the precache list)
npm test                 # Vitest: unit tests (node) and component tests (jsdom, Testing Library)
npm run test:coverage    # the same with V8 coverage and its thresholds (CI runs this)
npm run test:e2e         # Playwright on iPhone 15 Pro and iPad (A16), portrait and landscape, WebKit
npm run lint             # ESLint
npm run typecheck        # tsc for the app, service worker, tools and tests
npm run format           # Prettier (CI runs format:check)
npm run add-strategy -- <code> [--name "..."]   # download a strategy by its export code and bundle it
npm run add-side-bet -- <code> [--name "..."]   # same for a side-bet game
npm run logo             # redraw the CJ icon (SVG + PNGs) and the in-app wordmark from tools/logo.ts
```

Run a single test: `npx vitest run tests/unit/game/engine.test.ts` or
`npx playwright test tests/e2e/drills.spec.ts -g "name" --project=iphone`
(projects: `iphone`, `iphone-landscape`, `ipad`, `ipad-landscape`, and `build` for the offline tests).

## Layout

- `index.html` — Vite's entry; `src/main.tsx` renders the router. Service worker source `src/sw.ts`.
- `public/` — copied as-is: `manifest.webmanifest`, images and sounds in `public/assets/` (relative paths such as `assets/cards/cards.png`).
- `src/app/` — `routes.tsx` (every screen's route; overlays as child routes), `paths.ts` (each screen's URL, by name), `navigation.ts` (`useGoBack`), `help.ts` (the help screen's store), `app.ts` (the services).
- `src/components/` — `ui/` (the component library: `Button`, native `Select`, `CheckList`, `ValueButton`, `Slider`, `Tile`, `Grid`, `SettingsGroup`/`Section`/`SettingsRow`/`ListRow`, `TopBar`/`BarButton`, `Modal`, `toast`, `DurationPicker`, `Icon`, text styles), `screen-layout.tsx` (title bar + body, `Column`), `settings-controls.tsx` (setting-bound rows), `dialogs.tsx` (promise `alert`/`confirm`/`prompt`), and area components (`drills/`, `game/`, `settings/`).
- `src/core/` — pure logic shared by everything: cards, counting, random, money, strategy (parsing, tables, advisor).
- `src/settings/` — `schema.ts` (every setting, type and default), the Zustand-backed store, strategy catalog, pure rule logic.
- `src/game/engine/` — the round as a pure state machine emitting `GameEvent`s; `session.ts` wraps it with count/bankroll/stats; pure helpers in `game/*.ts`; `table/` holds the canvas renderer, animator, layout and the table controller; `screens/` the React screens.
- `src/drills/<flash|depth|count|full>/` — `logic.ts` (pure), `controller.ts` (a run's timing and drawing), `screen.tsx` and `options.tsx` (React); shared machinery in `drills/shared/`.
- `src/screens/` — home, help screen, settings and strategy screens.
- `src/react/` — `useApp()`/`useSetting()`/`useSettings()`, and the screen lifecycle hooks (`useOnShow`, `useOnHide`).
- `src/services/` — storage, persisted Zustand stores, sound (Web Audio), error tallies, wake lock.
- `src/lib/` — framework-free helpers: `utils` (`cn`, which knows the type scale), card sprites, theme (`cssVar`), install hint, double tap, the wordmark.
- `src/styles/` — `tokens.css` (the app's colours as custom properties, Classic values) and `themes.css` (Latte, Mocha); `src/index.css` imports them and sets the type scale (`text-tiny/caption/body/title/heading`), animations and base styles.
- `src/data/` — bundled strategy files, side-bet game definitions, help text (keyed by screen name).
- `docs/ARCHITECTURE.md` — fuller description.

## Conventions

- Keep logic DOM-free and unit tested; components only render and wire input. New logic goes in a pure module (or a controller for a canvas screen), not a component.
- Strict TypeScript everywhere: no `any`, `@ts-ignore` or `@ts-nocheck`; `import type` for types; no enums/namespaces (`erasableSyntaxOnly` — use `as const` objects and unions). Imports have no extension; use `@/` for anything outside the current folder.
- Screens are React components given a route in `src/app/routes.tsx` (and a URL in `paths.ts`), wrapped in `ScreenLayout`. Navigate with `useNavigate()` and `PATHS`; Back is `useGoBack()`; help is `openHelp(topic, title)`. A screen opened over a live one (Stats over the table) is a child route rendered in the parent's `<Outlet />`, reading it through `useOutletContext`.
- Canvas screens keep their run in a controller (`subscribe`/`getSnapshot`, read with `useSyncExternalStore`), attached to its canvases in a layout effect. They must survive StrictMode's mount, unmount, mount: nothing random or stateful in render, and anything started in an effect is called off by its cleanup.
- Settings: add to `src/settings/schema.ts` (dotted keys, typed, with default); read with `useSetting(key)` in components and `app.settings.get/set` elsewhere. Persisted by Zustand (`{ state, version }`); a change of shape needs a step in `migrate()` in `settings/store.ts`. Other saved state (bankroll, stats, tallies) is a `persistedStore()` in `app.ts`. Keys are prefixed `cj.`. Changing a default changes what fresh installs get.
- UI: build screens from `@/components/ui`; style with Tailwind using the tokens directly (`bg-(--btn-bg)`, `text-(--text-secondary)`, `rounded-(--radius-s)`, `min-h-(--control-h)`) and the type scale; `cn` from `@/lib/utils`. A component that looks different inside a group or row says so itself with `in-data-[slot=settings-group]:` / `in-data-[slot=settings-row]:` variants (containers set `data-slot`). Icons are `<Icon name=…>` (the original's stroke glyphs). `toast()` from `@/components/ui/toast` for acknowledgements; `alert()`/`confirm()` from `@/components/dialogs` only when the user must read or answer. Every control has an accessible name. To change the look of a control everywhere, edit its file in `ui/`.
- Never hard-code a colour. Classic values go in `src/styles/tokens.css`; Latte and Mocha map them in `themes.css`; text must meet WCAG AA in every theme (the contrast test checks the token pairs). Canvas code reads tokens with `cssVar(name, classicFallback)`. Mocha is the default theme (`display.theme`).
- Randomness is injected (`random` param); tests use `seededRandom(seed)` from `src/core/random.ts`.
- Card ids are 1..52 (`suit * 13 + rank`; suits spades, clubs, hearts, diamonds). Canvas drawing goes through `setupCanvas()` (devicePixelRatio aware).
- Money is shown with `money()`/`dollars()` from `core/money.ts`.
- Tests: Vitest for logic; Testing Library (`render`, `screen.getByRole`, `userEvent`) for components via `tests/support/render.tsx`; Playwright with role-based locators for the app.
- Style: Prettier (2-space indent, single quotes, semicolons, width 120), named exports, small modules.

## Gotchas

- `tests/fixtures/*.json.gz` is behavior recorded from the original apps; it **cannot be regenerated** (the originals were removed — recoverable from git tag `original-apps-reference`). If a fixture test fails, the code changed behavior: either fix the code or, if the change is intentional, adjust the test deliberately.
- The service worker's precache list is generated at build time from `dist/` (`globPatterns` in `vite.config.ts`). Installed copies offer a Reload when a new build is deployed.
- E2E tests import and patch source modules in the page (`import('/src/...ts')`), which only the dev server serves (started with `E2E=1`, so no hot reload mid-test); tests needing the service worker are tagged `@build` and run on the production build. A seeded `Math.random` must follow only calls whose nearest frame is the app's (React and React Router draw random ids). Tests hear sounds by replacing `app.sound.output`. Locally Playwright reuses any server already on ports 5174/4173; stop a stale one first.
- The app makes no network requests; users cannot import strategies or side-bet games. New ones are bundled with `tools/bundle-import.ts`, which edits `src/data/` and `src/settings/strategies.ts`.
- Don't reintroduce code-generator-style names (`frm*`, numeric option arrays, globals) — the codebase intentionally has none.
