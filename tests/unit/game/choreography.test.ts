// The round's choreography, played from real engine rounds. A dealer beat here is 500 ms, a player beat
// 200 and a payoff 700.
import { describe, it, expect } from 'vitest';
import { BlackjackGame, ACTION } from '@/game/engine/game';
import type { GameOptions, TableConfig } from '@/game/engine/game';
import type { GameEvent } from '@/game/engine/events';
import { rulesFrom } from '@/game/engine/rules';
import { planSteps, segment } from '@/game/table/choreography';
import type { Step } from '@/game/table/animator';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingsPatch } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import { seededRandom } from '@/core/random';

const PAUSES = { dealer: 500, player: 200, payoff: 700 };
const { dealer: D, player: P, payoff: Y } = PAUSES;
const card = (rank: number, suit = 0) => cardId(rank, suit);

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

/** A game whose shoe deals `cards` in order, then falls back to random. */
function riggedGame(
  cards: CardId[],
  { table = {}, ...options }: Partial<Omit<GameOptions, 'table'>> & { table?: Partial<TableConfig> } = {},
) {
  const game = new BlackjackGame({
    rules: makeRules(),
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: seededRandom(1),
    ...options,
  });
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    const next = queue.shift();
    if (next === undefined) return realDraw();
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  // The opening shuffle is played on its own (see 'the shuffle').
  game.takeEvents();
  return game;
}

/** Seats 1 (the player) and 2 (a computer). Deal order: player, computer, up card; player, computer, hole card. */
const twoSeats = (cards: CardId[], computerPlay: GameOptions['computerPlay'], rules = makeRules()) =>
  riggedGame(cards, { table: { seatCount: 2, computerSeats: [2] }, computerPlay, rules });

const isComputer = (key: string) => key.startsWith('2-');
const plan = (events: readonly GameEvent[], over: Partial<Parameters<typeof planSteps>[1]> = {}) =>
  planSteps(events, { pauses: PAUSES, isComputer, ...over });
const shape = (steps: Step[]) => steps.map(s => [s.event.type, s.pause]);
/** The steps of one hand's moment: from its first event to the next hand's pointer. */
const forHand = (steps: Step[], hand: string) => {
  const from = steps.findIndex(s => 'hand' in s.event && s.event.hand === hand);
  const to = steps.findIndex(
    (s, i) =>
      i > from &&
      (s.event.type === 'dealerTurn' || (s.event.type === 'turn' && 'hand' in s.event && s.event.hand !== hand)),
  );

  return steps.slice(from, to < 0 ? undefined : to);
};

describe('the deal', () => {
  it('rests a dealer beat once the bets are down, deals each card a dealer beat apart, the up card face down until every card is out', () => {
    const game = riggedGame([card(10), card(9), card(7), card(6)]);
    const steps = plan(game.startRound([{ seat: 1, bet: 10 }]));
    expect(shape(steps)).toEqual([
      ['roundStart', D],
      ['card', D],
      ['card', D],
      ['card', D],
      ['card', D],
      ['reveal', D],
      ['dealt', 0],
      ['turn', 0],
    ]);
    expect(steps[2].event).toMatchObject({ hand: '0-0', faceUp: false });
  });

  it("notes the dealer's look under a ten without a pause of its own", () => {
    const game = riggedGame([card(10), card(10, 1), card(7), card(6)]);
    const steps = plan(game.startRound([{ seat: 1, bet: 10 }]));
    expect(shape(steps).slice(-2)).toEqual([
      ['dealerChecked', 0],
      ['turn', 0],
    ]);
  });

  it('turns the up card, then flashes the hole card for a dealer beat', () => {
    const game = riggedGame([card(10), card(9), card(7), card(6)], {
      table: { peeking: { mode: 'holeCard', percent: 100 } },
    });
    // At a dealer speed of its own, to tell the peek's pause from any other.
    const steps = plan(game.startRound([{ seat: 1, bet: 10 }]), { pauses: { ...PAUSES, dealer: 333 } });
    const types = steps.map(s => s.event.type);
    expect(types.slice(types.indexOf('reveal'))).toEqual(['reveal', 'dealt', 'peek', 'conceal', 'turn']);
    expect(steps.find(s => s.event.type === 'peek')?.pause).toBe(333);
  });
});

describe('a computer seat', () => {
  it('takes a beat over each decision and shows each card for one, a hit-then-stand like any other', () => {
    // The computer hits 10-2 into 17 and stands.
    const game = twoSeats([card(10), card(10, 1), card(10, 2), card(9), card(2), card(7), card(5)], hand =>
      hand.total < 17 ? ACTION.hit : ACTION.stand,
    );
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(forHand(plan(game.act(ACTION.stand)), '2-0'))).toEqual([
      ['turn', 0],
      ['action', P],
      ['card', P],
      ['action', P],
    ]);
  });

  it('splits in a player beat, then plays each hand', () => {
    // 8-8 against a 7: split, then stand on each.
    const game = twoSeats(
      [card(10), card(8), card(7), card(9), card(8, 1), card(6), card(3), card(10, 2)],
      hand =>
        hand.cardCount === 2 && hand.values[0] === hand.values[1] && !hand.isSplit ? ACTION.split : ACTION.stand,
      makeRules({ 'rules.maxSplitHands': 2 }),
    );
    game.startRound([{ seat: 1, bet: 10 }]);
    const steps = plan(game.act(ACTION.stand));
    const split = steps.findIndex(s => s.event.type === 'action' && 'action' in s.event && s.event.action === 'split');
    expect(shape(steps.slice(split, split + 4))).toEqual([
      ['action', P],
      ['split', P],
      ['card', P],
      ['action', P],
    ]);
    // The pointer reaches the second hand a player beat before its card.
    const second = steps.findIndex(s => s.event.type === 'turn' && 'hand' in s.event && s.event.hand === '2-1');
    expect(shape(steps.slice(second, second + 2))).toEqual([
      ['turn', P],
      ['card', P],
    ]);
  });

  it('doubles within its decision’s beat, then its card', () => {
    const game = twoSeats(
      [card(10), card(6), card(7), card(9), card(5), card(10, 1), card(10, 2)],
      () => ACTION.double,
    );
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(forHand(plan(game.act(ACTION.stand)), '2-0'))).toEqual([
      ['turn', 0],
      ['action', P],
      ['double', 0],
      ['card', P],
    ]);
  });
});

describe("the player's own decisions", () => {
  it('take no time of their own: a hit card a player beat', () => {
    const game = riggedGame([card(10), card(9), card(2), card(7), card(5)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(plan(game.act(ACTION.hit)))).toEqual([
      ['action', 0],
      ['card', P],
      ['turn', 0],
    ]);
  });

  it('double in a player beat, then the card', () => {
    const game = riggedGame([card(6), card(9), card(5), card(7), card(9)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(plan(game.act(ACTION.double))).slice(0, 3)).toEqual([
      ['action', 0],
      ['double', P],
      ['card', P],
    ]);
  });

  it('show a bust as soon as the card lands, and sweep it', () => {
    const game = riggedGame([card(10), card(9), card(6), card(7), card(10, 1)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(plan(game.act(ACTION.hit))).slice(0, 4)).toEqual([
      ['action', 0],
      ['card', P],
      ['result', Y],
      ['sweep', Y],
    ]);
  });
});

describe('a blackjack', () => {
  it('holds the pointer a beat, and is paid at once once the dealer has checked', () => {
    const game = riggedGame([card(1), card(9), card(13), card(7)]);
    const types = plan(game.startRound([{ seat: 1, bet: 10 }])).map(s => s.event.type);
    expect(types.slice(types.indexOf('dealt') + 1, types.indexOf('dealt') + 4)).toEqual(['turn', 'result', 'sweep']);
  });

  it('is announced, and waits for the payoff, when the dealer may yet have one', () => {
    const game = riggedGame([card(1), card(9), card(13), card(7)]);
    const steps = plan(game.startRound([{ seat: 1, bet: 10 }]), { sweepNaturals: false });
    expect(steps.some(s => s.event.type === 'result')).toBe(false);
    expect(steps.some(s => s.event.type === 'message')).toBe(true);
  });
});

describe("the dealer's turn", () => {
  it('rests a dealer beat after the last play, turns the hole card, then draws a dealer beat apart', () => {
    const game = riggedGame([card(10), card(10, 1), card(9), card(6), card(2)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    const steps = plan(game.act(ACTION.stand));
    const turn = steps.findIndex(s => s.event.type === 'dealerTurn');
    expect(shape(steps.slice(turn, turn + 3))).toEqual([
      ['dealerTurn', D],
      ['reveal', D],
      ['card', D],
    ]);
  });

  it('closes its cards up a beat before a fifth', () => {
    // Ten up, 2 in the hole, then A, A, 3: the fifth card is the 3.
    const game = riggedGame([card(10), card(10, 1), card(9), card(2), card(1), card(1, 1), card(3)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    const types = plan(game.act(ACTION.stand)).map(s => s.event.type);
    expect(types[types.indexOf('squeeze') + 1]).toBe('card');
    expect(types.filter(t => t === 'squeeze')).toHaveLength(1);
  });
});

describe('the payoff', () => {
  it('pays each hand in turn: its result, what it paid (none shown for a computer), the sweep', () => {
    const game = twoSeats([card(10), card(10, 1), card(10, 2), card(9), card(8), card(7)], () => ACTION.stand);
    game.startRound([{ seat: 1, bet: 10 }]);
    const steps = plan(game.act(ACTION.stand));
    const from = steps.findIndex(s => s.event.type === 'settled');
    expect(steps.slice(from).map(s => [s.event.type, 'hand' in s.event ? s.event.hand : null, s.pause])).toEqual([
      ['settled', '1-0', Y],
      ['payout', '1-0', Math.round(Y * 0.15)],
      ['sweep', '1-0', Y],
      ['settled', '2-0', Y],
      ['sweep', '2-0', Y],
      ['roundEnd', null, 0],
    ]);
  });

  it('turns every face-down hand up in one player beat, however many cards it holds, before the hands are paid', () => {
    const game = riggedGame([card(10), card(10, 1), card(9), card(7)], { table: { cardsFaceDown: true } });
    game.startRound([{ seat: 1, bet: 10 }]);
    const steps = plan(game.act(ACTION.stand));
    const pay = steps.findIndex(s => s.event.type === 'settled');
    expect(shape(steps.slice(pay - 2, pay))).toEqual([
      ['reveal', 0],
      ['reveal', P],
    ]);
  });

  it("turns the player's face-down hand over in one beat for its turn", () => {
    const game = riggedGame([card(10), card(10, 1), card(9), card(7)], { table: { cardsFaceDown: true } });
    const steps = plan(game.startRound([{ seat: 1, bet: 10 }]));
    expect(shape(steps.slice(-3))).toEqual([
      ['reveal', 0],
      ['reveal', P],
      ['turn', 0],
    ]);
  });
});

describe('the end of a round', () => {
  it('lets the dealer discard, then rests the empty table a dealer beat before the bets', () => {
    const game = riggedGame([card(10), card(10, 1), card(9), card(7)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(shape(plan(game.nextRound()))).toEqual([['clear', D]]);
  });
});

describe('the shuffle', () => {
  it('sounds, burns each card a dealer beat apart, then gathers them into the tray', () => {
    const game = new BlackjackGame({
      rules: makeRules(),
      table: { decks: 6, burnCards: 1, showBurnCards: false, seatCount: 1, computerSeats: [] },
      bankroll: 1000,
      random: seededRandom(1),
    });
    expect(plan(game.takeEvents()).map(s => [s.event.type, s.pause, s.sound])).toEqual([
      ['shuffle', D, 'shuffle'],
      ['burn', D, 'card'],
      ['burnsToTray', D, null],
    ]);
  });
});

describe('the insurance answer', () => {
  it('puts the stake down for a player beat, then takes it at the payoff’s pace when the dealer has none', () => {
    const game = riggedGame([card(10), card(1), card(9), card(9)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(plan(game.takeInsurance())).slice(0, 3)).toEqual([
      ['insuranceTaken', P],
      ['insuranceLost', Y],
      ['dealerChecked', 0],
    ]);
  });

  it("turns the hole card and announces the dealer's blackjack when it finds one", () => {
    const game = riggedGame([card(10), card(1), card(9), card(13)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(shape(plan(game.declineInsurance())).slice(0, 3)).toEqual([
      ['insuranceDeclined', 0],
      ['reveal', D],
      ['message', D],
    ]);
  });
});

describe('cutting the facts into units', () => {
  it('keeps a decision with what it led to, and starts a new unit at the next decision', () => {
    const game = twoSeats([card(10), card(10, 1), card(10, 2), card(9), card(2), card(7), card(5)], hand =>
      hand.total < 17 ? ACTION.hit : ACTION.stand,
    );
    game.startRound([{ seat: 1, bet: 10 }]);
    const kinds = segment(game.act(ACTION.stand)).map(u => (u.kind === 'decision' ? `decision:${u.action}` : u.kind));
    expect(kinds.slice(0, 5)).toEqual(['decision:stand', 'turn', 'decision:hit', 'decision:stand', 'dealer']);
  });
});
