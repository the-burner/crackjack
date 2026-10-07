import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Settings as saved in `cj.settings`: the tests also save values the schema would refuse. */
export type SavedSettings = Record<string, unknown>;

/** Opens the app with the given settings already saved. */
export async function openWithSettings(page: Page, settings: SavedSettings = {}): Promise<void> {
  await page.addInitScript(values => {
    localStorage.clear();
    localStorage.setItem('cj.settings', JSON.stringify(values));
  }, settings);
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
}

/**
 * From page load, the app's own Math.random calls follow a seeded generator,
 * so every run deals the same cards. A library's calls (React makes ids) do
 * not, so they cannot shift the seed.
 */
export async function seedRandom(page: Page, seed: number): Promise<void> {
  await page.addInitScript(start => {
    let a = start;
    const libraryRandom = Math.random;
    Math.random = () => {
      if (!(new Error().stack ?? '').includes('/src/')) return libraryRandom();
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

/** The first of these that is visible, for waiting until any of them shows. */
export const visibleOneOf = (...locators: Locator[]): Locator =>
  locators
    .reduce((all, next) => all.or(next))
    .filter({ visible: true })
    .first();
