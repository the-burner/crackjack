// Opens one of the original (legacy) apps in a Playwright page with a seeded
// Math.random, so its internal functions can be called to record reference
// behavior ("characterization" fixtures).
import { seededRandomInitScript } from './seeded-random.js';

export async function openLegacy(context, baseURL, app, { seed = 1, storage = null } = {}) {
  const page = await context.newPage();
  await page.addInitScript(seededRandomInitScript(seed));
  if (storage) {
    await page.addInitScript(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  } else {
    await page.addInitScript(() => { if (!sessionStorage.getItem('__keep')) { localStorage.clear(); sessionStorage.setItem('__keep', '1'); } });
  }
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${baseURL}/legacy/${app}/index.html`);
  await page.waitForFunction(() => typeof window.CCLoad2 === 'function' && document.readyState === 'complete');
  await page.waitForTimeout(300);
  page.legacyErrors = errors;
  return page;
}
