// Rule behaviours a player meets at the table, played through a session built
// from settings, as the table builds it.

import { describe, it, expect } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { RESULT } from '@/game/engine/settlement';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import type { GameEvent } from '@/game/engine/events';
import type { SettingsPatch } from '@/settings/schema';

const RANKS = 'A23456789TJQK';
const SUITS = 'schd';
/** 'Ts' -> card id. */
const card = (name: string) => cardId(RANKS.indexOf(name[0]) + 1, SUITS.indexOf(name[1]));
const cards = (names: string[]) => names.map(card);

const BASE: SettingsPatch = {
  'mechanics.dealerMakesObviousPlays': false,
  'table.startingBankroll': 1000,
  'table.seatCount': 1,
  'table.computerSeats': [false, false, false, false, false, false],
  'table.burnCards': 0,
  'table.decks': 6,
  'betting.warnOnError': false,
  'strategy.warnOnError': false,
  'rules.surrender': 'none',
};

/** A session at a table with these settings whose shoe deals the given cards in order. */
function riggedSession(stack: string[], settings: SettingsPatch = {}) {
  const app = createServices({ backend: new MemoryBackend() });
  // A silent stand-in for the Web Audio player.
  app.sound = { play() {} } as unknown as typeof app.sound;
  app.settings.update({ ...BASE, ...settings });
  const session = new GameSession(app);
  const { shoe } = session.game;
  const queue: CardId[] = cards(stack);
  const realDraw = shoe.draw.bind(shoe);
  shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift() as CardId;
    shoe.remainingByCard[next] -= 1;
    shoe.remaining -= 1;
    shoe.dealt += 1;
    return next;
  };
  return session;
}

// A plain dealer 17 (9 up, 8 in the hole) that never peeks.
const D17 = ['9h', '8h'];
/** Interleaves the player's two cards with the dealer's, in deal order. */
const deal = ([p1, p2]: string[], [up, hole]: string[]) => [p1, up, p2, hole];
// Seat order with a computer seat 2: player, computer, dealer up, player, computer, hole card.
const deal2 = ([h1, h2]: string[], [c1, c2]: string[], [up, hole]: string[]) => [h1, c1, up, h2, c2, hole];

const hand = (session: GameSession, key: string) => session.game.hands.find(h => h.key === key)!;

describe('many unbusted cards win', () => {
  for (const [count, key, hits] of [
    [6, 'rules.autoWinSixCards', ['2c', '3c', '2h', '4s']],
    [7, 'rules.autoWinSevenCards', ['2c', '3c', '2h', 'Ac', 'Ah']],
  ] satisfies [number, string, string[]][]) {
    it(`stands ${count} unbusted cards and pays them as a win`, () => {
      const session = riggedSession([...deal(['2s', '3s'], ['Ts', '7s']), ...hits], { [key]: true });
      session.startRound({ betPerHand: 25 });
      for (let n = 3; n <= count; n++) {
        expect(session.availableActions().hit).toBe(true);
        session.act('hit');
        expect(session.state === 'playerAction').toBe(n < count);
      }
      expect(hand(session, '1-0').cards).toHaveLength(count);
      // A total under 17 against 17, won on the card count.
      expect(session.bankroll).toBe(1025);
    });
  }
});

describe('auto-stand on 21', () => {
  it('still offers Hit on a soft 21 of exactly four cards', () => {
    const session = riggedSession([...deal(['As', '2s'], D17), '3s', '5s']);
    session.startRound({ betPerHand: 25 });
    session.act('hit');
    session.act('hit');
    expect(hand(session, '1-0').cards).toEqual(cards(['As', '2s', '3s', '5s']));
    expect(session.availableActions()).toMatchObject({ hit: true, stand: true });
    session.act('stand');
    expect(session.bankroll).toBe(1025);
  });

  it('with 22 counting as 21, does not bust a hard 22 and pushes a dealer 21', () => {
    // Dealer 9+7 draws a 5 to 21. As a 22 the hand would win; as a 21 it pushes.
    const session = riggedSession([...deal(['Ts', '5s'], ['9h', '7h']), '7s', '5h'], {
      'rules.player22CountsAs21': true,
    });
    session.startRound({ betPerHand: 25 });
    const events: GameEvent[] = session.act('hit');
    expect(session.state).toBe('settled');
    expect(session.game.dealer.cards).toEqual(cards(['9h', '7h', '5h']));
    expect(events.some(e => e.type === 'message' && e.text === RESULT.bust)).toBe(false);
    expect(hand(session, '1-0').result).toBe(RESULT.push);
    expect(session.bankroll).toBe(1000);
  });
});

describe('dealer makes obvious plays', () => {
  it('leaves a soft 20 alone, then stands a hard 20 holding an ace', () => {
    const session = riggedSession([...deal(['As', '9s'], D17), 'Ts'], { 'mechanics.dealerMakesObviousPlays': true });
    session.startRound({ betPerHand: 25 });
    expect(session.state).toBe('playerAction');
    expect(session.availableActions()).toMatchObject({ hit: true, stand: true });
    session.act('hit');
    expect(session.state).toBe('settled');
    expect(hand(session, '1-0').cards).toHaveLength(3);
  });
});

describe('Macao surrender', () => {
  it('is not offered on a two-card hand, even under an ace', () => {
    const session = riggedSession(deal(['Ts', '6s'], ['Ah', '7h']), { 'rules.surrender': 'macao' });
    session.startRound({ betPerHand: 25 });
    expect(session.state).toBe('insurance');
    expect(session.availableActions().surrender).toBeFalsy();
    session.declineInsurance();
    expect(session.state).toBe('playerAction');
    expect(session.availableActions().surrender).toBe(false);
  });
});

describe('redouble and hit after double', () => {
  const tenDollars: SettingsPatch = { 'betting.chipValue': 10 };

  it('with only Redouble on, offers Double but not Hit after a double', () => {
    const session = riggedSession([...deal(['2s', '3s'], ['Th', '7h']), '2c'], {
      ...tenDollars,
      'rules.redouble': true,
      'rules.doubleOnThreeCards': true,
    });
    session.startRound({ betPerHand: 10 });
    session.act('double');
    expect(session.state).toBe('playerAction');
    expect(session.availableActions()).toMatchObject({ hit: false, double: true });
  });

  it('with Hit After Double on, offers Hit after a double', () => {
    const session = riggedSession([...deal(['2s', '3s'], ['Th', '7h']), '2c'], {
      ...tenDollars,
      'rules.hitAfterDouble': true,
    });
    session.startRound({ betPerHand: 10 });
    session.act('double');
    expect(session.state).toBe('playerAction');
    expect(session.availableActions().hit).toBe(true);
  });
});

describe('suited 6-7-8 pays 2:1 if it wins', () => {
  it('pays nothing extra against a dealer 21', () => {
    // Dealer 9+7 draws a 5 to 21: the suited 21 pushes.
    const session = riggedSession([...deal(['6s', '7s'], ['9h', '7h']), '8s', '5h'], {
      'bonuses.suited678IfWins': true,
    });
    session.startRound({ betPerHand: 10 });
    session.act('hit');
    expect(session.state).toBe('settled');
    expect(session.game.dealer.cards).toEqual(cards(['9h', '7h', '5h']));
    expect(session.bankroll).toBe(1000);
  });
});

describe('bankroll limits', () => {
  it('allows insurance with half the bet left after a $100 bet', () => {
    const session = riggedSession(deal(['Ts', '6s'], ['Ah', '7h']), { 'table.startingBankroll': 150 });
    session.startRound({ betPerHand: 100 });
    expect(session.state).toBe('insurance');
    expect(session.game.canInsure()).toBe(true);
  });

  for (const [label, settings, bet, offered] of [
    ['a double', {}, 75, false],
    ['a double', {}, 50, true],
    ['a triple-down', { 'rules.tripleDown': true }, 40, false],
    ['a triple-down', { 'rules.tripleDown': true }, 30, true],
  ] satisfies [string, SettingsPatch, number, boolean][]) {
    it(`${offered ? 'offers' : 'refuses'} ${label} with $${100 - bet} left after a $${bet} bet`, () => {
      const session = riggedSession(deal(['6s', '5s'], ['Th', '7h']), { ...settings, 'table.startingBankroll': 100 });
      session.startRound({ betPerHand: bet });
      expect(session.state).toBe('playerAction');
      expect(session.availableActions().double).toBe(offered);
    });
  }

  for (const [bet, offered] of [
    [30, false],
    [25, true],
  ] satisfies [number, boolean][]) {
    it(`${offered ? 'offers' : 'refuses'} a redouble with $${100 - bet * 2} left after doubling a $${bet} bet`, () => {
      const session = riggedSession([...deal(['2s', '3s'], ['Th', '7h']), '2c'], {
        'rules.redouble': true,
        'rules.doubleOnThreeCards': true,
        'table.startingBankroll': 100,
      });
      session.startRound({ betPerHand: bet });
      session.act('double');
      expect(session.bankroll).toBe(100 - bet * 2);
      expect(session.availableActions()).toMatchObject({ stand: true, double: offered });
    });
  }
});

describe('computer seats', () => {
  const computerSeat: SettingsPatch = {
    'table.seatCount': 2,
    'table.computerSeats': [false, true, false, false, false, false],
  };

  /** Stands the human hand and plays the round out. */
  const playOut = (session: GameSession) => {
    session.startRound({ betPerHand: 25 });
    while (session.state === 'playerAction') session.act('stand');
    expect(session.state).toBe('settled');
  };

  it('stands a 16 against a 10 as the Playing Strategy says, rather than hitting to 17', () => {
    // Seen before it acts: 5 4 T 6 T, a running count of +1. The default
    // strategy stands 16 v 10 at a true count of 0 or more.
    const session = riggedSession(deal2(['5s', '4s'], ['Tc', '6c'], ['Th', '7h']), computerSeat);
    playOut(session);
    expect(hand(session, '2-0').cards).toHaveLength(2);
  });

  it('doubles an 11 against a 6, as the strategy says', () => {
    // Doubling takes one card (to 13); a hitting seat would draw on.
    const session = riggedSession([...deal2(['Ts', '9s'], ['5c', '6c'], ['6h', 'Th']), '2d', '9d', '9c'], computerSeat);
    playOut(session);
    expect(hand(session, '2-0')).toMatchObject({ doubled: true });
    expect(hand(session, '2-0').cards).toEqual(cards(['5c', '6c', '2d']));
  });

  it('never surrenders', () => {
    // The strategy surrenders 16 v 10 when the table allows it.
    const session = riggedSession(deal2(['5s', '4s'], ['Tc', '6c'], ['Th', '7h']), {
      ...computerSeat,
      'rules.surrender': 'late',
    });
    playOut(session);
    const computer = hand(session, '2-0');
    expect(computer.surrendered).toBe(false);
    expect(computer.result).not.toBe(RESULT.surrender);
    expect(computer.cards).toEqual(cards(['Tc', '6c']));
  });
});
