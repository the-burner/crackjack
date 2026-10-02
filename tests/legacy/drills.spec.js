// Proves the recorded drill fixtures still describe the original Drills app:
// re-runs every capture against legacy/ and compares with tests/fixtures/.
import { test, expect } from '@playwright/test';
import { openLegacy } from '../support/legacy.js';
import { loadFixture } from '../support/fixtures.js';
import * as cap from './captures-drills.js';

test.use({ serviceWorkers: 'block' });

/** Each capture stubs globals, so every one gets a fresh page. */
const capture = async (context, baseURL, fn, args) => {
  const page = await openLegacy(context, baseURL, 'drill');
  const data = await page.evaluate(fn, args);
  expect(page.legacyErrors).toEqual([]);
  return data;
};

test.describe('legacy drills', () => {
  test('flash hand lists', async ({ context, baseURL }) => {
    const actual = await capture(context, baseURL, cap.captureFlashHandListsInPage, { configs: cap.HAND_LIST_CONFIGS });
    expect(actual).toEqual(loadFixture('drills-hand-lists'));
  });

  test('flash indices and plays', async ({ context, baseURL }) => {
    const actual = await capture(context, baseURL, cap.captureFlashPlayInPage, {
      configs: cap.PLAY_CONFIGS, hands: cap.PLAY_HANDS, upcards: cap.PLAY_UPCARDS, counts: cap.PLAY_COUNTS,
    });
    expect(actual).toEqual(loadFixture('drills-flash-play'));
  });

  test('depth answer grids', async ({ context, baseURL }) => {
    const actual = await capture(context, baseURL, cap.captureDepthGridsInPage, { configs: cap.DEPTH_GRID_CONFIGS });
    expect(actual).toEqual(loadFixture('drills-depth-grids'));
  });

  test('depth tray photos', async ({ context, baseURL }) => {
    const actual = await capture(context, baseURL, cap.captureDepthTraysInPage, { configs: cap.TRAY_CONFIGS });
    expect(actual).toEqual(loadFixture('drills-depth-trays'));
  });

  test('count drill answers', async ({ context, baseURL }) => {
    const actual = await capture(context, baseURL, cap.captureCountAnswersInPage, {
      configs: cap.COUNT_ANSWER_CONFIGS, cards: cap.COUNT_CARDS,
    });
    expect(actual).toEqual(loadFixture('drills-count-answers'));
  });
});
