// What a table allows a hand to double, and what a blackjack pays.

import { describe, it, expect } from 'vitest';
import {
  doubleAllowed,
  blackjackPremium,
  roundPremium,
  bustValue,
  rulesFrom,
  splitAllowed,
  surrenderAllowed,
  earlySurrenderAllowed,
  charlieWin,
  insuranceOffered,
} from '../../../src/game/engine/rules.ts';
import { Hand } from '../../../src/game/engine/hand.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import { Storage, MemoryBackend } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';
import type { CardId } from '../../../src/core/cards.ts';
import type { SettingValues } from '../../../src/settings/schema.ts';

const SPADES = 0,
  CLUBS = 1,
  HEARTS = 2,
  DIAMONDS = 3;
const card = (rank: number, suit = SPADES) => cardId(rank, suit);

function makeRules(overrides: Partial<SettingValues> = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function hand(cards: CardId[], extra: Partial<Hand> = {}) {
  const h = new Hand({ seat: 1, bet: 10 });
  for (const c of cards) h.addCard(c);
  Object.assign(h, extra);
  return h;
}

describe('doubling a hard hand', () => {
  const ranges: Record<string, [number, string][]> = {
    any: [
      [5, 'any total'],
      [8, 'eight'],
      [11, 'eleven'],
      [16, 'sixteen'],
    ],
    '8-11': [
      [8, 'eight'],
      [11, 'eleven'],
    ],
    '9-11': [
      [9, 'nine'],
      [11, 'eleven'],
    ],
    '10-11': [
      [10, 'ten'],
      [11, 'eleven'],
    ],
  };

  for (const [setting, allowed] of Object.entries(ranges)) {
    it(`allows ${setting}`, () => {
      const rules = makeRules({ 'rules.hardDoubles': setting as SettingValues['rules.hardDoubles'] });
      for (const [total] of allowed) {
        expect(doubleAllowed(rules, hand([card(2), card(total - 2)])), `${setting} should allow ${total}`).toBe(true);
      }
    });
  }

  it('refuses a total below the range', () => {
    expect(doubleAllowed(makeRules({ 'rules.hardDoubles': '8-11' }), hand([card(3), card(4)]))).toBe(false);
    expect(doubleAllowed(makeRules({ 'rules.hardDoubles': '9-11' }), hand([card(3), card(5)]))).toBe(false);
    expect(doubleAllowed(makeRules({ 'rules.hardDoubles': '10-11' }), hand([card(4), card(5)]))).toBe(false);
  });

  it('refuses a total above the range', () => {
    for (const setting of ['8-11', '9-11', '10-11'] as const) {
      expect(doubleAllowed(makeRules({ 'rules.hardDoubles': setting }), hand([card(10), card(2)]))).toBe(false);
    }
  });

  it('refuses every total when the table doubles on none', () => {
    const rules = makeRules({ 'rules.hardDoubles': 'none' });
    for (const total of [8, 9, 10, 11]) {
      expect(doubleAllowed(rules, hand([card(2), card(total - 2)]))).toBe(false);
    }
  });
});

describe('doubling a soft hand', () => {
  const soft = (total: number) => hand([card(1), card(total - 11)]);

  it('allows any soft total where the table says so', () => {
    const rules = makeRules({ 'rules.softDoubles': 'any' });
    expect(doubleAllowed(rules, soft(13))).toBe(true);
    expect(doubleAllowed(rules, soft(20))).toBe(true);
  });

  it('allows only a soft 19 or 20 for "A8 or A9"', () => {
    const rules = makeRules({ 'rules.softDoubles': 'a8a9' });
    expect(doubleAllowed(rules, soft(19))).toBe(true);
    expect(doubleAllowed(rules, soft(20))).toBe(true);
    expect(doubleAllowed(rules, soft(18))).toBe(false);
    expect(doubleAllowed(rules, soft(13))).toBe(false);
  });

  it('refuses a soft hand where the table doubles none', () => {
    expect(doubleAllowed(makeRules({ 'rules.softDoubles': 'none' }), soft(19))).toBe(false);
  });
});

describe('how many cards may double', () => {
  const eleven = (extra?: Partial<Hand>) => hand([card(2), card(4), card(5)], extra);
  const base: Partial<SettingValues> = { 'rules.hardDoubles': 'any' };

  it('refuses a hand of one card', () => {
    expect(doubleAllowed(makeRules(base), hand([card(5)]))).toBe(false);
  });

  it('refuses three cards unless the table allows it', () => {
    expect(doubleAllowed(makeRules(base), eleven())).toBe(false);
    expect(doubleAllowed(makeRules({ ...base, 'rules.doubleOnThreeCards': true }), eleven())).toBe(true);
    expect(doubleAllowed(makeRules({ ...base, 'rules.doubleAnyNumberOfCards': true }), eleven())).toBe(true);
  });

  it('allows a fourth card only where any number may double', () => {
    const four = hand([card(2), card(2), card(3), card(4)]);
    expect(doubleAllowed(makeRules({ ...base, 'rules.doubleOnThreeCards': true }), four)).toBe(false);
    expect(doubleAllowed(makeRules({ ...base, 'rules.doubleAnyNumberOfCards': true }), four)).toBe(true);
  });
});

describe('doubling a split hand', () => {
  const base: Partial<SettingValues> = { 'rules.hardDoubles': 'any' };
  const split = (cards: CardId[]) => hand(cards, { splitCount: 1 });

  it('needs double after split', () => {
    expect(doubleAllowed(makeRules({ ...base, 'rules.doubleAfterSplit': false }), split([card(5), card(6)]))).toBe(
      false,
    );
    expect(doubleAllowed(makeRules({ ...base, 'rules.doubleAfterSplit': true }), split([card(5), card(6)]))).toBe(true);
  });

  it('lets a pair of split aces double where that is allowed on its own', () => {
    const rules = makeRules({ ...base, 'rules.doubleAfterSplit': false, 'rules.doubleAfterSplitAces': true });
    expect(doubleAllowed(rules, split([card(1), card(1)]))).toBe(true);
    // Not a pair of aces, so the ordinary rule applies.
    expect(doubleAllowed(rules, split([card(1), card(9)]))).toBe(false);
  });

  it('refuses a redouble unless the table redoubles', () => {
    const doubled = hand([card(5), card(6)], { doubled: true, doubleBet: 10 });
    expect(doubleAllowed(makeRules(base), doubled)).toBe(false);
    expect(doubleAllowed(makeRules({ ...base, 'rules.redouble': true }), doubled)).toBe(true);
  });
});

describe('what a blackjack pays', () => {
  const natural = (suit = SPADES) => hand([card(1, suit), card(13, suit)]);

  it('follows the table payout', () => {
    expect(blackjackPremium(makeRules(), natural())).toBe(0.5);
    expect(blackjackPremium(makeRules({ 'rules.blackjackPayout': '2:1' }), natural())).toBe(1);
    expect(blackjackPremium(makeRules({ 'rules.blackjackPayout': '1:1' }), natural())).toBe(0);
    expect(blackjackPremium(makeRules({ 'rules.blackjackPayout': '6:5' }), natural())).toBe(0.2);
  });

  it('pays a bonus blackjack 2:1 whatever the table pays', () => {
    const diamonds = hand([card(1, DIAMONDS), card(13, DIAMONDS)]);
    expect(
      blackjackPremium(makeRules({ 'bonuses.diamondBlackjack': true, 'rules.blackjackPayout': '6:5' }), diamonds),
    ).toBe(1);

    const suitedAceJack = hand([card(1, CLUBS), card(11, CLUBS)]);
    expect(blackjackPremium(makeRules({ 'bonuses.suitedAceJack': true }), suitedAceJack)).toBe(1);

    const heartsAceJack = hand([card(1, HEARTS), card(11, HEARTS)]);
    expect(blackjackPremium(makeRules({ 'bonuses.heartsAceJack': true }), heartsAceJack)).toBe(1);
  });

  it('rounds the premium up only where the table rounds', () => {
    expect(roundPremium(makeRules(), 7.5)).toBe(7.5);
    expect(roundPremium(makeRules({ 'rules.blackjackRoundUp': true }), 7.5)).toBe(8);
    expect(roundPremium(makeRules({ 'rules.blackjackRoundUp': true }), 7.4)).toBe(7);
  });
});

describe('the bust ceiling', () => {
  it('is 21, or 22 where a player 22 counts as 21', () => {
    expect(bustValue(makeRules())).toBe(21);
    expect(bustValue(makeRules({ 'rules.player22CountsAs21': true }))).toBe(22);
  });

  it('is 21 when asked about nothing at all', () => {
    expect(bustValue()).toBe(21);
  });
});

describe('splitting', () => {
  const pair = (rank: number, suits = [SPADES, CLUBS], extra: Partial<Hand> = {}) =>
    hand([card(rank, suits[0]), card(rank, suits[1])], extra);

  it('needs a pair of equal value', () => {
    expect(splitAllowed(makeRules(), pair(8), 1)).toBe(true);
    expect(splitAllowed(makeRules(), hand([card(8), card(9)]), 1)).toBe(false);
  });

  it('counts a ten and a king as a pair unless the table wants the same rank', () => {
    const tenKing = hand([card(10), card(13, CLUBS)]);
    expect(splitAllowed(makeRules(), tenKing, 1)).toBe(true);
    expect(splitAllowed(makeRules({ 'rules.splitTensSameRankOnly': true }), tenKing, 1)).toBe(false);
    // Two kings are still the same rank.
    expect(splitAllowed(makeRules({ 'rules.splitTensSameRankOnly': true }), pair(13), 1)).toBe(true);
  });

  it('stops at the hands the table allows in a seat', () => {
    const rules = makeRules({ 'rules.maxSplitHands': 2 });
    expect(splitAllowed(rules, pair(8), 1)).toBe(true);
    expect(splitAllowed(rules, pair(8), 2)).toBe(false);
  });

  it('refuses aces where the table splits none', () => {
    expect(splitAllowed(makeRules({ 'rules.noAceSplits': true }), pair(1), 1)).toBe(false);
    expect(splitAllowed(makeRules(), pair(1), 1)).toBe(true);
  });

  it('refuses fours, fives and tens where the table says so', () => {
    const rules = makeRules({ 'rules.noSplit4s5s10s': true });
    for (const rank of [4, 5, 10]) expect(splitAllowed(rules, pair(rank), 1)).toBe(false);
    expect(splitAllowed(rules, pair(8), 1)).toBe(true);
  });

  it('refuses to resplit aces unless the table allows it', () => {
    const splitAces = pair(1, [SPADES, CLUBS], { splitCount: 1 });
    expect(splitAllowed(makeRules({ 'rules.resplitAces': false }), splitAces, 1)).toBe(false);
    expect(splitAllowed(makeRules({ 'rules.resplitAces': true }), splitAces, 1)).toBe(true);
  });
});

describe('surrendering', () => {
  const fresh = () => hand([card(10), card(6)]);

  it('is refused once insurance is taken, unless the table allows both', () => {
    const rules = makeRules({ 'rules.surrender': 'late', 'rules.surrenderAfterInsurance': false });
    expect(surrenderAllowed(rules, fresh(), { hasInsurance: true })).toBe(false);
    const both = makeRules({ 'rules.surrender': 'late', 'rules.surrenderAfterInsurance': true });
    expect(surrenderAllowed(both, fresh(), { hasInsurance: true })).toBe(true);
  });

  it('is refused on a split hand', () => {
    const rules = makeRules({ 'rules.surrender': 'late' });
    expect(surrenderAllowed(rules, hand([card(10), card(6)], { splitCount: 1 }))).toBe(false);
  });
});

describe('early surrender against an upcard', () => {
  const upcard = (rank: number, suit = SPADES) => card(rank, suit);

  it('is allowed against anything for early surrender and Macao', () => {
    for (const setting of ['early', 'macao'] as const) {
      const rules = makeRules({ 'rules.surrender': setting });
      expect(earlySurrenderAllowed(rules, upcard(5))).toBe(true);
    }
  });

  it('is allowed only against a ten for "early versus ten"', () => {
    const rules = makeRules({ 'rules.surrender': 'earlyVsTen' });
    expect(earlySurrenderAllowed(rules, upcard(13))).toBe(true);
    expect(earlySurrenderAllowed(rules, upcard(9))).toBe(false);
  });

  it('is refused for late surrender and for none', () => {
    for (const setting of ['late', 'none'] as const) {
      expect(earlySurrenderAllowed(makeRules({ 'rules.surrender': setting }), upcard(13))).toBe(false);
    }
  });
});

describe('winning on card count', () => {
  const unbusted = (n: number) => hand(Array.from({ length: n }, () => card(2)));

  it('pays at exactly the count the table rewards', () => {
    expect(charlieWin(makeRules({ 'rules.autoWinSixCards': true }), unbusted(6))).toBe(true);
    expect(charlieWin(makeRules({ 'rules.autoWinSixCards': true }), unbusted(5))).toBe(false);
    expect(charlieWin(makeRules({ 'rules.autoWinSevenCards': true }), unbusted(7))).toBe(true);
    expect(charlieWin(makeRules({ 'rules.autoWinSevenCards': true }), unbusted(6))).toBe(false);
  });

  it('never pays a busted hand', () => {
    const busted = hand([card(10), card(10), card(5)]);
    expect(charlieWin(makeRules({ 'rules.autoWinFiveCards': true }), busted)).toBe(false);
  });
});

describe('offering insurance', () => {
  const ace = card(1);

  it('needs an ace showing', () => {
    const rules = makeRules({ 'rules.insurance': 'normal' });
    expect(insuranceOffered(rules, ace, false)).toBe(true);
    expect(insuranceOffered(rules, card(13), false)).toBe(false);
  });

  it('is never offered where the table has no insurance', () => {
    expect(insuranceOffered(makeRules({ 'rules.insurance': 'none' }), ace, true)).toBe(false);
  });

  it('waits for the player to hold 21 where only a blackjack may insure', () => {
    const rules = makeRules({ 'rules.insurance': 'blackjackOnly' });
    expect(insuranceOffered(rules, ace, true)).toBe(true);
    expect(insuranceOffered(rules, ace, false)).toBe(false);
  });
});
