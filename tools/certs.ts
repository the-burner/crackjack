// HTTPS for installing on a phone: Safari only installs web apps served over
// HTTPS, so `npm run serve` uses a certificate from mkcert (created on first use
// in .certs/) for the Mac's Bonjour name.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The Mac's Bonjour name, e.g. "Ethans-MacBook.local". */
export function localHostName() {
  return `${execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim()}.local`;
}

/** The mkcert certificate for this Mac, created on first use. */
export function certificateFor(hostName: string): { cert: Buffer; key: Buffer } {
  const dir = path.join(REPO, '.certs');
  const cert = path.join(dir, `${hostName}.pem`);
  const key = path.join(dir, `${hostName}-key.pem`);
  if (!fs.existsSync(cert) || !fs.existsSync(key)) {
    try {
      execFileSync('mkcert', ['-help'], { stdio: 'ignore' });
    } catch {
      throw new Error('mkcert is not installed. Run: brew install mkcert nss && mkcert -install');
    }
    console.log(`Creating a locally-trusted certificate for ${hostName} ...`);
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('mkcert', ['-cert-file', cert, '-key-file', key, hostName, 'localhost', '127.0.0.1'], {
      stdio: 'inherit',
    });
  }
  return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) };
}
