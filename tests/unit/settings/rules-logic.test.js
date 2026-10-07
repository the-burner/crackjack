import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.js';
import {
  applyGameChange,
  applyIndexRangeChange,
  applyRuleChange,
  gameVariant,
  prepareLaunch,
} from '../../../src/settings/rules-logic.js';

/** A reader over the schema defaults with the given overrides. */
function reader(overrides = {}) {
  return key => {
    if (key in overrides) return overrides[key];
    if (!(key in SETTINGS_SCHEMA)) throw new Error(`Unknown setting: ${key}`);
    return structuredClone(SETTINGS_SCHEMA[key].default);
  };
}

const change = (overrides, key, value) => applyRuleChange(reader(overrides), key, value);

describe('applyRuleChange: doubling', () => {
  it('redoubling needs three-card doubles and a face-up double card', () => {
    expect(change({ 'table.doubleDownCardFaceUp': false }, 'rules.redouble', true)).toEqual({
      'rules.redouble': true,
      'rules.doubleOnThreeCards': true,
      'table.doubleDownCardFaceUp': true,
    });
  });

  it('turning off three-card doubles turns off redouble and any-card doubles', () => {
    const overrides = {
      'rules.doubleOnThreeCards': true,
      'rules.redouble': true,
      'rules.doubleAnyNumberOfCards': true,
    };
    expect(change(overrides, 'rules.doubleOnThreeCards', false)).toEqual({
      'rules.doubleOnThreeCards': false,
      'rules.redouble': false,
      'rules.doubleAnyNumberOfCards': false,
    });
  });

  it('doubling on any number of cards implies three-card doubles', () => {
    expect(change({}, 'rules.doubleAnyNumberOfCards', true)).toEqual({
      'rules.doubleAnyNumberOfCards': true,
      'rules.doubleOnThreeCards': true,
    });
  });

  it('hitting after a double shows the double card', () => {
    expect(change({ 'table.doubleDownCardFaceUp': false }, 'rules.hitAfterDouble', true)).toEqual({
      'rules.hitAfterDouble': true,
      'table.doubleDownCardFaceUp': true,
    });
  });

  it('no longer hitting after a double leaves the double card as it is', () => {
    expect(
      change({ 'rules.hitAfterDouble': true, 'table.doubleDownCardFaceUp': false }, 'rules.hitAfterDouble', false),
    ).toEqual({ 'rules.hitAfterDouble': false });
  });
});

describe('applyRuleChange: peeking and the hole card', () => {
  it('peeking on a ten also peeks on an ace and rules out a missing hole card', () => {
    const overrides = { 'rules.dealerPeeksTen': false, 'rules.dealerPeeksAce': false, 'rules.noHoleCard': true };
    expect(change(overrides, 'rules.dealerPeeksTen', true)).toEqual({
      'rules.dealerPeeksTen': true,
      'rules.dealerPeeksAce': true,
      'rules.noHoleCard': false,
    });
  });

  it('not peeking on an ace means not peeking at all', () => {
    expect(change({}, 'rules.dealerPeeksAce', false)).toEqual({
      'rules.dealerPeeksAce': false,
      'rules.dealerPeeksTen': false,
    });
  });

  it('no hole card clears both peeks', () => {
    expect(change({}, 'rules.noHoleCard', true)).toEqual({
      'rules.noHoleCard': true,
      'rules.dealerPeeksTen': false,
      'rules.dealerPeeksAce': false,
    });
  });

  it('peeking on a ten cancels early surrender against a ten', () => {
    const overrides = { 'rules.surrender': 'earlyVsTen', 'rules.dealerPeeksTen': false };
    expect(change(overrides, 'rules.dealerPeeksTen', true)['rules.surrender']).toBe('none');
  });

  it('early surrender against a ten stops the dealer peeking on a ten', () => {
    expect(change({}, 'rules.surrender', 'earlyVsTen')).toEqual({
      'rules.surrender': 'earlyVsTen',
      'rules.dealerPeeksTen': false,
    });
  });

  it('leaves other surrender choices alone', () => {
    expect(change({}, 'rules.surrender', 'late')).toEqual({ 'rules.surrender': 'late' });
  });
});

describe('applyRuleChange: splitting', () => {
  it('resplitting aces needs a resplit limit', () => {
    expect(change({ 'rules.maxSplitHands': 2 }, 'rules.resplitAces', true)).toEqual({
      'rules.resplitAces': true,
      'rules.maxSplitHands': 4,
    });
  });

  it('keeps a three-hand limit when aces may be resplit', () => {
    expect(change({ 'rules.maxSplitHands': 3 }, 'rules.resplitAces', true)).toEqual({ 'rules.resplitAces': true });
  });

  it('allowing no resplits also stops ace resplits', () => {
    expect(change({ 'rules.resplitAces': true }, 'rules.maxSplitHands', 2)).toEqual({
      'rules.maxSplitHands': 2,
      'rules.resplitAces': false,
    });
  });

  it('doubling after an ace split implies doubling after a split', () => {
    expect(change({ 'rules.doubleAfterSplit': false }, 'rules.doubleAfterSplitAces', true)).toEqual({
      'rules.doubleAfterSplitAces': true,
      'rules.doubleAfterSplit': true,
    });
  });

  it('banning doubles after a split bans them after an ace split too', () => {
    expect(change({ 'rules.doubleAfterSplitAces': true }, 'rules.doubleAfterSplit', false)).toEqual({
      'rules.doubleAfterSplit': false,
      'rules.doubleAfterSplitAces': false,
    });
  });

  it('banning doubles after an ace split says nothing about other splits', () => {
    expect(
      change(
        { 'rules.doubleAfterSplitAces': true, 'rules.doubleAfterSplit': true },
        'rules.doubleAfterSplitAces',
        false,
      ),
    ).toEqual({ 'rules.doubleAfterSplitAces': false });
  });
});

describe('applyRuleChange: double exposure bans', () => {
  const doubleExposure = { 'bonuses.game': 2002, 'rules.insurance': 'none', 'peeking.mode': 'off' };

  it('refuses insurance while both dealer cards are face up', () => {
    expect(change(doubleExposure, 'rules.insurance', 'normal')['rules.insurance']).toBe('none');
  });

  it('refuses peeking at a hole card that is already visible', () => {
    expect(change(doubleExposure, 'peeking.mode', 'holeCard')['peeking.mode']).toBe('off');
  });

  it('still allows peeking when the dealer peeks', () => {
    expect(change(doubleExposure, 'peeking.mode', 'whenDealerPeeks')['peeking.mode']).toBe('whenDealerPeeks');
  });
});

describe('gameVariant', () => {
  it('maps the side-bet game ids that change the rules', () => {
    expect(gameVariant(0)).toBe('standard');
    expect(gameVariant(8)).toBe('standard');
    expect(gameVariant(2001)).toBe('blackjackSwitch');
    expect(gameVariant(2002)).toBe('doubleExposure');
    expect(gameVariant(16)).toBe('spanish21');
    expect(gameVariant(17)).toBe('spanish21');
  });
});

describe('applyGameChange', () => {
  it('applies the double exposure rule bundle', () => {
    const changes = applyGameChange(reader(), 2002);
    expect(changes).toMatchObject({
      'bonuses.game': 2002,
      'rules.dealerWinsTies': true,
      'rules.blackjackPayout': '1:1',
      'rules.insurance': 'none',
      'peeking.mode': 'off',
    });
  });

  it('applies the blackjack switch rule bundle', () => {
    expect(applyGameChange(reader(), 2001)).toMatchObject({
      'bonuses.game': 2001,
      'rules.dealerHitsSoft17': true,
      'rules.dealerPeeksTen': true,
      'rules.dealerPeeksAce': true,
      'rules.doubleAfterSplit': true,
      'rules.dealerBlackjackWinsAll': true,
      'rules.blackjackPayout': '1:1',
    });
  });

  it('applies the spanish 21 bundle for both spanish games', () => {
    for (const id of [16, 17]) {
      expect(applyGameChange(reader(), id)).toMatchObject({
        'bonuses.game': id,
        'rules.surrender': 'late',
        'rules.doubleDownRescue': true,
        'rules.resplitAces': true,
        'rules.doubleAnyNumberOfCards': true,
        'rules.doubleOnThreeCards': true,
        'rules.playerBlackjackAlwaysWins': true,
      });
    }
  });

  it('restores the rules the previous variant forced', () => {
    const current = reader({ 'bonuses.game': 2002, 'rules.dealerWinsTies': true, 'rules.blackjackPayout': '1:1' });
    expect(applyGameChange(current, 8)).toEqual({
      'bonuses.game': 8,
      'rules.dealerWinsTies': false,
      'rules.blackjackPayout': '3:2',
      'rules.insurance': 'normal',
      'peeking.mode': 'off',
    });
  });

  it('keeps unrelated rules when a side bet is chosen', () => {
    const current = reader({
      'rules.autoWinFiveCards': true,
      'rules.doubleDownRescue': true,
      'rules.surrender': 'late',
    });
    expect(applyGameChange(current, 15)).toEqual({ 'bonuses.game': 15 });
  });

  it('does not reset a rule the new variant forces as well', () => {
    const current = reader({
      'bonuses.game': 2002,
      'rules.dealerWinsTies': true,
      'rules.blackjackPayout': '1:1',
      'rules.insurance': 'none',
      'peeking.mode': 'off',
    });
    expect(applyGameChange(current, 2001)).toEqual({
      'bonuses.game': 2001,
      // Double exposure's own rules go back to their defaults...
      'rules.dealerWinsTies': false,
      'rules.insurance': 'normal',
      'peeking.mode': 'off',
      // ...but the even-money payout both variants force stays put.
      'rules.blackjackPayout': '1:1',
      'rules.dealerHitsSoft17': true,
      'rules.dealerPeeksTen': true,
      'rules.dealerPeeksAce': true,
      'rules.doubleAfterSplit': true,
      'rules.dealerBlackjackWinsAll': true,
      // What blackjack switch overwrote, so that leaving it can put it back.
      'bonuses.savedRules': {
        'rules.dealerHitsSoft17': true,
        'rules.dealerPeeksTen': true,
        'rules.dealerPeeksAce': true,
        'rules.doubleAfterSplit': true,
        'rules.dealerBlackjackWinsAll': false,
        'rules.blackjackPayout': '3:2',
      },
    });
  });

  it('keeps the bundle when moving between two games of the same variant', () => {
    const current = reader({ 'bonuses.game': 16, 'rules.surrender': 'late', 'rules.resplitAces': true });
    expect(applyGameChange(current, 17)).toEqual({ 'bonuses.game': 17 });
  });

  it('puts back the rules the player had before the variant was chosen', () => {
    const before = { 'rules.dealerHitsSoft17': false, 'rules.hardDoubles': '9-11' };
    const spanish = applyGameChange(reader(before), 17);
    expect(applyGameChange(reader({ ...before, ...spanish }), 0)).toMatchObject({
      'bonuses.game': 0,
      'rules.dealerHitsSoft17': false,
      'rules.hardDoubles': '9-11',
    });
  });
});

describe('applyIndexRangeChange', () => {
  it('refuses a minimum count above the maximum', () => {
    expect(applyIndexRangeChange(reader({ 'strategy.indexRangeMax': 10 }), 'strategy.indexRangeMin', 50)).toEqual({
      'strategy.indexRangeMin': 10,
    });
  });

  it('refuses a maximum count below the minimum', () => {
    expect(applyIndexRangeChange(reader({ 'strategy.indexRangeMin': -4 }), 'strategy.indexRangeMax', -20)).toEqual({
      'strategy.indexRangeMax': -4,
    });
  });

  it('takes a range that is the right way round as it is', () => {
    expect(applyIndexRangeChange(reader(), 'strategy.indexRangeMin', -4)).toEqual({ 'strategy.indexRangeMin': -4 });
    expect(applyIndexRangeChange(reader(), 'strategy.indexRangeMax', 12)).toEqual({ 'strategy.indexRangeMax': 12 });
  });
});

describe('prepareLaunch', () => {
  it('leaves the seat count alone in either orientation', () => {
    expect(prepareLaunch(reader({ 'table.seatCount': 6 }))).toEqual({ changes: {} });
  });

  it('frees the first seat when every seat in play is a computer', () => {
    const current = reader({ 'table.seatCount': 2, 'table.computerSeats': [true, true, true, true, true, true] });
    expect(prepareLaunch(current).changes['table.computerSeats']).toEqual([false, true, true, true, true, true]);
  });

  it('counts only the seats in play when looking for a free seat', () => {
    const current = reader({ 'table.seatCount': 2, 'table.computerSeats': [true, true, true, true, true, false] });
    expect(prepareLaunch(current).changes['table.computerSeats']).toEqual([false, true, true, true, true, false]);
    const six = reader({ 'table.seatCount': 6, 'table.computerSeats': [true, true, true, true, true, false] });
    expect(prepareLaunch(six)).toEqual({ changes: {} });
  });
});
