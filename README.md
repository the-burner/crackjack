# Drills

## Running it locally

The app loads its screens (`frm*.htm`) and data files (`usp*.txt`, `g.txt`) at
runtime via `XMLHttpRequest`. Because of that, **you cannot just open
`index.html` from the filesystem** (`file://` blocks those requests). You must
serve the folder over HTTP.

Any static file server works. The simplest, using Python (pre-installed on
macOS/Linux):

```bash
./serve.sh          # starts http://localhost:8000 and prints the URL
# or directly:
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in a browser.

## Installing on an iPhone (offline home-screen app)

iOS only lets a web app go offline after it has been loaded over HTTP once, so
the Service Worker can install. One-time setup:

1. On your Mac (same Wi-Fi as the phone), run `./serve.sh` and note the URL.
2. On the iPhone, open that URL in **Safari** (required for Add to Home Screen);
   let it sit a few seconds so `sw.js` caches everything.
3. Share button → **Add to Home Screen**.
4. Stop the server / enable airplane mode, then tap the icon — it runs fully
   offline. The Mac server is not needed again.

## What's here

| Path | Description |
|------|-------------|
| `index.html` | Main entry point — contains the bulk of the app logic |
| `frm*.htm` | Individual screens/forms loaded on demand |
| `nsb/` | NSBasic/AppStudio runtime (jQuery, jQuery Mobile, iScroll, helpers) |
| `usp*.txt`, `g.txt` | Strategy/count data tables loaded at runtime |
| `cards.png` | Card sprite sheet |
| `xstw*.jpg` | Drill / strategy table images |
| `BUZZ.mp3`, `DRIP2.mp3` | Sound effects |
| `BlackjackVeriteDrills.pdf` | Bundled documentation |
| `icons/`, `res/` | App icons and Android splash screens |
| `sw.js` | Service Worker — precaches every app file for offline use |
| `manifest.webmanifest` | Web app manifest for Add to Home Screen |
