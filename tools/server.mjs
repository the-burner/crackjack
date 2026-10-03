// The app's web server, for local testing and for installing on a phone.
//
//   node tools/server.mjs                 http://127.0.0.1:4173/   (this computer only)
//   node tools/server.mjs --phone         https://<mac>.local:8443/ (your network, for phones)
//   node tools/server.mjs --port 9000     either mode on another port
//
// Phones need HTTPS before Safari will install a web app, so --phone serves
// HTTPS with a certificate from mkcert (created on first use in .certs/).
//
// Only the public/ folder is served; the rest of the repository (tests,
// tools, .git, the certificates) is not. Requests under /apps/ are forwarded to
// qfit.com: strategy import (/Apps/z<code>.php), side-bet game import
// (/Apps/u<code>.php) and the casino database (/apps/cbjn7.php) are PHP
// endpoints there, and forwarding keeps them same-origin for the browser.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Everything the browser loads lives here. */
const ROOT = path.join(REPO, 'public');
const UPSTREAM = 'https://www.qfit.com';
const PROXY_TIMEOUT_MS = 15000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
};

/** Serves one of the app's files, or 404. */
function serveFile(urlPath, res) {
  const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, body) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  });
}

/** Forwards a request to qfit.com and relays the answer. */
async function proxy(req, res) {
  try {
    const upstream = await fetch(UPSTREAM + req.url, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'text/plain' });
    res.end(body);
  } catch (err) {
    send(res, 502, `Could not reach qfit.com: ${err.message}`);
  }
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function handler(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (urlPath.toLowerCase().startsWith('/apps/')) return proxy(req, res);
  return serveFile(urlPath, res);
}

/**
 * Starts the server.
 * @param {object} o
 * @param {number} [o.port=0]          0 picks a free port.
 * @param {string} [o.host='127.0.0.1']
 * @param {{cert: Buffer, key: Buffer}} [o.tls]  Serve HTTPS with this certificate.
 * @returns {Promise<http.Server>}
 */
export function startServer({ port = 0, host = '127.0.0.1', tls = null } = {}) {
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  // A browser may drop a connection mid-reply (a cancelled prefetch, a
  // backgrounded tab). That is expected, so close it quietly.
  server.on('clientError', (_, socket) => socket.destroy());
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

/** The Mac's Bonjour name, e.g. "Ethans-MacBook.local". */
function localHostName() {
  return `${execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim()}.local`;
}

/** The mkcert certificate for this Mac, created on first use. */
function certificateFor(hostName) {
  const dir = path.join(REPO, '.certs');
  const cert = path.join(dir, `${hostName}.pem`);
  const key = path.join(dir, `${hostName}-key.pem`);
  if (!fs.existsSync(cert) || !fs.existsSync(key)) {
    try {
      execFileSync('mkcert', ['-help'], { stdio: 'ignore' });
    } catch {
      fail('mkcert is not installed. Run: brew install mkcert nss && mkcert -install');
    }
    console.log(`Creating a locally-trusted certificate for ${hostName} ...`);
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('mkcert', ['-cert-file', cert, '-key-file', key, hostName, 'localhost', '127.0.0.1'], { stdio: 'inherit' });
  }
  return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) };
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { phone: false, port: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--phone') args.phone = true;
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (/^\d+$/.test(arg)) args.port = Number(arg);
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: node tools/server.mjs [--phone] [--port N]');
      process.exit(0);
    } else fail(`unknown argument '${arg}' (usage: node tools/server.mjs [--phone] [--port N])`);
  }
  if (args.port !== null && !(Number.isInteger(args.port) && args.port > 0 && args.port < 65536)) fail('the port must be a number from 1 to 65535');
  return args;
}

async function main() {
  const { phone, port } = parseArgs(process.argv.slice(2));
  const hostName = phone ? localHostName() : '127.0.0.1';
  const options = phone
    ? { port: port ?? 8443, host: '0.0.0.0', tls: certificateFor(hostName) }
    : { port: port ?? 4173, host: '127.0.0.1' };
  try {
    await startServer(options);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      fail(`port ${options.port} is already in use. Another copy of this server may be running `
        + `(stop it with: kill $(lsof -ti tcp:${options.port})), or pick another port with --port.`);
    }
    throw err;
  }
  const url = `${phone ? 'https' : 'http'}://${hostName}:${options.port}/`;
  console.log(`Serving the app at ${url}`);
  if (phone) console.log(`On this Mac you can also use https://localhost:${options.port}/`);
  console.log('Press Ctrl+C to stop.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
