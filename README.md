# Drills

## Running it locally

The app loads its screens (`frm*.htm`) and data files (`usp*.txt`, `g.txt`) at
runtime via `XMLHttpRequest`. Because of that, **you cannot just open
`index.html` from the filesystem** (`file://` blocks those requests). You must
serve the folder.

The offline home-screen app relies on a Service Worker, and browsers only
register a Service Worker in a **secure context** (HTTPS, or `http://localhost`).
When the phone connects to the Mac over the LAN it uses the Mac's hostname, not
`localhost`, so the server **must** speak HTTPS with a certificate the phone
trusts. `serve.sh` handles this using [`mkcert`](https://github.com/FiloSottile/mkcert).

### One-time setup (on the serving Mac)

```bash
brew install mkcert nss
mkcert -install        # creates a locally-trusted root CA on this Mac
```

### Running

```bash
./serve.sh             # serves https://<your-mac>.local:8443/ and prints the URL
./serve.sh 9000        # optional: use a different port
```

On first run `serve.sh` generates a certificate for the Mac's `.local` hostname
into `.certs/` (git-ignored). Then open the printed `https://…` URL in a browser.

## Installing on an iPhone (offline home-screen app)

The phone must trust the Mac's local certificate authority once, after which
the Service Worker can install and the app runs fully offline. One-time setup:

1. On the serving Mac (same Wi-Fi as the phone), run `./serve.sh` and note the
   `https://<your-mac>.local:8443/` URL.
2. Trust the local CA on the iPhone:
   - Run `mkcert -CAROOT` on the Mac to find the CA folder, and AirDrop
     `rootCA.pem` from it to the phone.
   - iPhone: open the file → **Settings → Profile Downloaded → Install**.
   - **Settings → General → About → Certificate Trust Settings** → enable full
     trust for the mkcert CA.
3. In **Safari** (required for Add to Home Screen), open the `https://…` URL and
   let it sit a few seconds so `sw.js` caches everything.
4. Share button → **Add to Home Screen**.
5. Stop the server / enable airplane mode, then tap the icon — it runs fully
   offline. The Mac server is not needed again.

> The certificate and the installed app are tied to the Mac's `.local`
> hostname, so the offline app keeps working even if the Mac's IP address
> changes. If you rename the Mac, delete `.certs/` and repeat the setup.

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
