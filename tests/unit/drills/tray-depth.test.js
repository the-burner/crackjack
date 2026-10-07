// The discard tray photo must show the depth the drill is asking about.
//
// The original stepped one photo too low, so every picture held a quarter deck
// more than it claimed and the deepest step of two styles fell out of its own
// series onto an unrelated empty tray. We correct that: see the deliberate
// divergence recorded in `depth tray photos match the original`.

import { describe, it, expect } from 'vitest';
import { trayImage, TRAY_STYLES, maxDecksInTray } from '../../../src/drills/shared/discard-tray.ts';

/** The photo number a style shows at a depth, or null when it cannot. */
const photoAt = (decks, style) => {
  const picked = trayImage(decks, style);
  return picked ? Number(picked.src.match(/(\d+)\.jpg/)[1]) : null;
};

describe('the empty tray', () => {
  // These are the empty photographs at the end of each style's series.
  const EMPTY = {
    eightDeckFront: 303,
    sixDeckFront: 351,
    doubleDeckFront: 382,
    sixDeckRear: 431,
    doubleDeckRear: 447,
  };

  for (const [style, number] of Object.entries(EMPTY)) {
    it(`is what ${style} shows before any card is dealt`, () => {
      expect(photoAt(0, style)).toBe(number);
    });
  }
});

describe('a tray photo', () => {
  it('stays inside its own style’s series at every depth', () => {
    // Each series is a run of photo numbers; a style must never borrow another's.
    const series = {
      eightDeckFront: [242, 303],
      sixDeckFront: [304, 351],
      doubleDeckFront: [366, 382],
      sixDeckRear: [383, 431],
      doubleDeckRear: [432, 447],
    };
    const strayed = [];
    for (const style of Object.keys(TRAY_STYLES)) {
      const [low, high] = series[style];
      for (let decks = 0; decks <= 8; decks += 0.25) {
        const number = photoAt(decks, style);
        // A style that cannot hold this many decks falls back to the 8-deck series.
        if (number === null || decks > maxDecksInTray(style)) continue;
        const eightDeck = number >= 242 && number <= 303;
        if (!(number >= low && number <= high) && !eightDeck) strayed.push({ style, decks, number });
      }
    }
    expect(strayed).toEqual([]);
  });

  it('shows more cards as the tray fills', () => {
    // Numbers count down as the tray fills, so a deeper tray is a lower number.
    for (const style of Object.keys(TRAY_STYLES)) {
      const empty = photoAt(0, style);
      const deeper = photoAt(1, style);
      expect(deeper, style).toBeLessThan(empty);
    }
  });
});
