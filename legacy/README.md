# Original apps (reference only)

These are the two QFIT apps this repository was rebuilt from, kept unchanged
apart from the offline-install files:

| Folder | App | Version |
|--------|-----|---------|
| `drill/` | Blackjack Verité Drills | 1.5.25 |
| `game/`  | Blackjack Verité Games  | 2.0.6 |

They are not served by `serve.sh` and are not part of the app. They are here
because the test suite replays their behavior to prove the rebuild matches it:
`tests/legacy/` loads them in a browser, records what their strategy tables,
play advice and counts produce, and compares that with the new code
(`tests/fixtures/`).

Each app is a single generated HTML file (NSBasic/AppStudio) with its own copy of
jQuery Mobile in `nsb/`. `tools/make-reference.mjs` and
`tools/split-reference.mjs` extract readable copies into `.reference/`
(git-ignored) for reading; `.reference/specs/` holds the behavioral specs written
from them.

To run one for comparison:

```bash
node tests/support/static-server.js 4173
# then open http://127.0.0.1:4173/legacy/game/index.html
```

All rights to this code and its assets remain with QFIT.
