import { describe, it, expect } from 'vitest';
import { createTableState } from '../../../public/src/game/table/table-state.js';

const card = (hand, value, faceUp = true) => ({ type: 'card', hand, card: value, faceUp, cardIndex: 0 });

const dealt = () => {
  const state = createTableState({ decks: 6 });
  state.setBankroll(1000);
  state.setBets([{ seat: 1, amount: 10 }]);
  state.apply({ type: 'shuffle' });
  state.apply({ type: 'burn', card: 7, faceUp: true });
  state.apply({ type: 'roundStart', round: 1 });
  state.apply(card('1-0', 5));
  state.apply(card('0-0', 13));
  state.apply(card('1-0', 9));
  state.apply({ type: 'card', hand: '0-0', card: 20, faceUp: false, cardIndex: 1 });
  return state;
};

describe('what the player can see', () => {
  it('builds hands from the cards as they arrive', () => {
    const state = dealt();
    expect(state.hands).toHaveLength(1);
    expect(state.hands[0]).toMatchObject({ key: '1-0', seat: 1, index: 0, cards: [5, 9] });
    expect(state.dealer.cards).toEqual([13, 20]);
    expect(state.dealer.faceUp).toEqual([true, false]);
  });

  it('keeps hands in seat order whatever order the cards arrive in', () => {
    const state = createTableState({ decks: 6 });
    state.apply(card('3-0', 1));
    state.apply(card('1-1', 2));
    state.apply(card('1-0', 3));
    expect(state.hands.map(h => h.key)).toEqual(['1-0', '1-1', '3-0']);
  });

  it('turns a card face up when it is revealed', () => {
    const state = dealt();
    state.apply({ type: 'reveal', hand: '0-0', cardIndex: 1, card: 20 });
    expect(state.dealer.faceUp).toEqual([true, true]);
  });

  it('counts the shoe down and the tray up', () => {
    const state = dealt();
    // Five cards have left the shoe; the burn card is the only one not on the table.
    expect(state.shoeCards).toBe(6 * 52 - 5);
    expect(state.trayCards).toBe(1);
  });

  it('sends the whole round to the tray when the table is cleared', () => {
    const state = dealt();
    state.apply({ type: 'clear' });
    expect(state.trayCards).toBe(5);
    expect(state.hands).toEqual([]);
    expect(state.dealer.cards).toEqual([]);
  });

  it('empties the tray on a shuffle', () => {
    const state = dealt();
    state.apply({ type: 'clear' });
    state.apply({ type: 'shuffle' });
    expect(state.trayCards).toBe(0);
    expect(state.shoeCards).toBe(6 * 52);
  });

  it('follows the turn pointer', () => {
    const state = dealt();
    state.apply({ type: 'turn', hand: '1-0' });
    expect(state.pointerHand).toBe('1-0');
    state.apply({ type: 'dealerTurn' });
    expect(state.pointerHand).toBe(null);
  });

  it('knows when insurance is being offered', () => {
    const state = dealt();
    state.apply({ type: 'offerInsurance' });
    expect(state.insurance).toBe(true);
    state.apply({ type: 'insuranceDeclined' });
    expect(state.insurance).toBe(false);
  });

  it('turns the hole card back down after a peek', () => {
    const state = dealt();
    state.apply({ type: 'peek', hand: '0-0', cardIndex: 1, card: 20 });
    expect(state.dealer.faceUp).toEqual([true, true]);
    state.apply({ type: 'conceal', hand: '0-0', cardIndex: 1 });
    expect(state.dealer.faceUp).toEqual([true, false]);
  });

  it('ignores an event that says nothing about the table', () => {
    const state = dealt();
    const before = JSON.stringify(state.hands);
    state.apply({ type: 'action', hand: '1-0', action: 'hit' });
    expect(JSON.stringify(state.hands)).toBe(before);
    expect(state.dealer.cards).toEqual([13, 20]);
  });
});

describe('the chips on the table', () => {
  it('shows what each seat wagered', () => {
    expect(dealt().chips.get(1)).toMatchObject({ amount: 10, base: 10 });
  });

  it('adds the extra wager when a hand doubles', () => {
    const state = dealt();
    state.apply({ type: 'double', hand: '1-0', amount: 10 });
    expect(state.chips.get(1).amount).toBe(20);
    expect(state.bankroll).toBe(990);
  });

  it('adds a bet and moves a card when a hand splits', () => {
    const state = dealt();
    state.apply({ type: 'split', hand: '1-0', newHand: '1-1', card: 9 });
    expect(state.hands.map(h => h.cards)).toEqual([[5], [9]]);
    expect(state.chips.get(1).amount).toBe(20);
    expect(state.bankroll).toBe(990);
  });

  it('charges half a bet for insurance', () => {
    const state = dealt();
    state.apply({ type: 'offerInsurance' });
    state.apply({ type: 'insuranceTaken' });
    expect(state.chips.get(1).amount).toBe(15);
    expect(state.bankroll).toBe(995);
  });

  it('spends nothing of the player bankroll when another seat splits or doubles', () => {
    const state = dealt();
    state.apply(card('3-0', 4));
    state.apply(card('3-0', 17));
    state.apply({ type: 'split', hand: '3-0', newHand: '3-1', card: 17 });
    state.apply({ type: 'double', hand: '3-0', amount: 50 });
    expect(state.bankroll).toBe(1000);
    expect(state.chips.has(3)).toBe(false);
  });

  it('shows the result instead of the amount once a hand is settled', () => {
    const state = dealt();
    state.apply({ type: 'settled', hand: '1-0', seat: 1, result: 'Win', payout: 20, net: 10 });
    expect(state.chips.get(1).result).toBe('Win');
  });
});

describe('burn cards', () => {
  it('shows each one, and keeps it out of the tray until the round starts', () => {
    const state = createTableState({ decks: 6 });
    state.apply({ type: 'shuffle' });
    state.apply({ type: 'burn', card: 7, faceUp: true });
    state.apply({ type: 'burn', card: 9, faceUp: false });
    expect(state.burns).toEqual([{ card: 7, faceUp: true }, { card: 9, faceUp: false }]);
    expect(state.trayCards).toBe(0);
    state.apply({ type: 'roundStart', round: 1 });
    expect(state.burns).toEqual([]);
    expect(state.trayCards).toBe(2);
  });

  it('clears them when the shoe is shuffled again', () => {
    const state = createTableState({ decks: 6 });
    state.apply({ type: 'burn', card: 7, faceUp: true });
    state.apply({ type: 'shuffle' });
    expect(state.burns).toEqual([]);
  });
});

describe('the payoff', () => {
  it('shows what the hand paid, then sweeps its cards to the tray and its chips off the seat', () => {
    const state = dealt();
    state.apply({ type: 'settled', hand: '1-0', seat: 1, result: 'Win', payout: 20, net: 10 });
    state.apply({ type: 'payout', hand: '1-0', amount: 20 });
    expect(state.chips.get(1)).toMatchObject({ result: null, paid: 20 });
    const tray = state.trayCards;
    state.apply({ type: 'sweep', hand: '1-0' });
    expect(state.hands).toHaveLength(0);
    expect(state.trayCards).toBe(tray + 2);
    expect(state.chips.get(1)).toMatchObject({ result: null, paid: null, amount: 0 });
  });

  it('takes the turn pointer off a hand that is being paid', () => {
    const state = dealt();
    state.apply({ type: 'turn', hand: '1-0' });
    state.apply({ type: 'result', hand: '1-0', result: 'Bust' });
    expect(state.pointerHand).toBe(null);
  });

  it('takes the turn pointer off a hand that is settled', () => {
    const state = dealt();
    state.apply({ type: 'turn', hand: '1-0' });
    state.apply({ type: 'settled', hand: '1-0', seat: 1, result: 'Win', payout: 20, net: 10 });
    expect(state.pointerHand).toBe(null);
  });

  it('leaves the turn pointer on the hand still to play', () => {
    const state = dealt();
    state.apply(card('3-0', 4));
    state.apply({ type: 'turn', hand: '1-0' });
    state.apply({ type: 'result', hand: '3-0', result: 'Bust' });
    expect(state.pointerHand).toBe('1-0');
  });

  it('leaves a split seat the chips of the hands still on the table', () => {
    const state = dealt();
    state.apply({ type: 'split', hand: '1-0', newHand: '1-1', card: 9 });
    state.apply({ type: 'double', hand: '1-1', amount: 10 });
    state.apply({ type: 'sweep', hand: '1-1' });
    expect(state.chips.get(1).amount).toBe(10);
  });

  it('labels a computer seat with its result but never pays it into the bankroll', () => {
    const state = dealt();
    state.apply(card('3-0', 4));
    state.apply({ type: 'result', hand: '3-0', result: 'Bust' });
    expect(state.chips.get(3)).toMatchObject({ result: 'Bust', computer: true });
    state.apply({ type: 'sweep', hand: '3-0' });
    state.apply({ type: 'settled', hand: '3-0', seat: 3, result: 'Bust', payout: 0, net: -5 });
    expect(state.chips.get(3).result).toBe(null);
    expect(state.bankroll).toBe(1000);
  });

  it('pays a hand swept during play without labelling it again', () => {
    const state = dealt();
    state.apply({ type: 'result', hand: '1-0', result: 'Surrender' });
    state.apply({ type: 'sweep', hand: '1-0' });
    state.apply({ type: 'settled', hand: '1-0', seat: 1, result: 'Surrender', payout: 5, net: -5 });
    expect(state.chips.get(1).result).toBe(null);
    expect(state.bankroll).toBe(1005);
  });
});

describe('the bankroll the player sees', () => {
  it('follows the payouts hand by hand rather than jumping to the end', () => {
    const state = dealt();
    state.apply({ type: 'settled', hand: '1-0', seat: 1, result: 'Win', payout: 20, net: 10 });
    expect(state.bankroll).toBe(1020);
  });

  it('ignores payouts to seats the player does not own', () => {
    const state = dealt();
    state.apply({ type: 'settled', hand: '3-0', seat: 3, result: 'Win', payout: 20, net: 10 });
    expect(state.bankroll).toBe(1000);
  });

  it('takes the engine figure at the end of the round', () => {
    const state = dealt();
    state.apply({ type: 'roundEnd', bankroll: 1234, needsShuffle: false });
    expect(state.bankroll).toBe(1234);
  });
});

describe('burn cards going into the tray', () => {
  it('leave the burn row and count in the tray', () => {
    const state = createTableState({ decks: 6 });
    state.apply({ type: 'shuffle' });
    state.apply({ type: 'burn', card: 7, faceUp: true });
    expect(state.burns).toHaveLength(1);
    expect(state.trayCards).toBe(0);
    state.apply({ type: 'burnsToTray' });
    expect(state.burns).toEqual([]);
    expect(state.trayCards).toBe(1);
  });
});
