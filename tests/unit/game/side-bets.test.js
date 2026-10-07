import { describe, it, expect } from 'vitest';
import { evaluateSideBet, evaluateHandBonus, sideBetSpots, ruleMatches, allowedAtCount } from '../../../src/game/engine/side-bets.js';
import { decodeSideBetGame } from '../../../src/settings/side-bet-games.js';
import { SIDE_BET_GAME_DEFINITIONS, BUILTIN_SIDE_BET_GAMES } from '../../../src/data/side-bet-games.js';
import { cardId } from '../../../src/core/cards.js';

const SPADES = 0, CLUBS = 1, HEARTS = 2, DIAMONDS = 3;
const c = (rank, suit = SPADES) => cardId(rank, suit);

/** Decodes a built-in game by its name in the game list. */
function game(name) {
  const entry = BUILTIN_SIDE_BET_GAMES.find(g => g.name === name);
  const definition = entry && SIDE_BET_GAME_DEFINITIONS[entry.id];
  if (!definition) throw new Error(`No definition for ${name}`);
  return decodeSideBetGame(definition);
}

function play(def, playerHandCards, dealerHandCards, { stake = 5, spot = 0, won = false, doubled = false, split = false, trueCount = 0 } = {}) {
  const spots = sideBetSpots(def);
  if (spots.length === 0) return null;
  return evaluateSideBet({
    game: def, ruleIndex: spots[spot].ruleIndex, stake,
    context: { playerHandCards, dealerHandCards, won, doubled, split, trueCount },
  });
}

/** The bonus a game pays on the main bet, for a $10 bet. */
function bonus(def, playerHandCards, dealerHandCards, { playerTotal = 21, dealerTotal = 19, ...rest } = {}) {
  return evaluateHandBonus({
    game: def, bet: 10,
    context: {
      playerHandCards, dealerHandCards, won: false, doubled: false, split: false,
      dealerBlackjack: false, playerTotal, dealerTotal, ...rest,
    },
  });
}

describe('side bet spots', () => {
  it('lists the enabled side-bet rules of each game', () => {
    expect(sideBetSpots(game('21 + 3 Blackjack (Wagerworks)')).length).toBeGreaterThan(0);
    expect(sideBetSpots(game('Over Under 13')).length).toBe(2);
    expect(sideBetSpots(game('Red Black')).length).toBe(2);
  });
});

describe('21 + 3 (Wagerworks)', () => {
  const def = game('21 + 3 Blackjack (Wagerworks)');

  it('pays 100:1 for suited trips', () => {
    const result = play(def, [c(5, HEARTS), c(5, HEARTS)], [c(5, HEARTS)]);
    expect(result.multiplier).toBe(100);
  });

  it('pays 5:1 for a flush', () => {
    const result = play(def, [c(2, CLUBS), c(9, CLUBS)], [c(5, CLUBS)]);
    expect(result.multiplier).toBe(5);
  });

  it('pays 10:1 for a straight', () => {
    const result = play(def, [c(5, CLUBS), c(6, HEARTS)], [c(7, SPADES)]);
    expect(result.multiplier).toBe(10);
  });

  it('loses when the three cards make nothing', () => {
    expect(play(def, [c(2, CLUBS), c(9, HEARTS)], [c(5, SPADES)])).toBeNull();
  });
});

describe('Dare any Pair', () => {
  const def = game('Dare any Pair');

  it('pays a pair and loses otherwise', () => {
    expect(play(def, [c(8, CLUBS), c(8, HEARTS)], [c(5)]).multiplier).toBeGreaterThan(0);
    expect(play(def, [c(8, CLUBS), c(9, HEARTS)], [c(5)])).toBeNull();
  });
});

describe('Royal Match', () => {
  const def = game('Royal Match');

  it('pays more for a suited king and queen than for any suited pair of cards', () => {
    const royal = play(def, [c(13, DIAMONDS), c(12, DIAMONDS)], [c(5)]);
    const suited = play(def, [c(3, DIAMONDS), c(9, DIAMONDS)], [c(5)]);
    expect(royal.multiplier).toBeGreaterThan(suited.multiplier);
  });
});

describe('straights', () => {
  const def = game('21 + 3 Blackjack (Wagerworks)');

  it('runs an ace high, so A-K-Q is a straight', () => {
    expect(play(def, [c(1, SPADES), c(13, HEARTS)], [c(12, DIAMONDS)]).multiplier).toBe(10);
  });

  it('runs an ace low, so A-2-3 is a straight', () => {
    expect(play(def, [c(1, SPADES), c(2, HEARTS)], [c(3, DIAMONDS)]).multiplier).toBe(10);
  });

  it('does not stretch an ace to fill a gap', () => {
    expect(play(def, [c(1, SPADES), c(2, HEARTS)], [c(5, DIAMONDS)])).toBeNull();
  });
});

describe('Perfect Pairs', () => {
  const def = game('Perfect Pairs');

  it('pays 6:1 for a mixed pair, 12:1 for a coloured one and 25:1 for a perfect one', () => {
    expect(play(def, [c(8, SPADES), c(8, HEARTS)], [c(5)]).multiplier).toBe(6);
    expect(play(def, [c(8, SPADES), c(8, CLUBS)], [c(5)]).multiplier).toBe(12);
    expect(play(def, [c(8, HEARTS), c(8, DIAMONDS)], [c(5)]).multiplier).toBe(12);
    expect(play(def, [c(8, HEARTS), c(8, HEARTS)], [c(5)]).multiplier).toBe(25);
  });
});

describe('Over Under 13', () => {
  const def = game('Over Under 13');

  it('pays the Under spot below 13 and the Over spot above it', () => {
    expect(play(def, [c(1), c(13, HEARTS)], [c(5)], { spot: 0 }).multiplier).toBe(1);
    expect(play(def, [c(10), c(10, HEARTS)], [c(5)], { spot: 1 }).multiplier).toBe(1);
  });

  it('counts an ace as one, so an ace and a king are 11', () => {
    expect(play(def, [c(1), c(13, HEARTS)], [c(5)], { spot: 0 })).not.toBeNull();
  });

  it('pays neither spot on exactly 13', () => {
    expect(play(def, [c(10), c(3, HEARTS)], [c(5)], { spot: 0 })).toBeNull();
    expect(play(def, [c(10), c(3, HEARTS)], [c(5)], { spot: 1 })).toBeNull();
  });

  it('never pays the spot the player did not bet on', () => {
    expect(play(def, [c(10), c(10, HEARTS)], [c(5)], { spot: 0 })).toBeNull();
  });
});

describe('Field of Gold', () => {
  const def = game('Field of Gold');

  it('judges the hand on its first two cards, so a later card cannot raise the total', () => {
    // 10 + 10 + 5 is 25 over three cards, but the bet is on the first two: 20.
    expect(play(def, [c(10), c(10, HEARTS), c(5, CLUBS)], [c(5)])).toBeNull();
  });

  it('pays an exact total of nine', () => {
    expect(play(def, [c(5), c(4, HEARTS)], [c(5)]).multiplier).toBe(2);
  });
});

describe('Big Slick', () => {
  const def = game('Big Slick');

  it('pays 40:1 for a suited ace and king', () => {
    expect(play(def, [c(1, DIAMONDS), c(13, DIAMONDS)], [c(5)]).multiplier).toBe(40);
  });
});

describe('High Tie Bonus Blackjack', () => {
  const def = game('High Tie Bonus Blackjack');

  it('pays more for a suited 21 than an unsuited one', () => {
    expect(play(def, [c(1, SPADES), c(13, HEARTS)], [c(5), c(9)]).multiplier).toBe(6);
    expect(play(def, [c(1, SPADES), c(13, SPADES)], [c(5), c(9)]).multiplier).toBe(15);
  });

  it('pays 50:1 when the dealer ties the 21', () => {
    expect(play(def, [c(1, SPADES), c(13, HEARTS)], [c(1, CLUBS), c(13, CLUBS)]).multiplier).toBe(50);
  });
});

describe('Lucky Ladies', () => {
  const def = game('Lucky Ladies');

  it('climbs from an unsuited 20 to a matched pair', () => {
    expect(play(def, [c(10, SPADES), c(10, HEARTS)], [c(5)]).multiplier).toBe(4);
    expect(play(def, [c(10, SPADES), c(13, SPADES)], [c(5)]).multiplier).toBe(9);
    expect(play(def, [c(10, SPADES), c(10, SPADES)], [c(5)]).multiplier).toBe(19);
  });

  it('pays 125:1 for two queens of hearts', () => {
    expect(play(def, [c(12, HEARTS), c(12, HEARTS)], [c(5), c(9)]).multiplier).toBe(125);
  });

  it('pays the same 125:1 before the dealer has a second card', () => {
    expect(play(def, [c(12, HEARTS), c(12, HEARTS)], [c(5)]).multiplier).toBe(125);
  });

  it('pays 1000:1 when the dealer also has a blackjack', () => {
    expect(play(def, [c(12, HEARTS), c(12, HEARTS)], [c(1, SPADES), c(13, SPADES)]).multiplier).toBe(1000);
  });
});

describe('Bonanza Blackjack', () => {
  const def = game('Bonanza Blackjack');

  it('adds up every rule four identical kings match', () => {
    // 20 against a ten (10:1), all one suit (10:1), a suited pair (80:1),
    // suited trips with the up card (2400:1) and identical dealer cards (22500:1).
    expect(play(def, [c(13, SPADES), c(13, SPADES)], [c(13, SPADES), c(13, SPADES)]).multiplier).toBe(25000);
  });

  it('pays a 20 and its pair against a ten-valued up card', () => {
    expect(play(def, [c(10, SPADES), c(10, HEARTS)], [c(10, CLUBS), c(9, CLUBS)]).multiplier).toBe(30);
  });

  it('pays nothing against an ace, which is not a ten-valued up card', () => {
    expect(play(def, [c(10, SPADES), c(10, HEARTS)], [c(1, CLUBS), c(9, CLUBS)])).toBeNull();
  });

  it('wants a ten-valued up card of any rank', () => {
    for (const rank of [10, 11, 12, 13]) {
      expect(play(def, [c(10, SPADES), c(10, HEARTS)], [c(rank, CLUBS), c(9, CLUBS)]).multiplier).toBe(30);
    }
    expect(play(def, [c(10, SPADES), c(10, HEARTS)], [c(9, CLUBS), c(9, CLUBS)])).toBeNull();
  });

  it('pays nothing before the dealer has a card at all', () => {
    expect(play(def, [c(10, SPADES), c(10, HEARTS)], [])).toBeNull();
  });
});

describe('Sweet 16', () => {
  const def = game('Sweet 16');

  it('returns the stake for a rule that matches but pays nothing', () => {
    const result = play(def, [c(4, SPADES), c(4, HEARTS)], [c(5)], { stake: 5 });
    expect(result).toMatchObject({ payout: 5, multiplier: 0 });
  });

  it('pays even money for a total above 15', () => {
    expect(play(def, [c(10, SPADES), c(6, HEARTS)], [c(5)]).multiplier).toBe(1);
  });
});

describe('Spanish 21 hand bonuses', () => {
  const def = game('Spanish 21 - Match the Dealer');

  it('pays even money on a 21 the hand had not already won', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(10, HEARTS), c(9, HEARTS)])).toEqual({ payout: 10, multiplier: 1 });
  });

  it('pays nothing on a 21 that already beat the dealer', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(10, HEARTS), c(9, HEARTS)], { won: true })).toBeNull();
  });

  it('pays a 21 that only tied the dealer', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(10, HEARTS), c(1, HEARTS)], { won: true, dealerTotal: 21 }))
      .toEqual({ payout: 10, multiplier: 1 });
  });

  it('pays a 21 against a dealer blackjack', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(1, HEARTS), c(13, HEARTS)], { won: true, dealerTotal: 21, dealerBlackjack: true }))
      .toEqual({ payout: 10, multiplier: 1 });
  });

  it('pays double on a doubled 21', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(10, HEARTS), c(9, HEARTS)], { doubled: true }))
      .toEqual({ payout: 20, multiplier: 2 });
  });

  it('pays 3:2, 2:1 and 3:1 for a 21 of five, six and seven cards', () => {
    const dealer = [c(10, HEARTS), c(9, HEARTS)];
    expect(bonus(def, [c(5), c(4), c(3), c(2), c(7)], dealer).multiplier).toBe(1.5);
    expect(bonus(def, [c(5), c(4), c(3), c(2), c(6), c(1)], dealer).multiplier).toBe(2);
    expect(bonus(def, [c(2), c(3), c(2), c(3), c(2), c(3), c(6)], dealer).multiplier).toBe(3);
  });

  it('drops the card-count bonus on a doubled hand, leaving even money', () => {
    expect(bonus(def, [c(5), c(4), c(3), c(2), c(7)], [c(10, HEARTS), c(9, HEARTS)], { doubled: true }))
      .toEqual({ payout: 20, multiplier: 2 });
  });

  it('pays 3:2 mixed, 2:1 suited and 3:1 in spades for a 6-7-8', () => {
    const dealer = [c(10, CLUBS), c(9, CLUBS)];
    expect(bonus(def, [c(6, CLUBS), c(7, HEARTS), c(8, DIAMONDS)], dealer).multiplier).toBe(1.5);
    expect(bonus(def, [c(6, HEARTS), c(7, HEARTS), c(8, HEARTS)], dealer).multiplier).toBe(2);
    expect(bonus(def, [c(6, SPADES), c(7, SPADES), c(8, SPADES)], dealer).multiplier).toBe(3);
  });

  it('pays 3:2 mixed, 2:1 suited and 3:1 in spades for a 7-7-7', () => {
    const dealer = [c(10, CLUBS), c(9, CLUBS)];
    expect(bonus(def, [c(7, CLUBS), c(7, HEARTS), c(7, DIAMONDS)], dealer).multiplier).toBe(1.5);
    expect(bonus(def, [c(7, HEARTS), c(7, HEARTS), c(7, HEARTS)], dealer).multiplier).toBe(2);
    expect(bonus(def, [c(7, SPADES), c(7, SPADES), c(7, SPADES)], dealer).multiplier).toBe(3);
  });

  it('adds a flat super bonus to a spaded 7-7-7 against a dealer seven', () => {
    expect(bonus(def, [c(7, SPADES), c(7, SPADES), c(7, SPADES)], [c(7, HEARTS), c(9, CLUBS)], { dealerTotal: 16 }))
      .toEqual({ payout: 230, multiplier: 3 });
  });

  it('pays double on a doubled 21 that only tied', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(10, HEARTS), c(1, HEARTS)], { won: true, doubled: true, dealerTotal: 21 }))
      .toEqual({ payout: 20, multiplier: 2 });
  });

  it('pays nothing on a hand no bonus rule describes', () => {
    expect(bonus(def, [c(10), c(10, HEARTS)], [c(10, CLUBS), c(9, CLUBS)], { playerTotal: 20 })).toBeNull();
  });

  it('stops at the first matching rule where the game does not accumulate', () => {
    const firstOnly = { ...def, nonAdditive: false };
    expect(bonus(firstOnly, [c(5), c(4), c(3), c(2), c(7)], [c(10, HEARTS), c(9, HEARTS)]).multiplier).toBe(1);
  });
});

describe('Spanish 21 without the 21-always-wins rule', () => {
  const def = game('Spanish 21');

  it('pays the card-count bonus alone, so a five-card 21 is only 1:2', () => {
    expect(bonus(def, [c(5), c(4), c(3), c(2), c(7)], [c(10, HEARTS), c(9, HEARTS)]))
      .toEqual({ payout: 5, multiplier: 0.5 });
  });

  it('pays nothing extra for a plain three-card 21', () => {
    expect(bonus(def, [c(10), c(9), c(2)], [c(10, HEARTS), c(9, HEARTS)])).toBeNull();
  });

  it('still pays the super bonus, on top of the spaded 7-7-7 multiplier', () => {
    expect(bonus(def, [c(7, SPADES), c(7, SPADES), c(7, SPADES)], [c(7, HEARTS), c(9, CLUBS)], { dealerTotal: 16 }))
      .toEqual({ payout: 220, multiplier: 2 });
  });
});

describe('card conditions', () => {
  const rule = overrides => ({ ...game('Dare any Pair').rules[10], ...overrides });
  const context = (playerHandCards, dealerHandCards, extra = {}) =>
    ({ playerHandCards, dealerHandCards, won: false, doubled: false, split: false, trueCount: 0, ...extra });

  it('can pair the second player card with the second dealer card', () => {
    const second = rule({ mixMatch: [2, 2, 1] });
    expect(ruleMatches(second, context([c(5), c(8)], [c(2), c(8, HEARTS)]))).toBe(true);
    expect(ruleMatches(second, context([c(5), c(8)], [c(2), c(9, HEARTS)]))).toBe(false);
  });

  it("can pair two of the dealer's first three cards", () => {
    const three = rule({ mixMatch: [0, 4, 1] });
    expect(ruleMatches(three, context([c(5), c(8)], [c(2), c(9, HEARTS), c(9, DIAMONDS)]))).toBe(true);
    expect(ruleMatches(three, context([c(5), c(8)], [c(2), c(9, HEARTS), c(10, DIAMONDS)]))).toBe(false);
  });

  it('can require every card to be black, or every card to be red', () => {
    const black = rule({ mixMatch: [0, 0, 0], playerCombo: [0, 0, 9, 0, 0, 0, 0, 0, 0] });
    expect(ruleMatches(black, context([c(5, SPADES), c(8, CLUBS)], [c(5)]))).toBe(true);
    expect(ruleMatches(black, context([c(5, SPADES), c(8, HEARTS)], [c(5)]))).toBe(false);
    const red = rule({ mixMatch: [0, 0, 0], playerCombo: [0, 0, 10, 0, 0, 0, 0, 0, 0] });
    expect(ruleMatches(red, context([c(5, HEARTS), c(8, DIAMONDS)], [c(5)]))).toBe(true);
    expect(ruleMatches(red, context([c(5, HEARTS), c(8, SPADES)], [c(5)]))).toBe(false);
  });

  it('can require a rank in the dealer hand', () => {
    const dealerAce = rule({ mixMatch: [0, 0, 0], exactCards: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(ruleMatches(dealerAce, context([c(5), c(8)], [c(1, HEARTS), c(9)]))).toBe(true);
    expect(ruleMatches(dealerAce, context([c(5), c(8)], [c(2, HEARTS), c(9)]))).toBe(false);
  });

  it('matches any ten-valued card for the any-ten rank', () => {
    const anyTen = rule({ mixMatch: [0, 0, 0], exactCards: [14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(ruleMatches(anyTen, context([c(13), c(8)], [c(5)]))).toBe(true);
    expect(ruleMatches(anyTen, context([c(10), c(8)], [c(5)]))).toBe(true);
    expect(ruleMatches(anyTen, context([c(9), c(8)], [c(5)]))).toBe(false);
  });

  it("can require a rank of the dealer's hole card", () => {
    const hole = rule({ mixMatch: [0, 0, 0], exactCards: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0] });
    expect(ruleMatches(hole, context([c(5), c(8)], [c(9), c(5, HEARTS)]))).toBe(true);
    expect(ruleMatches(hole, context([c(5), c(8)], [c(9), c(6, HEARTS)]))).toBe(false);
    expect(ruleMatches(hole, context([c(5), c(8)], [c(9)]))).toBe(false);
  });

  it("can require a rank of the dealer's last card", () => {
    const last = rule({ mixMatch: [0, 0, 0], exactCards: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7] });
    expect(ruleMatches(last, context([c(5), c(8)], [c(9), c(5, HEARTS), c(7, DIAMONDS)]))).toBe(true);
    expect(ruleMatches(last, context([c(5), c(8)], [c(9), c(7, HEARTS), c(5, DIAMONDS)]))).toBe(false);
    expect(ruleMatches(last, context([c(5), c(8)], []))).toBe(false);
  });
});

describe('rule gating', () => {
  const def = game('Dare any Pair');

  it('respects a rule that requires a win', () => {
    const rule = { ...def.rules[sideBetSpots(def)[0].ruleIndex], winRequired: true };
    const context = { playerHandCards: [c(8, CLUBS), c(8, HEARTS)], dealerHandCards: [c(5)], won: false, doubled: false, split: false, trueCount: 0 };
    expect(ruleMatches(rule, context)).toBe(false);
    expect(ruleMatches(rule, { ...context, won: true })).toBe(true);
  });

  it('only runs a count-gated rule at or above its threshold', () => {
    const rule = { trueCountThreshold: 3, aboveThreshold: false };
    expect(allowedAtCount(rule, 0)).toBe(false);
    expect(allowedAtCount(rule, 3)).toBe(true);
    expect(allowedAtCount({ trueCountThreshold: -99 }, -20)).toBe(true);
    expect(allowedAtCount({ trueCountThreshold: 99, aboveThreshold: true }, 0)).toBe(true);
    expect(allowedAtCount({ trueCountThreshold: 3, aboveThreshold: true }, 5)).toBe(false);
  });

  it('skips a count-gated rule the player did not bet on', () => {
    const pairs = game('Perfect Pairs');
    const gated = { ...pairs, rules: pairs.rules.map((r, i) => (i === 11 ? { ...r, trueCountThreshold: 5 } : r)) };
    const colouredPair = [c(8, SPADES), c(8, CLUBS)];
    expect(play(gated, colouredPair, [c(5, HEARTS)], { trueCount: 0 }).multiplier).toBe(6);
    expect(play(gated, colouredPair, [c(5, HEARTS)], { trueCount: 5 }).multiplier).toBe(12);
  });

  it('refuses a rule the table bars after a split', () => {
    const rule = { ...def.rules[sideBetSpots(def)[0].ruleIndex], allowedAfterSplit: false };
    const context = { playerHandCards: [c(8, CLUBS), c(8, HEARTS)], dealerHandCards: [c(5)], won: false, doubled: false, split: true, trueCount: 0 };
    expect(ruleMatches(rule, context)).toBe(false);
    expect(ruleMatches(rule, { ...context, split: false })).toBe(true);
  });

  it('ignores a disabled rule, and a missing one', () => {
    const context = { playerHandCards: [c(8, CLUBS), c(8, HEARTS)], dealerHandCards: [c(5)], won: false, doubled: false, split: false, trueCount: 0 };
    expect(ruleMatches({ ...def.rules[10], enabled: false }, context)).toBe(false);
    expect(ruleMatches(undefined, context)).toBe(false);
  });

  it('treats a context with no count as a neutral count', () => {
    const pairs = game('Perfect Pairs');
    const result = evaluateSideBet({
      game: pairs, ruleIndex: 10, stake: 5,
      context: { playerHandCards: [c(8, SPADES), c(8, CLUBS)], dealerHandCards: [c(5, HEARTS)], won: false, doubled: false, split: false },
    });
    expect(result.multiplier).toBe(12);
  });

  it('pays nothing when no side bet was staked', () => {
    expect(play(def, [c(8, CLUBS), c(8, HEARTS)], [c(5)], { stake: 0 })).toBeNull();
  });

  it('offers no spots without a game', () => {
    expect(sideBetSpots(null)).toEqual([]);
  });
});

describe('every built-in game decodes and can be evaluated', () => {
  it.each(Object.keys(SIDE_BET_GAME_DEFINITIONS))('game %s', key => {
    const def = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[key]);
    expect(def.rules.length).toBe(20);
    const result = play(def, [c(8, CLUBS), c(8, CLUBS)], [c(8, CLUBS), c(10)]);
    expect(result === null || Number.isFinite(result.payout)).toBe(true);
  });
});

// These three games judge their conditions on the cards the rule picks out
// rather than on the player's whole hand (pattern code 8). Until that was
// implemented every rule in them failed and they could never pay.
describe('Lucky Lucky', () => {
  const def = game('Lucky Lucky');
  /** The bet is on the player's first two cards with the dealer's up card. */
  const three = (a, b, up) => play(def, [a, b], [up, c(9, CLUBS)]);

  it('pays 200:1 for a suited 777', () => {
    expect(three(c(7, HEARTS), c(7, HEARTS), c(7, HEARTS)).multiplier).toBe(200);
  });

  it('pays 100:1 for a suited 678', () => {
    expect(three(c(6, HEARTS), c(7, HEARTS), c(8, HEARTS)).multiplier).toBe(100);
  });

  it('pays 50:1 for an unsuited 777', () => {
    expect(three(c(7, HEARTS), c(7, SPADES), c(7, CLUBS)).multiplier).toBe(50);
  });

  it('pays 30:1 for an unsuited 678', () => {
    expect(three(c(6, HEARTS), c(7, SPADES), c(8, CLUBS)).multiplier).toBe(30);
  });

  it('pays 15:1 for a suited 21 and 3:1 for a mixed one', () => {
    expect(three(c(10, HEARTS), c(8, HEARTS), c(3, HEARTS)).multiplier).toBe(15);
    expect(three(c(10, HEARTS), c(8, SPADES), c(3, CLUBS)).multiplier).toBe(3);
  });

  it('pays 2:1 for a total of 20 or 19', () => {
    expect(three(c(10, HEARTS), c(7, SPADES), c(3, CLUBS)).multiplier).toBe(2);
    expect(three(c(10, HEARTS), c(6, SPADES), c(3, CLUBS)).multiplier).toBe(2);
  });

  it('pays nothing for a total of 18', () => {
    expect(three(c(10, HEARTS), c(5, SPADES), c(3, CLUBS))).toBeNull();
  });

  it('counts the dealer up card and not its hole card', () => {
    // 10 + 8 + 3 is 21; the hole card would spoil it if it counted.
    expect(play(def, [c(10, HEARTS), c(8, SPADES)], [c(3, CLUBS), c(10, SPADES)]).multiplier).toBe(3);
  });
});

describe("Super 7's", () => {
  const def = game("Super 7's");

  it('pays 5000:1 for three suited sevens', () => {
    expect(play(def, [c(7, HEARTS), c(7, HEARTS), c(7, HEARTS)], [c(9)]).multiplier).toBe(5000);
  });

  it('pays 500:1 for three unsuited sevens', () => {
    expect(play(def, [c(7, HEARTS), c(7, SPADES), c(7, CLUBS)], [c(9)]).multiplier).toBe(500);
  });

  it('pays 100:1 for two suited sevens and 50:1 for two mixed', () => {
    expect(play(def, [c(7, HEARTS), c(7, HEARTS), c(4)], [c(9)]).multiplier).toBe(100);
    expect(play(def, [c(7, HEARTS), c(7, SPADES), c(4)], [c(9)]).multiplier).toBe(50);
  });

  it('pays 3:1 for a first card of seven', () => {
    expect(play(def, [c(7, HEARTS), c(4), c(5)], [c(9)]).multiplier).toBe(3);
  });

  it('pays nothing when the seven is not the first card', () => {
    expect(play(def, [c(4), c(7, HEARTS), c(5)], [c(9)])).toBeNull();
  });
});

describe('Red Black', () => {
  const def = game('Red Black');

  it('offers a spot on each colour', () => {
    expect(sideBetSpots(def).map(spot => spot.id)).toEqual(['R', 'B']);
  });

  it('pays the red spot for a red up card and the black spot for a black one', () => {
    expect(play(def, [c(5), c(6)], [c(9, HEARTS)], { spot: 0 }).multiplier).toBe(1);
    expect(play(def, [c(5), c(6)], [c(9, SPADES)], { spot: 1 }).multiplier).toBe(1);
  });

  it('pays nothing on the wrong colour', () => {
    expect(play(def, [c(5), c(6)], [c(9, SPADES)], { spot: 0 })).toBeNull();
    expect(play(def, [c(5), c(6)], [c(9, HEARTS)], { spot: 1 })).toBeNull();
  });
});

describe('a game judged on the first two cards only', () => {
  it('ignores the cards a hand drew later', () => {
    const def = game('Perfect Pairs');
    const pair = [c(8, SPADES), c(8, SPADES)];
    expect(play(def, pair, [c(9)]).multiplier).toBeGreaterThan(0);
    // The same pair with a third card still pays: the bet was settled on the pair.
    expect(play(def, [...pair, c(5)], [c(9)]).multiplier).toBeGreaterThan(0);
  });
});
