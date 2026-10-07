// A face-down game, early surrender, and the insurance chips leaving the table.

import { describe, it, expect } from 'vitest';
import { BlackjackGame, STATE, ACTION } from '../../../src/game/engine/game.ts';
import { rulesFrom } from '../../../src/game/engine/rules.ts';
import { PLAYER } from '../../../src/game/engine/hand.ts';
import { createTableState } from '../../../src/game/table/table-state.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import { Storage, MemoryBackend } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';
import { seededRandom } from '../../../src/core/random.ts';

const card = (rank, suit = 0) => cardId(rank, suit);

function makeRules(overrides = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function riggedGame(cards, { rules = makeRules(), table = {} } = {}) {
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 2, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: seededRandom(1),
  });
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift();
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  return game;
}

describe('a face-down game', () => {
  const faceDown = { cardsFaceDown: true };

  it('turns the player hand up for its turn and back down on standing', () => {
    // Two seats, so the round is still going when the first one stands.
    // Deal order with two hands: 1-0, 2-0, dealer up, 1-0, 2-0, hole.
    const game = riggedGame([card(10), card(6), card(9), card(7), card(6), card(5)], { table: faceDown });
    game.startRound([
      { seat: 1, bet: 10 },
      { seat: 2, bet: 10 },
    ]);
    const [first, second] = game.hands;
    expect(first.faceUp).toEqual([true, true]);
    expect(second.faceUp.some(Boolean)).toBe(false);
    game.act(ACTION.stand);
    expect(first.faceUp).toEqual([false, false]);
    expect(second.faceUp).toEqual([true, true]);
  });

  it('turns every hand up at the showdown', () => {
    const game = riggedGame([card(10), card(9), card(7), card(5)], { table: faceDown });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(game.hands[0].faceUp).toEqual([true, true]);
  });

  it('tells the table to put the cards back down', () => {
    const game = riggedGame([card(10), card(9), card(7), card(5)], { table: faceDown });
    game.startRound([{ seat: 1, bet: 10 }]);
    const conceals = game.act(ACTION.stand).filter(e => e.type === 'conceal');
    expect(conceals).toEqual([
      { type: 'conceal', hand: '1-0', cardIndex: 0 },
      { type: 'conceal', hand: '1-0', cardIndex: 1 },
    ]);
  });

  it('leaves a doubled or split hand face up', () => {
    const rules = makeRules({ 'rules.hardDoubles': 'any' });
    const game = riggedGame([card(5), card(9), card(4), card(5), [card(2)]].flat(), { rules, table: faceDown });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.hands[0].faceUp.every(Boolean)).toBe(true);
  });

  it('keeps a computer seat down until the showdown', () => {
    const game = riggedGame([], { table: { ...faceDown, seatCount: 2, computerSeats: [2], computerBet: 5 } });
    game.startRound([{ seat: 1, bet: 10 }]);
    const computer = game.hands.find(hand => hand.owner === PLAYER.computer);
    expect(computer.faceUp.some(Boolean)).toBe(false);
    game.act(ACTION.stand);
    expect(computer.faceUp.every(Boolean)).toBe(true);
  });

  it('leaves every hand face up in a face-up game', () => {
    const game = riggedGame([card(10), card(9), card(7), card(5)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(game.hands[0].faceUp).toEqual([true, true]);
  });
});

describe('early surrender', () => {
  const early = makeRules({ 'rules.surrender': 'early', 'rules.insurance': 'normal' });

  it('is offered while the insurance offer stands', () => {
    const game = riggedGame([card(10), card(1), card(7), card(5)], { rules: early });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.insurance);
    expect(game.availableActions()).toEqual({ surrender: true });
  });

  it('gives the hand up without ending the insurance offer', () => {
    const game = riggedGame([card(10), card(1), card(7), card(5)], { rules: early });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.surrender);
    expect(game.hands[0].surrendered).toBe(true);
    expect(game.state).toBe(STATE.insurance);
  });

  it('does not offer the hand a turn once it has been given up', () => {
    const game = riggedGame([card(10), card(1), card(7), card(5)], { rules: early });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.surrender);
    game.declineInsurance();
    expect(game.state).not.toBe(STATE.playerAction);
    expect(game.hands[0].result).toBe('Surrender');
  });

  it('is not offered where the table only surrenders late', () => {
    const late = makeRules({ 'rules.surrender': 'late', 'rules.insurance': 'normal' });
    const game = riggedGame([card(10), card(1), card(7), card(5)], { rules: late });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.availableActions()).toEqual({ surrender: false });
  });
});

describe('the insurance chips', () => {
  it('are taken as soon as the dealer has checked and has no blackjack', () => {
    const rules = makeRules({ 'rules.insurance': 'normal', 'rules.dealerPeeksAce': true });
    const game = riggedGame([card(10), card(1), card(7), card(5)], { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.takeInsurance();
    expect(events.some(e => e.type === 'insuranceLost')).toBe(true);
  });

  it('stay where they are when the dealer does have a blackjack', () => {
    const rules = makeRules({ 'rules.insurance': 'normal', 'rules.dealerPeeksAce': true });
    const game = riggedGame([card(10), card(1), card(7), card(13)], { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.takeInsurance();
    expect(events.some(e => e.type === 'insuranceLost')).toBe(false);
  });

  it('come off the seat on the table as well as the bankroll', () => {
    const state = createTableState({ decks: 6 });
    state.setBankroll(1000);
    state.setBets([{ seat: 1, amount: 10 }]);
    state.apply({ type: 'card', hand: '1-0', card: 5, faceUp: true, cardIndex: 0 });
    state.apply({ type: 'offerInsurance' });
    state.apply({ type: 'insuranceTaken' });
    expect(state.chips.get(1).amount).toBe(15);
    state.apply({ type: 'insuranceLost' });
    expect(state.chips.get(1).amount).toBe(10);
  });
});
