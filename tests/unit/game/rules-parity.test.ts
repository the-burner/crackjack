// Rules the original applied that this app had stopped applying.

import { describe, it, expect } from 'vitest';
import { BlackjackGame, STATE, ACTION } from '../../../src/game/engine/game.ts';
import type { TableConfig } from '../../../src/game/engine/game.ts';
import {
  rulesFrom,
  surrenderAllowed,
  splitAcesMayDraw,
  splitAcesMayHit,
  bustValue,
} from '../../../src/game/engine/rules.ts';
import type { Rules } from '../../../src/game/engine/rules.ts';
import { settleHand, handBonus, RESULT } from '../../../src/game/engine/settlement.ts';
import { Hand } from '../../../src/game/engine/hand.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import type { SettingsPatch } from '../../../src/settings/schema.ts';
import { Storage, MemoryBackend } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';
import type { CardId } from '../../../src/core/cards.ts';
import { seededRandom } from '../../../src/core/random.ts';

const SPADES = 0,
  CLUBS = 1,
  HEARTS = 2;
const card = (rank: number, suit = SPADES) => cardId(rank, suit);

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function riggedGame(
  cards: CardId[],
  {
    rules = makeRules(),
    table = {},
    bankroll = 1000,
  }: { rules?: Rules; table?: Partial<TableConfig>; bankroll?: number } = {},
) {
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll,
    random: seededRandom(1),
  });
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift() as CardId;
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  return game;
}

const deal = (p1: CardId, up: CardId, p2: CardId, hole: CardId, rest: CardId[] = []) => [p1, up, p2, hole, ...rest];

/** A standalone hand, for the pure settlement and rule helpers. */
function hand(cards: CardId[], { bet = 10, ...rest }: Partial<Hand> = {}) {
  const h = new Hand({ seat: 1, bet });
  for (const c of cards) h.addCard(c);
  Object.assign(h, rest);
  return h;
}

describe('a player 22 counting as 21', () => {
  it('raises the bust ceiling only when the rule is on', () => {
    expect(bustValue(makeRules())).toBe(21);
    expect(bustValue(makeRules({ 'rules.player22CountsAs21': true }))).toBe(22);
  });

  it('does not bust a hard 22, and scores it as 21', () => {
    const game = riggedGame(deal(card(10), card(9), card(5), card(5), [card(7)]), {
      rules: makeRules({ 'rules.player22CountsAs21': true }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    const [player] = game.hands;
    expect(player.cards.length).toBe(3);
    expect(player.busted()).toBe(false);
    expect(player.total).toBe(21);
  });

  it('still busts a 23', () => {
    const game = riggedGame(deal(card(10), card(9), card(5), card(5), [card(8)]), {
      rules: makeRules({ 'rules.player22CountsAs21': true }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].busted()).toBe(true);
  });

  it('leaves the dealer busting above 21', () => {
    const rules = makeRules({ 'rules.player22CountsAs21': true });
    const game = riggedGame([], { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.dealer.bustCeiling).toBe(21);
  });
});

describe('player blackjack always wins', () => {
  const natural = [card(1), card(13)];

  it('pays 3:2 against a dealer blackjack instead of pushing', () => {
    const rules = makeRules({ 'rules.playerBlackjackAlwaysWins': true });
    const settled = settleHand({
      rules,
      hand: hand(natural),
      dealer: hand([card(1, CLUBS), card(12, CLUBS)]),
      dealerBlackjack: true,
    });
    expect(settled).toMatchObject({ payout: 25, result: RESULT.win });
  });

  it('pushes when the rule is off', () => {
    const settled = settleHand({
      rules: makeRules(),
      hand: hand(natural),
      dealer: hand([card(1, CLUBS), card(12, CLUBS)]),
      dealerBlackjack: true,
    });
    expect(settled).toMatchObject({ payout: 10, result: RESULT.push });
  });
});

describe('surrender', () => {
  it('offers Macao only on an unbusted five-card hand', () => {
    const rules = makeRules({ 'rules.surrender': 'macao' });
    expect(surrenderAllowed(rules, hand([card(5), card(6)]))).toBe(false);
    expect(surrenderAllowed(rules, hand([card(2), card(3), card(2), card(2), card(3)]))).toBe(true);
    expect(surrenderAllowed(rules, hand([card(10), card(10), card(10), card(10), card(10)]))).toBe(false);
  });

  it('allows double-down rescue on a doubled hand, with no table surrender rule', () => {
    const rescue = makeRules({ 'rules.doubleDownRescue': true, 'rules.surrender': 'none' });
    const doubled = hand([card(5), card(6), card(9)], { doubled: true, doubleBet: 10 });
    expect(surrenderAllowed(rescue, doubled)).toBe(true);
    expect(surrenderAllowed(makeRules({ 'rules.surrender': 'late' }), doubled)).toBe(false);
  });

  it('refuses a rescue once the doubled hand has busted', () => {
    const rescue = makeRules({ 'rules.doubleDownRescue': true });
    expect(surrenderAllowed(rescue, hand([card(10), card(6), card(9)], { doubled: true, doubleBet: 10 }))).toBe(false);
  });

  it('returns half of everything wagered, so a rescued double gets half of both bets', () => {
    const rules = makeRules({ 'rules.doubleDownRescue': true });
    const rescued = hand([card(5), card(6), card(9)], { doubled: true, doubleBet: 10, surrendered: true });
    expect(
      settleHand({ rules, hand: rescued, dealer: hand([card(10), card(8)]), dealerBlackjack: false }),
    ).toMatchObject({ payout: 10, result: RESULT.surrender });
  });

  it('offers a rescue in the game once the double card is out', () => {
    const rules = makeRules({ 'rules.doubleDownRescue': true, 'rules.surrender': 'none', 'rules.hardDoubles': 'any' });
    const game = riggedGame(deal(card(5), card(9), card(6), card(5), [card(2)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.availableActions().surrender).toBe(true);
  });
});

describe('split aces', () => {
  const aces = () => hand([card(1), card(1)], { splitCount: 1 });

  it('may resplit when resplit aces is on, but still may not hit', () => {
    const rules = makeRules({ 'rules.resplitAces': true, 'rules.hitSplitAces': false });
    expect(splitAcesMayDraw(rules, aces())).toBe(true);
    expect(splitAcesMayHit(rules, aces())).toBe(false);
  });

  it('may act when double after ace split is on', () => {
    const rules = makeRules({ 'rules.doubleAfterSplitAces': true, 'rules.hitSplitAces': false });
    expect(splitAcesMayDraw(rules, hand([card(1), card(9)], { splitCount: 1 }))).toBe(true);
  });

  it('stands at once when none of the three rules is on', () => {
    const rules = makeRules({ 'rules.hitSplitAces': false });
    expect(splitAcesMayDraw(rules, aces())).toBe(false);
    expect(splitAcesMayDraw(rules, hand([card(1), card(9)], { splitCount: 1 }))).toBe(false);
  });

  it('offers split but not hit on a resplittable pair of aces', () => {
    const rules = makeRules({ 'rules.resplitAces': true, 'rules.hitSplitAces': false, 'rules.maxSplitHands': 4 });
    const game = riggedGame(deal(card(1), card(9), card(1), card(5), [card(1), card(1)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    const actions = game.availableActions();
    expect(actions).toMatchObject({ hit: false, split: true, stand: true });
  });
});

describe('hands that win on their card count', () => {
  it('stands a five-card hand automatically when five cards win', () => {
    const rules = makeRules({ 'rules.autoWinFiveCards': true });
    const game = riggedGame(deal(card(2), card(9), card(2), card(5), [card(2), card(2), card(8)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    expect(game.hands[0].cards.length).toBe(5);
    expect(game.state).not.toBe(STATE.playerAction);
  });

  it('keeps dealing when the rule is off', () => {
    const game = riggedGame(deal(card(2), card(9), card(2), card(5), [card(2), card(2), card(3)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    expect(game.state).toBe(STATE.playerAction);
  });
});

describe('standing on 21', () => {
  it('stands a hard 21', () => {
    const game = riggedGame(deal(card(10), card(9), card(6), card(5), [card(5)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.state).not.toBe(STATE.playerAction);
  });

  it('keeps drawing on a soft 21 of exactly four cards, as the original did', () => {
    const game = riggedGame(deal(card(1), card(9), card(2), card(5), [card(5), card(3)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    const [player] = game.hands;
    expect(player.cards.length).toBe(4);
    expect(player.total).toBe(21);
    expect(player.soft).toBe(true);
    expect(game.state).toBe(STATE.playerAction);
  });
});

describe('doubling', () => {
  const doubling = (extra: SettingsPatch) =>
    makeRules({ 'rules.hardDoubles': 'any', 'rules.doubleAnyNumberOfCards': true, ...extra });

  it('stakes the bet plus the doubles already made when redoubling', () => {
    const game = riggedGame(deal(card(5), card(9), card(4), card(5), [card(2), card(2)]), {
      rules: doubling({ 'rules.redouble': true }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.hands[0].doubleBet).toBe(10);
    game.act(ACTION.double);
    expect(game.hands[0].doubleBet).toBe(30);
  });

  it('finishes a redoubled hand unless the table doubles on any number of cards', () => {
    const rules = makeRules({ 'rules.hardDoubles': 'any', 'rules.redouble': true, 'rules.doubleOnThreeCards': true });
    const game = riggedGame(deal(card(5), card(9), card(4), card(5), [card(2), card(2)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    game.act(ACTION.double);
    expect(game.state).not.toBe(STATE.playerAction);
  });

  it('reopens hit after a double only where the table hits after doubling', () => {
    const game = riggedGame(deal(card(5), card(9), card(4), card(5), [card(2)]), {
      rules: doubling({ 'rules.redouble': true }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.availableActions().hit).toBe(false);

    const hitting = riggedGame(deal(card(5), card(9), card(4), card(5), [card(2)]), {
      rules: doubling({ 'rules.hitAfterDouble': true }),
    });
    hitting.startRound([{ seat: 1, bet: 10 }]);
    hitting.act(ACTION.double);
    expect(hitting.availableActions().hit).toBe(true);
  });
});

describe('the dealer making obvious plays', () => {
  const obvious = (cards: CardId[], table: Partial<TableConfig> = {}) => {
    const game = riggedGame(cards, { table: { dealerMakesObviousPlays: true, ...table } });
    game.startRound([{ seat: 1, bet: 10 }]);
    return game;
  };

  it('stands a hard 17 for the player', () => {
    expect(obvious(deal(card(10), card(9), card(7), card(5))).state).not.toBe(STATE.playerAction);
  });

  it('leaves a pair of nines alone, so it can still be split', () => {
    expect(obvious(deal(card(9), card(9), card(9), card(5))).state).toBe(STATE.playerAction);
  });

  it('stands a hard 20', () => {
    expect(obvious(deal(card(10), card(9), card(13), card(5))).state).not.toBe(STATE.playerAction);
  });

  it('leaves a soft 20 alone, which the original judged on its all-aces-as-one total', () => {
    expect(obvious(deal(card(1), card(9), card(9), card(5))).state).toBe(STATE.playerAction);
  });

  it('leaves a hard 16 alone', () => {
    expect(obvious(deal(card(10), card(9), card(6), card(5))).state).toBe(STATE.playerAction);
  });

  it('does nothing in a face-down game, or when the option is off', () => {
    expect(obvious(deal(card(10), card(9), card(7), card(5)), { cardsFaceDown: true }).state).toBe(STATE.playerAction);
    const off = riggedGame(deal(card(10), card(9), card(7), card(5)));
    off.startRound([{ seat: 1, bet: 10 }]);
    expect(off.state).toBe(STATE.playerAction);
  });
});

describe('the suited 6-7-8 bonus', () => {
  const suited678 = hand([card(6, HEARTS), card(7, HEARTS), card(8, HEARTS)]);

  it('pays nothing against a dealer 21 when it only pays on a win', () => {
    const rules = makeRules({ 'bonuses.suited678IfWins': true });
    expect(handBonus(rules, suited678, { dealerTotal: 21 })).toBe(null);
    expect(handBonus(rules, suited678, { dealerTotal: 20 })).toMatchObject({ multiplier: 2 });
  });

  it('pays against a dealer 21 when it pays regardless', () => {
    const rules = makeRules({ 'bonuses.suited678': true });
    expect(handBonus(rules, suited678, { dealerTotal: 21 })).toMatchObject({ multiplier: 2 });
  });
});

describe('a hand the dealer wrongly busts', () => {
  const rigged = () => riggedGame(deal(card(10), card(9), card(5), card(8), [card(5)]));

  it('is taken away as soon as the card lands, not at the payoff', () => {
    const game = rigged();
    game.onGoodHandBusted = hand => hand.total === 20;
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.act(ACTION.hit);
    const [player] = game.hands;
    expect(player.mistakenBust).toBe(true);
    expect(player.total).toBe(20);
    // The hand is called a bust while it is still the player's turn.
    expect(events.find(e => e.type === 'message')).toMatchObject({ text: RESULT.bust, hand: player.key });
    expect(game.availableActions()).toEqual({});
  });

  it('pays nothing, whatever it held', () => {
    const game = rigged();
    game.onGoodHandBusted = () => true;
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0]).toMatchObject({ result: RESULT.bust, payout: 0 });
  });

  it('plays on as normal when the dealer makes no mistake', () => {
    const game = rigged();
    game.onGoodHandBusted = () => false;
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].mistakenBust).toBe(false);
    expect(game.hands[0].result).not.toBe(RESULT.bust);
  });

  it('is never asked about a computer seat', () => {
    const asked: string[] = [];
    const game = riggedGame([], { table: { seatCount: 2, computerSeats: [2], computerBet: 5 } });
    game.onGoodHandBusted = hand => {
      asked.push(hand.owner);
      return false;
    };
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(asked.every(owner => owner === 'human')).toBe(true);
  });
});
