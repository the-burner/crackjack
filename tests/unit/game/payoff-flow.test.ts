// A whole round as the table plays it: engine events, planned into steps by the
// animator and applied to the table state one at a time, as the controller does.

import { describe, it, expect } from 'vitest';
import { BlackjackGame, STATE, ACTION } from '@/game/engine/game';
import type { AvailableActions, GameAction, GameOptions, TableConfig } from '@/game/engine/game';
import { PLAYER } from '@/game/engine/hand';
import type { HandKey } from '@/game/engine/hand';
import type { GameEvent } from '@/game/engine/events';
import type { Result } from '@/game/engine/settlement';
import { rulesFrom } from '@/game/engine/rules';
import { RESULT_TONES } from '@/game/table/animator';
import { planSteps } from '@/game/table/choreography';
import type { Step } from '@/game/table/animator';
import { createTableState, DEALER_KEY } from '@/game/table/table-state';
import { blackjackUnknown } from '@/game/dealer-error-round';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingsPatch } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import { seededRandom } from '@/core/random';

const card = (rank: number, suit = 0) => cardId(rank, suit);
const PAUSES = { dealer: 500, player: 200, payoff: 700 };
const BET = 5;

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

/** A game whose shoe deals the given cards in order, then falls back to random. */
function riggedGame(
  cards: CardId[],
  {
    rules = makeRules(),
    table = {},
    ...options
  }: Partial<Omit<GameOptions, 'table'>> & { table?: Partial<TableConfig> } = {},
) {
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: seededRandom(1),
    ...options,
  });
  game.takeEvents();
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

/** What the table shows after one step. */
interface Frame {
  step: Step;
  hands: { key: HandKey; cards: number }[];
  pointer: HandKey | null;
  chips: Map<number, { result: Result | null; paid: number | null }>;
  bankroll: number;
  trayCards: number;
  dealt: number;
  dealerCards: number;
  toast: string | null;
}

/** Bets `BET` on each of `seats` and plays the round out with `choose`, declining insurance. */
function playRound(game: BlackjackGame, seats: number[], choose: (offered: AvailableActions) => GameAction) {
  const state = createTableState({ decks: 6 });
  const swept = new Set<HandKey>();
  const isComputer = (key: HandKey) => game.hands.find(hand => hand.key === key)?.owner === PLAYER.computer;
  const frames: Frame[] = [];
  state.setBets(seats.map(seat => ({ seat, amount: BET })));
  state.setBankroll(game.bankroll - BET * seats.length);
  const play = (events: GameEvent[]) => {
    const sweepNaturals = !blackjackUnknown(game.rules, game.dealer.cards[0]);
    for (const step of planSteps(events, { pauses: PAUSES, isComputer, swept, sweepNaturals })) {
      const { event } = step;
      state.apply(event);
      frames.push({
        step,
        hands: state.hands.map(hand => ({ key: hand.key, cards: hand.cards.length })),
        pointer: state.pointerHand,
        chips: new Map([...state.chips].map(([seat, chip]) => [seat, { result: chip.result, paid: chip.paid }])),
        bankroll: state.bankroll,
        trayCards: state.trayCards,
        dealt: state.dealt,
        dealerCards: state.dealer.cards.length,
        toast: event.type === 'message' ? event.text : event.type === 'offerInsurance' ? 'Insurance?' : null,
      });
    }
  };
  play(game.startRound(seats.map(seat => ({ seat, bet: BET }))));
  while (game.state !== STATE.settled) {
    play(game.state === STATE.insurance ? game.declineInsurance() : game.act(choose(game.availableActions())));
  }
  return frames;
}

const stand = () => ACTION.stand;
const prefer =
  (action: GameAction) =>
  (offered: AvailableActions): GameAction =>
    offered[action] ? action : ACTION.stand;

const stepAt = (frames: Frame[], type: string, hand?: HandKey) =>
  frames.findIndex(
    f => f.step.event.type === type && (!hand || ('hand' in f.step.event && f.step.event.hand === hand)),
  );
const sweepOf = (frames: Frame[], key: HandKey) => stepAt(frames, 'sweep', key);
const has = (frame: Frame, key: HandKey) => frame.hands.some(hand => hand.key === key);
const toasts = (frames: Frame[]) => frames.flatMap(f => (f.toast ? [f.toast] : []));

/** Asserts `key` showed `result`, then left the table with its cards before step `before`. */
function sweptBefore(frames: Frame[], key: HandKey, result: Result, before: number) {
  const seat = Number(key.split('-')[0]);
  const gone = sweepOf(frames, key);
  expect(before, `${key}: the next step happens`).toBeGreaterThan(0);
  expect(gone, `${key} swept`).toBeGreaterThan(0);
  expect(gone, `${key} swept in time`).toBeLessThan(before);
  const shown = frames.findIndex(f => f.chips.get(seat)?.result);
  expect(frames[shown].chips.get(seat)!.result).toBe(result);
  expect(shown).toBeLessThan(gone);
  const cards = frames[gone - 1].hands.find(hand => hand.key === key)!.cards;
  expect(frames[gone].trayCards - frames[gone - 1].trayCards).toBe(cards);
  expect(has(frames[gone], key)).toBe(false);
}

/** The pointer is only ever on a hand still on the table, and never on a seat showing a result. */
function pointerStaysOnLiveHands(frames: Frame[]) {
  expect(frames.some(f => f.pointer)).toBe(true);
  for (const [i, f] of frames.entries()) {
    if (!f.pointer) continue;
    expect(has(f, f.pointer), `step ${i}`).toBe(true);
    const seat = Number(f.pointer.split('-')[0]);
    expect(f.chips.get(seat)?.result ?? null, `step ${i}`).toBe(null);
  }
}

// Deal order: each seat's first card, the dealer's up card, each seat's second card, the hole card.

describe('the payoff at the end of a round', () => {
  it('labels computer seats with a result but never an amount, and leaves the bankroll alone for them', () => {
    // Seat 1 wins, seat 2 loses, computer seat 3 wins, computer seat 4 pushes, against 17.
    const game = riggedGame(
      [card(10), card(10, 1), card(10, 2), card(10, 3), card(13), card(11), card(6), card(9), card(7, 1), card(7)],
      { table: { seatCount: 4, computerSeats: [3, 4], computerBet: BET }, computerPlay: () => ACTION.stand },
    );
    const frames = playRound(game, [1, 2], stand);
    for (const [seat, result] of [
      [3, 'Win'],
      [4, 'Push'],
    ] as const) {
      const shown = frames.flatMap(f => f.chips.get(seat)?.result ?? []);
      expect(new Set(shown), `seat ${seat}`).toEqual(new Set([result]));
      expect(frames.filter(f => (f.chips.get(seat)?.paid ?? null) !== null)).toEqual([]);
    }
    expect(frames.some(f => f.chips.get(1)?.paid === 10)).toBe(true);
    const computerFrom = frames.findIndex(f => f.chips.get(3)?.result);
    expect(computerFrom).toBeGreaterThan(stepAt(frames, 'dealerTurn'));
    const bank = frames[computerFrom].bankroll;
    expect(bank).toBe(1000);
    expect(frames.slice(computerFrom).filter(f => f.bankroll !== bank)).toEqual([]);
  });
});

describe('a hand settled during play', () => {
  it('a computer seat that busts is swept before the next seat plays', () => {
    // Computer seats 2 and 3 hit to a bust against a 6.
    const game = riggedGame(
      [card(10), card(10, 1), card(10, 2), card(6), card(9), card(6, 1), card(6, 2), card(5), card(10, 3), card(13)],
      { table: { seatCount: 3, computerSeats: [2, 3], computerBet: BET }, computerPlay: () => ACTION.hit },
    );
    const frames = playRound(game, [1], stand);
    sweptBefore(frames, '2-0', 'Bust', stepAt(frames, 'turn', '3-0'));
    sweptBefore(frames, '3-0', 'Bust', stepAt(frames, 'dealerTurn'));
  });

  it('a surrender shows its result and is swept before the next seat plays', () => {
    // Seat 1 gives up 16 against a 9.
    const game = riggedGame([card(10), card(10, 1), card(9), card(6), card(7), card(5)], {
      table: { seatCount: 2, computerSeats: [2], computerBet: BET },
      computerPlay: () => ACTION.stand,
    });
    const frames = playRound(game, [1], prefer(ACTION.surrender));
    sweptBefore(frames, '1-0', 'Surrender', stepAt(frames, 'turn', '2-0'));
  });

  it('a blackjack is swept at once when the dealer has checked for one', () => {
    // Seat 1 has a natural; the dealer shows a king and checks.
    const game = riggedGame([card(1), card(10, 1), card(13), card(13, 1), card(9), card(7)], {
      table: { seatCount: 2, computerSeats: [2], computerBet: BET },
      computerPlay: () => ACTION.stand,
    });
    const frames = playRound(game, [1], stand);
    sweptBefore(frames, '1-0', '21', stepAt(frames, 'turn', '2-0'));
  });

  it('a blackjack waits for the payoff when the dealer has no hole card', () => {
    // No hole card: seat 1 has a natural against a ten; computer seat 2 hits to a bust, seat 3 stands.
    const game = riggedGame(
      [card(1), card(10, 1), card(10, 2), card(10), card(13), card(6), card(9), card(9, 1), card(7)],
      {
        rules: makeRules({ 'rules.noHoleCard': true }),
        table: { seatCount: 3, computerSeats: [2, 3], computerBet: BET },
        computerPlay: hand => (hand.seat === 2 ? ACTION.hit : ACTION.stand),
      },
    );
    const frames = playRound(game, [1], stand);
    const second = frames.findIndex(f => f.dealerCards >= 2);
    expect(second).toBeGreaterThan(0);
    expect(sweepOf(frames, '1-0'), 'the natural stays until the dealer has its second card').toBeGreaterThan(second);
    expect(frames.findIndex(f => f.chips.get(1)?.result)).toBeGreaterThan(second);
    sweptBefore(frames, '2-0', 'Bust', stepAt(frames, 'turn', '3-0'));
  });
});

describe('the result label', () => {
  it('a bust and a surrender use the losing colours', () => {
    expect(RESULT_TONES.Bust).toBe('lose');
    expect(RESULT_TONES.Surrender).toBe('lose');
  });
});

describe('the turn pointer', () => {
  it('leaves a hand before it is paid, and never points at an emptied seat, after a bust', () => {
    // Seat 1 hits 16 to a bust; seat 2 stands.
    const game = riggedGame([card(10), card(10, 1), card(9), card(6), card(7), card(7, 1), card(10, 2)], {
      table: { seatCount: 2, computerSeats: [2], computerBet: BET },
      computerPlay: () => ACTION.stand,
    });
    const frames = playRound(game, [1], prefer(ACTION.hit));
    expect(sweepOf(frames, '1-0')).toBeLessThan(stepAt(frames, 'turn', '2-0'));
    pointerStaysOnLiveHands(frames);
  });

  it('leaves a hand before it is paid, and never points at an emptied seat, after a computer bust', () => {
    const game = riggedGame(
      [card(10), card(10, 1), card(10, 2), card(6), card(9), card(6, 1), card(6, 2), card(5), card(10, 3), card(13)],
      { table: { seatCount: 3, computerSeats: [2, 3], computerBet: BET }, computerPlay: () => ACTION.hit },
    );
    pointerStaysOnLiveHands(playRound(game, [1], stand));
  });

  it('leaves a hand before it is paid, and never points at an emptied seat, after a surrender', () => {
    const game = riggedGame([card(10), card(10, 1), card(9), card(6), card(7), card(5)], {
      table: { seatCount: 2, computerSeats: [2], computerBet: BET },
      computerPlay: () => ACTION.stand,
    });
    pointerStaysOnLiveHands(playRound(game, [1], prefer(ACTION.surrender)));
  });
});

describe('table messages', () => {
  it('never say "No Dealer Blackjack" or "Dealer busts"', () => {
    // The dealer checks under a ten, has no blackjack, then draws to 26.
    const game = riggedGame([card(10), card(10, 1), card(8), card(6), card(10, 2)]);
    const frames = playRound(game, [1], stand);
    expect(game.dealer.total).toBeGreaterThan(21);
    expect(toasts(frames).filter(text => /no dealer blackjack|dealer busts/i.test(text))).toEqual([]);
  });

  for (const [name, rules, cards] of [
    ['the dealer checks for it', {}, [card(10), card(13), card(8), card(1)]],
    ['the dealer has no hole card', { 'rules.noHoleCard': true }, [card(10), card(13), card(8), card(1)]],
  ] satisfies [string, SettingsPatch, CardId[]][]) {
    it(`announce a dealer blackjack once when ${name}`, () => {
      const game = riggedGame(cards, { rules: makeRules(rules) });
      const frames = playRound(game, [1], stand);
      expect(game.dealer.cards).toHaveLength(2);
      expect(game.dealer.total).toBe(21);
      expect(toasts(frames).filter(text => /dealer has blackjack/i.test(text))).toHaveLength(1);
    });
  }
});

describe('sounds', () => {
  it('only a card coming off the shoe clicks, not a card turned over or moved on a split', () => {
    // Seat 1 splits eights against a 6; computer seat 2 stands.
    const game = riggedGame(
      [card(8), card(10), card(6), card(8, 1), card(9), card(10, 1), card(3), card(2), card(13)],
      { table: { seatCount: 2, computerSeats: [2], computerBet: BET }, computerPlay: () => ACTION.stand },
    );
    let split = false;
    const frames = playRound(game, [1], offered => {
      if (!split && offered.split) {
        split = true;
        return ACTION.split;
      }
      return ACTION.stand;
    });
    const clicks = frames.filter(f => f.step.sound === 'card');
    expect(clicks.length).toBe(frames.at(-1)!.dealt);
    expect(clicks.length).toBeGreaterThan(8);
    for (const [i, f] of frames.entries()) {
      const drew = f.dealt - (frames[i - 1]?.dealt ?? 0);
      expect(f.step.sound === 'card', `step ${i} (${f.step.event.type})`).toBe(drew === 1);
    }
    const silent = frames.filter(f => f.step.event.type === 'split' || f.step.event.type === 'reveal');
    expect(silent.filter(f => 'hand' in f.step.event && f.step.event.hand === DEALER_KEY).length).toBeGreaterThan(1);
    expect(silent.some(f => f.step.event.type === 'split')).toBe(true);
    expect(silent.map(f => f.step.sound)).toEqual(silent.map(() => null));
  });
});

describe('a doubled hand that busts', () => {
  it('stays on the table, unannounced, until the payoff', () => {
    // Seat 1 doubles 13 against a 6 and draws a jack; computer seat 2 stands.
    const game = riggedGame([card(10), card(10, 1), card(6), card(3), card(9), card(7), card(11)], {
      table: { seatCount: 2, computerSeats: [2], computerBet: BET },
      computerPlay: () => ACTION.stand,
    });
    const frames = playRound(game, [1], prefer(ACTION.double));
    const doubled = frames.findIndex(f => f.hands.find(hand => hand.key === '1-0')?.cards === 3);
    const dealer = stepAt(frames, 'dealerTurn');
    expect(doubled).toBeGreaterThan(0);
    expect(game.hands[0].result).toBe('Bust');
    expect(frames.slice(doubled, dealer).every(f => has(f, '1-0'))).toBe(true);
    expect(frames.slice(0, dealer).filter(f => f.chips.get(1)?.result)).toEqual([]);
    expect(frames.some(f => f.chips.get(1)?.result === 'Bust')).toBe(true);
    expect(toasts(frames).filter(text => /bust/i.test(text))).toEqual([]);
    expect(sweepOf(frames, '1-0')).toBeGreaterThan(dealer);
  });
});
